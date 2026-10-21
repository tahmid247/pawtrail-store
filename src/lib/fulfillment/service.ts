import "server-only";
import { prisma } from "../db";
import { env } from "../env";
import { audit, logIntegration } from "../audit";
import { alertAdmin, sendEmail } from "../email";
import { getSettings } from "../settings";
import { availableFrom, confirmSupplierDeduction, setSupplierQuantity } from "../inventory";
import { cjLiveClient } from "./cj/client";
import { cjMockClient } from "./cj/mock";
import { SupplierApiError, type FulfillmentClient } from "./types";
import { countryName } from "../countries";

export function getCjClient(): FulfillmentClient {
  return env.cjMode === "live" ? cjLiveClient : cjMockClient;
}

export async function getCjSupplier() {
  return prisma.supplier.upsert({
    where: { code: "CJ" },
    create: { code: "CJ", name: "CJdropshipping" },
    update: {},
  });
}

const LOCK_TIMEOUT_MS = 5 * 60_000;

export class FulfillmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FulfillmentError";
  }
}

/**
 * Submits a paid order to CJ. Duplicate submissions are prevented by:
 *  1. a unique (orderId, supplierId) FulfillmentOrder row,
 *  2. an atomic claim (lockedAt) so concurrent calls cannot both submit,
 *  3. refusing to resubmit once an external order id exists,
 *  4. using our order number as CJ's orderNumber (CJ-side de-duplication).
 */
export async function submitFulfillment(orderId: string, actorId: string | null) {
  const settings = await getSettings();
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });

  if (order.paymentStatus !== "PAID") throw new FulfillmentError("Only paid orders can be fulfilled.");
  if (order.status !== "CONFIRMED") throw new FulfillmentError(`Order status is ${order.status}; resolve it before fulfillment.`);
  if (!["UNFULFILLED", "FAILED"].includes(order.fulfillmentStatus)) throw new FulfillmentError("Order has already been submitted for fulfillment.");

  const supplier = await getCjSupplier();
  const fo = await prisma.fulfillmentOrder.upsert({
    where: { orderId_supplierId: { orderId, supplierId: supplier.id } },
    create: { orderId, supplierId: supplier.id },
    update: {},
  });

  const claimed = await prisma.fulfillmentOrder.updateMany({
    where: {
      id: fo.id,
      externalOrderId: null,
      status: { in: ["UNFULFILLED", "FAILED"] },
      OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - LOCK_TIMEOUT_MS) } }],
    },
    data: { lockedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count === 0) throw new FulfillmentError("A submission for this order is already in progress or complete.");

  const fail = async (message: string, retryable: boolean) => {
    await prisma.$transaction([
      prisma.fulfillmentOrder.update({ where: { id: fo.id }, data: { status: "FAILED", lastError: message, lockedAt: null } }),
      prisma.order.update({ where: { id: orderId }, data: { fulfillmentStatus: "FAILED" } }),
    ]);
    await logIntegration("cj", "error", "create_order", message, { orderId, details: { retryable } });
    await alertAdmin(`Fulfillment failed for ${order.number}`, `${message}\nRetry from Admin → Orders → ${order.number}.`);
    throw new FulfillmentError(message);
  };

  // Pre-flight validation (no request is sent when data is incomplete).
  const missing = order.items.filter((i) => !i.cjVariantId);
  if (missing.length) return fail(`Missing CJ variant mapping for: ${missing.map((i) => i.sku).join(", ")}`, false);
  if (!settings.fulfillment.cjLogisticName || !settings.fulfillment.cjFromCountryCode)
    return fail("CJ logistic name and warehouse country must be configured in Settings → Fulfillment.", false);
  const addr = order.shippingAddress as Record<string, string | null> | null;
  if (!addr?.line1 || !addr.city || !addr.postalCode || !addr.country) return fail("Order has no complete shipping address.", false);

  try {
    const client = getCjClient();
    const result = await client.createOrder({
      orderNumber: order.number,
      email: order.email,
      phone: order.phone ?? "",
      shipping: {
        name: addr.name ?? order.customerName ?? "",
        line1: addr.line1,
        line2: addr.line2 ?? null,
        city: addr.city,
        province: addr.state ?? null,
        postalCode: addr.postalCode,
        countryCode: addr.country,
        countryName: countryName(addr.country),
      },
      logisticName: settings.fulfillment.cjLogisticName,
      fromCountryCode: settings.fulfillment.cjFromCountryCode,
      storageId: settings.fulfillment.cjStorageId || null,
      remark: `Use prepaid private inventory. Store order ${order.number}.`,
      products: order.items.map((i) => ({ vid: i.cjVariantId!, quantity: i.quantity })),
    });

    await prisma.$transaction([
      prisma.fulfillmentOrder.update({
        where: { id: fo.id },
        data: {
          status: "AWAITING_SUPPLIER_CONFIRMATION",
          externalOrderId: result.externalOrderId,
          externalOrderNumber: result.externalOrderNumber,
          submittedAt: new Date(),
          lockedAt: null,
          lastError: null,
          lastResponse: { mode: client.mode, orderId: result.externalOrderId },
        },
      }),
      prisma.order.update({ where: { id: orderId }, data: { fulfillmentStatus: "AWAITING_SUPPLIER_CONFIRMATION" } }),
    ]);
    await logIntegration("cj", "info", "create_order", `Created CJ order ${result.externalOrderId} (${client.mode})`, { orderId });
    await audit(actorId, "fulfillment.submit", "Order", orderId, { externalOrderId: result.externalOrderId, mode: client.mode });
    return result;
  } catch (err) {
    if (err instanceof FulfillmentError) throw err;
    const retryable = err instanceof SupplierApiError ? err.retryable : true;
    return fail(err instanceof Error ? err.message : String(err), retryable);
  }
}

