import "server-only";
import { prisma } from "../db";
import { env } from "../env";
import { audit } from "../audit";
import { sendEmail } from "../email";
import { formatMoney } from "../money";
import { getSettings } from "../settings";
import { cancelUnpaidOrder, type PendingOrder } from "../orders";
import { stripeProvider } from "./stripe";
import { simulatedProvider } from "./simulated";
import type { PaymentProvider } from "./types";

/** Stripe when configured; the simulator only outside production (until Stripe keys are added). */
export function getPaymentProvider(): PaymentProvider | null {
  if (env.stripeSecretKey) return stripeProvider;
  if (!env.isProduction && process.env.PAYMENT_SIMULATOR !== "false") return simulatedProvider;
  return null;
}

/** Blends hex colour `b` into `a` by `amount` (0–1). */
function mixHex(a: string, b: string, amount: number) {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return "#" + [0, 1, 2].map((i) => Math.round(ch(a, i) * (1 - amount) + ch(b, i) * amount).toString(16).padStart(2, "0")).join("");
}

export async function startPaymentSession(pending: PendingOrder) {
  const provider = getPaymentProvider();
  if (!provider) {
    await cancelUnpaidOrder(pending.order.id, "failed");
    throw new Error("Payments are not configured yet.");
  }
  const { order, quote, accessToken } = pending;
  const successUrl = `${env.siteUrl}/checkout/success?order=${encodeURIComponent(order.number)}&token=${encodeURIComponent(accessToken)}`;
  const cancelUrl = `${env.siteUrl}/cart?cancelled=${encodeURIComponent(order.number)}`;
  const settings = await getSettings();
  try {
    const session = await provider.createCheckout({
      orderId: order.id,
      orderNumber: order.number,
      email: order.email,
      currency: order.currency,
      country: order.shippingCountry,
      lines: quote.lines.map((l) => ({
        name: l.productTitle,
        description: l.variantTitle,
        unitAmountCents: l.unitPriceCents,
        quantity: l.quantity,
        imageUrl: l.imageUrl,
      })),
      shipping: {
        name: quote.shipping!.name,
        amountCents: quote.shippingCents,
        minDays: quote.shipping!.minDeliveryDays,
        maxDays: quote.shipping!.maxDeliveryDays,
      },
      discountCents: quote.discountCents,
      successUrl,
      cancelUrl,
      // Stripe requires 30 min – 24 h; reservations outlive the session by 5 minutes.
      expiresAt: new Date(pending.reservationExpiresAt.getTime() - 5 * 60_000),
      branding: {
        displayName: settings.brand.name,
        buttonColor: settings.theme.primaryDeep,
        // Same deep lilac as the storefront page background
        backgroundColor: mixHex(settings.theme.lavender, settings.theme.primary, 0.18),
        logoUrl: settings.brand.logoUrl ? new URL(settings.brand.logoUrl, env.siteUrl).toString() : null,
        iconUrl: `${env.siteUrl}/brand/checkout-icon.png`,
        submitMessage:
          `Order ${order.number} · Prices include VAT. ` +
          `You have a ${settings.commerce.withdrawalDays}-day right of withdrawal from delivery on eligible items — see ${env.siteUrl}/legal/returns.`,
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.sessionId } });
    return session.url;
  } catch (err) {
    await cancelUnpaidOrder(order.id, "failed");
    throw err;
  }
}

/** Issues a refund through the provider that took the payment. Amount is validated against what remains refundable. */
export async function refundOrder(orderId: string, amountCents: number, actorId: string, reason: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true, refunds: true } });
  const payment = order.payments.find((p) => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED");
  if (!payment) throw new Error("This order has no captured payment to refund.");
  const pendingOrDone = order.refunds.filter((r) => r.status !== "FAILED" && r.status !== "CANCELED").reduce((s, r) => s + r.amountCents, 0);
  const refundable = order.totalCents - pendingOrDone;
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > refundable) {
    throw new Error(`Refund amount must be between 0.01 and ${formatMoney(refundable, order.currency)}.`);
  }
  const provider = payment.provider === "stripe" ? stripeProvider : simulatedProvider;

  const refund = await prisma.refund.create({
    data: { orderId, paymentId: payment.id, amountCents, reason, createdById: actorId },
  });
  try {
    const result = await provider.refund(payment.providerRef, amountCents, refund.id);
    await applyRefundResult(refund.id, result.refundId, result.status);
  } catch (err) {
    await prisma.refund.update({ where: { id: refund.id }, data: { status: "FAILED" } });
    throw err;
  }
  await audit(actorId, "order.refund", "Order", orderId, { amountCents, reason, refundId: refund.id });
  return refund;
}

/** Updates refund + order totals. Shared by admin refunds and provider webhooks (idempotent). */
export async function applyRefundResult(refundId: string, providerRefundId: string, status: "PENDING" | "SUCCEEDED" | "FAILED") {
  await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId } });
    const wasSucceeded = refund.status === "SUCCEEDED";
    await tx.refund.update({ where: { id: refundId }, data: { providerRefundId, status } });
    if (status === "SUCCEEDED" && !wasSucceeded) {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${refund.orderId} FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: refund.orderId } });
      const refundedCents = Math.min(order.totalCents, order.refundedCents + refund.amountCents);
      const full = refundedCents >= order.totalCents;
      await tx.order.update({
        where: { id: order.id },
        data: { refundedCents, paymentStatus: full ? "REFUNDED" : "PARTIALLY_REFUNDED" },
      });
      if (refund.paymentId)
        await tx.payment.update({ where: { id: refund.paymentId }, data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    }
  });
  if (status === "SUCCEEDED") {
    const refund = await prisma.refund.findUniqueOrThrow({ where: { id: refundId }, include: { order: true } });
    await sendEmail("refund_issued", refund.order.email, {
      customerName: refund.order.customerName ?? "there",
      orderNumber: refund.order.number,
      amount: formatMoney(refund.amountCents, refund.order.currency),
    }).catch(() => null);
  }
}
