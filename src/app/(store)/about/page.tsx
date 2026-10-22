import type { Metadata } from "next";
import Image from "next/image";
import { getSettings } from "@/lib/settings";
import { Container } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "About us", alternates: { canonical: "/about" } };

export default async function AboutPage() {
  const s = await getSettings();
  return (
    <Container className="grid items-center gap-12 py-12 sm:py-20 lg:grid-cols-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">About {s.brand.name}</p>
        <h1 className="mt-3 text-4xl font-bold">{s.home.aboutTitle}</h1>
        <div className="mt-6 space-y-4 leading-relaxed text-[#4a4357]">
          {s.home.aboutBody.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <ButtonLink href="/shop" className="mt-8">Shop the collection</ButtonLink>
      </div>
      <div data-reveal="scale" className="relative aspect-square overflow-hidden rounded-[2rem] bg-lavender-pale">
        <Image src="/products/carry-strap-lifestyle.jpg" alt="Our pet water bottle carried outdoors on a sunny day" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
      </div>
    </Container>
  );
}
