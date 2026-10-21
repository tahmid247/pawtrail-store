import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { PageHeader } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { Badge, Stars } from "@/components/ui/misc";
import { moderateReview } from "../actions/store";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  await requireStaffPage();
  const reviews = await prisma.review.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100, include: { product: true, order: { select: { number: true } } } });
  return (
    <>
      <PageHeader title="Reviews" description="Reviews come only from customers with a paid order. Approve or reject — never edit a customer's words. Negative reviews must not be suppressed just for being negative." />
      <ul className="space-y-4">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-center gap-2"><Stars rating={r.rating} /><Badge tone={r.status === "APPROVED" ? "success" : r.status === "PENDING" ? "warning" : "neutral"}>{r.status}</Badge>{r.verifiedPurchase && <Badge tone="violet">Verified · {r.order?.number}</Badge>}</div>
            <p className="mt-2 text-sm font-semibold">{r.title} <span className="font-normal text-muted">— {r.authorName} on {r.product.title}</span></p>
            <p className="mt-1 whitespace-pre-line text-sm">{r.body}</p>
            <div className="mt-3 flex gap-2">
              {r.status !== "APPROVED" && <ActionForm action={moderateReview} submitLabel="Approve" inline><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="APPROVED" /></ActionForm>}
              {r.status !== "REJECTED" && <ActionForm action={moderateReview} submitLabel="Reject" variant="outline" inline><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="REJECTED" /></ActionForm>}
            </div>
          </li>
        ))}
        {!reviews.length && <p className="text-sm text-muted">No reviews yet.</p>}
      </ul>
    </>
  );
}
