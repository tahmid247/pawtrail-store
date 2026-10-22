"use client";
import { useFormAction } from "@/components/ui/use-form-action";
import Link from "next/link";
import { submitContact } from "@/app/actions/engagement";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

const TYPES = [
  ["GENERAL", "General question"],
  ["ORDER", "Question about my order"],
  ["DAMAGED_OR_INCORRECT", "Damaged, faulty or incorrect item"],
  ["WITHDRAWAL", "Withdrawal / return"],
  ["DATA_REQUEST", "Privacy / personal data request"],
];

export function ContactForm({ defaultType, defaultOrder }: { defaultType?: string; defaultOrder?: string }) {
  const [state, action, pending] = useFormAction(submitContact, null);
  if (state?.ok) return <div className="rounded-3xl bg-white p-8 text-center shadow-soft font-medium text-success" role="status">{state.message}</div>;
  return (
    <form onSubmit={action} className="space-y-5 rounded-3xl border border-line bg-white p-6 shadow-soft sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="c-name"><Input id="c-name" name="name" required maxLength={120} autoComplete="name" /></Field>
        <Field label="Email" htmlFor="c-email"><Input id="c-email" name="email" type="email" required autoComplete="email" /></Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Topic" htmlFor="c-type">
          <Select id="c-type" name="type" defaultValue={TYPES.some(([v]) => v === defaultType) ? defaultType : "GENERAL"}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Order number (optional)" htmlFor="c-order"><Input id="c-order" name="orderNumber" maxLength={40} defaultValue={defaultOrder} /></Field>
      </div>
      <Field label="Subject" htmlFor="c-subject"><Input id="c-subject" name="subject" required maxLength={200} /></Field>
      <Field label="Message" htmlFor="c-message"><Textarea id="c-message" name="message" required minLength={10} maxLength={5000} rows={6} /></Field>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <p className="text-xs text-muted">We use your details only to answer your request. See our <Link className="underline" href="/legal/privacy">Privacy Policy</Link>.</p>
      {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send message"}</Button>
    </form>
  );
}
