import "server-only";
import type { Inventory } from "@prisma/client";
import { prisma, type Tx } from "./db";

/**
 * Prepaid-inventory accounting.
 *
 *   supplierQuantity          prepaid units the supplier (CJ) holds for us — from sync or manual entry
 *   reservedQuantity          units held by checkouts awaiting payment (expire automatically)
 *   pendingDeductionQuantity  units paid for but not yet confirmed as deducted at the supplier
 *   safetyBuffer              units deliberately withheld from sale to absorb sync drift
 *
 *   available = supplier − reserved − pendingDeduction − buffer
 *
 * All mutations are single conditional UPDATE statements, so concurrent checkouts can never oversell.
 */

export class OutOfStockError extends Error {
  constructor(public variantId: string, public requested: number) {
    super(`Insufficient stock for variant ${variantId}`);
    this.name = "OutOfStockError";
  }
}

export function availableFrom(inv: Pick<Inventory, "supplierQuantity" | "reservedQuantity" | "pendingDeductionQuantity" | "safetyBuffer"> | null | undefined): number {
  if (!inv) return 0;
  return Math.max(0, inv.supplierQuantity - inv.reservedQuantity - inv.pendingDeductionQuantity - inv.safetyBuffer);
}

export async function getAvailability(variantIds: string[], db: Tx | typeof prisma = prisma) {
  const rows = await db.inventory.findMany({ where: { variantId: { in: variantIds } } });
  const map = new Map<string, number>(variantIds.map((id) => [id, 0]));
  for (const r of rows) map.set(r.variantId, availableFrom(r));
  return map;
}

async function tryReserve(tx: Tx, variantId: string, quantity: number): Promise<boolean> {
  const updated = await tx.$executeRaw`
    UPDATE "Inventory"
       SET "reservedQuantity" = "reservedQuantity" + ${quantity}, "updatedAt" = now()
     WHERE "variantId" = ${variantId}
       AND "supplierQuantity" - "reservedQuantity" - "pendingDeductionQuantity" - "safetyBuffer" >= ${quantity}`;
  return updated === 1;
}

