import "server-only";
import { randomInt } from "node:crypto";
import { Prisma, type Order } from "@prisma/client";
import { prisma } from "./db";
import { randomToken, safeEqual, sha256 } from "./crypto";
import { computeQuote, type Quote } from "./pricing";
import { commitOrderStock, releaseReservations, reserveForOrder, returnPendingStock, OutOfStockError } from "./inventory";
import { redeemDiscount } from "./discounts";
import { getSettings } from "./settings";
import { sendEmail, alertAdmin } from "./email";
import { formatMoney } from "./money";
import { env } from "./env";
import { audit, logIntegration } from "./audit";
import { formatAddress } from "./order-format";

const ORDER_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";

export function generateOrderNumber(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ORDER_ALPHABET[randomInt(ORDER_ALPHABET.length)];
  return `WP-${s}`;
}

export class CheckoutError extends Error {
  constructor(message: string, public code: "empty" | "stock" | "shipping" | "disabled" | "invalid") {
    super(message);
    this.name = "CheckoutError";
  }
}

export type PendingOrder = { order: Order; accessToken: string; quote: Quote; reservationExpiresAt: Date };

/**
 * Creates an order awaiting payment and reserves its stock in one transaction.
 * Amounts come exclusively from `computeQuote` (database prices).
 */
export async function createPendingOrder(input: {
  cartId: string;
  items: { variantId: string; quantity: number }[];
  email: string;
  userId: string | null;
  country: string;
  shippingRateId?: string | null;
  discountCode?: string | null;
  termsVersion: string;
  marketingOptIn: boolean;
}): Promise<PendingOrder> {
  const settings = await getSettings();
  if (!settings.commerce.checkoutEnabled) throw new CheckoutError("Checkout is temporarily unavailable.", "disabled");
  if (input.items.length === 0) throw new CheckoutError("Your cart is empty.", "empty");

  const quote = await computeQuote({
    items: input.items,
    country: input.country,
    shippingRateId: input.shippingRateId,
    discountCode: input.discountCode,
  });
  if (!quote.shipping) throw new CheckoutError("We do not ship to the selected country yet.", "shipping");
  if (quote.problems.length) throw new CheckoutError(quote.problems.join(" "), "stock");
  if (input.discountCode && !quote.discount) throw new CheckoutError(quote.discountError ?? "Invalid discount code.", "invalid");

  const accessToken = randomToken();
  // Stripe sessions live at least 30 minutes; keep stock a little longer than the session itself.
  const reservationExpiresAt = new Date(Date.now() + (settings.commerce.reservationMinutes + 5) * 60_000);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const order = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            number: generateOrderNumber(),
            userId: input.userId,
            email: input.email.toLowerCase(),
            currency: quote.currency,
            subtotalCents: quote.subtotalCents,
            discountCents: quote.discountCents,
            shippingCents: quote.shippingCents,
            taxIncludedCents: quote.vatIncludedCents,
            totalCents: quote.totalCents,
            discountCodeId: quote.discount?.id ?? null,
            discountCodeText: quote.discount?.code ?? null,
            cartId: input.cartId,
            shippingCountry: input.country.toUpperCase(),
            shippingRateId: quote.shipping!.rateId,
            shippingRateName: quote.shipping!.name,
            shippingEstimate: quote.shipping!.estimate,
            accessTokenHash: sha256(accessToken),
            termsVersion: input.termsVersion,
            termsAcceptedAt: new Date(),
            marketingOptIn: input.marketingOptIn,
            items: {
              create: quote.lines.map((l) => ({
                variantId: l.variantId,
                productId: l.productId,
                productTitle: l.productTitle,
                variantTitle: l.variantTitle,
                sku: l.sku,
                imageUrl: l.imageUrl,
                unitPriceCents: l.unitPriceCents,
                quantity: l.quantity,
                totalCents: l.totalCents,
                cjVariantId: l.cjVariantId,
              })),
            },
          },
        });
        await reserveForOrder(
          tx,
          order.id,
          quote.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          reservationExpiresAt,
        );
        return order;
      });
      return { order, accessToken, quote, reservationExpiresAt };
    } catch (err) {
      if (err instanceof OutOfStockError) {
        throw new CheckoutError("Sorry — one of the items in your cart just sold out. Please review your cart.", "stock");
      }
      // Retry only on an order-number collision.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("Could not allocate an order number");
}

