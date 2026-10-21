import { NextResponse } from "next/server";
import { getStripe } from "@/lib/payments/stripe";
import { handleStripeEvent } from "@/lib/payments/stripe-webhook";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe webhook: the raw body is verified against the signing secret before anything is processed. */
export async function POST(req: Request) {
  const secret = env.stripeWebhookSecret;
  if (!secret || !env.stripeSecretKey) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await req.text();
  let event;
  try {
    event = await getStripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    const result = await handleStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch {
    // Generic error body; details are in IntegrationLog. Non-2xx makes Stripe retry.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
