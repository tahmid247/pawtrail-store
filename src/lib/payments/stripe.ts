import "server-only";
import Stripe from "stripe";
import { env } from "../env";
import type { CheckoutRequest, PaymentProvider } from "./types";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (env.isProduction && env.stripeSecretKey.startsWith("sk_test_") && process.env.ALLOW_STRIPE_TEST_IN_PRODUCTION !== "true") {
    console.warn("Stripe is running with a TEST key in production mode.");
  }
  client ??= new Stripe(env.stripeSecretKey, {
    maxNetworkRetries: 2,
    appInfo: { name: "pawtrail-store" },
  });
  return client;
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",

  async createCheckout(req: CheckoutRequest) {
    const stripe = getStripe();
    const currency = req.currency.toLowerCase();
    const publicImages = env.siteUrl.startsWith("https://");

    let discounts: { coupon: string }[] | undefined;
    if (req.discountCents > 0) {
      // A single-use coupon carrying the server-computed discount for this order only.
      const coupon = await stripe.coupons.create(
        { amount_off: req.discountCents, currency, duration: "once", max_redemptions: 1, name: "Discount", metadata: { orderId: req.orderId } },
        { idempotencyKey: `coupon_${req.orderId}` },
      );
      discounts = [{ coupon: coupon.id }];
    }

    const estimate =
      req.shipping.minDays != null || req.shipping.maxDays != null
        ? {
            ...(req.shipping.minDays != null ? { minimum: { unit: "business_day" as const, value: req.shipping.minDays } } : {}),
            ...(req.shipping.maxDays != null ? { maximum: { unit: "business_day" as const, value: req.shipping.maxDays } } : {}),
          }
        : undefined;

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: req.email,
        client_reference_id: req.orderId,
        metadata: { orderId: req.orderId, orderNumber: req.orderNumber },
        payment_intent_data: { metadata: { orderId: req.orderId, orderNumber: req.orderNumber } },
        line_items: req.lines.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency,
            unit_amount: l.unitAmountCents,
            product_data: {
              name: l.name,
              ...(l.description ? { description: l.description } : {}),
              ...(publicImages && l.imageUrl ? { images: [new URL(l.imageUrl, env.siteUrl).toString()] } : {}),
            },
          },
        })),
        shipping_address_collection: {
          allowed_countries: [req.country as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry],
        },
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name: req.shipping.name,
              fixed_amount: { amount: req.shipping.amountCents, currency },
              ...(estimate ? { delivery_estimate: estimate } : {}),
            },
          },
        ],
        phone_number_collection: { enabled: true },
        ...(discounts ? { discounts } : {}),
        expires_at: Math.floor(req.expiresAt.getTime() / 1000),
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        locale: "auto",
      },
      { idempotencyKey: `checkout_${req.orderId}` },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { sessionId: session.id, url: session.url };
  },

  async refund(paymentRef, amountCents, localRefundId) {
    const refund = await getStripe().refunds.create(
      { payment_intent: paymentRef, amount: amountCents, metadata: { localRefundId } },
      { idempotencyKey: `refund_${localRefundId}` },
    );
    const status = refund.status === "succeeded" ? "SUCCEEDED" : refund.status === "failed" || refund.status === "canceled" ? "FAILED" : "PENDING";
    return { refundId: refund.id, status };
  },
};
