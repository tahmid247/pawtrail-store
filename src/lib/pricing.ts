import "server-only";
import { prisma } from "./db";
import { availableFrom } from "./inventory";
import { evaluateDiscount, findDiscount } from "./discounts";
import { getShippingOptions, shippingCostFor, formatEstimate, type ShippingOption } from "./shipping";
import { includedVat } from "./money";
import { getSettings } from "./settings";

export type QuoteLine = {
  variantId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  variantTitle: string;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
  available: number;
  cjVariantId: string | null;
  problem: string | null;
};

export type Quote = {
  currency: string;
  lines: QuoteLine[];
  subtotalCents: number;
  discountCents: number;
  discount: { id: string; code: string } | null;
  discountError: string | null;
  shipping: (ShippingOption & { costCents: number; estimate: string | null }) | null;
  shippingCents: number;
  totalCents: number;
  vatIncludedCents: number;
  vatRatePercent: number;
  canCheckout: boolean;
  problems: string[];
};

/**
 * Computes every amount on the server from database prices. Client-supplied prices are never used.
 */
export async function computeQuote(input: {
  items: { variantId: string; quantity: number }[];
  country?: string | null;
  shippingRateId?: string | null;
  discountCode?: string | null;
}): Promise<Quote> {
  const settings = await getSettings();
  const ids = input.items.map((i) => i.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: ids } },
    include: { inventory: true, product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } },
  });

  const problems: string[] = [];
  const lines: QuoteLine[] = [];
  for (const item of input.items) {
    const v = variants.find((x) => x.id === item.variantId);
    if (!v) continue;
    const available = availableFrom(v.inventory);
    const sellable = v.active && v.product.status === "ACTIVE";
    let problem: string | null = null;
    if (!sellable) problem = "This item is no longer available.";
    else if (available <= 0) problem = "Out of stock.";
    else if (item.quantity > available) problem = `Only ${available} available.`;
    else if (item.quantity > settings.commerce.maxQuantityPerItem)
      problem = `Maximum ${settings.commerce.maxQuantityPerItem} per order.`;
    if (problem) problems.push(`${v.product.title} (${v.title}): ${problem}`);
    lines.push({
      variantId: v.id,
      productId: v.productId,
      productTitle: v.product.title,
      productSlug: v.product.slug,
      variantTitle: v.title,
      sku: v.sku,
      imageUrl: v.product.images[0]?.url ?? null,
      unitPriceCents: v.priceCents,
      quantity: item.quantity,
      totalCents: v.priceCents * item.quantity,
      available,
      cjVariantId: v.cjVariantId,
      problem,
    });
  }

  const subtotalCents = lines.reduce((s, l) => s + l.totalCents, 0);

  let discountCents = 0;
  let discount: Quote["discount"] = null;
  let discountError: string | null = null;
  if (input.discountCode) {
    const result = evaluateDiscount(await findDiscount(input.discountCode), subtotalCents);
    if (result.ok) {
      discountCents = result.amountCents;
      discount = { id: result.code.id, code: result.code.code };
    } else discountError = result.reason;
  }

  let shipping: Quote["shipping"] = null;
  if (input.country) {
    const options = await getShippingOptions(input.country);
    const chosen = options.find((o) => o.rateId === input.shippingRateId) ?? options[0];
    if (chosen) {
      const costCents = shippingCostFor(chosen, subtotalCents - discountCents);
      shipping = { ...chosen, costCents, estimate: formatEstimate(chosen.minDeliveryDays, chosen.maxDeliveryDays) };
    } else problems.push("We do not ship to the selected country yet.");
  }

  const shippingCents = shipping?.costCents ?? 0;
  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);
  const vatRatePercent = settings.commerce.vatRatePercent;

  return {
    currency: settings.commerce.currency,
    lines,
    subtotalCents,
    discountCents,
    discount,
    discountError,
    shipping,
    shippingCents,
    totalCents,
    vatIncludedCents: includedVat(totalCents, vatRatePercent),
    vatRatePercent,
    canCheckout: lines.length > 0 && problems.length === 0 && (!input.country || shipping !== null) && settings.commerce.checkoutEnabled,
    problems,
  };
}
