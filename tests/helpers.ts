import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

type RequestState = { cookie: string; jar: Map<string, string> };
export const requestState = (globalThis as unknown as { __requestState: RequestState }).__requestState;

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  requestState.cookie = "";
  requestState.jar.clear();
}

/** One active product with two variants, CJ mappings and a shipping zone for Italy. */
export async function seedCatalog(opts: { stock?: number; price?: number } = {}) {
  const supplier = await prisma.supplier.create({ data: { code: "CJ", name: "CJdropshipping" } });
  const product = await prisma.product.create({
    data: { slug: "bottle", title: "Bottle", description: "Test", status: "ACTIVE", highlights: [{ text: "Shown", verified: true }, { text: "Hidden", verified: false }] },
  });
  const mk = (sku: string, vid: string) =>
    prisma.productVariant.create({
      data: { productId: product.id, sku, title: sku, priceCents: opts.price ?? 2490, cjVariantId: vid, supplierId: supplier.id, inventory: { create: { supplierQuantity: opts.stock ?? 10, lowStockThreshold: 0 } } },
    });
  const a = await mk("A", "VID-A");
  const b = await mk("B", "VID-B");
  const zone = await prisma.shippingZone.create({
    data: { name: "Italy", countries: ["IT"], rates: { create: { name: "Standard", priceCents: 490, minDeliveryDays: 3, maxDeliveryDays: 6 } } },
    include: { rates: true },
  });
  await prisma.storeSetting.create({
    data: { key: "fulfillment", value: { mode: "cj_api", autoSubmitOnPayment: false, cjLogisticName: "TestPost", cjFromCountryCode: "DE", cjStorageId: "", cjWarehouseCountryCode: "" } },
  });
  return { product, a, b, supplier, rate: zone.rates[0] };
}

export async function cart(items: { variantId: string; quantity: number }[]) {
  return prisma.cart.create({ data: { tokenHash: randomUUID(), items: { create: items } } });
}

export const address = { name: "Mario Rossi", line1: "Via Roma 1", line2: null, city: "Milano", postalCode: "20121", state: "MI", country: "IT" };

export async function inv(variantId: string) {
  return prisma.inventory.findUniqueOrThrow({ where: { variantId } });
}
