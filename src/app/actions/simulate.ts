"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { cancelUnpaidOrder, markOrderPaid } from "@/lib/orders";
import { getPaymentProvider } from "@/lib/payments";

/**
 * DEVELOPMENT ONLY: stands in for the Stripe webhook while Stripe is not configured.
 * Refuses to run in production or when a real payment provider is configured.
 */
function assertSimulatorAllowed() {
  if (env.isProduction || getPaymentProvider()?.name !== "simulated") throw new Error("Payment simulator is disabled");
}

const schema = z.object({
  session: z.string().startsWith("sim_"),
  name: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  state: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  outcome: z.enum(["success", "failure"]),
  next: z.string().startsWith(env.siteUrl),
});

export async function simulatePayment(formData: FormData) {
  assertSimulatorAllowed();
  const data = schema.parse(Object.fromEntries(formData));
  const order = await prisma.order.findUnique({ where: { stripeCheckoutSessionId: data.session } });
  if (!order) throw new Error("Unknown session");
  if (data.outcome === "failure") {
    await cancelUnpaidOrder(order.id, "failed");
    redirect(`/cart?cancelled=${order.number}`);
  }
  const address = { name: data.name, line1: data.line1, line2: data.line2 || null, city: data.city, postalCode: data.postalCode, state: data.state || null, country: order.shippingCountry };
  await markOrderPaid(order.id, {
    provider: "simulated",
    providerRef: data.session,
    amountCents: order.totalCents,
    currency: order.currency,
    customerName: data.name,
    phone: data.phone || null,
    shippingAddress: address,
    billingAddress: address,
  });
  redirect(data.next);
}
