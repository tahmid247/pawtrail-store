import "server-only";
import { prisma } from "./db";
import { formatMoney } from "./money";
import { formatEstimate } from "./shipping";

/** One-line shipping summary built from the configured zones (no invented promises). */
export async function getShippingSummary(): Promise<string | null> {
  const zones = await prisma.shippingZone.findMany({
    where: { active: true },
    include: { rates: { where: { active: true }, orderBy: { priceCents: "asc" }, take: 1 } },
  });
  const it = zones.find((z) => z.countries.includes("IT"))?.rates[0];
  if (!it) return null;
  const estimate = formatEstimate(it.minDeliveryDays, it.maxDeliveryDays);
  const price = it.priceCents === 0 ? "Free shipping" : `Shipping to Italy from ${formatMoney(it.priceCents)}`;
  const free = it.freeOverCents != null && it.priceCents > 0 ? ` · free over ${formatMoney(it.freeOverCents)}` : "";
  return `${price}${free}${estimate ? ` · ${estimate}` : ""}. Other EU countries shown at checkout.`;
}
