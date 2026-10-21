import "server-only";
import type { DiscountCode } from "@prisma/client";
import { prisma, type Tx } from "./db";

export type DiscountResult =
  | { ok: true; code: DiscountCode; amountCents: number }
  | { ok: false; reason: string };

export function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** Pure calculation — validated & unit tested. */
export function evaluateDiscount(code: DiscountCode | null, subtotalCents: number, now = new Date()): DiscountResult {
  if (!code || !code.active) return { ok: false, reason: "This discount code is not valid." };
  if (code.startsAt && code.startsAt > now) return { ok: false, reason: "This discount code is not active yet." };
  if (code.endsAt && code.endsAt < now) return { ok: false, reason: "This discount code has expired." };
  if (code.maxRedemptions != null && code.redemptionCount >= code.maxRedemptions)
    return { ok: false, reason: "This discount code has reached its usage limit." };
  if (subtotalCents < code.minSubtotalCents)
    return { ok: false, reason: "Your order does not meet the minimum amount for this code." };
  const raw = code.type === "PERCENT" ? Math.floor((subtotalCents * code.value) / 100) : code.value;
  const amountCents = Math.max(0, Math.min(raw, subtotalCents));
  return { ok: true, code, amountCents };
}

export async function findDiscount(code: string | null | undefined) {
  if (!code) return null;
  return prisma.discountCode.findUnique({ where: { code: normalizeCode(code) } });
}

/** Atomically counts a redemption; respects the max-redemption limit under concurrency. */
export async function redeemDiscount(tx: Tx, discountCodeId: string) {
  return tx.$executeRaw`
    UPDATE "DiscountCode" SET "redemptionCount" = "redemptionCount" + 1, "updatedAt" = now()
     WHERE "id" = ${discountCodeId} AND ("maxRedemptions" IS NULL OR "redemptionCount" < "maxRedemptions")`;
}
