import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Container } from "@/components/ui/misc";
import { Markdown } from "@/components/markdown";

type Props = { params: Promise<{ slug: string }> };

async function getPage(slug: string) {
  return prisma.legalPage.findFirst({ where: { slug, published: true } });
}

/** Fills business placeholders from Settings so legal pages stay in sync with the admin's business data. */
async function fillPlaceholders(content: string) {
  const s = await getSettings();
  const map: Record<string, string> = {
    "[LEGAL BUSINESS NAME]": s.business.legalName,
    "[REGISTERED ADDRESS]": s.business.address,
    "[PARTITA IVA]": s.business.vatNumber,
    "[REA / COMPANY REGISTRATION NUMBER]": s.business.registrationNumber,
    "[PEC ADDRESS]": s.business.pec,
    "[SUPPORT EMAIL]": s.brand.supportEmail,
    "[WITHDRAWAL DAYS]": String(s.commerce.withdrawalDays),
    "[VAT RATE]": String(s.commerce.vatRatePercent),
  };
  return Object.entries(map).reduce((txt, [k, v]) => (v && !v.startsWith("[") ? txt.split(k).join(v) : txt), content);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPage((await params).slug);
  return page ? { title: page.title, alternates: { canonical: `/legal/${page.slug}` } } : {};
}

export default async function LegalPage({ params }: Props) {
  const page = await getPage((await params).slug);
  if (!page) notFound();
  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      <h1 className="text-3xl font-extrabold sm:text-4xl">{page.title}</h1>
      <p className="mt-2 text-sm text-muted">Version {page.version} · updated {page.updatedAt.toLocaleDateString("en-GB", { dateStyle: "long" })}</p>
      <article className="mt-10">
        <Markdown source={await fillPlaceholders(page.content)} />
      </article>
    </Container>
  );
}