/** Reserves stock for every line of an order, or throws OutOfStockError (the caller's transaction rolls back). */
export async function reserveForOrder(
  tx: Tx,
  orderId: string,
  lines: { variantId: string; quantity: number }[],
  expiresAt: Date,
) {
  // Lock rows in a consistent order to avoid deadlocks between concurrent multi-item checkouts.
  const sorted = [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
  for (const line of sorted) {
    if (!(await tryReserve(tx, line.variantId, line.quantity))) {
      throw new OutOfStockError(line.variantId, line.quantity);
    }
    await tx.inventoryReservation.create({
      data: { orderId, variantId: line.variantId, quantity: line.quantity, expiresAt },
    });
    await tx.inventoryMovement.create({
      data: { variantId: line.variantId, field: "reserved", delta: line.quantity, reason: "checkout_reserved", reference: orderId },
    });
  }
}

/** Releases any active reservations of an order (payment expired / failed / cancelled). Idempotent. */
export async function releaseReservations(tx: Tx, orderId: string, reason: string) {
  const active = await tx.inventoryReservation.findMany({ where: { orderId, status: "ACTIVE" } });
  for (const r of active) {
    const claimed = await tx.inventoryReservation.updateMany({
      where: { id: r.id, status: "ACTIVE" },
      data: { status: "RELEASED" },
    });
    if (claimed.count === 0) continue;
    await tx.$executeRaw`
      UPDATE "Inventory" SET "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${r.quantity}), "updatedAt" = now()
       WHERE "variantId" = ${r.variantId}`;
    await tx.inventoryMovement.create({
      data: { variantId: r.variantId, field: "reserved", delta: -r.quantity, reason, reference: orderId },
    });
  }
}

/**
 * Converts reservations into "pending supplier deduction" once payment is confirmed.
 * If a reservation already expired, stock is re-checked; lines that can no longer be covered are returned
 * so the order can be flagged for admin attention (refund or restock) instead of silently overselling.
 */
export async function commitOrderStock(
  tx: Tx,
  orderId: string,
  lines: { variantId: string; quantity: number }[],
): Promise<{ shortfalls: { variantId: string; quantity: number }[] }> {
  const shortfalls: { variantId: string; quantity: number }[] = [];
  const reservations = await tx.inventoryReservation.findMany({ where: { orderId } });
  for (const line of [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
    const res = reservations.find((r) => r.variantId === line.variantId);
    if (res?.status === "CONSUMED") continue; // already committed (idempotent)
    const claimed = res
      ? await tx.inventoryReservation.updateMany({ where: { id: res.id, status: "ACTIVE" }, data: { status: "CONSUMED" } })
      : { count: 0 };
    if (claimed.count === 1) {
      await tx.$executeRaw`
        UPDATE "Inventory"
           SET "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${line.quantity}),
               "pendingDeductionQuantity" = "pendingDeductionQuantity" + ${line.quantity},
               "updatedAt" = now()
         WHERE "variantId" = ${line.variantId}`;
    } else {
      // Reservation was released (e.g. payment completed after expiry) — try to take stock again.
      const ok = await tx.$executeRaw`
        UPDATE "Inventory"
           SET "pendingDeductionQuantity" = "pendingDeductionQuantity" + ${line.quantity}, "updatedAt" = now()
         WHERE "variantId" = ${line.variantId}
           AND "supplierQuantity" - "reservedQuantity" - "pendingDeductionQuantity" - "safetyBuffer" >= ${line.quantity}`;
      if (ok !== 1) {
        shortfalls.push(line);
        continue;
      }
      if (res) await tx.inventoryReservation.update({ where: { id: res.id }, data: { status: "CONSUMED" } });
      else
        await tx.inventoryReservation.create({
          data: { orderId, variantId: line.variantId, quantity: line.quantity, status: "CONSUMED", expiresAt: new Date() },
        });
    }
    await tx.inventoryMovement.create({
      data: { variantId: line.variantId, field: "pendingDeduction", delta: line.quantity, reason: "payment_confirmed", reference: orderId },
    });
  }
  return { shortfalls };
}

/**
 * Called when the supplier confirms the prepaid units were deducted (fulfillment accepted).
 * Moves units out of pendingDeduction and lowers the local supplier quantity until the next sync.
 */
export async function confirmSupplierDeduction(tx: Tx, orderId: string, lines: { variantId: string; quantity: number }[]) {
  for (const line of lines) {
    await tx.$executeRaw`
      UPDATE "Inventory"
         SET "pendingDeductionQuantity" = GREATEST(0, "pendingDeductionQuantity" - ${line.quantity}),
             "supplierQuantity" = GREATEST(0, "supplierQuantity" - ${line.quantity}),
             "updatedAt" = now()
       WHERE "variantId" = ${line.variantId}`;
    await tx.inventoryMovement.create({
      data: { variantId: line.variantId, field: "supplier", delta: -line.quantity, reason: "supplier_deducted", reference: orderId },
    });
  }
}

/** Returns paid-but-not-deducted units to sale (order cancelled before fulfillment). */
export async function returnPendingStock(tx: Tx, orderId: string, lines: { variantId: string; quantity: number }[]) {
  for (const line of lines) {
    await tx.$executeRaw`
      UPDATE "Inventory"
         SET "pendingDeductionQuantity" = GREATEST(0, "pendingDeductionQuantity" - ${line.quantity}), "updatedAt" = now()
       WHERE "variantId" = ${line.variantId}`;
    await tx.inventoryMovement.create({
      data: { variantId: line.variantId, field: "pendingDeduction", delta: -line.quantity, reason: "order_cancelled", reference: orderId },
    });
  }
}

/** Sets the prepaid supplier quantity (from CJ sync or an admin's manual count). */
export async function setSupplierQuantity(
  variantId: string,
  quantity: number,
  opts: { reason: string; actorId?: string | null; source?: "MANUAL" | "CJ"; warehouse?: string | null },
) {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error("Quantity must be a non-negative integer");
  return prisma.$transaction(async (tx) => {
    const before = await tx.inventory.findUnique({ where: { variantId } });
    const inv = await tx.inventory.upsert({
      where: { variantId },
      create: {
        variantId,
        supplierQuantity: quantity,
        source: opts.source ?? "MANUAL",
        supplierWarehouse: opts.warehouse ?? null,
        lastSyncedAt: opts.source === "CJ" ? new Date() : null,
        syncStatus: opts.source === "CJ" ? "ok" : null,
      },
      update: {
        supplierQuantity: quantity,
        ...(opts.source ? { source: opts.source } : {}),
        ...(opts.warehouse !== undefined ? { supplierWarehouse: opts.warehouse } : {}),
        ...(opts.source === "CJ" ? { lastSyncedAt: new Date(), syncStatus: "ok", syncError: null } : {}),
      },
    });
    const delta = quantity - (before?.supplierQuantity ?? 0);
    if (delta !== 0) {
      await tx.inventoryMovement.create({
        data: { variantId, field: "supplier", delta, reason: opts.reason, actorId: opts.actorId ?? null },
      });
    }
    return inv;
  });
}

/** Releases reservations whose checkout window passed without payment. Run periodically. */
export async function releaseExpiredReservations(now = new Date()) {
  const expired = await prisma.inventoryReservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: now } },
    select: { orderId: true },
    distinct: ["orderId"],
  });
  for (const { orderId } of expired) {
    await prisma.$transaction(async (tx) => {
      // Never release stock for an order that has been paid in the meantime.
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true } });
      if (order?.paymentStatus === "PAID") return;
      await releaseReservations(tx, orderId, "reservation_expired");
      await tx.order.updateMany({
        where: { id: orderId, paymentStatus: "UNPAID", status: "PENDING_PAYMENT" },
        data: { paymentStatus: "EXPIRED", status: "CANCELLED", cancelledAt: new Date() },
      });
    });
  }
  return expired.length;
}