/** Admin-assisted: the order was placed manually in the CJ dashboard. */
export async function recordManualSubmission(orderId: string, externalOrderId: string, actorId: string) {
  const supplier = await getCjSupplier();
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.paymentStatus !== "PAID") throw new FulfillmentError("Only paid orders can be fulfilled.");
  await prisma.$transaction([
    prisma.fulfillmentOrder.upsert({
      where: { orderId_supplierId: { orderId, supplierId: supplier.id } },
      create: { orderId, supplierId: supplier.id, status: "AWAITING_SUPPLIER_CONFIRMATION", externalOrderId, submittedAt: new Date() },
      update: { status: "AWAITING_SUPPLIER_CONFIRMATION", externalOrderId, submittedAt: new Date(), lastError: null, lockedAt: null },
    }),
    prisma.order.update({ where: { id: orderId }, data: { fulfillmentStatus: "AWAITING_SUPPLIER_CONFIRMATION" } }),
  ]);
  await audit(actorId, "fulfillment.manual_submit", "Order", orderId, { externalOrderId });
}

/**
 * Marks that CJ accepted the order and deducted our prepaid units (verified in the CJ dashboard,
 * or detected automatically when CJ reports the order as paid/processing). Idempotent.
 */
export async function confirmSupplierAccepted(orderId: string, actorId: string | null) {
  await prisma.$transaction(async (tx) => {
    const fo = await tx.fulfillmentOrder.findFirst({ where: { orderId } });
    if (!fo) throw new FulfillmentError("Order has not been submitted to the supplier.");
    const claimed = await tx.fulfillmentOrder.updateMany({
      where: { id: fo.id, confirmedAt: null },
      data: { confirmedAt: new Date(), status: "PROCESSING" },
    });
    if (claimed.count === 0) return;
    const items = await tx.orderItem.findMany({ where: { orderId, variantId: { not: null } } });
    await confirmSupplierDeduction(tx, orderId, items.map((i) => ({ variantId: i.variantId!, quantity: i.quantity })));
    await tx.order.updateMany({
      where: { id: orderId, fulfillmentStatus: { in: ["SUBMITTED", "AWAITING_SUPPLIER_CONFIRMATION"] } },
      data: { fulfillmentStatus: "PROCESSING" },
    });
    await tx.auditLog.create({ data: { actorId, action: "fulfillment.supplier_confirmed", entityType: "Order", entityId: orderId } });
  });
}

