"use client";
import { useFormAction } from "@/components/ui/use-form-action";
import { confirmNewsletter, unsubscribeNewsletter } from "@/app/actions/newsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export function ConfirmNewsletter({ token }: { token: string }) {
  const [state, action, pending] = useFormAction(confirmNewsletter, null);
  if (state?.ok) return <p className="mt-6 font-medium text-success" role="status">{state.message}</p>;
  return (
    <form onSubmit={action} className="mt-8">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" disabled={pending}>Confirm subscription</Button>
      {state?.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}
    </form>
  );
}

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useFormAction(unsubscribeNewsletter, null);
  if (state?.ok) return <p className="mt-6 font-medium text-success" role="status">{state.message}</p>;
  return (
    <form onSubmit={action} className="mx-auto mt-8 max-w-sm space-y-3">
      <input type="hidden" name="token" value={token} />
      {!token && <Input name="email" type="email" required placeholder="Your email address" aria-label="Email address" />}
      <Button type="submit" disabled={pending} variant="outline" className="w-full">Unsubscribe</Button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
