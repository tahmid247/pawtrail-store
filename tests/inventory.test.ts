import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { availableFrom, commitOrderStock, releaseExpiredReservations, reserveForOrder, OutOfStockError } from "@/lib/inventory";
import { createPendingOrder, CheckoutError } from "@/lib/orders";
import { cart, inv, resetDb, seedCatalog } from "./helpers";

beforeEach(resetDb);

const orderFor = (email = "a@test.dev") =>
  prisma.order.create({ data: { number: `T-${Math.random()}`, email, subtotalCents: 0, shippingCents: 0, totalCents: 0, shippingCountry: "IT", shippingRateName: "x" } });

describe("inventory accounting", () => {
  it("computes availability from prepaid, reserved, pending and buffer", () => {
    expect(availableFrom({ supplierQuantity: 10, reservedQuantity: 3, pendingDeductionQuantity: 2, safetyBuffer: 1 })).toBe(4);
    expect(availableFrom({ supplierQuantity: 1, reservedQuantity: 3, pendingDeductionQuantity: 0, safetyBuffer: 0 })).toBe(0);
    expect(availableFrom(null)).toBe(0);
  });

  it("reserves stock and refuses to oversell", async () => {
    const { a } = await seedCatalog({ stock: 3 });
    const o1 = await orderFor();
    await prisma.$transaction((tx) => reserveForOrder(tx, o1.id, [{ variantId: a.id, quantity: 3 }], new Date(Date.now() + 60_000)));
    expect((await inv(a.id)).reservedQuantity).toBe(3);
    const o2 = await orderFor();
    await expect(prisma.$transaction((tx) => reserveForOrder(tx, o2.id, [{ variantId: a.id, quantity: 1 }], new Date()))).rejects.toBeInstanceOf(OutOfStockError);
  });

  it("never oversells under concurrent checkouts", async () => {
    const { a, rate } = await seedCatalog({ stock: 5 });
    const attempts = await Promise.allSettled(
      Array.from({ length: 12 }, async (_, i) => {
        const c = await cart([{ variantId: a.id, quantity: 1 }]);
        return createPendingOrder({ cartId: c.id, items: [{ variantId: a.id, quantity: 1 }], email: `c${i}@test.dev`, userId: null, country: "IT", shippingRateId: rate.id, termsVersion: "v1", marketingOptIn: false });
      }),
    );
    const ok = attempts.filter((r) => r.status === "fulfilled");
    const failed = attempts.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(5);
    expect(failed.every((f) => f.reason instanceof CheckoutError)).toBe(true);
    const i = await inv(a.id);
    expect(i.reservedQuantity).toBe(5);
    expect(availableFrom(i)).toBe(0);
  });

  it("releases expired reservations and cancels the unpaid order", async () => {
    const { a, rate } = await seedCatalog({ stock: 2 });
    const c = await cart([{ variantId: a.id, quantity: 2 }]);
    const { order } = await createPendingOrder({ cartId: c.id, items: [{ variantId: a.id, quantity: 2 }], email: "x@test.dev", userId: null, country: "IT", shippingRateId: rate.id, termsVersion: "v1", marketingOptIn: false });
    expect((await inv(a.id)).reservedQuantity).toBe(2);
    await releaseExpiredReservations(new Date(Date.now() + 24 * 3600_000));
    expect((await inv(a.id)).reservedQuantity).toBe(0);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("CANCELLED");
    expect(o.paymentStatus).toBe("EXPIRED");
  });

  it("commits reserved stock to pending deduction exactly once", async () => {
    const { a } = await seedCatalog({ stock: 4 });
    const o = await orderFor();
    await prisma.$transaction((tx) => reserveForOrder(tx, o.id, [{ variantId: a.id, quantity: 2 }], new Date(Date.now() + 60_000)));
    await prisma.$transaction((tx) => commitOrderStock(tx, o.id, [{ variantId: a.id, quantity: 2 }]));
    await prisma.$transaction((tx) => commitOrderStock(tx, o.id, [{ variantId: a.id, quantity: 2 }]));
    const i = await inv(a.id);
    expect(i.reservedQuantity).toBe(0);
    expect(i.pendingDeductionQuantity).toBe(2);
  });
});
