import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { audit } from "@/lib/audit";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { Select } from "@/components/ui/field";
import { OrderStatusBadge } from "@/components/store/order-detail";
import { setUserRole } from "../../actions/store";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaffPage();
  const { id } = await params;
  const c = await prisma.user.findUnique({
    where: { id },
    include: { profile: true, addresses: true, orders: { orderBy: { placedAt: "desc" } }, supportRequests: { orderBy: { createdAt: "desc" } } },
  });
  if (!c) notFound();
  await audit(viewer.id, "customer.viewed", "User", id); // access to personal data is logged
  const sub = await prisma.newsletterSubscription.findUnique({ where: { email: c.email } });
  return (
    <>
      <PageHeader title={c.name} description={`${c.email} · joined ${c.createdAt.toLocaleDateString("en-GB")} · 2FA ${c.twoFactorEnabled ? "on" : "off"}`} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Orders" className="xl:col-span-2">
          <ul className="divide-y divide-line text-sm">
            {c.orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2">
                <Link href={`/admin/orders/${o.id}`} className="font-semibold text-primary">{o.number}</Link>
                <OrderStatusBadge order={o} />
                <span>{formatMoney(o.totalCents, o.currency)}</span>
              </li>
            ))}
            {!c.orders.length && <li className="py-2 text-muted">No orders.</li>}
          </ul>
        </Panel>
        <div className="space-y-6">
          <Panel title="Details">
            <p className="text-sm">Phone: {c.profile?.phone ?? "—"}<br />Marketing: {sub?.status ?? "not subscribed"}</p>
            <ul className="mt-3 space-y-2 text-xs text-muted">{c.addresses.map((a) => <li key={a.id}>{a.fullName}, {a.line1}, {a.postalCode} {a.city}, {a.country}</li>)}</ul>
          </Panel>
          {viewer.role === "ADMIN" && viewer.id !== c.id && (
            <Panel title="Role">
              <ActionForm action={setUserRole} submitLabel="Update role" confirmText="Change this user's role? Staff roles grant access to customer data." inline>
                <input type="hidden" name="userId" value={c.id} />
                <Select name="role" defaultValue={c.role} className="h-9 w-40" aria-label="Role"><option>CUSTOMER</option><option>SUPPORT</option><option>ADMIN</option></Select>
              </ActionForm>
            </Panel>
          )}
          <Panel title="Support requests">
            <ul className="space-y-2 text-sm">{c.supportRequests.map((s) => <li key={s.id}>{s.subject} · {s.status}</li>)}{!c.supportRequests.length && <li className="text-muted">None.</li>}</ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
