import "server-only";
import type Stripe from "stripe";
import { prisma } from "../db";
import { cancelUnpaidOrder, markOrderPaid } from "../orders";
import { logIntegration } from "../audit";
import { applyRefundResult } from ".";

type Addr = Stripe.Address | null | undefined;

function toAddress(name: string | null | undefined, a: Addr) {
  if (!a) return null;
  return {
    name: name ?? null,
    line1: a.line1 ?? null,
    line2: a.line2 ?? null,
    city: a.city ?? null,
    postalCode: a.postal_code ?? null,
    state: a.state ?? null,
    country: a.country ?? null,
  };
}

async function orderIdForSession(session: Stripe.Checkout.Session) {
  const fromMeta = session.metadata?.orderId ?? session.client_reference_id;
  const order = await prisma.order.findFirst({
    where: { OR: [{ stripeCheckoutSessionId: session.id }, ...(fromMeta ? [{ id: fromMeta }] : [])] },
    select: { id: true },
  });
  return order?.id ?? null;
}

async function handlePaidSession(session: Stripe.Checkout.Session) {
  const orderId = await orderIdForSession(session);
  if (!orderId) throw new Error(`No order for checkout session ${session.id}`);
  const shipping = session.collected_information?.shipping_details;
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  await markOrderPaid(orderId, {
    provider: "stripe",
    providerRef: paymentIntent ?? session.id,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "eur",
    customerName: shipping?.name ?? session.customer_details?.name ?? null,
    phone: session.customer_details?.phone ?? null,
    shippingAddress: toAddress(shipping?.name ?? session.customer_details?.name, shipping?.address ?? session.customer_details?.address),
    billingAddress: toAddress(session.customer_details?.name, session.customer_details?.address),
  });
}

/**
 * Processes a signature-verified Stripe event exactly once.
 * Duplicate deliveries are detected through the unique (provider, eventId) constraint.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: "stripe", eventId: event.id } },
  });
  if (existing?.status === "processed" || existing?.status === "ignored") return "duplicate";
  if (!existing) {
    try {
      await prisma.webhookEvent.create({ data: { provider: "stripe", eventId: event.id, type: event.type } });
    } catch {
      return "duplicate"; // a concurrent delivery claimed it
    }
  }

  let outcome: "processed" | "ignored" = "processed";
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.payment_status === "paid" || session.payment_status === "no_payment_required") await handlePaidSession(session);
        // "unpaid": delayed payment method — wait for async_payment_succeeded.
        break;
      }
      case "checkout.session.async_payment_succeeded":
        await handlePaidSession(event.data.object);
        break;
      case "checkout.session.async_payment_failed": {
        const id = await orderIdForSession(event.data.object);
        if (id) await cancelUnpaidOrder(id, "failed");
        break;
      }
      case "checkout.session.expired": {
        const id = await orderIdForSession(event.data.object);
        if (id) await cancelUnpaidOrder(id, "expired");
        break;
      }
      case "refund.created":
      case "refund.updated": {
        const r = event.data.object;
        const localId = r.metadata?.localRefundId;
        const local =
          (localId ? await prisma.refund.findUnique({ where: { id: localId } }) : null) ??
          (await prisma.refund.findUnique({ where: { providerRefundId: r.id } }));
        if (local) {
          const status = r.status === "succeeded" ? "SUCCEEDED" : r.status === "failed" || r.status === "canceled" ? "FAILED" : "PENDING";
          await applyRefundResult(local.id, r.id, status);
        } else {
          // Refund issued directly in the Stripe dashboard: record it against the order.
          const pi = typeof r.payment_intent === "string" ? r.payment_intent : r.payment_intent?.id;
          const order = pi ? await prisma.order.findUnique({ where: { stripePaymentIntentId: pi }, include: { payments: true } }) : null;
          if (order && r.amount > 0) {
            const created = await prisma.refund.create({
              data: { orderId: order.id, paymentId: order.payments[0]?.id, amountCents: r.amount, reason: "Issued in Stripe dashboard" },
            });
            const status = r.status === "succeeded" ? "SUCCEEDED" : r.status === "failed" || r.status === "canceled" ? "FAILED" : "PENDING";
            await applyRefundResult(created.id, r.id, status);
          }
        }
        break;
      }
      default:
        outcome = "ignored";
    }
    await prisma.webhookEvent.update({
      where: { provider_eventId: { provider: "stripe", eventId: event.id } },
      data: { status: outcome, processedAt: new Date(), error: null },
    });
    return outcome;
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { provider_eventId: { provider: "stripe", eventId: event.id } },
      data: { status: "failed", error: String(err).slice(0, 1000) },
    });
    await logIntegration("stripe", "error", event.type, String(err));
    throw err; // non-2xx → Stripe retries
  }
}
