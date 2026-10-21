"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { storeImage } from "@/lib/storage";
import { parseClaims, parseFaqs } from "@/lib/admin-format";
import { guarded, optInt, toCents } from "./guard";
import type { AdminResult } from "../result";

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use lowercase letters, numbers and dashes").max(120);

const productSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug,
  subtitle: z.string().trim().max(300).optional(),
  description: z.string().trim().min(1).max(20000),
  category: z.string().trim().max(100).optional(),
  productType: z.string().trim().max(200).optional(),
  careInstructions: z.string().trim().max(5000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(170).optional(),
});

function revalidateCatalog(productSlug?: string) {
  revalidatePath("/", "layout");
  if (productSlug) revalidatePath(`/products/${productSlug}`);
}

export async function saveProduct(_p: AdminResult, fd: FormData) {
  let createdId: string | null = null;
  const result = await guarded({ adminOnly: true }, async (u) => {
    const data = productSchema.parse(Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === "string" && k in productSchema.shape && v !== "")));
    const highlights = parseClaims(String(fd.get("highlights") ?? ""), false);
    const specifications = parseClaims(String(fd.get("specifications") ?? ""), true);
    const faqs = parseFaqs(String(fd.get("faqs") ?? ""));
    const collectionIds = fd.getAll("collections").map(String);
    const payload = {
      ...data,
      subtitle: data.subtitle ?? null,
      category: data.category ?? null,
      productType: data.productType ?? null,
      careInstructions: data.careInstructions ?? null,
      seoTitle: data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
      featured: fd.get("featured") === "on",
      highlights,
      specifications,
      faqs,
    };
    const id = String(fd.get("id") ?? "");
    const product = id
      ? await prisma.product.update({ where: { id }, data: payload })
      : await prisma.product.create({ data: payload });
    await prisma.productCollection.deleteMany({ where: { productId: product.id } });
    if (collectionIds.length) await prisma.productCollection.createMany({ data: collectionIds.map((collectionId) => ({ productId: product.id, collectionId })) });
    await audit(u.id, id ? "product.update" : "product.create", "Product", product.id, { status: product.status });
    revalidateCatalog(product.slug);
    if (!id) createdId = product.id;
    return "Product saved.";
  });
  if (createdId) redirect(`/admin/products/${createdId}`);
  return result;
}

export async function deleteProduct(_p: AdminResult, fd: FormData) {
  let deleted = false;
  const result = await guarded({ adminOnly: true }, async (u) => {
    const id = z.string().parse(fd.get("id"));
    const sold = await prisma.orderItem.count({ where: { productId: id } });
    if (sold > 0) {
      await prisma.product.update({ where: { id }, data: { status: "ARCHIVED" } });
      await audit(u.id, "product.archive", "Product", id);
      revalidateCatalog();
      return "This product has orders, so it was archived instead of deleted.";
    }
    await prisma.product.delete({ where: { id } });
    await audit(u.id, "product.delete", "Product", id);
    deleted = true;
    revalidateCatalog();
  });
  if (deleted) redirect("/admin/products");
  return result;
}

const variantSchema = z.object({
  title: z.string().trim().min(1).max(100),
  sku: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/),
  swatchHex: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/)]).optional(),
  cjProductId: z.string().trim().max(100).optional(),
  cjVariantId: z.string().trim().max(100).optional(),
  cjSku: z.string().trim().max(100).optional(),
});

