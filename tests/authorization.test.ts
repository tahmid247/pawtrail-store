import { beforeEach, describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { checkStaffAccess } from "@/lib/session";
import { createPendingOrder, markOrderPaid } from "@/lib/orders";
import { issueRefund, submitToSupplier } from "@/app/admin/actions/orders";
import { updateInventory } from "@/app/admin/actions/store";
import { address, cart, requestState, resetDb, seedCatalog } from "./helpers";
import { GET as cron } from "@/app/api/cron/[job]/route";
import { GET as exportData } from "@/app/api/account/export/route";
import { safeNext } from "@/lib/safe-next";

beforeEach(resetDb);

async function signIn(email: string, role: Role, twoFactor = false) {
  await auth.api.signUpEmail({ body: { email, password: "correct-horse-battery", name: "Test" } });
  await prisma.user.update({ where: { email }, data: { emailVerified: true, role } });
  const res = await auth.api.signInEmail({ body: { email, password: "correct-horse-battery" }, asResponse: true });
  const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  if (twoFactor) await prisma.user.update({ where: { email }, data: { twoFactorEnabled: true } });
  requestState.cookie = cookies;
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

async function paidOrder() {
  const s = await seedCatalog();
  const c = await cart([{ variantId: s.a.id, quantity: 1 }]);
  const { order } = await createPendingOrder({ cartId: c.id, items: [{ variantId: s.a.id, quantity: 1 }], email: "c@test.dev", userId: null, country: "IT", shippingRateId: s.rate.id, termsVersion: "v1", marketingOptIn: false });
  await markOrderPaid(order.id, { provider: "simulated", providerRef: "sim_1", amountCents: order.totalCents, currency: "eur", shippingAddress: address });
  return { ...s, order };
}

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("staff access rule", () => {
  it("requires a staff role and 2FA", () => {
    expect(checkStaffAccess(null, { require2fa: true })).toBe("unauthenticated");
    expect(checkStaffAccess({ role: "CUSTOMER", twoFactorEnabled: true }, { require2fa: true })).toBe("forbidden");
    expect(checkStaffAccess({ role: "ADMIN", twoFactorEnabled: false }, { require2fa: true })).toBe("needs-2fa");
    expect(checkStaffAccess({ role: "SUPPORT", twoFactorEnabled: true }, { adminOnly: true, require2fa: true })).toBe("forbidden");
    expect(checkStaffAccess({ role: "SUPPORT", twoFactorEnabled: true }, { require2fa: true })).toBe("ok");
    expect(checkStaffAccess({ role: "ADMIN", twoFactorEnabled: true }, { adminOnly: true, require2fa: true })).toBe("ok");
  });
});

describe("admin actions enforce authorization on the server", () => {
  it("rejects anonymous users", async () => {
    const { order } = await paidOrder();
    const r = await issueRefund(null, fd({ orderId: order.id, amount: "5", reason: "test" }));
    expect(r?.error).toMatch(/not authorized/);
    expect(await prisma.refund.count()).toBe(0);
  });

  it("rejects customers", async () => {
    const { a } = await paidOrder();
    await signIn("cust@test.dev", "CUSTOMER", true);
    const r = await updateInventory(null, fd({ variantId: a.id, supplierQuantity: "999", source: "MANUAL" }));
    expect(r?.error).toMatch(/not authorized/);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { variantId: a.id } })).supplierQuantity).toBe(10);
  });

  it("rejects admins without 2FA", async () => {
    const { order } = await paidOrder();
    await signIn("admin-no2fa@test.dev", "ADMIN", false);
    expect((await issueRefund(null, fd({ orderId: order.id, amount: "5", reason: "test" })))?.error).toMatch(/not authorized/);
  });

  it("lets support staff fulfil but not refund", async () => {
    const { order } = await paidOrder();
    await signIn("support@test.dev", "SUPPORT", true);
    expect((await issueRefund(null, fd({ orderId: order.id, amount: "5", reason: "test" })))?.error).toMatch(/not authorized/);
    const r = await submitToSupplier(null, fd({ orderId: order.id }));
    expect(r?.ok).toBe(true);
  });

  it("lets a 2FA admin refund, validates the amount, and audits it", async () => {
    const { order } = await paidOrder();
    const admin = await signIn("admin@test.dev", "ADMIN", true);
    const tooMuch = await issueRefund(null, fd({ orderId: order.id, amount: "9999", reason: "test" }));
    expect(tooMuch?.error).toMatch(/Refund amount/);
    const r = await issueRefund(null, fd({ orderId: order.id, amount: "5.00", reason: "Goodwill" }));
    expect(r?.ok).toBe(true);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.refundedCents).toBe(500);
    expect(o.paymentStatus).toBe("PARTIALLY_REFUNDED");
    expect(await prisma.auditLog.count({ where: { actorId: admin.id, action: "order.refund" } })).toBe(1);
  });
});

describe("endpoint protection", () => {
  it("cron endpoints require the secret", async () => {
    const params = { params: Promise.resolve({ job: "low-stock" }) };
    expect((await cron(new Request("http://x/api/cron/low-stock"), params)).status).toBe(401);
    expect((await cron(new Request("http://x/api/cron/low-stock", { headers: { authorization: "Bearer wrong" } }), params)).status).toBe(401);
    expect((await cron(new Request("http://x/api/cron/low-stock", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }), params)).status).toBe(200);
  });

  it("data export requires a session and returns only the caller's data", async () => {
    expect((await exportData()).status).toBe(401);
    await signIn("me@test.dev", "CUSTOMER");
    const body = JSON.parse(await (await exportData()).text());
    expect(body.user.email).toBe("me@test.dev");
  });

  it("post-login redirects are restricted to same-site paths", () => {
    expect(safeNext("/account/orders")).toBe("/account/orders");
    expect(safeNext("https://evil.example")).toBe("/account");
    expect(safeNext("//evil.example")).toBe("/account");
    expect(safeNext("/\\evil.example")).toBe("/account");
  });
});
