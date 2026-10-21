import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { PageHeader, Table, td } from "@/components/admin/ui";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requireStaffPage({ adminOnly: true });
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { email: true } } } });
  return (
    <>
      <PageHeader title="Audit log" description="Most recent 200 administrative actions." />
      <Table head={["When", "Who", "Action", "Entity", "Details"]} empty={!logs.length}>
        {logs.map((l) => (
          <tr key={l.id}>
            <td className={td}>{l.createdAt.toLocaleString("en-GB")}</td>
            <td className={td}>{l.actor?.email ?? "system"}</td>
            <td className={td}>{l.action}</td>
            <td className={td}>{l.entityType} <span className="text-xs text-muted">{l.entityId}</span></td>
            <td className={`${td} max-w-xs truncate font-mono text-xs`}>{l.metadata ? JSON.stringify(l.metadata) : ""}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
