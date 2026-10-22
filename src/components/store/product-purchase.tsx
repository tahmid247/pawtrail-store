"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShieldCheck, Truck, Undo2 } from "lucide-react";
import { addToCart } from "@/app/actions/cart";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { formatMoney } from "@/lib/money";

type Variant = { id: string; title: string; priceCents: number; currency: string; swatchHex: string | null; available: number; imageId: string | null };

export function ProductPurchase({
  productTitle,
  variants,
  maxPerOrder,
  shippingSummary,
  withdrawalDays,
  compact = false,
}: {
  productTitle: string;
  variants: Variant[];
  maxPerOrder: number;
  shippingSummary: string | null;
  withdrawalDays: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const firstAvailable = variants.find((v) => v.available > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [showSticky, setShowSticky] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const max = Math.max(0, Math.min(variant?.available ?? 0, maxPerOrder));
  const soldOut = !variant || variant.available <= 0;

  useEffect(() => setQty((q) => Math.min(Math.max(1, q), Math.max(1, max))), [max]);

  useEffect(() => {
    if (compact || !ctaRef.current) return;
    const obs = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    obs.observe(ctaRef.current);
    return () => obs.disconnect();
  }, [compact]);

  const submit = (buyNow: boolean) =>
    start(async () => {
      if (!variant) return;
      setMessage(null);
      const res = await addToCart({ variantId: variant.id, quantity: qty });
      if (!res.ok) return setMessage({ ok: false, text: res.message ?? "Could not add to cart." });
      if (buyNow) router.push("/checkout");
      else setMessage({ ok: true, text: "Added to your cart." });
    });

  if (!variant) return <p className="text-muted">This product is currently unavailable.</p>;

  return (
    <div>
      <p className="font-display text-3xl font-bold text-ink" aria-live="polite">
        <span translate="no">{formatMoney(variant.priceCents, variant.currency)}</span>
        <span className="ml-2 align-middle text-sm font-medium text-muted">incl. VAT</span>
      </p>

      {variants.length > 1 && (
        <fieldset className="mt-6">
          <legend className="mb-3 text-sm font-semibold">
            Colour: <span className="font-normal text-muted">{variant.title}</span>
          </legend>
          <div className="flex flex-wrap gap-3">
            {variants.map((v) => (
              <label key={v.id} className="group relative cursor-pointer" title={v.title}>
                <input type="radio" name="variant" value={v.id} checked={v.id === variantId} onChange={() => setVariantId(v.id)} className="peer sr-only" />
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full border-2 border-white ring-2 transition peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2",
                    v.id === variantId ? "ring-primary" : "ring-line group-hover:ring-muted/50",
                    v.available <= 0 && "opacity-40",
                  )}
                  style={{ backgroundColor: v.swatchHex ?? "#eee" }}
                >
                  {v.id === variantId && <Check className="size-4 text-ink/70" aria-hidden />}
                </span>
                <span className="sr-only">
                  {v.title}
                  {v.available <= 0 ? " (out of stock)" : ""}
                </span>
                {v.available <= 0 && <span className="pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-12 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-muted/60" aria-hidden />}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="mt-5 flex items-center gap-2 text-sm font-medium" role="status">
        <span className={cn("size-2 rounded-full", soldOut ? "bg-danger" : "bg-success")} aria-hidden />
        {soldOut ? (
          <span className="text-danger">Out of stock</span>
        ) : variant.available <= 5 ? (
          <span key={variant.id} className="text-ink">In stock — <span translate="no">{variant.available}</span> available</span>
        ) : (
          <span className="text-success">In stock, ready to ship</span>
        )}
      </p>

      <div ref={ctaRef} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex h-13 min-h-[3.25rem] items-center justify-between rounded-full border border-line px-2 sm:w-36" role="group" aria-label="Quantity">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1 || soldOut} className="rounded-full p-2 hover:bg-lavender-pale disabled:opacity-40" aria-label="Decrease quantity">
            <Minus className="size-4" />
          </button>
          <span translate="no" className="min-w-8 text-center font-semibold tabular-nums" aria-live="polite" aria-label={`Quantity ${qty}`}>{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max || soldOut} className="rounded-full p-2 hover:bg-lavender-pale disabled:opacity-40" aria-label="Increase quantity">
            <Plus className="size-4" />
          </button>
        </div>
        <Button size="lg" className="flex-1" disabled={soldOut || pending} onClick={() => submit(false)}>
          {soldOut ? "Sold out" : pending ? "Adding…" : "Add to Cart"}
        </Button>
      </div>
      <Button size="lg" variant="secondary" className="mt-3 w-full" disabled={soldOut || pending} onClick={() => submit(true)}>
        Buy Now
      </Button>

      {message && (
        <p className={cn("mt-3 text-sm font-medium", message.ok ? "text-success" : "text-danger")} role={message.ok ? "status" : "alert"}>
          {message.text}{" "}
          {message.ok && (
            <a href="/cart" className="underline underline-offset-2">View cart</a>
          )}
        </p>
      )}

      {!compact && (
        <ul className="mt-8 space-y-3 border-t border-line pt-6 text-sm text-[#4a4357]">
          <li className="flex gap-3"><Truck className="size-5 shrink-0 text-primary" aria-hidden />{shippingSummary ?? "Shipping cost and delivery estimate shown at checkout before you pay."}</li>
          <li className="flex gap-3"><Undo2 className="size-5 shrink-0 text-primary" aria-hidden />{withdrawalDays}-day right of withdrawal on eligible orders.</li>
          <li className="flex gap-3"><ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden />Secure checkout by Stripe — we never see your card details.</li>
        </ul>
      )}

      {!compact && showSticky && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-3 shadow-lift backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{productTitle}</p>
              <p className="text-sm text-muted">{variant.title} · <span translate="no" className="font-bold text-ink">{formatMoney(variant.priceCents, variant.currency)}</span></p>
            </div>
            <Button disabled={soldOut || pending} onClick={() => submit(false)}>{soldOut ? "Sold out" : "Add to Cart"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