/** Adds a shipment (from CJ sync or entered by an admin) and notifies the customer once per tracking number. */
export async function recordShipment(
  orderId: string,
  data: { trackingNumber: string; carrier?: string | null; trackingUrl?: string | null },
  actorId: string | null,
) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { fulfillmentOrders: true } });
  const existing = await prisma.shipment.findUnique({ where: { orderId_trackingNumber: { orderId, trackingNumber: data.trackingNumber } } });
  if (existing) return existing;

  // Shipping implies the supplier used the stock.
  if (order.fulfillmentOrders[0] && !order.fulfillmentOrders[0].confirmedAt) await confirmSupplierAccepted(orderId, actorId);

  const shipment = await prisma.shipment.create({
    data: {
      orderId,
      fulfillmentOrderId: order.fulfillmentOrders[0]?.id ?? null,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier ?? null,
      trackingUrl: data.trackingUrl ?? null,
      shippedAt: new Date(),
    },
  });
  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { fulfillmentStatus: "SHIPPED" } }),
    prisma.fulfillmentOrder.updateMany({ where: { orderId }, data: { status: "SHIPPED" } }),
  ]);
  await audit(actorId, "fulfillment.shipment_added", "Order", orderId, { trackingNumber: data.trackingNumber });
  await sendEmail("order_shipped", order.email, {
    customerName: order.customerName ?? "there",
    orderNumber: order.number,
    carrier: data.carrier ?? "—",
    trackingNumber: data.trackingNumber,
    trackingUrl: data.trackingUrl ?? "",
    orderUrl: `${env.siteUrl}/account/orders/${order.number}`,
  }).catch(() => null);
  return shipment;
}

export async function markDelivered(orderId: string, actorId: string | null) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.fulfillmentStatus === "DELIVERED") return;
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { fulfillmentStatus: "DELIVERED", status: order.status === "CONFIRMED" ? "COMPLETED" : order.status, completedAt: new Date() },
    }),
    prisma.fulfillmentOrder.updateMany({ where: { orderId }, data: { status: "DELIVERED" } }),
    prisma.shipment.updateMany({ where: { orderId, deliveredAt: null }, data: { status: "delivered", deliveredAt: new Date() } }),
  ]);
  await audit(actorId, "fulfillment.delivered", "Order", orderId);
  await sendEmail("order_delivered", order.email, {
    customerName: order.customerName ?? "there",
    orderNumber: order.number,
    orderUrl: `${env.siteUrl}/account/orders/${order.number}`,
  }).catch(() => null);
}

const ACCEPTED_STATUSES = ["UNSHIPPED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"];

/** Polls CJ for order progress and tracking. Run from the cron endpoint. */
export async function syncFulfillmentUpdates() {
  const client = getCjClient();
  const open = await prisma.fulfillmentOrder.findMany({
    where: { externalOrderId: { not: null }, status: { in: ["AWAITING_SUPPLIER_CONFIRMATION", "PROCESSING", "SHIPPED", "SUBMITTED"] } },
    include: { shipments: true },
    take: 100,
  });
  let updated = 0;
  for (const fo of open) {
    try {
      const status = await client.getOrder(fo.externalOrderId!);
      if (!status) continue;
      if (status.status === "CANCELLED") {
        await prisma.$transaction([
          prisma.fulfillmentOrder.update({ where: { id: fo.id }, data: { status: "FAILED", lastError: "Cancelled at supplier" } }),
          prisma.order.update({ where: { id: fo.orderId }, data: { fulfillmentStatus: "FAILED", status: "REQUIRES_ATTENTION" } }),
        ]);
        await alertAdmin("Supplier cancelled an order", `CJ order ${fo.externalOrderId} was cancelled. Review the order.`);
        continue;
      }
      if (ACCEPTED_STATUSES.includes(status.status) && !fo.confirmedAt) await confirmSupplierAccepted(fo.orderId, null);
      if (status.trackingNumber) {
        await recordShipment(fo.orderId, { trackingNumber: status.trackingNumber, carrier: status.logisticName, trackingUrl: status.trackingUrl }, null);
      }
      for (const s of await prisma.shipment.findMany({ where: { fulfillmentOrderId: fo.id, deliveredAt: null } })) {
        const tracking = await client.getTracking(s.trackingNumber);
        if (!tracking) continue;
        for (const e of tracking.events) {
          await prisma.trackingEvent.upsert({
            where: { shipmentId_occurredAt_description: { shipmentId: s.id, occurredAt: e.occurredAt, description: e.description.slice(0, 500) } },
            create: { shipmentId: s.id, status: e.status, description: e.description.slice(0, 500), location: e.location, occurredAt: e.occurredAt },
            update: {},
          });
        }
        await prisma.shipment.update({ where: { id: s.id }, data: { lastCheckedAt: new Date() } });
        if (tracking.delivered || status.status === "DELIVERED") await markDelivered(fo.orderId, null);
      }
      updated++;
    } catch (err) {
      await logIntegration("cj", "error", "sync_order", err instanceof Error ? err.message : String(err), { orderId: fo.orderId });
    }
  }
  return { checked: open.length, updated };
}

