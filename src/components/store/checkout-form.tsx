"use client";
import { useFormAction } from "@/components/ui/use-form-action";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { startCheckout } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";

export function CheckoutForm(props: {
  email: string;
  lockedEmail: boolean;
  countries: { code: string; name: string }[];
  country: string;
  options: { id: string; name: string; price: string }[];
  selectedRate: string | null;
  canSubmit: boolean;
  totalLabel: string;
  withdrawalDays: number;
  seller: string;
}) {
  const [state, action, pending] = useFormAction(startCheckout, null);
  // Controlled fields: React resets uncontrolled inputs after a server action, which would wipe them on validation errors.
  const [email, setEmail] = useState(props.email);
  const [accepted, setAccepted] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    if (key === "country") next.delete("rate");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const fe = state?.fieldErrors ?? {};

  return (
    <form onSubmit={action} className="space-y-8" noValidate>
      <section className="space-y-4">
        <h2 className="text-lg font-bold">1. Contact</h2>
        <Field label="Email address" htmlFor="email" hint="We'll send your order confirmation and shipping updates here." error={fe.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} readOnly={props.lockedEmail} aria-invalid={Boolean(fe.email)} />
        </Field>
        {!props.lockedEmail && (
          <p className="text-sm text-muted">
            Have an account? <Link href="/account/login?next=/checkout" className="font-medium text-primary hover:underline">Sign in</Link> — or continue as a guest.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">2. Delivery</h2>
        <Field label="Shipping country" htmlFor="country" hint="You'll enter your full address on the secure payment page.">
          <Select id="country" name="country" value={props.country} onChange={(e) => update("country", e.target.value)} autoComplete="country">
            {props.countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
        </Field>
        {props.options.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Shipping method</legend>
            {props.options.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-line px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-lavender-pale">
                <span className="flex items-center gap-3 text-sm">
                  <input type="radio" name="shippingRateId" value={o.id} checked={props.selectedRate === o.id} onChange={() => update("rate", o.id)} className="accent-primary" />
                  {o.name}
                </span>
                <span className="text-sm font-semibold">{o.price}</span>
              </label>
            ))}
          </fieldset>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">3. Review &amp; pay</h2>
        <div className="rounded-2xl bg-lavender-pale p-4 text-sm leading-relaxed text-[#4a4357]">
          <p><strong>Seller:</strong> {props.seller}</p>
          <p className="mt-2">
            You have a {props.withdrawalDays}-day right of withdrawal from delivery (see <Link href="/legal/returns" className="text-primary underline">Returns &amp; Refunds</Link>). Products are covered by the 2-year legal guarantee of conformity. Orders are shipped by our logistics partner.
          </p>
        </div>
        <Checkbox
          name="acceptTerms"
          required
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          aria-invalid={Boolean(fe.acceptTerms)}
          label={
            <>
              I have read and accept the <Link href="/legal/terms" target="_blank" className="font-medium text-primary underline">Terms and Conditions</Link> and acknowledge the{" "}
              <Link href="/legal/privacy" target="_blank" className="font-medium text-primary underline">Privacy Policy</Link>.
            </>
          }
        />
        {fe.acceptTerms && <p className="text-xs font-medium text-danger" role="alert">{fe.acceptTerms}</p>}
        <Checkbox name="marketingOptIn" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} label="Optional: email me about new products and offers. I can unsubscribe at any time." />
      </section>

      {state?.error && <p className="rounded-xl bg-[#fde8e6] px-4 py-3 text-sm font-medium text-danger" role="alert">{state.error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pending || !props.canSubmit}>
        {pending ? "Redirecting to secure payment…" : `Order with obligation to pay · ${props.totalLabel}`}
      </Button>
      <p className="flex items-center justify-center gap-2 text-xs text-muted">
        <ShieldCheck className="size-4 text-success" aria-hidden /> Payment is processed securely by Stripe. We never see or store your card details.
      </p>
    </form>
  );
}
