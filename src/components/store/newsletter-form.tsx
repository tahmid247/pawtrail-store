"use client";
import { useFormAction } from "@/components/ui/use-form-action";
import Link from "next/link";
import { subscribeNewsletter } from "@/app/actions/engagement";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/consent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export function NewsletterForm({ id = "newsletter" }: { id?: string }) {
  const [state, action, pending] = useFormAction(subscribeNewsletter, null);
  if (state?.ok) return <p className="mt-4 rounded-xl bg-white p-4 text-sm font-medium text-success" role="status">{state.message}</p>;
  return (
    <form onSubmit={action} className="mt-4 space-y-3">
      <div className="flex gap-2">
        <label htmlFor={`${id}-email`} className="sr-only">Email address</label>
        <Input id={`${id}-email`} name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="bg-white" />
        <Button type="submit" disabled={pending} className="shrink-0">Subscribe</Button>
      </div>
      {/* Honeypot for bots */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-primary" />
        <span>{NEWSLETTER_CONSENT_TEXT} See our <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.</span>
      </label>
      {state?.error && <p className="text-xs font-medium text-danger" role="alert">{state.error}</p>}
    </form>
  );
}
