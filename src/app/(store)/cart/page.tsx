import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { getCart } from "@/lib/cart";
import { computeQuote } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { Alert, Container } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { CartLineControls, DiscountForm } from "@/components/store/cart-controls";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default async function CartPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  const cart = await getCart();
  const items = cart?.items ?? [];
  const quote = await computeQuote({
    items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    country: "IT",
    discountCode: cart?.discountCode,
  });

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-4xl font-extrabold">Your cart</h1>
      {cancelled && <Alert tone="warning" className="mt-6">Payment was cancelled — your order {cancelled} was not placed. Your cart is still here.</Alert>}
      {items.length === 0 ? (
        <div className="mt-10 rounded-3xl bg-lavender p-12 text-center">
          <ShoppingBag className="mx-auto size-10 text-primary" aria-hidden />
          <p className="mt-4 text-lg font-semibold">Your cart is empty</p>
          <ButtonLink href="/shop" className="mt-6">Continue shopping</ButtonLink>
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
          <ul className="divide-y divide-line border-y border-line">
            {quote.lines.map((l) => (
              <li key={l.variantId} className="flex gap-4 py-6 sm:gap-6">
                <Link href={`/products/${l.productSlug}`} className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-lavender-pale sm:size-28">
                  {l.imageUrl && <Image src={l.imageUrl} alt="" fill sizes="112px" className="object-cover" />}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex justify-between gap-4">
                    <div>
                      <Link href={`/products/${l.productSlug}`} className="font-semibold hover:text-primary">{l.productTitle}</Link>
                      <p className="text-sm text-muted">{l.variantTitle}</p>
                      <p className="mt-1 text-sm text-muted">{formatMoney(l.unitPriceCents, quote.currency)} each</p>
                    </div>
                    <p className="font-semibold">{formatMoney(l.totalCents, quote.currency)}</p>
                  </div>
                  {l.problem && <p className="mt-2 text-sm font-medium text-danger" role="alert">{l.problem}</p>}
                  <CartLineControls variantId={l.variantId} quantity={l.quantity} max={Math.max(l.quantity, Math.min(l.available, 99))} />
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-3xl border border-line bg-white p-6 shadow-soft lg:sticky lg:top-28" aria-label="Order summary">
            <h2 className="text-lg font-bold">Order summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <Row label="Subtotal" value={formatMoney(quote.subtotalCents, quote.currency)} />
              {quote.discount && <Row label={`Discount (${quote.discount.code})`} value={`−${formatMoney(quote.discountCents, quote.currency)}`} />}
              <Row
                label="Shipping"
                value={quote.shipping ? (quote.shippingCents === 0 ? "Free" : formatMoney(quote.shippingCents, quote.currency)) : "At checkout"}
                hint={quote.shipping ? `To Italy${quote.shipping.estimate ? ` · ${quote.shipping.estimate}` : ""}. Other countries at checkout.` : undefined}
              />
              <div className="flex justify-between border-t border-line pt-4 text-base font-bold">
                <dt>Estimated total</dt>
                <dd>{formatMoney(quote.totalCents, quote.currency)}</dd>
              </div>
              <p className="text-xs text-muted">Includes {formatMoney(quote.vatIncludedCents, quote.currency)} VAT ({quote.vatRatePercent}%).</p>
            </dl>
            <DiscountForm applied={quote.discount?.code ?? null} error={cart?.discountCode && !quote.discount ? quote.discountError : null} />
            {quote.problems.length > 0 && <Alert tone="danger" className="mt-4">Please fix the items marked above before checking out.</Alert>}
            <ButtonLink href="/checkout" size="lg" className="mt-6 w-full" aria-disabled={quote.problems.length > 0} tabIndex={quote.problems.length ? -1 : undefined} style={quote.problems.length ? { pointerEvents: "none", opacity: 0.5 } : undefined}>
              Checkout
            </ButtonLink>
            <Link href="/shop" className="mt-4 block text-center text-sm font-medium text-primary hover:underline">Continue shopping</Link>
          </aside>
        </div>
      )}
    </Container>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="flex justify-between">
        <dt className="text-muted">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
