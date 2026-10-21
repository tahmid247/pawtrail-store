/**
 * Seeds the initial catalogue and configuration. Safe to re-run (upserts).
 * Values marked PLACEHOLDER (price, stock, shipping rates) must be replaced in the admin dashboard before launch.
 */
import { PrismaClient } from "@prisma/client";
import { legalDefaults } from "../src/content/legal-defaults";

const prisma = new PrismaClient();

const PLACEHOLDER_PRICE_CENTS = 2490; // PLACEHOLDER — set your real price in Admin → Products
const DEMO_STOCK = Number(process.env.SEED_DEMO_STOCK ?? 25); // PLACEHOLDER — replaced by CJ sync / manual count

async function main() {
  const supplier = await prisma.supplier.upsert({
    where: { code: "CJ" },
    create: { code: "CJ", name: "CJdropshipping" },
    update: {},
  });

  const collection = await prisma.collection.upsert({
    where: { slug: "pet-accessories" },
    create: {
      slug: "pet-accessories",
      title: "Pet Accessories",
      description: "Practical, well-designed accessories for everyday adventures with your pet.",
    },
    update: {},
  });

  const product = await prisma.product.upsert({
    where: { slug: "portable-pet-water-bottle" },
    update: {},
    create: {
      slug: "portable-pet-water-bottle",
      title: "Portable Pet Water Bottle",
      subtitle: "2-in-1 water bottle and food container for walks, trips and outdoor adventures",
      category: "Pet Accessories",
      productType: "Portable pet hydration and feeding accessory",
      status: "ACTIVE",
      featured: true,
      description:
        "Keep your furry companion refreshed and ready for every adventure with our 2-in-1 Portable Pet Water Bottle. Designed for convenient outdoor hydration and feeding, it combines a drinking bowl and food container in one travel-friendly accessory.\n\nPerfect for walks, park visits, road trips, and outdoor adventures with your dog or cat.",
      // Only `verified: true` items are shown to shoppers. Verify the others against supplier specs, then tick them in the admin.
      highlights: [
        { text: "2-in-1 design: water bottle with a separate food container", verified: true },
        { text: "Integrated drinking bowl — no extra bowl to carry", verified: true },
        { text: "Portable, travel-friendly size for walks and trips", verified: true },
        { text: "Carry lanyard for hands-free transport", verified: false },
        { text: "Designed to help prevent leaks", verified: false },
        { text: "Suitable for small and large dogs and cats", verified: false },
      ],
      specifications: [
        { label: "Colours", value: "Lavender, Sky Blue, Blush Pink, Butter Yellow", verified: true },
        { label: "Water capacity", value: "[CONFIRM WITH SUPPLIER]", verified: false },
        { label: "Food container capacity", value: "[CONFIRM WITH SUPPLIER]", verified: false },
        { label: "Material", value: "[CONFIRM WITH SUPPLIER — e.g. food-grade PP / PC / silicone]", verified: false },
        { label: "Dimensions", value: "[CONFIRM WITH SUPPLIER]", verified: false },
        { label: "Weight", value: "[CONFIRM WITH SUPPLIER]", verified: false },
        { label: "Leak resistance", value: "[CONFIRM WITH SUPPLIER]", verified: false },
      ],
      careInstructions:
        "Empty the bottle, bowl and food container after each outing. Rinse all parts with warm water and mild soap, then let them air-dry completely before reassembling. Do not leave water standing in the bottle for long periods.",
      faqs: [
        {
          question: "How do I use the bottle?",
          answer: "Fill the bottle with fresh water and the bottom container with your pet's food or treats. When your pet is thirsty, release water into the integrated bowl and let your pet drink. Empty any leftover water before closing the bowl.",
        },
        {
          question: "What is the capacity and material?",
          answer: "We are confirming the exact capacity and material specifications with our supplier and will list them here once verified. If you need this information before ordering, please contact us.",
        },
      ],
      seoTitle: "Portable Pet Water Bottle — 2-in-1 Water & Food Bottle",
      seoDescription:
        "The 2-in-1 portable pet water bottle with integrated drinking bowl and food container. Ideal for walks, park visits and road trips with your dog or cat.",
      collections: { create: { collectionId: collection.id } },
    },
  });

  const images = [
    { url: "/products/colors-overview.jpg", alt: "Portable Pet Water Bottle in lavender and pink, with a corgi drinking from a yellow bottle and colour swatches" },
    { url: "/products/dog-drinking-street.jpg", alt: "Corgi drinking from the yellow pet water bottle's integrated bowl on a city walk" },
    { url: "/products/bottle-with-food-cup.jpg", alt: "Yellow pet water bottle with its food container detached and filled with kibble" },
    { url: "/products/carry-strap-lifestyle.jpg", alt: "Yellow pet water bottle carried on a shoulder lanyard outdoors" },
    { url: "/products/dog-drinking-closeup.jpg", alt: "Close-up of a dog drinking from the bottle's integrated bowl on the grass" },
  ];
  if ((await prisma.productImage.count({ where: { productId: product.id } })) === 0) {
    await prisma.productImage.createMany({
      data: images.map((img, i) => ({ ...img, productId: product.id, position: i, width: 800, height: 800 })),
    });
  }

  const variants = [
    { sku: "WP-PWB-LAV", title: "Lavender", hex: "#C9B6F2" },
    { sku: "WP-PWB-BLU", title: "Sky Blue", hex: "#BFD8EE" },
    { sku: "WP-PWB-PNK", title: "Blush Pink", hex: "#F3B7B5" },
    { sku: "WP-PWB-YLW", title: "Butter Yellow", hex: "#F1E3A4" },
  ];
  for (const [i, v] of variants.entries()) {
    const variant = await prisma.productVariant.upsert({
      where: { sku: v.sku },
      update: {},
      create: {
        productId: product.id,
        sku: v.sku,
        title: v.title,
        options: { Color: v.title },
        priceCents: PLACEHOLDER_PRICE_CENTS,
        swatchHex: v.hex,
        position: i,
        supplierId: supplier.id,
      },
    });
    await prisma.inventory.upsert({
      where: { variantId: variant.id },
      update: {},
      create: { variantId: variant.id, supplierQuantity: DEMO_STOCK, lowStockThreshold: 10, source: "MANUAL" },
    });
  }

  if ((await prisma.shippingZone.count()) === 0) {
    await prisma.shippingZone.create({
      data: {
        name: "Italy",
        countries: ["IT", "SM", "VA"],
        rates: { create: { name: "Standard shipping", priceCents: 490 } }, // PLACEHOLDER price; set delivery estimate in admin
      },
    });
    await prisma.shippingZone.create({
      data: {
        name: "European Union",
        countries: ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"],
        rates: { create: { name: "Standard EU shipping", priceCents: 790 } }, // PLACEHOLDER
      },
    });
  }

  for (const page of legalDefaults) {
    await prisma.legalPage.upsert({ where: { slug: page.slug }, update: {}, create: page });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
