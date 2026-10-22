import { beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { createPendingOrder } from "@/lib/orders";
import { POST } from "@/app/api/webhooks/stripe/route";
import { cart, inv, resetDb, seedCatalog } from "./helpers";

beforeEach(resetDb);

const secret = process.env.STRIPE_WEBHOOK_SECRET!;

function signedRequest(event: object, sig?: string) {
  const payload = JSON.stringify(event);
  const header = sig ?? Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": header } });
}

async function setup() {
  const s = await seedCatalog({ stock: 5 });
  const c = await cart([{ variantId: s.a.id, quantity: 1 }]);
  const p = await createPendingOrder({ cartId: c.id, items: [{ variantId: s.a.id, quantity: 1 }], email: "w@test.dev", userId: null, country: "IT", shippingRateId: s.rate.id, termsVersion: "v1", marketingOptIn: false });
  await prisma.order.update({ where: { id: p.order.id }, data: { stripeCheckoutSessionId: "cs_test_1" } });
  return { ...s, order: p.order };
}

const completed = (orderId: string, amount: number, id = "evt_1", payment_status = "paid") => ({
  id,
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_1", object: "checkout.session", payment_status, amount_total: amount, currency: "eur", client_reference_id: orderId,
      metadata: { orderId }, payment_intent: "pi_test_1",
      customer_details: { name: "Mario Rossi", email: "w@test.dev", phone: "+390000", address: { line1: "Via Roma 1", line2: null, city: "Milano", postal_code: "20121", state: "MI", country: "IT" } },
      collected_information: { shipping_details: { name: "Mario Rossi", address: { line1: "Via Roma 1", line2: null, city: "Milano", postal_code: "20121", state: "MI", country: "IT" } } },
    },
  },
});

describe("Stripe webhook", () => {
  it("rejects requests with an invalid signature", async () => {
    const { order } = await setup();
    const res = await POST(signedRequest(completed(order.id, order.totalCents), "t=1,v1=deadbeef"));
    expect(res.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("UNPAID");
  });

  it("marks the order paid from a verified event and ignores duplicate deliveries", async () => {
    const { order, a } = await setup();
    const r1 = await POST(signedRequest(completed(order.id, order.totalCents)));
    expect(r1.status).toBe(200);
    const r2 = await POST(signedRequest(completed(order.id, order.totalCents)));
    expect(await r2.json()).toMatchObject({ result: "duplicate" });
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.paymentStatus).toBe("PAID");
    expect(o.stripePaymentIntentId).toBe("pi_test_1");
    expect((o.shippingAddress as { city: string }).city).toBe("Milano");
    expect(await prisma.payment.count()).toBe(1);
    expect((await inv(a.id)).pendingDeductionQuantity).toBe(1);
  });

  it("does not mark delayed (unpaid) sessions as paid", async () => {
    const { order } = await setup();
    await POST(signedRequest(completed(order.id, order.totalCents, "evt_2", "unpaid")));
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("UNPAID");
  });

  it("releases stock when the checkout session expires", async () => {
    const { order, a } = await setup();
    const evt = { id: "evt_exp", object: "event", type: "checkout.session.expired", data: { object: { id: "cs_test_1", object: "checkout.session", metadata: { orderId: order.id } } } };
    expect((await POST(signedRequest(evt))).status).toBe(200);
    expect((await inv(a.id)).reservedQuantity).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
  });
});

describe("Stripe refunds via webhook", () => {
  it("records a dashboard refund delivered as charge.refund.updated, and accepts a re-send of an ignored event", async () => {
    const { order } = await setup();
    await POST(signedRequest(completed(order.id, order.totalCents)));
    const refundEvent = (id: string) => ({
      id,
      object: "event",
      type: "charge.refund.updated",
      data: { object: { id: "re_test_1", object: "refund", amount: order.totalCents, status: "succeeded", payment_intent: "pi_test_1", metadata: {} } },
    });
    // simulate the event having been ignored by an older version
    await prisma.webhookEvent.create({ data: { provider: "stripe", eventId: "evt_ref", type: "charge.refund.updated", status: "ignored" } });
    const res = await POST(signedRequest(refundEvent("evt_ref")));
    expect(await res.json()).toMatchObject({ result: "processed" });
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.paymentStatus).toBe("REFUNDED");
    expect(o.refundedCents).toBe(order.totalCents);
    // a second delivery is a duplicate and does not double-refund
    expect(await (await POST(signedRequest(refundEvent("evt_ref")))).json()).toMatchObject({ result: "duplicate" });
    expect(await prisma.refund.count()).toBe(1);
  });
});
