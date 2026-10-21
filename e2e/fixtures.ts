/** E2E-only fixtures: mock CJ variant IDs and logistics settings (an admin enters the real ones). */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL?.includes("_e2e")) throw new Error("e2e fixtures only run against the e2e database");
  for (const v of await prisma.productVariant.findMany()) {
    await prisma.productVariant.update({ where: { id: v.id }, data: { cjVariantId: `MOCK-VID-${v.sku}` } });
  }
  await prisma.storeSetting.upsert({
    where: { key: "fulfillment" },
    create: { key: "fulfillment", value: { mode: "cj_api", autoSubmitOnPayment: false, cjLogisticName: "MockPost", cjFromCountryCode: "DE", cjStorageId: "", cjWarehouseCountryCode: "" } },
    update: {},
  });
}

main().finally(() => prisma.$disconnect());
