import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { computeQuote } from "@/lib/pricing";
import { evaluateDiscount } from "@/lib/discounts";
import { cancelUnpaidOrder, createPendingOrder, findOrderForViewer, markOrderPaid, CheckoutError } from "@/lib/orders";
import { address, cart, inv, resetDb, seedCatalog } from "./helpers";

beforeEach(resetDb);

async function pending(stock = 10, quantity = 2) {
  const s = await seedCatalog({ stock });
  const c = await cart([{ variantId: s.a.id, quantity }]);
  const p = await createPendingOrder({ cartId: c.id, items: [{ variantId: s.a.id, quantity }], email: "Buyer@Test.dev", userId: null, country: "IT", shippingRateId: s.rate.id, termsVersion: "v1", marketingOptIn: false });
  return { ...s, ...p, cartId: c.id };
}

const pay = (orderId: string, amountCents: number, ref = "pi_1") =>
  markOrderPaid(orderId, { provider: "stripe", providerRef: ref, amountCents, currency: "eur", customerName: "Mario", shippingAddress: address });

describe("pricing", () => {
  it("uses database prices and computes totals on the server", async () => {
    const { a } = await seedCatalog({ price: 1999 });
    const q = await computeQuote({ items: [{ variantId: a.id, quantity: 3 }], country: "IT" });
    expect(q.subtotalCents).toBe(5997);
    expect(q.shippingCents).toBe(490);
    expect(q.totalCents).toBe(6487);
    expect(q.vatIncludedCents).toBe(Math.round(6487 - 6487 / 1.22));
  });

  it("flags unsupported shipping countries and over-quantity lines", async () => {
    const { a } = await seedCatalog({ stock: 2 });
    const q = await computeQuote({ items: [{ variantId: a.id, quantity: 5 }], country: "FR" });
    expect(q.canCheckout).toBe(false);
    expect(q.problems.join(" ")).toMatch(/Only 2 available/);
    expect(q.problems.join(" ")).toMatch(/do not ship/);
  });

  it("validates discount codes", () => {
    const base = { id: "d", code: "X", description: null, minSubtotalCents: 1000, maxRedemptions: 1, redemptionCount: 0, startsAt: null, endsAt: null, active: true, createdAt: new Date(), updatedAt: new Date() };
    expect(evaluateDiscount({ ...base, type: "PERCENT", value: 10 }, 2499)).toMatchObject({ ok: true, amountCents: 249 });
    expect(evaluateDiscount({ ...base, type: "FIXED", value: 5000 }, 2000)).toMatchObject({ ok: true, amountCents: 2000 });
    expect(evaluateDiscount({ ...base, type: "PERCENT", value: 10 }, 500).ok).toBe(false);
    expect(evaluateDiscount({ ...base, type: "PERCENT", value: 10, redemptionCount: 1 }, 5000).ok).toBe(false);
    expect(evaluateDiscount({ ...base, type: "PERCENT", value: 10, endsAt: new Date(Date.now() - 1000) }, 5000).ok).toBe(false);
    expect(evaluateDiscount({ ...base, type: "PERCENT", value: 10, active: false }, 5000).ok).toBe(false);
  });
});

describe("guest checkout & payment confirmation", () => {
  it("creates a pending order with server totals and reserved stock", async () => {
    const { order, a } = await pending(10, 2);
    expect(order.paymentStatus).toBe("UNPAID");
    expect(order.email).toBe("buyer@test.dev");
    expect(order.totalCents).toBe(2 * 2490 + 490);
    expect((await inv(a.id)).reservedQuantity).toBe(2);
  });

  it("rejects checkout when stock is insufficient", async () => {
    await expect(pending(1, 2)).rejects.toBeInstanceOf(CheckoutError);
  });

  it("marks paid once, commits stock and empties the cart (idempotent)", async () => {
    const { order, a, cartId } = await pending(10, 2);
    const first = await pay(order.id, order.totalCents);
    const second = await pay(order.id, order.totalCents);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.paymentStatus).toBe("PAID");
    expect(o.status).toBe("CONFIRMED");
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
    const i = await inv(a.id);
    expect(i.reservedQuantity).toBe(0);
    expect(i.pendingDeductionQuantity).toBe(2);
    expect(await prisma.cartItem.count({ where: { cartId } })).toBe(0);
    expect(await prisma.emailLog.count({ where: { template: "order_confirmation" } })).toBe(1);
  });

  it("flags amount mismatches for admin attention", async () => {
    const { order } = await pending();
    await pay(order.id, 100);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("REQUIRES_ATTENTION");
  });

  it("handles payment arriving after the reservation expired and stock is gone", async () => {
    const { order, a } = await pending(2, 2);
    await cancelUnpaidOrder(order.id, "expired");
    await prisma.inventory.update({ where: { variantId: a.id }, data: { supplierQuantity: 0 } });
    await pay(order.id, order.totalCents);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.paymentStatus).toBe("PAID");
    expect(o.status).toBe("REQUIRES_ATTENTION");
    expect((await inv(a.id)).pendingDeductionQuantity).toBe(0);
  });

  it("payment failure releases the reservation", async () => {
    const { order, a } = await pending(5, 2);
    await cancelUnpaidOrder(order.id, "failed");
    expect((await inv(a.id)).reservedQuantity).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("FAILED");
  });

  it("only lets the owner or token holder view an order", async () => {
    const { order, accessToken } = await pending();
    expect(await findOrderForViewer(order.number, { token: accessToken })).not.toBeNull();
    expect(await findOrderForViewer(order.number, { token: "wrong" })).toBeNull();
    expect(await findOrderForViewer(order.number, { userId: "someone-else" })).toBeNull();
  });
});
