import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { PageHeader, Table, td } from "@/components/admin/ui";
import { Alert, Badge } from "@/components/ui/misc";

export const metadata = { title: "Legal pages" };

export default async function LegalAdminPage() {
  await requireStaffPage({ adminOnly: true });
  const pages = await prisma.legalPage.findMany({ orderBy: { slug: "asc" } });
  return (
    <>
      <PageHeader title="Legal pages" />
      <Alert tone="warning" className="mb-6">These are editable drafts, not legal advice. Have them reviewed by a qualified professional before launch; the store does not make you automatically compliant.</Alert>
      <Table head={["Page", "Version", "Status", "Updated"]}>
        {pages.map((p) => (
          <tr key={p.id}>
            <td className={td}><Link href={`/admin/legal/${p.slug}`} className="font-semibold text-primary">{p.title}</Link><br /><span className="text-xs text-muted">/legal/{p.slug}</span></td>
            <td className={td}>{p.version}</td>
            <td className={td}>{p.content.includes("DRAFT —") ? <Badge tone="warning">Draft</Badge> : <Badge tone="success">Reviewed</Badge>}{!p.published && <Badge className="ml-1">Unpublished</Badge>}</td>
            <td className={td}>{p.updatedAt.toLocaleDateString("en-GB")}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
