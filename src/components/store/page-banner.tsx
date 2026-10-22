import type { ReactNode } from "react";
import { Container } from "@/components/ui/misc";

/** Deep-violet title band used at the top of secondary pages (shop, collections, legal, contact). */
export function PageBanner({ title, children, eyebrow }: { title: ReactNode; children?: ReactNode; eyebrow?: string }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-night via-primary-deep to-primary text-white">
      <div className="pointer-events-none absolute -right-24 -top-32 size-96 rounded-full bg-glow/25 blur-3xl" aria-hidden />
      <Container className="relative py-12 sm:py-16">
        {eyebrow && <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-glow">{eyebrow}</p>}
        <h1 className="text-4xl font-extrabold sm:text-5xl">{title}</h1>
        {children && <div className="mt-4 text-white/75">{children}</div>}
      </Container>
    </section>
  );
}
