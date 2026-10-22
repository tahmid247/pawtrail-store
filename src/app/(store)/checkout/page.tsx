import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getCart } from "@/lib/cart";
import { computeQuote } from "@/lib/pricing";
import { getShippingCountries, getShippingOptions } from "@/lib/shipping";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import { getPaymentProvider } from "@/lib/payments";
import { countryName } from "@/lib/countries";
import { formatMoney } from "@/lib/money";
import { Alert, Container } from "@/components/ui/misc";
import { CheckoutForm } from "@/components/store/checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ country?: string; rate?: string }> }) {
  const sp = await searchParams;
  const cart = await getCart();
  if (!cart || cart.items.length === 0) redirect("/cart");

  const [settings, user, countries] = await Promise.all([getSettings(), getCurrentUser(), getShippingCountries()]);
  const country = sp.country && countries.includes(sp.country.toUpperCase()) ? sp.country.toUpperCase() : countries.includes("IT") ? "IT" : countries[0];
  const options = country ? await getShippingOptions(country) : [];
  const quote = await computeQuote({
    items: cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    country,
    shippingRateId: sp.rate,
    discountCode: cart.discountCode,
  });
  const provider = getPaymentProvider();

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="flex items-center gap-3 text-3xl font-bold sm:text-4xl">
        Checkout <Lock className="size-6 text-primary" aria-label="Secure" />
      </h1>
      {!provider && <Alert tone="danger" className="mt-6">Online payments are not available yet. Please check back soon.</Alert>}
      {provider?.name === "simulated" && (
        <Alert tone="warning" className="mt-6">
          <strong>Test mode:</strong> Stripe is not configured, so payments are simulated. No money will be charged. (This mode is disabled in production.)
        </Alert>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]">
        <CheckoutForm
          email={user?.email ?? ""}
          lockedEmail={Boolean(user)}
          countries={countries.map((c) => ({ code: c, name: countryName(c) }))}
          country={country ?? ""}
          options={options.map((o) => ({
            id: o.rateId,
            name: o.name,
            price: formatMoney(quote.shipping?.rateId === o.rateId ? quote.shippingCents : o.priceCents),
          }))}
          selectedRate={quote.shipping?.rateId ?? null}
          canSubmit={quote.canCheckout && Boolean(provider)}
          totalLabel={formatMoney(quote.totalCents, quote.currency)}
          withdrawalDays={settings.commerce.withdrawalDays}
          seller={`${settings.business.legalName}, ${settings.business.address} — VAT ${settings.business.vatNumber} — ${settings.brand.supportEmail}`}
        />

        <aside className="h-fit rounded-3xl border border-line bg-white p-6 shadow-soft lg:sticky lg:top-28" aria-label="Order summary">
          <h2 className="text-lg font-bold">Order summary</h2>
          <ul className="mt-5 space-y-4">
            {quote.lines.map((l) => (
              <li key={l.variantId} className="flex gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white">
                  {l.imageUrl && <Image src={l.imageUrl} alt="" fill sizes="64px" className="object-cover" />}
                  <span className="absolute right-1 top-1 rounded-full bg-ink px-1.5 text-[0.65rem] font-bold text-white">{l.quantity}</span>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{l.productTitle}</p>
                  <p className="text-muted">{l.variantTitle}</p>
                  {l.problem && <p className="text-danger">{l.problem}</p>}
                </div>
                <p className="text-sm font-bold">{formatMoney(l.totalCents, quote.currency)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatMoney(quote.subtotalCents, quote.currency)}</dd></div>
            {quote.discount && <div className="flex justify-between"><dt className="text-muted">Discount ({quote.discount.code})</dt><dd>−{formatMoney(quote.discountCents, quote.currency)}</dd></div>}
            <div className="flex justify-between">
              <dt className="text-muted">Shipping {country ? `to ${countryName(country)}` : ""}</dt>
              <dd>{quote.shipping ? (quote.shippingCents === 0 ? "Free" : formatMoney(quote.shippingCents, quote.currency)) : "—"}</dd>
            </div>
            {quote.shipping && (
              <p className="text-xs text-muted">
                {quote.shipping.name}: {quote.shipping.estimate ? `estimated delivery ${quote.shipping.estimate} after dispatch` : "delivery estimate confirmed by email at dispatch"}
              </p>
            )}
            <div className="flex justify-between border-t border-line pt-4 text-base font-bold"><dt>Total</dt><dd>{formatMoney(quote.totalCents, quote.currency)}</dd></div>
            <p className="text-xs text-muted">Including {formatMoney(quote.vatIncludedCents, quote.currency)} VAT ({quote.vatRatePercent}%). No additional fees.</p>
          </dl>
          {quote.problems.length > 0 && (
            <Alert tone="danger" className="mt-4">
              {quote.problems.join(" ")} <Link href="/cart" className="underline">Review cart</Link>
            </Alert>
          )}
        </aside>
      </div>
    </Container>
  );
}
