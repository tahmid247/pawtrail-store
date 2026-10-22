import type { Metadata } from "next";
import { Mail, MapPin } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { Container } from "@/components/ui/misc";
import { ContactForm } from "@/components/store/contact-form";

export const metadata: Metadata = { title: "Contact us", alternates: { canonical: "/contact" } };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ type?: string; order?: string }> }) {
  const [s, sp] = await Promise.all([getSettings(), searchParams]);
  return (
    <Container className="grid gap-12 py-12 sm:py-16 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <h1 className="text-4xl font-bold">Contact us</h1>
        <p className="mt-4 text-muted">Questions about an order, a return, or our products? We&apos;re here to help.</p>
        <ul className="mt-8 space-y-4 text-sm">
          <li className="flex gap-3"><Mail className="size-5 text-primary" aria-hidden /><a href={`mailto:${s.brand.supportEmail}`} className="hover:text-primary">{s.brand.supportEmail}</a></li>
          <li className="flex gap-3"><MapPin className="size-5 text-primary" aria-hidden /><span>{s.business.legalName}<br />{s.business.address}</span></li>
        </ul>
        <p className="mt-8 rounded-2xl bg-white p-4 text-sm text-[#4a4357] shadow-soft">
          To withdraw from a purchase, choose &ldquo;Withdrawal / return&rdquo; below and include your order number. For a damaged or incorrect item, please attach photos by replying to our confirmation email.
        </p>
      </div>
      <ContactForm defaultType={sp.type} defaultOrder={sp.order} />
    </Container>
  );
}
