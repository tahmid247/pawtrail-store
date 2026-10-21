import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { PageHeader, Table, td } from "@/components/admin/ui";
import { Badge } from "@/components/ui/misc";
import { PayBadge } from "@/components/admin/badges";

export const metadata = { title: "Orders" };

const FILTERS: [string, string, Prisma.OrderWhereInput][] = [
  ["all", "All paid", { paymentStatus: { notIn: ["UNPAID", "EXPIRED", "FAILED"] } }],
  ["to-fulfil", "To fulfil", { paymentStatus: "PAID", status: "CONFIRMED", fulfillmentStatus: { in: ["UNFULFILLED", "FAILED"] } }],
  ["at-supplier", "At supplier", { fulfillmentStatus: { in: ["SUBMITTED", "AWAITING_SUPPLIER_CONFIRMATION", "PROCESSING"] } }],
  ["shipped", "Shipped", { fulfillmentStatus: "SHIPPED" }],
  ["attention", "Needs attention", { status: "REQUIRES_ATTENTION" }],
  ["refunded", "Refunded", { paymentStatus: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] } }],
  ["unpaid", "Unpaid / abandoned", { paymentStatus: { in: ["UNPAID", "EXPIRED", "FAILED"] } }],
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; fulfillment?: string; q?: string }> }) {
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f[0] === sp.status) ?? FILTERS[0];
  const q = sp.q?.trim().slice(0, 100);
  const where: Prisma.OrderWhereInput = {
    ...filter[2],
    ...(sp.fulfillment === "FAILED" ? { fulfillmentStatus: "FAILED" } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { customerName: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const orders = await prisma.order.findMany({ where, orderBy: { placedAt: "desc" }, take: 100, include: { _count: { select: { items: true } } } });
  return (
    <>
      <PageHeader title="Orders" description="Showing the 100 most recent matching orders." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex flex-wrap gap-2" aria-label="Filters">
          {FILTERS.map(([key, label]) => (
            <Link key={key} href={`/admin/orders?status=${key}`} className={`rounded-full px-3 py-1.5 text-sm font-medium ${filter[0] === key ? "bg-primary text-white" : "bg-white ring-1 ring-line hover:ring-primary"}`}>{label}</Link>
          ))}
        </nav>
        <form className="flex gap-2">
          <input type="hidden" name="status" value={filter[0]} />
          <input name="q" defaultValue={q} placeholder="Search number, email, name" aria-label="Search orders" className="h-9 rounded-full border border-line bg-white px-4 text-sm" />
        </form>
      </div>
      <Table head={["Order", "Date", "Customer", "Payment", "Fulfillment", "Total"]} empty={orders.length === 0}>
        {orders.map((o) => (
          <tr key={o.id} className="hover:bg-lavender-pale/40">
            <td className={td}><Link href={`/admin/orders/${o.id}`} className="font-semibold text-primary hover:underline">{o.number}</Link>{o.status === "REQUIRES_ATTENTION" && <Badge tone="danger" className="ml-2">Attention</Badge>}</td>
            <td className={td}>{o.placedAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
            <td className={td}>{o.customerName ?? "—"}<br /><span className="text-xs text-muted">{o.email}</span></td>
            <td className={td}><PayBadge s={o.paymentStatus} /></td>
            <td className={td}><Badge tone={o.fulfillmentStatus === "FAILED" ? "danger" : o.fulfillmentStatus === "DELIVERED" || o.fulfillmentStatus === "SHIPPED" ? "success" : "neutral"}>{o.fulfillmentStatus.replaceAll("_", " ").toLowerCase()}</Badge></td>
            <td className={td}>{formatMoney(o.totalCents, o.currency)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
