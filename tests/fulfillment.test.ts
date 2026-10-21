import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createPendingOrder, markOrderPaid } from "@/lib/orders";
import { FulfillmentError, submitFulfillment, syncFulfillmentUpdates, syncInventoryFromSupplier, checkLowStock } from "@/lib/fulfillment/service";
import { cjMockClient } from "@/lib/fulfillment/cj/mock";
import { parsePrivateInventoryPage } from "@/lib/fulfillment/cj/client";
import { address, cart, inv, resetDb, seedCatalog } from "./helpers";

beforeEach(async () => {
  await resetDb();
  cjMockClient._reset();
});

async function paidOrder(qty = 1) {
  const s = await seedCatalog({ stock: 10 });
  const c = await cart([{ variantId: s.a.id, quantity: qty }]);
  const { order } = await createPendingOrder({ cartId: c.id, items: [{ variantId: s.a.id, quantity: qty }], email: "f@test.dev", userId: null, country: "IT", shippingRateId: s.rate.id, termsVersion: "v1", marketingOptIn: false });
  await markOrderPaid(order.id, { provider: "stripe", providerRef: `pi_${order.id}`, amountCents: order.totalCents, currency: "eur", customerName: "Mario", phone: "+39", shippingAddress: address });
  return { ...s, order };
}

describe("CJ fulfillment (mock client)", () => {
  it("submits a paid order once and blocks duplicate submissions", async () => {
    const { order } = await paidOrder();
    const r = await submitFulfillment(order.id, null);
    expect(r.externalOrderId).toBe(`MOCK-CJ-${order.number}`);
    await expect(submitFulfillment(order.id, null)).rejects.toBeInstanceOf(FulfillmentError);
    expect(await prisma.fulfillmentOrder.count({ where: { orderId: order.id } })).toBe(1);
    expect(cjMockClient._created.size).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).fulfillmentStatus).toBe("AWAITING_SUPPLIER_CONFIRMATION");
  });

  it("concurrent submissions create exactly one supplier order", async () => {
    const { order } = await paidOrder();
    const results = await Promise.allSettled([submitFulfillment(order.id, null), submitFulfillment(order.id, null), submitFulfillment(order.id, null)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(cjMockClient._created.size).toBe(1);
  });

  it("records failures and allows an admin retry", async () => {
    const { order } = await paidOrder();
    cjMockClient._failNext = true;
    await expect(submitFulfillment(order.id, null)).rejects.toThrow(/Mock CJ failure/);
    const failed = await prisma.fulfillmentOrder.findFirstOrThrow({ where: { orderId: order.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.lockedAt).toBeNull();
    expect(await prisma.integrationLog.count({ where: { level: "error", orderId: order.id } })).toBe(1);
    await submitFulfillment(order.id, null);
    const ok = await prisma.fulfillmentOrder.findFirstOrThrow({ where: { orderId: order.id } });
    expect(ok.attempts).toBe(2);
    expect(ok.externalOrderId).toBeTruthy();
  });

  it("refuses unpaid orders and unmapped variants", async () => {
    const s = await seedCatalog();
    const c = await cart([{ variantId: s.a.id, quantity: 1 }]);
    const { order } = await createPendingOrder({ cartId: c.id, items: [{ variantId: s.a.id, quantity: 1 }], email: "u@test.dev", userId: null, country: "IT", shippingRateId: s.rate.id, termsVersion: "v1", marketingOptIn: false });
    await expect(submitFulfillment(order.id, null)).rejects.toThrow(/Only paid orders/);
    await prisma.orderItem.updateMany({ where: { orderId: order.id }, data: { cjVariantId: null } });
    await markOrderPaid(order.id, { provider: "stripe", providerRef: "pi_x", amountCents: order.totalCents, currency: "eur", shippingAddress: address });
    await expect(submitFulfillment(order.id, null)).rejects.toThrow(/Missing CJ variant mapping/);
  });

  it("syncs supplier progress: deducts prepaid stock, records tracking, marks delivered", async () => {
    const { order, a } = await paidOrder(2);
    const { externalOrderId } = await submitFulfillment(order.id, null);
    expect((await inv(a.id)).pendingDeductionQuantity).toBe(2);

    cjMockClient._setStatus(externalOrderId, "SHIPPED", "TRACK123");
    await syncFulfillmentUpdates();
    let o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { shipments: { include: { events: true } } } });
    expect(o.fulfillmentStatus).toBe("SHIPPED");
    expect(o.shipments[0].trackingNumber).toBe("TRACK123");
    const i = await inv(a.id);
    expect(i.pendingDeductionQuantity).toBe(0);
    expect(i.supplierQuantity).toBe(8);
    expect(await prisma.emailLog.count({ where: { template: "order_shipped" } })).toBe(1);

    await syncFulfillmentUpdates(); // repeated sync must not duplicate shipments or emails
    expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.emailLog.count({ where: { template: "order_shipped" } })).toBe(1);

    cjMockClient._setStatus(externalOrderId, "DELIVERED");
    await syncFulfillmentUpdates();
    o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { shipments: { include: { events: true } } } });
    expect(o.fulfillmentStatus).toBe("DELIVERED");
    expect(o.status).toBe("COMPLETED");
    expect(o.shipments[0].events.length).toBeGreaterThan(0);
  });

  it("syncs prepaid inventory only for CJ-sourced variants and alerts on low stock", async () => {
    const { a, b } = await seedCatalog({ stock: 10 });
    await prisma.inventory.update({ where: { variantId: a.id }, data: { source: "CJ", lowStockThreshold: 5 } });
    process.env.MOCK_CJ_INVENTORY = JSON.stringify({ "VID-A": 3, "VID-B": 99 });
    const r = await syncInventoryFromSupplier();
    delete process.env.MOCK_CJ_INVENTORY;
    expect(r.applied).toBe(1);
    expect((await inv(a.id)).supplierQuantity).toBe(3);
    expect((await inv(b.id)).supplierQuantity).toBe(10); // MANUAL source untouched
    expect((await inv(a.id)).lowStockAlertedAt).not.toBeNull();
    expect(await checkLowStock()).toBe(0); // no repeat alert within 24h
  });

  it("parses CJ private-inventory pages defensively", () => {
    const spuOnly = parsePrivateInventoryPage({ list: [{ productId: "P1", totalWarehouseQuantity: 40, warehouseQuantityInfoList: [{ countryCode: "DE", warehouseQuantity: 30 }, { countryCode: "CN", warehouseQuantity: 10 }] }] });
    expect(spuOnly).toEqual([
      { vid: null, sku: null, pid: "P1", quantity: 30, warehouseCountryCode: "DE", level: "product" },
      { vid: null, sku: null, pid: "P1", quantity: 10, warehouseCountryCode: "CN", level: "product" },
    ]);
    const perSku = parsePrivateInventoryPage({ list: [{ productId: "P1", skuList: [{ vid: "V1", sku: "S1", warehouseQuantityInfoList: [{ countryCode: "DE", warehouseQuantity: "7" }] }] }] });
    expect(perSku[0]).toMatchObject({ vid: "V1", quantity: 7, level: "variant" });
    expect(parsePrivateInventoryPage(null)).toEqual([]);
  });
});