/**
 * Pulls prepaid (private) inventory from CJ and applies it to mapped variants whose inventory source is CJ.
 * Product-level totals are only applied when the product has exactly one mapped variant; otherwise the
 * variant is flagged for manual entry (admin-assisted workflow).
 */
export async function syncInventoryFromSupplier(actorId: string | null = null) {
  const client = getCjClient();
  const settings = await getSettings();
  const records = await client.getPrivateInventory();
  const variants = await prisma.productVariant.findMany({
    where: { OR: [{ cjVariantId: { not: null } }, { cjProductId: { not: null } }] },
    include: { inventory: true },
  });
  const warehouse = settings.fulfillment.cjWarehouseCountryCode || null;
  const inWarehouse = (r: { warehouseCountryCode: string | null }) => !warehouse || !r.warehouseCountryCode || r.warehouseCountryCode === warehouse;

  let applied = 0;
  const flagged: string[] = [];
  for (const v of variants) {
    if (v.inventory && v.inventory.source !== "CJ") continue;
    let qty: number | null = null;
    const byVid = records.filter((r) => r.level === "variant" && inWarehouse(r) && ((v.cjVariantId && r.vid === v.cjVariantId) || (v.cjSku && r.sku === v.cjSku)));
    if (byVid.length) qty = byVid.reduce((s, r) => s + r.quantity, 0);
    else if (v.cjProductId) {
      const siblings = variants.filter((x) => x.cjProductId === v.cjProductId);
      const byPid = records.filter((r) => r.level === "product" && r.pid === v.cjProductId && inWarehouse(r));
      if (byPid.length && siblings.length === 1) qty = byPid.reduce((s, r) => s + r.quantity, 0);
    }
    if (qty == null) {
      flagged.push(v.sku);
      await prisma.inventory.upsert({
        where: { variantId: v.id },
        create: { variantId: v.id, source: "CJ", syncStatus: "unmatched", syncError: "No per-variant quantity returned by CJ; enter manually." },
        update: { syncStatus: "unmatched", syncError: "No per-variant quantity returned by CJ; enter manually.", lastSyncedAt: new Date() },
      });
      continue;
    }
    await setSupplierQuantity(v.id, qty, { reason: "cj_sync", actorId, source: "CJ", warehouse });
    applied++;
  }
  await logIntegration("cj", flagged.length ? "warn" : "info", "inventory_sync", `Applied ${applied} variant(s); unmatched: ${flagged.join(", ") || "none"}`);
  await checkLowStock();
  return { applied, flagged, records: records.length };
}

/** Alerts the admin (at most once per day per variant) when available prepaid stock is at or below its threshold. */
export async function checkLowStock() {
  const rows = await prisma.inventory.findMany({ include: { variant: { include: { product: true } } } });
  const now = new Date();
  const low = rows.filter(
    (r) =>
      r.variant.active &&
      availableFrom(r) <= r.lowStockThreshold &&
      (!r.lowStockAlertedAt || now.getTime() - r.lowStockAlertedAt.getTime() > 24 * 3600_000),
  );
  if (!low.length) return 0;
  await alertAdmin(
    "Low prepaid inventory",
    low.map((r) => `${r.variant.product.title} — ${r.variant.title} (${r.variant.sku}): ${availableFrom(r)} available`).join("\n") +
      "\n\nPurchase more prepaid inventory from CJdropshipping before stock runs out.",
  );
  await prisma.inventory.updateMany({ where: { id: { in: low.map((r) => r.id) } }, data: { lowStockAlertedAt: now } });
  return low.length;
}

export { fulfillmentLabel } from "./labels";
