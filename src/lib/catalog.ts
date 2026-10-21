import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { availableFrom } from "./inventory";

export type Highlight = { text: string; verified: boolean };
export type Spec = { label: string; value: string; verified: boolean };
export type Faq = { question: string; answer: string };

const productInclude = {
  images: { orderBy: { position: "asc" } },
  variants: { where: { active: true }, orderBy: { position: "asc" }, include: { inventory: true } },
} satisfies Prisma.ProductInclude;

type RawProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** Shapes a product for public display: only verified claims, only computed availability (never raw stock internals). */
function toPublic(p: RawProduct) {
  const highlights = ((p.highlights as Highlight[]) ?? []).filter((h) => h.verified).map((h) => h.text);
  const specifications = ((p.specifications as Spec[]) ?? []).filter((s) => s.verified).map(({ label, value }) => ({ label, value }));
  const variants = p.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    title: v.title,
    options: v.options as Record<string, string>,
    priceCents: v.priceCents,
    currency: v.currency,
    swatchHex: v.swatchHex,
    imageId: v.imageId,
    available: availableFrom(v.inventory),
  }));
  const prices = variants.map((v) => v.priceCents);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    description: p.description,
    category: p.category,
    careInstructions: p.careInstructions,
    faqs: (p.faqs as Faq[]) ?? [],
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    highlights,
    specifications,
    images: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, width: i.width, height: i.height })),
    variants,
    minPriceCents: prices.length ? Math.min(...prices) : 0,
    maxPriceCents: prices.length ? Math.max(...prices) : 0,
    currency: variants[0]?.currency ?? "EUR",
    inStock: variants.some((v) => v.available > 0),
    updatedAt: p.updatedAt,
  };
}

export type PublicProduct = ReturnType<typeof toPublic>;

export const getProductBySlug = cache(async (slug: string) => {
  const p = await prisma.product.findFirst({ where: { slug, status: "ACTIVE" }, include: productInclude });
  return p ? toPublic(p) : null;
});

export const listProducts = cache(async (opts: { collectionSlug?: string; featuredOnly?: boolean } = {}) => {
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      ...(opts.featuredOnly ? { featured: true } : {}),
      ...(opts.collectionSlug ? { collections: { some: { collection: { slug: opts.collectionSlug, published: true } } } } : {}),
    },
    include: productInclude,
    orderBy: [{ featured: "desc" }, { createdAt: "asc" }],
  });
  return products.map(toPublic);
});

export const listCollections = cache(async () =>
  prisma.collection.findMany({ where: { published: true }, orderBy: { position: "asc" } }),
);

export async function getReviewSummary(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId, status: "APPROVED" },
    _avg: { rating: true },
    _count: true,
  });
  return { average: agg._avg.rating ?? 0, count: agg._count };
}

export async function getApprovedReviews(productId: string, take = 20) {
  return prisma.review.findMany({
    where: { productId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, authorName: true, rating: true, title: true, body: true, verifiedPurchase: true, createdAt: true },
  });
}