export async function saveVariant(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const productId = z.string().parse(fd.get("productId"));
    const v = variantSchema.parse(Object.fromEntries(fd));
    const priceCents = toCents(fd.get("price"));
    const data = {
      title: v.title,
      sku: v.sku,
      options: { Color: v.title },
      priceCents,
      swatchHex: v.swatchHex || null,
      cjProductId: v.cjProductId || null,
      cjVariantId: v.cjVariantId || null,
      cjSku: v.cjSku || null,
      weightGrams: optInt(fd.get("weightGrams")),
      position: optInt(fd.get("position")) ?? 0,
      active: fd.get("active") === "on",
    };
    const id = String(fd.get("id") ?? "");
    const previous = id ? await prisma.productVariant.findUnique({ where: { id }, select: { priceCents: true } }) : null;
    const supplier = data.cjVariantId || data.cjProductId ? await prisma.supplier.findUnique({ where: { code: "CJ" } }) : null;
    const variant = id
      ? await prisma.productVariant.update({ where: { id }, data: { ...data, supplierId: supplier?.id ?? undefined } })
      : await prisma.productVariant.create({ data: { ...data, productId, supplierId: supplier?.id ?? null, inventory: { create: {} } } });
    await audit(u.id, id ? "variant.update" : "variant.create", "ProductVariant", variant.id, { priceCents, previousPriceCents: previous?.priceCents ?? null });
    const product = await prisma.product.findUnique({ where: { id: productId } });
    revalidateCatalog(product?.slug);
    revalidatePath(`/admin/products/${productId}`);
    return "Variant saved.";
  });
}

export async function uploadImages(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const productId = z.string().parse(fd.get("productId"));
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const url = String(fd.get("url") ?? "").trim();
    const alt = z.string().trim().min(3, "describe the image (alt text)").max(300).parse(fd.get("alt"));
    if (!files.length && !url) throw new Error("Choose a file or enter an image URL.");
    let position = await prisma.productImage.count({ where: { productId } });
    const urls = [...(await Promise.all(files.slice(0, 10).map(storeImage))), ...(url ? [z.url().startsWith("https://").parse(url)] : [])];
    for (const u2 of urls) await prisma.productImage.create({ data: { productId, url: u2, alt, position: position++ } });
    await audit(u.id, "product.images_added", "Product", productId, { count: urls.length });
    revalidatePath(`/admin/products/${productId}`);
    revalidateCatalog();
    return `${urls.length} image(s) added.`;
  });
}

export async function updateImage(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const id = z.string().parse(fd.get("imageId"));
    if (fd.get("delete") === "1") {
      const img = await prisma.productImage.delete({ where: { id } });
      await audit(u.id, "product.image_deleted", "ProductImage", id);
      revalidatePath(`/admin/products/${img.productId}`);
      revalidateCatalog();
      return "Image removed.";
    }
    const alt = z.string().trim().min(3).max(300).parse(fd.get("alt"));
    const position = optInt(fd.get("position")) ?? 0;
    const img = await prisma.productImage.update({ where: { id }, data: { alt, position } });
    revalidatePath(`/admin/products/${img.productId}`);
    revalidateCatalog();
    return "Image updated.";
  });
}

export async function saveCollection(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const data = z.object({
      title: z.string().trim().min(1).max(120),
      slug,
      description: z.string().trim().max(2000).optional(),
      seoTitle: z.string().trim().max(70).optional(),
      seoDescription: z.string().trim().max(170).optional(),
    }).parse(Object.fromEntries([...fd.entries()].filter(([, v]) => v !== "")));
    const payload = { ...data, description: data.description ?? null, seoTitle: data.seoTitle ?? null, seoDescription: data.seoDescription ?? null, published: fd.get("published") === "on", position: optInt(fd.get("position")) ?? 0 };
    const id = String(fd.get("id") ?? "");
    const c = id ? await prisma.collection.update({ where: { id }, data: payload }) : await prisma.collection.create({ data: payload });
    await audit(u.id, id ? "collection.update" : "collection.create", "Collection", c.id);
    revalidatePath("/admin/collections");
    revalidateCatalog();
    return "Collection saved.";
  });
}

export async function deleteCollection(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const id = z.string().parse(fd.get("id"));
    await prisma.collection.delete({ where: { id } });
    await audit(u.id, "collection.delete", "Collection", id);
    revalidatePath("/admin/collections");
    return "Collection deleted.";
  });
}
