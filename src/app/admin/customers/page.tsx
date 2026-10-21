import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { PageHeader, Panel, Table, td } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { processDeletionRequest } from "../actions/store";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireStaffPage();
  const q = (await searchParams).q?.trim().slice(0, 100);
  const [customers, deletions] = await Promise.all([
    prisma.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, name: true, email: true, role: true, emailVerified: true, createdAt: true, _count: { select: { orders: true } } },
    }),
    prisma.accountDeletionRequest.findMany({ where: { status: "PENDING" }, orderBy: { requestedAt: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Customers" description="Access to customer data is logged. Only view what you need to help the customer." />
      {deletions.length > 0 && (
        <Panel title="Pending account deletion requests" className="mb-6">
          <ul className="space-y-4">
            {deletions.map((d) => (
              <li key={d.id} className="rounded-xl border border-line p-4 text-sm">
                <p><strong>{d.email}</strong> · requested {d.requestedAt.toLocaleDateString("en-GB")} {d.reason && `· "${d.reason}"`}</p>
                {user.role === "ADMIN" && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <ActionForm action={processDeletionRequest} submitLabel="Erase account" variant="danger" confirmText="Permanently erase this account? Required order records are kept but unlinked." inline>
                      <input type="hidden" name="requestId" value={d.id} /><input type="hidden" name="decision" value="erase" />
                    </ActionForm>
                    <ActionForm action={processDeletionRequest} submitLabel="Reject" variant="outline" inline>
                      <input type="hidden" name="requestId" value={d.id} /><input type="hidden" name="decision" value="reject" />
                      <Input name="notes" placeholder="Reason (e.g. open dispute)" className="h-9 w-64" aria-label="Rejection reason" />
                    </ActionForm>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <form className="mb-4"><input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search customers" className="h-9 w-72 rounded-full border border-line bg-white px-4 text-sm" /></form>
      <Table head={["Customer", "Role", "Verified", "Orders", "Joined"]} empty={!customers.length}>
        {customers.map((c) => (
          <tr key={c.id}>
            <td className={td}><Link href={`/admin/customers/${c.id}`} className="font-semibold text-primary hover:underline">{c.name}</Link><br /><span className="text-xs text-muted">{c.email}</span></td>
            <td className={td}><Badge tone={c.role === "CUSTOMER" ? "neutral" : "violet"}>{c.role}</Badge></td>
            <td className={td}>{c.emailVerified ? "Yes" : "No"}</td>
            <td className={td}>{c._count.orders}</td>
            <td className={td}>{c.createdAt.toLocaleDateString("en-GB")}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
