import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { PageHeader } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { updateSupportRequest } from "../actions/store";

export const metadata = { title: "Support" };

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireStaffPage();
  const all = (await searchParams).all === "1";
  const requests = await prisma.supportRequest.findMany({ where: all ? {} : { status: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <PageHeader title="Support requests" description="Withdrawal requests must be acknowledged; refunds are due within 14 days of the withdrawal notice." actions={<Link href={all ? "/admin/support" : "/admin/support?all=1"} className="text-sm font-medium text-primary">{all ? "Show open only" : "Show all"}</Link>} />
      <ul className="space-y-4">
        {requests.map((r) => (
          <li key={r.id} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={r.type === "WITHDRAWAL" || r.type === "DAMAGED_OR_INCORRECT" ? "danger" : r.type === "DATA_REQUEST" ? "violet" : "neutral"}>{r.type.replaceAll("_", " ")}</Badge>
              <Badge>{r.status}</Badge>
              <span className="text-xs text-muted">{r.createdAt.toLocaleString("en-GB")}</span>
            </div>
            <p className="mt-2 font-semibold">{r.subject}</p>
            <p className="text-sm text-muted">{r.name} · <a href={`mailto:${r.email}`} className="text-primary">{r.email}</a>{r.orderNumber && <> · order {r.orderNumber}</>}</p>
            <p className="mt-3 whitespace-pre-line rounded-xl bg-lavender-pale p-3 text-sm">{r.message}</p>
            <ActionForm action={updateSupportRequest} className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-start">
              <input type="hidden" name="id" value={r.id} />
              <Select name="status" defaultValue={r.status} className="h-10" aria-label="Status"><option>OPEN</option><option>IN_PROGRESS</option><option>RESOLVED</option><option>CLOSED</option></Select>
              <Textarea name="adminNotes" defaultValue={r.adminNotes ?? ""} rows={1} placeholder="Internal notes" aria-label="Internal notes" className="min-h-10" />
            </ActionForm>
          </li>
        ))}
        {!requests.length && <p className="text-sm text-muted">No requests.</p>}
      </ul>
    </>
  );
}
