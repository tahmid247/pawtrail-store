import { BadgeCheck } from "lucide-react";
import { Stars } from "@/components/ui/misc";

type Review = { id: string; authorName: string; rating: number; title: string | null; body: string; verifiedPurchase: boolean; createdAt: Date };

export function ReviewList({ reviews }: { reviews: Review[] }) {
  return (
    <ul data-reveal-stagger className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-3xl bg-white p-6 shadow-soft">
          <Stars rating={r.rating} />
          {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#4a4357]">{r.body}</p>
          <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="font-semibold text-ink">{r.authorName}</span>
            {r.verifiedPurchase && (
              <span className="inline-flex items-center gap-1 text-success">
                <BadgeCheck className="size-3.5" aria-hidden /> Verified purchase
              </span>
            )}
            <time dateTime={r.createdAt.toISOString()}>{r.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>
          </p>
        </li>
      ))}
    </ul>
  );
}
