import "server-only";
import { cache } from "react";
import { z } from "zod";
import { prisma } from "./db";

/**
 * Store-wide configuration editable from the admin dashboard.
 * Every section has safe defaults; placeholders in [BRACKETS] must be completed before launch.
 */
export const settingsSchema = z.object({
  brand: z.object({
    name: z.string().min(1).max(60),
    tagline: z.string().max(140),
    logoUrl: z.string().max(500).nullable(),
    supportEmail: z.string().max(200),
    phone: z.string().max(40),
  }),
  business: z.object({
    legalName: z.string().max(200),
    address: z.string().max(400),
    country: z.string().max(60),
    vatNumber: z.string().max(40),
    registrationNumber: z.string().max(80),
    pec: z.string().max(200),
    shareCapital: z.string().max(80),
  }),
  announcement: z.object({
    enabled: z.boolean(),
    text: z.string().max(160),
    link: z.string().max(300).nullable(),
  }),
  home: z.object({
    heroHeadline: z.string().max(140),
    heroSubheadline: z.string().max(300),
    heroImage: z.string().max(500),
    featuredProductSlug: z.string().max(120).nullable(),
    aboutTitle: z.string().max(140),
    aboutBody: z.string().max(4000),
  }),
  commerce: z.object({
    currency: z.enum(["EUR"]),
    vatRatePercent: z.number().min(0).max(30),
    withdrawalDays: z.number().int().min(14).max(90),
    reservationMinutes: z.number().int().min(30).max(1440),
    maxQuantityPerItem: z.number().int().min(1).max(99),
    defaultLowStockThreshold: z.number().int().min(0).max(10000),
    checkoutEnabled: z.boolean(),
  }),
  social: z.object({
    instagram: z.string().max(300),
    facebook: z.string().max(300),
    tiktok: z.string().max(300),
  }),
  seo: z.object({
    defaultTitle: z.string().max(70),
    defaultDescription: z.string().max(170),
  }),
  analytics: z.object({
    /** Plausible domain; script loads only after analytics consent */
    plausibleDomain: z.string().max(200),
    /** Record first-party, cookieless page views only with analytics consent */
    firstPartyEnabled: z.boolean(),
  }),
  fulfillment: z.object({
    /** manual: admin fulfils in CJ dashboard. cj_api: orders submitted through the CJ API */
    mode: z.enum(["manual", "cj_api"]),
    autoSubmitOnPayment: z.boolean(),
    cjLogisticName: z.string().max(80),
    cjFromCountryCode: z.string().max(2),
    cjStorageId: z.string().max(80),
    cjWarehouseCountryCode: z.string().max(2),
  }),
  theme: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    primaryDeep: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    lavender: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    lavenderPale: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  shippingNote: z.string().max(1000),
  faq: z.array(z.object({ question: z.string().min(1).max(200), answer: z.string().min(1).max(2000) })).max(30),
});

export type StoreSettings = z.infer<typeof settingsSchema>;
export type SettingsSection = keyof StoreSettings;

