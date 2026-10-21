import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

type Tone = "neutral" | "violet" | "success" | "warning" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-[#f2f0f5] text-[#4a4357]",
  violet: "bg-lavender text-primary-deep",
  success: "bg-[#e3f4ec] text-success",
  warning: "bg-[#fdf1d8] text-warning",
  danger: "bg-[#fde8e6] text-danger",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-line bg-white p-6 shadow-soft", className)} {...props} />;
}

/** Accessible disclosure built on <details>/<summary> (keyboard & screen-reader friendly, no JS). */
export function Accordion({ items, className }: { items: { title: ReactNode; content: ReactNode }[]; className?: string }) {
  return (
    <div className={cn("divide-y divide-line rounded-2xl border border-line bg-white", className)}>
      {items.map((item, i) => (
        <details key={i} className="group px-5 sm:px-6 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-semibold text-ink">
            <span>{item.title}</span>
            <ChevronDown className="size-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="pb-5 text-[0.95rem] leading-relaxed text-[#4a4357]">{item.content}</div>
        </details>
      ))}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, description, align = "center" }: { eyebrow?: string; title: ReactNode; description?: ReactNode; align?: "center" | "left" }) {
  return (
    <div className={cn("mb-10 max-w-2xl sm:mb-14", align === "center" && "mx-auto text-center")}>
      {eyebrow && <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>}
      <h2 className="text-3xl font-bold text-ink sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base text-muted sm:text-lg">{description}</p>}
    </div>
  );
}

export function Alert({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-xl px-4 py-3 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex text-primary", className)} aria-label={`${rating.toFixed(1)} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={cn("size-4", i <= Math.round(rating) ? "fill-current" : "fill-line")} aria-hidden>
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}
