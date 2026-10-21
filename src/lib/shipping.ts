import "server-only";
import { prisma } from "./db";

export type ShippingOption = {
  rateId: string;
  name: string;
  priceCents: number;
  freeOverCents: number | null;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
};

export function formatEstimate(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? `${min} business days` : `${min}–${max} business days`;
  return `up to ${max ?? min} business days`;
}

export async function getShippingCountries(): Promise<string[]> {
  const zones = await prisma.shippingZone.findMany({ where: { active: true, rates: { some: { active: true } } } });
  return [...new Set(zones.flatMap((z) => z.countries))].sort();
}

export async function getShippingOptions(country: string): Promise<ShippingOption[]> {
  const zones = await prisma.shippingZone.findMany({
    where: { active: true, countries: { has: country.toUpperCase() } },
    include: { rates: { where: { active: true }, orderBy: [{ position: "asc" }, { priceCents: "asc" }] } },
  });
  return zones.flatMap((z) =>
    z.rates.map((r) => ({
      rateId: r.id,
      name: r.name,
      priceCents: r.priceCents,
      freeOverCents: r.freeOverCents,
      minDeliveryDays: r.minDeliveryDays,
      maxDeliveryDays: r.maxDeliveryDays,
    })),
  );
}

/** Shipping cost after applying an admin-configured free-shipping threshold (if any). */
export function shippingCostFor(option: ShippingOption, merchandiseCents: number): number {
  if (option.freeOverCents != null && merchandiseCents >= option.freeOverCents) return 0;
  return option.priceCents;
}
