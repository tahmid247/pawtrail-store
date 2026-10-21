"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimitByIp } from "@/lib/rate-limit";
import { fulfillmentLabel } from "@/lib/fulfillment/labels";

type TrackState = {
  error?: string;
  order?: { number: string; placedAt: string; status: string; tracking: { number: string; carrier: string | null; url: string | null }[] };
} | null;

/** Guest order lookup. Requires order number + matching email; returns no personal data. */
export async function lookupOrder(_prev: TrackState, formData: FormData): Promise<TrackState> {
  if (!(await rateLimitByIp("track", 10, 600))) return { error: "Too many attempts. Please try again later." };
  const parsed = z.object({ number: z.string().trim().toUpperCase().max(20), email: z.email().max(254) }).safeParse({
    number: formData.get("number"),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  });
  if (!parsed.success) return { error: "Please enter a valid order number and email." };
  const order = await prisma.order.findUnique({ where: { number: parsed.data.number }, include: { shipments: true } });
  if (!order || order.email !== parsed.data.email || order.paymentStatus === "UNPAID") {
    return { error: "We couldn't find an order with those details." };
  }
  const status =
    order.status === "CANCELLED" ? "Cancelled" : order.paymentStatus === "REFUNDED" ? "Refunded" : fulfillmentLabel(order.fulfillmentStatus);
  return {
    order: {
      number: order.number,
      placedAt: order.placedAt.toLocaleDateString("en-GB", { dateStyle: "long" }),
      status,
      tracking: order.shipments.map((s) => ({ number: s.trackingNumber, carrier: s.carrier, url: s.trackingUrl && /^https:\/\//.test(s.trackingUrl) ? s.trackingUrl : null })),
    },
  };
}