/** Cancels an unpaid order and releases its reservation (checkout abandoned / provider error). */
export async function cancelUnpaidOrder(orderId: string, reason: "expired" | "failed" | "abandoned") {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentStatus === "PAID") return;
    await releaseReservations(tx, orderId, `payment_${reason}`);
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: reason === "failed" ? "FAILED" : "EXPIRED",
        status: "CANCELLED",
        cancelledAt: order.cancelledAt ?? new Date(),
      },
    });
  });
}

export type PaymentConfirmation = {
  provider: string;
  providerRef: string;
  amountCents: number;
  currency: string;
  customerName?: string | null;
  phone?: string | null;
  shippingAddress?: Record<string, string | null> | null;
  billingAddress?: Record<string, string | null> | null;
};

/**
 * Marks an order as paid. Called only from verified payment-provider webhooks (never from a browser redirect).
 * Idempotent: the order row is locked and a second call for the same order is a no-op.
 */
export async function markOrderPaid(orderId: string, payment: PaymentConfirmation) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED" || order.paymentStatus === "PARTIALLY_REFUNDED") {
      return { order, duplicate: true, attention: [] as string[] };
    }

    const attention: string[] = [];
    if (payment.amountCents !== order.totalCents || payment.currency.toUpperCase() !== order.currency) {
      attention.push(
        `Paid amount ${payment.amountCents} ${payment.currency} does not match order total ${order.totalCents} ${order.currency}.`,
      );
    }

    const lines = order.items.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId!, quantity: i.quantity }));
    const { shortfalls } = await commitOrderStock(tx, order.id, lines);
    if (shortfalls.length) attention.push(`Insufficient stock after payment for ${shortfalls.length} line(s); refund or restock required.`);

    if (order.discountCodeId) {
      const redeemed = await redeemDiscount(tx, order.discountCodeId);
      if (redeemed === 0) attention.push("Discount code exceeded its redemption limit concurrently.");
    }

    await tx.payment.upsert({
      where: { provider_providerRef: { provider: payment.provider, providerRef: payment.providerRef } },
      create: {
        orderId: order.id,
        provider: payment.provider,
        providerRef: payment.providerRef,
        amountCents: payment.amountCents,
        currency: payment.currency.toUpperCase(),
        status: "PAID",
      },
      update: { status: "PAID" },
    });

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "PAID",
        status: attention.length ? "REQUIRES_ATTENTION" : "CONFIRMED",
        paidAt: new Date(),
        cancelledAt: null,
        customerName: payment.customerName ?? order.customerName,
        phone: payment.phone ?? order.phone,
        shippingAddress: (payment.shippingAddress ?? order.shippingAddress ?? undefined) as Prisma.InputJsonValue | undefined,
        billingAddress: (payment.billingAddress ?? order.billingAddress ?? undefined) as Prisma.InputJsonValue | undefined,
        stripePaymentIntentId: payment.provider === "stripe" ? payment.providerRef : order.stripePaymentIntentId,
        adminNotes: attention.length ? [order.adminNotes, ...attention].filter(Boolean).join("\n") : order.adminNotes,
      },
      include: { items: true },
    });

    if (order.cartId) await tx.cartItem.deleteMany({ where: { cartId: order.cartId } });
    if (order.cartId) await tx.cart.update({ where: { id: order.cartId }, data: { discountCode: null } }).catch(() => null);
    return { order: updated, duplicate: false, attention };
  });

  if (!result.duplicate) {
    await afterOrderPaid(result.order.id, result.attention);
  }
  return result;
}

