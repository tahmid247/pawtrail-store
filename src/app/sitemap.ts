import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { resolveSiteUrl } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = resolveSiteUrl();
  const [products, collections, legal] = await Promise.all([
    prisma.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true } }),
    prisma.collection.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    prisma.legalPage.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/about`, priority: 0.5 },
    { url: `${base}/contact`, priority: 0.5 },
    ...products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt, priority: 0.9 })),
    ...collections.map((c) => ({ url: `${base}/collections/${c.slug}`, lastModified: c.updatedAt, priority: 0.7 })),
    ...legal.map((l) => ({ url: `${base}/legal/${l.slug}`, lastModified: l.updatedAt, priority: 0.2 })),
  ];
}
