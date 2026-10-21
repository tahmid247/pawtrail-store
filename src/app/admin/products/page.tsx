import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { availableFrom } from "@/lib/inventory";
import { PageHeader, Table, td } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Products" };

export default async function ProductsPage() {
  await requireStaffPage({ adminOnly: true });
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    include: { images: { orderBy: { position: "asc" }, take: 1 }, variants: { include: { inventory: true } } },
  });
  return (
    <>
      <PageHeader title="Products" actions={<ButtonLink href="/admin/products/new" size="sm">Add product</ButtonLink>} />
      <Table head={["", "Product", "Status", "Variants", "Price", "Available", "CJ mapped"]} empty={!products.length}>
        {products.map((p) => {
          const prices = p.variants.map((v) => v.priceCents);
          const mapped = p.variants.filter((v) => v.cjVariantId).length;
          return (
            <tr key={p.id}>
              <td className={td}>{p.images[0] && <Image src={p.images[0].url} alt="" width={48} height={48} className="size-12 rounded-lg object-cover" />}</td>
              <td className={td}><Link href={`/admin/products/${p.id}`} className="font-semibold text-primary hover:underline">{p.title}</Link><br /><span className="text-xs text-muted">/{p.slug}</span></td>
              <td className={td}><Badge tone={p.status === "ACTIVE" ? "success" : p.status === "DRAFT" ? "warning" : "neutral"}>{p.status}</Badge></td>
              <td className={td}>{p.variants.length}</td>
              <td className={td}>{prices.length ? formatMoney(Math.min(...prices)) : "—"}</td>
              <td className={td}>{p.variants.reduce((s, v) => s + availableFrom(v.inventory), 0)}</td>
              <td className={td}><Badge tone={mapped === p.variants.length && mapped > 0 ? "success" : "warning"}>{mapped}/{p.variants.length}</Badge></td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
