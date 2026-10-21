import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { PageHeader, Table, td } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Newsletter" };

export default async function NewsletterAdmin() {
  await requireStaffPage({ adminOnly: true });
  const subs = await prisma.newsletterSubscription.findMany({ orderBy: { consentAt: "desc" }, take: 200 });
  const confirmed = subs.filter((s) => s.status === "CONFIRMED").length;
  return (
    <>
      <PageHeader title="Newsletter subscribers" description={`${confirmed} confirmed (double opt-in). Only email confirmed subscribers and always include an unsubscribe link to /newsletter/unsubscribe.`} actions={<a href="/api/admin/newsletter-export" className={buttonClass("outline", "sm")}>Export confirmed (CSV)</a>} />
      <Table head={["Email", "Status", "Source", "Consent", "Confirmed"]} empty={!subs.length}>
        {subs.map((s) => (
          <tr key={s.id}>
            <td className={td}>{s.email}</td>
            <td className={td}><Badge tone={s.status === "CONFIRMED" ? "success" : s.status === "PENDING" ? "warning" : "neutral"}>{s.status}</Badge></td>
            <td className={td}>{s.source}</td>
            <td className={td}>{s.consentAt.toLocaleDateString("en-GB")}</td>
            <td className={td}>{s.confirmedAt?.toLocaleDateString("en-GB") ?? "—"}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
