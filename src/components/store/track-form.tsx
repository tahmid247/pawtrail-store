"use client";
import { useFormAction } from "@/components/ui/use-form-action";
import { lookupOrder } from "@/app/actions/track";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function TrackForm() {
  const [state, action, pending] = useFormAction(lookupOrder, null);
  return (
    <div>
      <form onSubmit={action} className="mt-8 space-y-4">
        <Field label="Order number" htmlFor="number"><Input id="number" name="number" required maxLength={20} autoComplete="off" className="uppercase" /></Field>
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
        <Button type="submit" disabled={pending} className="w-full">Find order</Button>
      </form>
      {state?.error && <p className="mt-4 text-sm text-danger" role="alert">{state.error}</p>}
      {state?.order && (
        <div className="mt-8 rounded-2xl border border-line p-5" role="status">
          <p className="font-bold">Order {state.order.number}</p>
          <p className="mt-1 text-sm text-muted">Placed {state.order.placedAt}</p>
          <p className="mt-3 text-sm"><strong>Status:</strong> {state.order.status}</p>
          {state.order.tracking.map((t) => (
            <p key={t.number} className="mt-2 text-sm">
              <strong>Tracking:</strong> {t.carrier ?? ""} <span className="font-mono">{t.number}</span>
              {t.url && <> · <a className="text-primary underline" href={t.url} target="_blank" rel="noopener noreferrer">Track parcel</a></>}
            </p>
          ))}
          <p className="mt-4 text-xs text-muted">For full details use the link in your confirmation email, or sign in to your account.</p>
        </div>
      )}
    </div>
  );
}
