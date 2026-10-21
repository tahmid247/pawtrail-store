"use client";
import Link from "next/link";
import { useFormAction } from "@/components/ui/use-form-action";
import { createFirstAdmin } from "@/app/actions/setup";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";

export function SetupForm() {
  const [state, action, pending] = useFormAction(createFirstAdmin, null);
  if (state?.ok)
    return (
      <div className="space-y-4">
        <Alert tone="success">{state.message}</Alert>
        <Link href="/account/login?next=/admin" className={buttonClass("primary", "md", "w-full")}>Sign in</Link>
      </div>
    );
  return (
    <form onSubmit={action} className="space-y-4">
      <Field label="Your name" htmlFor="name"><Input id="name" name="name" required autoComplete="name" /></Field>
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
      <Field label="Password" htmlFor="password" hint="At least 12 characters."><Input id="password" name="password" type="password" minLength={12} required autoComplete="new-password" /></Field>
      <Field label="Confirm password" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" minLength={12} required autoComplete="new-password" /></Field>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>Create admin account</Button>
    </form>
  );
}
