import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireStaffPage({ adminOnly: true });
  const collections = await prisma.collection.findMany({ orderBy: { position: "asc" } });
  return (
    <>
      <PageHeader title="New product" description="Save the product first, then add variants, prices and images." />
      <ProductForm collections={collections} />
    </>
  );
}