async function afterOrderPaid(orderId: string, attention: string[]) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const settings = await getSettings();
  await sendEmail("order_confirmation", order.email, {
    customerName: order.customerName ?? "there",
    orderNumber: order.number,
    total: formatMoney(order.totalCents, order.currency),
    items: order.items.map((i) => `• ${i.quantity} × ${i.productTitle} — ${i.variantTitle} (${formatMoney(i.totalCents, order.currency)})`).join("\n"),
    shippingAddress: formatAddress(order.shippingAddress),
    shippingMethod: `${order.shippingRateName}${order.shippingEstimate ? ` (${order.shippingEstimate})` : ""}`,
    orderUrl: `${env.siteUrl}/account/orders/${order.number}`,
    withdrawalDays: String(settings.commerce.withdrawalDays),
  }).catch((e) => console.error("order confirmation email failed", e));

  if (order.marketingOptIn) {
    // Opt-in at checkout still goes through double opt-in confirmation.
    const { randomToken: token, sha256: hash } = await import("./crypto");
    const existing = await prisma.newsletterSubscription.findUnique({ where: { email: order.email } });
    if (existing?.status !== "CONFIRMED") {
      const t = token();
      const { NEWSLETTER_CONSENT_TEXT } = await import("./consent");
      await prisma.newsletterSubscription.upsert({
        where: { email: order.email },
        create: { email: order.email, tokenHash: hash(t), consentText: NEWSLETTER_CONSENT_TEXT, source: "checkout" },
        update: { tokenHash: hash(t), status: "PENDING", consentAt: new Date() },
      });
      await sendEmail("newsletter_confirm", order.email, { url: `${env.siteUrl}/newsletter/confirm?token=${t}` }).catch(() => null);
    }
  }

  if (attention.length) {
    await alertAdmin(`Order ${order.number} needs attention`, attention.join("\n"));
    await logIntegration("orders", "warn", "payment_attention", attention.join(" "), { orderId });
    return;
  }

  const { checkLowStock } = await import("./fulfillment/service");
  await checkLowStock().catch((e) => console.error("low stock check failed", e));

  if (settings.fulfillment.mode === "cj_api" && settings.fulfillment.autoSubmitOnPayment) {
    const { submitFulfillment } = await import("./fulfillment/service");
    await submitFulfillment(orderId, null).catch((e) => console.error("auto fulfillment failed", e));
  }
}


/** Admin cancellation. Paid orders are refunded via the payment provider; stock returns to sale if not yet deducted. */
export async function cancelOrderByAdmin(orderId: string, actorId: string, reason: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (order.status === "CANCELLED") return order;
  if (["SHIPPED", "DELIVERED"].includes(order.fulfillmentStatus)) {
    throw new Error("Shipped orders cannot be cancelled — process a return/refund instead.");
  }
  if (["SUBMITTED", "AWAITING_SUPPLIER_CONFIRMATION", "PROCESSING"].includes(order.fulfillmentStatus)) {
    throw new Error("This order was already sent to the fulfillment provider. Cancel it in the CJ dashboard first, then mark fulfillment as cancelled.");
  }
  if (order.paymentStatus === "PAID") {
    const { refundOrder } = await import("./payments");
    await refundOrder(orderId, order.totalCents - order.refundedCents, actorId, `Cancelled: ${reason}`);
  }
  const updated = await prisma.$transaction(async (tx) => {
    if (order.paymentStatus === "UNPAID") await releaseReservations(tx, orderId, "admin_cancelled");
    else if (order.fulfillmentStatus === "UNFULFILLED" || order.fulfillmentStatus === "FAILED") {
      const lines = order.items.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId!, quantity: i.quantity }));
      await returnPendingStock(tx, orderId, lines);
    }
    const o = await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", fulfillmentStatus: "CANCELLED", cancelledAt: new Date() },
    });
    await audit(actorId, "order.cancel", "Order", orderId, { reason }, tx);
    return o;
  });
  await sendEmail("order_cancelled", order.email, {
    customerName: order.customerName ?? "there",
    orderNumber: order.number,
    reason,
  }).catch(() => null);
  return updated;
}

/** Guest access check for order pages (token from the confirmation link). */
export async function findOrderForViewer(number: string, opts: { userId?: string | null; token?: string | null }) {
  const order = await prisma.order.findUnique({
    where: { number },
    include: {
      items: true,
      shipments: { include: { events: { orderBy: { occurredAt: "desc" } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return null;
  if (opts.userId && order.userId === opts.userId) return order;
  if (opts.token && order.accessTokenHash && safeEqual(sha256(opts.token), order.accessTokenHash)) return order;
  return null;
}