export const defaultSettings: StoreSettings = {
  brand: {
    name: "Wanderpaw",
    tagline: "Thoughtful essentials for life outdoors with your pet.",
    logoUrl: null,
    supportEmail: "[SUPPORT EMAIL]",
    phone: "",
  },
  business: {
    legalName: "[LEGAL BUSINESS NAME]",
    address: "[REGISTERED ADDRESS]",
    country: "Italy",
    vatNumber: "[PARTITA IVA]",
    registrationNumber: "[REA / COMPANY REGISTRATION NUMBER]",
    pec: "[PEC ADDRESS]",
    shareCapital: "",
  },
  announcement: {
    enabled: true,
    text: "Secure checkout · 14-day right of withdrawal on eligible orders",
    link: "/legal/returns",
  },
  home: {
    heroHeadline: "Every Adventure Deserves a Happy, Hydrated Pet.",
    heroSubheadline:
      "Meet the portable 2-in-1 water bottle designed to make outdoor adventures with your furry companion easier.",
    heroImage: "/products/dog-drinking-street.jpg",
    featuredProductSlug: "portable-pet-water-bottle",
    aboutTitle: "Made for the moments between home and the trail",
    aboutBody:
      "We started with a simple frustration: juggling a water bottle, a bowl and a bag of treats on every walk. Our first product brings water and food together in one bottle you can carry with one hand.\n\n[Tell your brand story here — who you are, why you started, and what you stand for.]",
  },
  commerce: {
    currency: "EUR",
    vatRatePercent: 22,
    withdrawalDays: 14,
    reservationMinutes: 30,
    maxQuantityPerItem: 10,
    defaultLowStockThreshold: 10,
    checkoutEnabled: true,
  },
  social: { instagram: "", facebook: "", tiktok: "" },
  seo: {
    defaultTitle: "Wanderpaw — Portable Pet Water Bottle",
    defaultDescription:
      "The 2-in-1 portable pet water bottle with integrated bowl and food container for walks, trips and outdoor adventures.",
  },
  analytics: { plausibleDomain: "", firstPartyEnabled: true },
  fulfillment: {
    mode: "manual",
    autoSubmitOnPayment: false,
    cjLogisticName: "",
    cjFromCountryCode: "",
    cjStorageId: "",
    cjWarehouseCountryCode: "",
  },
  theme: {
    primary: "#7047EB",
    primaryDeep: "#4C2B9A",
    lavender: "#EDE7FF",
    lavenderPale: "#F8F5FF",
  },
  shippingNote:
    "Orders are dispatched from our logistics partner's warehouse. Delivery times and costs for your country are shown before you pay.",
  faq: [
    {
      question: "Is the bottle suitable for my dog or cat?",
      answer: "Your pet drinks directly from the open bowl at the top of the bottle, so it works for pets that are comfortable drinking from a small bowl. We are confirming exact bowl and bottle dimensions with our supplier and will publish them in the product specifications once verified. If you are unsure, contact us before ordering.",
    },
    {
      question: "How do I clean it?",
      answer: "Empty the bottle, bowl and food container after each outing, rinse all parts with warm water and mild soap, and let them air-dry completely before reassembling. Avoid leaving water standing in the bottle for long periods.",
    },
    {
      question: "How much does shipping cost and how long does delivery take?",
      answer: "Shipping costs and delivery estimates depend on your country and are shown in your cart and at checkout before you pay. See our Shipping Policy for details.",
    },
    {
      question: "Can I return my order?",
      answer: "Yes. As an EU consumer you have a 14-day right of withdrawal from delivery for eligible purchases, and all products are covered by the 2-year legal guarantee of conformity. See our Returns & Refunds policy for how it works.",
    },
    {
      question: "How can I track my order?",
      answer: "When your order ships you will receive an email with your tracking number. You can also see your order status in your account, or on the Track Order page using your order number and email.",
    },
    {
      question: "What is it made of and how much does it hold?",
      answer: "We only publish material and capacity information after verifying it with our supplier. Verified specifications are listed on the product page; if something you need is missing, please contact us and we will confirm it for you.",
    },
  ],
};

/** Loads all settings, merging stored values over defaults section by section. */
export const getSettings = cache(async (): Promise<StoreSettings> => {
  const rows = await prisma.storeSetting.findMany();
  const merged: Record<string, unknown> = structuredClone(defaultSettings);
  for (const row of rows) {
    if (!(row.key in defaultSettings)) continue;
    const base = (defaultSettings as Record<string, unknown>)[row.key];
    merged[row.key] =
      typeof base === "object" && base !== null && !Array.isArray(base) && typeof row.value === "object" && row.value !== null && !Array.isArray(row.value)
        ? { ...base, ...(row.value as object) }
        : row.value;
  }
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : defaultSettings;
});

export async function saveSettingsSection<K extends SettingsSection>(key: K, value: StoreSettings[K]) {
  const validated = settingsSchema.shape[key].parse(value);
  await prisma.storeSetting.upsert({
    where: { key },
    create: { key, value: validated as object },
    update: { value: validated as object },
  });
}

/** Returns placeholder fields that still need real values before launch. */
export function findPlaceholders(settings: StoreSettings): string[] {
  const out: string[] = [];
  const walk = (obj: unknown, path: string) => {
    if (typeof obj === "string" && /\[[A-Z][A-Z /]+\]/.test(obj)) out.push(path);
    else if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(settings, "");
  return out;
}
