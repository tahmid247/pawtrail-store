import "server-only";
import { prisma } from "./db";
import { env } from "./env";
import { findPlaceholders, getSettings } from "./settings";

export type Check = { label: string; ok: boolean; detail?: string; href?: string };

/** Live launch-readiness checks shown on the admin overview. */
export async function getLaunchChecks(): Promise<Check[]> {
  const settings = await getSettings();
  const placeholders = findPlaceholders(settings);
  const [legal, rates, variants, unverified, admins2fa] = await Promise.all([
    prisma.legalPage.findMany({ select: { slug: true, content: true } }),
    prisma.shippingRate.findMany({ where: { active: true } }),
    prisma.productVariant.findMany({ where: { active: true, product: { status: "ACTIVE" } }, include: { inventory: true } }),
    prisma.product.findMany({ where: { status: "ACTIVE" }, select: { title: true, specifications: true } }),
    prisma.user.count({ where: { role: "ADMIN", twoFactorEnabled: true } }),
  ]);
  const legalDrafts = legal.filter((l) => l.content.includes("DRAFT —") || /\[[A-Z][A-Z /]+\]/.test(l.content));
  const ratesNoEstimate = rates.filter((r) => r.minDeliveryDays == null || r.maxDeliveryDays == null);
  const unmapped = variants.filter((v) => !v.cjVariantId);
  const manualStock = variants.filter((v) => v.inventory?.source !== "CJ");
  const specsUnverified = unverified.filter((p) => (p.specifications as { verified: boolean }[]).some((s) => !s.verified));

  return [
    { label: "Business & contact details completed", ok: placeholders.length === 0, detail: placeholders.length ? `Placeholders: ${placeholders.join(", ")}` : undefined, href: "/admin/settings" },
    { label: "Legal pages reviewed (no DRAFT notices/placeholders)", ok: legalDrafts.length === 0, detail: legalDrafts.map((l) => l.slug).join(", ") || undefined, href: "/admin/legal" },
    { label: "Delivery estimates set for every shipping rate", ok: ratesNoEstimate.length === 0, detail: ratesNoEstimate.map((r) => r.name).join(", ") || undefined, href: "/admin/shipping" },
    { label: "Stripe live keys configured", ok: Boolean(env.stripeSecretKey?.startsWith("sk_live_") && env.stripeWebhookSecret), detail: env.stripeSecretKey ? (env.stripeSecretKey.startsWith("sk_test_") ? "Test mode key in use" : undefined) : "Not configured — payments simulated in dev", href: "/admin/integrations" },
    { label: "Transactional email provider configured", ok: Boolean(env.resendApiKey), detail: env.resendApiKey ? undefined : "RESEND_API_KEY missing — emails are only logged", href: "/admin/integrations" },
    { label: "CJdropshipping live API tested", ok: env.cjMode === "live", detail: env.cjMode === "mock" ? "CJ_MODE=mock" : undefined, href: "/admin/integrations" },
    { label: "All variants mapped to CJ variant IDs", ok: unmapped.length === 0, detail: unmapped.map((v) => v.sku).join(", ") || undefined, href: "/admin/products" },
    { label: "Inventory synced from CJ (not manual placeholder)", ok: manualStock.length === 0, detail: manualStock.map((v) => v.sku).join(", ") || undefined, href: "/admin/inventory" },
    { label: "Product specifications verified with supplier", ok: specsUnverified.length === 0, detail: specsUnverified.map((p) => p.title).join(", ") || undefined, href: "/admin/products" },
    { label: "Fulfillment logistic settings configured", ok: Boolean(settings.fulfillment.cjLogisticName && settings.fulfillment.cjFromCountryCode), href: "/admin/settings" },
    { label: "Admin alert email set", ok: Boolean(env.adminAlertEmail) },
    { label: "At least one admin has 2FA enabled", ok: admins2fa > 0 },
  ];
}
