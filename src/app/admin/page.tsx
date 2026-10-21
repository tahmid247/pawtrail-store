import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { availableFrom } from "@/lib/inventory";
import { getLaunchChecks } from "@/lib/launch-checks";
import { requireStaffPage } from "@/lib/session";
import { PageHeader, Panel, Stat } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/store/order-detail";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  const user = await requireStaffPage();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const paidWhere = { paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as ("PAID" | "PARTIALLY_REFUNDED" | "REFUNDED")[] } };
  const [allTime, last30, totalOrders, awaiting, completed, attention, failedFulfillment, inventory, recentOrders, activity, sessions30, carts30, checkouts30, openSupport, pendingReviews, pendingDeletions] = await Promise.all([
    prisma.order.aggregate({ where: paidWhere, _sum: { totalCents: true, refundedCents: true }, _count: true }),
    prisma.order.aggregate({ where: { ...paidWhere, paidAt: { gte: since } }, _sum: { totalCents: true, refundedCents: true }, _count: true }),
    prisma.order.count({ where: paidWhere }),
    prisma.order.count({ where: { paymentStatus: "PAID", fulfillmentStatus: { in: ["UNFULFILLED", "FAILED", "AWAITING_SUPPLIER_CONFIRMATION"] }, status: { not: "CANCELLED" } } }),
    prisma.order.count({ where: { fulfillmentStatus: "DELIVERED" } }),
    prisma.order.count({ where: { status: "REQUIRES_ATTENTION" } }),
    prisma.order.count({ where: { fulfillmentStatus: "FAILED" } }),
    prisma.inventory.findMany({ include: { variant: { include: { product: true } } } }),
    prisma.order.findMany({ where: { paymentStatus: { not: "UNPAID" } }, orderBy: { placedAt: "desc" }, take: 8 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { email: true } } } }),
    prisma.analyticsEvent.findMany({ where: { type: "page_view", createdAt: { gte: since } }, distinct: ["sessionId"], select: { sessionId: true } }),
    prisma.cart.count({ where: { createdAt: { gte: since } } }),
    prisma.order.count({ where: { placedAt: { gte: since } } }),
    prisma.supportRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.accountDeletionRequest.count({ where: { status: "PENDING" } }),
  ]);
  const checks = user.role === "ADMIN" ? await getLaunchChecks() : [];
  const net = (a: typeof allTime) => (a._sum.totalCents ?? 0) - (a._sum.refundedCents ?? 0);
  const lowStock = inventory.filter((i) => i.variant.active && availableFrom(i) <= i.lowStockThreshold);
  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

  return (
    <>
      <PageHeader title="Overview" description="Store performance and items needing attention." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue (30 days)" value={formatMoney(net(last30))} hint={`${last30._count} paid orders · net of refunds`} />
        <Stat label="Total sales (all time)" value={formatMoney(net(allTime))} hint={`${totalOrders} paid orders`} />
        <Stat label="Awaiting fulfillment" value={awaiting} hint={failedFulfillment ? `${failedFulfillment} failed submission(s)` : "Paid, not yet shipped"} />
        <Stat label="Completed orders" value={completed} hint="Delivered" />
      </div>

      {(attention > 0 || lowStock.length > 0 || openSupport > 0 || pendingReviews > 0 || pendingDeletions > 0) && (
        <Panel title="Needs attention" className="mt-6">
          <ul className="space-y-2 text-sm">
            {attention > 0 && <li><Link className="font-medium text-danger hover:underline" href="/admin/orders?status=attention">{attention} order(s) require attention (payment/stock mismatch)</Link></li>}
            {failedFulfillment > 0 && <li><Link className="font-medium text-danger hover:underline" href="/admin/orders?fulfillment=FAILED">{failedFulfillment} fulfillment submission(s) failed — retry available</Link></li>}
            {lowStock.length > 0 && <li><Link className="font-medium text-warning hover:underline" href="/admin/inventory">{lowStock.length} variant(s) at or below low-stock threshold</Link></li>}
            {openSupport > 0 && <li><Link className="hover:underline" href="/admin/support">{openSupport} open support request(s)</Link></li>}
            {pendingReviews > 0 && <li><Link className="hover:underline" href="/admin/reviews">{pendingReviews} review(s) awaiting moderation</Link></li>}
            {pendingDeletions > 0 && <li><Link className="hover:underline" href="/admin/customers">{pendingDeletions} account deletion request(s) — respond within 30 days</Link></li>}
          </ul>
        </Panel>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Recent orders" className="xl:col-span-2" actions={<Link href="/admin/orders" className="text-sm font-medium text-primary">All orders</Link>}>
          {recentOrders.length === 0 ? <p className="text-sm text-muted">No orders yet.</p> : (
            <ul className="divide-y divide-line text-sm">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold hover:text-primary">{o.number}</Link>
                  <span className="hidden text-muted sm:inline">{o.email}</span>
                  <OrderStatusBadge order={o} />
                  <span className="font-medium">{formatMoney(o.totalCents, o.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Conversion (30 days)">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Visitors (analytics consent only)</dt><dd className="font-semibold">{sessions30.length}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Carts created</dt><dd className="font-semibold">{carts30}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Checkouts started</dt><dd className="font-semibold">{checkouts30}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Paid orders</dt><dd className="font-semibold">{last30._count}</dd></div>
            <div className="flex justify-between border-t border-line pt-3"><dt className="text-muted">Checkout → paid</dt><dd className="font-semibold">{pct(last30._count, checkouts30)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Cart → paid</dt><dd className="font-semibold">{pct(last30._count, carts30)}</dd></div>
          </dl>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Inventory status" actions={<Link href="/admin/inventory" className="text-sm font-medium text-primary">Manage</Link>}>
          <ul className="divide-y divide-line text-sm">
            {inventory.map((i) => (
              <li key={i.id} className="flex justify-between py-2">
                <span>{i.variant.product.title} — {i.variant.title}</span>
                <span className={availableFrom(i) <= i.lowStockThreshold ? "font-semibold text-warning" : "font-semibold"}>{availableFrom(i)} available</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Recent activity" actions={user.role === "ADMIN" ? <Link href="/admin/audit" className="text-sm font-medium text-primary">Audit log</Link> : undefined}>
          <ul className="space-y-2 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span><span className="font-medium">{a.action}</span> <span className="text-muted">{a.entityType}</span></span>
                <span className="shrink-0 text-xs text-muted">{a.actor?.email ?? "system"} · {a.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
              </li>
            ))}
            {activity.length === 0 && <li className="text-muted">No activity yet.</li>}
          </ul>
        </Panel>
      </div>

      {checks.length > 0 && (
        <Panel title={`Launch readiness (${checks.filter((c) => c.ok).length}/${checks.length})`} className="mt-6">
          <ul className="space-y-2.5 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-3">
                {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Done" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-label="To do" />}
                <span>
                  {c.href ? <Link href={c.href} className="font-medium hover:text-primary">{c.label}</Link> : <span className="font-medium">{c.label}</span>}
                  {c.detail && <span className="block text-xs text-muted">{c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
