import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { eraseUser } from "@/lib/privacy";
import { runRetention } from "@/lib/retention";
import { renderTemplate } from "@/lib/email";
import { parseConsent, CONSENT_POLICY_VERSION } from "@/lib/consent";
import { rateLimit } from "@/lib/rate-limit";
import { resetDb } from "./helpers";

beforeEach(resetDb);

describe("account deletion", () => {
  it("erases personal data but keeps legally required order records unlinked", async () => {
    const id = randomUUID();
    await prisma.user.create({ data: { id, email: "gone@test.dev", name: "Gone", addresses: { create: { fullName: "G", line1: "x", city: "y", postalCode: "1", country: "IT" } } } });
    const order = await prisma.order.create({ data: { number: "WP-KEEP", userId: id, email: "gone@test.dev", subtotalCents: 1, shippingCents: 0, totalCents: 1, shippingCountry: "IT", shippingRateName: "x", paymentStatus: "PAID" } });
    await prisma.accountDeletionRequest.create({ data: { userId: id, email: "gone@test.dev" } });
    const admin = await prisma.user.create({ data: { id: randomUUID(), email: "admin@test.dev", name: "A", role: "ADMIN" } });
    await eraseUser(id, admin.id);
    expect(await prisma.auditLog.count({ where: { actorId: admin.id, action: "customer.erased" } })).toBe(1);
    expect(await prisma.user.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.address.count()).toBe(0);
    const kept = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(kept.userId).toBeNull();
  });

  it("refuses to erase staff accounts", async () => {
    const id = randomUUID();
    await prisma.user.create({ data: { id, email: "staff@test.dev", name: "S", role: "ADMIN" } });
    await expect(eraseUser(id, "admin")).rejects.toThrow(/Staff accounts/);
  });
});

describe("retention, consent and templating", () => {
  it("purges abandoned carts and old unpaid orders but keeps paid orders", async () => {
    const old = new Date(Date.now() - 200 * 86_400_000);
    await prisma.cart.create({ data: { tokenHash: "t", updatedAt: old } });
    await prisma.order.create({ data: { number: "WP-OLD-UNPAID", email: "x@test.dev", subtotalCents: 1, shippingCents: 0, totalCents: 1, shippingCountry: "IT", shippingRateName: "x", placedAt: old } });
    await prisma.order.create({ data: { number: "WP-OLD-PAID", email: "x@test.dev", subtotalCents: 1, shippingCents: 0, totalCents: 1, shippingCountry: "IT", shippingRateName: "x", placedAt: old, paymentStatus: "PAID" } });
    const r = await runRetention();
    expect(r.carts).toBe(1);
    expect(r.unpaidOrders).toBe(1);
    expect(await prisma.order.count()).toBe(1);
  });

  it("parses consent cookies strictly and re-asks after a policy change", () => {
    const good = encodeURIComponent(JSON.stringify({ v: 1, analytics: true, marketing: false, ts: 1, id: "a", policy: CONSENT_POLICY_VERSION }));
    expect(parseConsent(good)?.analytics).toBe(true);
    expect(parseConsent(encodeURIComponent(JSON.stringify({ v: 1, analytics: true, marketing: false, ts: 1, id: "a", policy: "old" })))).toBeNull();
    expect(parseConsent("garbage")).toBeNull();
  });

  it("escapes HTML in email templates", () => {
    expect(renderTemplate("Hi {{name}}", { name: "<script>x</script>" }, true)).toBe("Hi &lt;script&gt;x&lt;/script&gt;");
    expect(renderTemplate("<b>{{name}}</b>", { name: "A" }, true)).toBe("&lt;b&gt;A&lt;/b&gt;");
  });

  it("rate limits per identifier", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit("test", "1.2.3.4", 3, 60));
    expect(results).toEqual([true, true, true, false]);
    expect(await rateLimit("test", "5.6.7.8", 3, 60)).toBe(true);
  });
});
