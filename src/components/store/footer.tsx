import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Container } from "@/components/ui/misc";
import { LogoMark } from "./logo";
import { NewsletterForm } from "./newsletter-form";
import { CookieSettingsLink } from "./cookie-consent";

export async function Footer() {
  const s = await getSettings();
  const socials = [
    { label: "Instagram", href: s.social.instagram },
    { label: "Facebook", href: s.social.facebook },
    { label: "TikTok", href: s.social.tiktok },
  ].filter((x) => x.href);
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-24 overflow-hidden bg-night text-white">
      <div className="pointer-events-none absolute -left-32 -top-40 size-[30rem] rounded-full bg-primary/30 blur-3xl" aria-hidden />
      <Container data-reveal-stagger="fade" className="relative grid grid-cols-2 gap-10 py-16 lg:grid-cols-12">
        <div className="col-span-2 lg:col-span-3">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span translate="no" className="font-display text-lg font-extrabold text-white">{s.brand.name}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">{s.brand.tagline}</p>
          {socials.length > 0 && (
            <ul className="mt-6 flex gap-4 text-sm font-medium">
              {socials.map((x) => (
                <li key={x.label}>
                  <a href={x.href} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white">
                    {x.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <FooterCol title="Shop" links={[["All products", "/shop"], ["Portable Pet Water Bottle", "/products/portable-pet-water-bottle"], ["Cart", "/cart"]]} />
        <FooterCol title="Help" links={[["Contact us", "/contact"], ["Track an order", "/track"], ["FAQ", "/#faq"], ["My account", "/account"]]} />
        <FooterCol title="Policies" links={[["Terms & Conditions", "/legal/terms"], ["Shipping", "/legal/shipping"], ["Returns & Refunds", "/legal/returns"], ["Privacy Policy", "/legal/privacy"], ["Cookie Policy", "/legal/cookies"], ["Legal notice", "/legal/legal-notice"]]} />
        <div className="col-span-2 lg:col-span-3">
          <h2 className="text-sm font-bold">Stay in the loop</h2>
          <p className="mt-2 text-sm text-white/65">New products and the occasional offer. No spam — unsubscribe anytime.</p>
          <NewsletterForm tone="dark" />
        </div>
      </Container>
      <div className="relative border-t border-white/10">
        <Container className="flex flex-col gap-3 py-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {s.business.legalName} · {s.business.address} · VAT {s.business.vatNumber}
          </p>
          <div className="flex items-center gap-4">
            <span>Prices in EUR incl. VAT</span>
            <CookieSettingsLink className="underline underline-offset-2 hover:text-white" />
          </div>
        </Container>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="lg:col-span-2">
      <h2 className="text-sm font-bold text-white">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-white/65 transition hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
