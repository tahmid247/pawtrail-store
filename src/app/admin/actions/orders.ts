"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { cancelOrderByAdmin } from "@/lib/orders";
import { refundOrder } from "@/lib/payments";
import { confirmSupplierAccepted, markDelivered, recordManualSubmission, recordShipment, submitFulfillment } from "@/lib/fulfillment/service";
import { guarded, toCents } from "./guard";
import type { AdminResult } from "../result";

const id = (fd: FormData) => z.string().min(1).max(64).parse(fd.get("orderId"));
const done = (orderId: string) => revalidatePath(`/admin/orders/${orderId}`);

export async function submitToSupplier(_p: AdminResult, fd: FormData) {
  return guarded({}, async (u) => {
    const orderId = id(fd);
    const r = await submitFulfillment(orderId, u.id);
    done(orderId);
    return `Submitted to CJ (order ${r.externalOrderId}). Verify in the CJ dashboard that prepaid inventory was used, then confirm below.`;
  });
}

export async function recordManualCjOrder(_p: AdminResult, fd: FormData) {
  return guarded({}, async (u) => {
    const orderId = id(fd);
    const ext = z.string().trim().min(3).max(100).parse(fd.get("externalOrderId"));
    await recordManualSubmission(orderId, ext, u.id);
    done(orderId);
    return "CJ order recorded.";
  });
}

export async function confirmSupplier(_p: AdminResult, fd: FormData) {
  return guarded({}, async (u) => {
    const orderId = id(fd);
    await confirmSupplierAccepted(orderId, u.id);
    done(orderId);
    return "Marked as accepted by supplier; prepaid stock deducted.";
  });
}

export async function addShipment(_p: AdminResult, fd: FormData) {
  return guarded({}, async (u) => {
    const orderId = id(fd);
    const data = z.object({
      trackingNumber: z.string().trim().min(3).max(100),
      carrier: z.string().trim().max(100).optional(),
      trackingUrl: z.union([z.literal(""), z.url().startsWith("https://")]).optional(),
    }).parse(Object.fromEntries(fd));
    await recordShipment(orderId, { trackingNumber: data.trackingNumber, carrier: data.carrier || null, trackingUrl: data.trackingUrl || null }, u.id);
    done(orderId);
    return "Shipment added and customer notified.";
  });
}

export async function setDelivered(_p: AdminResult, fd: FormData) {
  return guarded({}, async (u) => {
    const orderId = id(fd);
    await markDelivered(orderId, u.id);
    done(orderId);
    return "Order marked as delivered.";
  });
}

export async function issueRefund(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const orderId = id(fd);
    const amount = toCents(fd.get("amount"));
    const reason = z.string().trim().min(3).max(300).parse(fd.get("reason"));
    await refundOrder(orderId, amount, u.id, reason);
    done(orderId);
    return "Refund submitted to the payment provider.";
  });
}

export async function cancelOrder(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const orderId = id(fd);
    const reason = z.string().trim().min(3).max(300).parse(fd.get("reason"));
    await cancelOrderByAdmin(orderId, u.id, reason);
    done(orderId);
    return "Order cancelled.";
  });
}

export async function updateOrderNotes(_p: AdminResult, fd: FormData) {
  return guarded({}, async (u) => {
    const orderId = id(fd);
    const notes = z.string().max(5000).parse(fd.get("adminNotes") ?? "");
    await prisma.order.update({ where: { id: orderId }, data: { adminNotes: notes || null } });
    await audit(u.id, "order.notes", "Order", orderId);
    done(orderId);
    return "Notes saved.";
  });
}

/** Clears REQUIRES_ATTENTION after the admin resolved the issue (e.g. restocked). Only permitted transition. */
export async function resolveAttention(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const orderId = id(fd);
    const res = await prisma.order.updateMany({ where: { id: orderId, status: "REQUIRES_ATTENTION", paymentStatus: "PAID" }, data: { status: "CONFIRMED" } });
    if (res.count === 0) throw new Error("Order is not awaiting attention.");
    await audit(u.id, "order.attention_resolved", "Order", orderId);
    done(orderId);
    return "Order returned to normal processing.";
  });
}

export async function markFulfillmentCancelled(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const orderId = id(fd);
    await prisma.$transaction(async (tx) => {
      const fo = await tx.fulfillmentOrder.findFirst({ where: { orderId } });
      if (!fo) throw new Error("No supplier order to reset.");
      if (fo.confirmedAt) {
        // Stock was counted as deducted at the supplier; it is again "paid but not deducted" for this order.
        const items = await tx.orderItem.findMany({ where: { orderId, variantId: { not: null } } });
        for (const i of items) {
          await tx.$executeRaw`UPDATE "Inventory" SET "pendingDeductionQuantity" = "pendingDeductionQuantity" + ${i.quantity} WHERE "variantId" = ${i.variantId}`;
        }
      }
      await tx.fulfillmentOrder.update({ where: { id: fo.id }, data: { status: "FAILED", externalOrderId: null, confirmedAt: null, lockedAt: null, lastError: "Cancelled at supplier (reset by admin)" } });
      await tx.order.update({ where: { id: orderId }, data: { fulfillmentStatus: "UNFULFILLED" } });
    });
    await audit(u.id, "fulfillment.reset_after_supplier_cancel", "Order", orderId);
    done(orderId);
    return "Supplier order reset; the order can now be cancelled or resubmitted.";
  });
}
