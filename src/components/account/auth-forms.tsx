"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { safeNext } from "@/lib/safe-next";


function useNext() {
  return safeNext(useSearchParams().get("next"));
}

export function LoginForm() {
  const router = useRouter();
  const next = useNext();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [unverified, setUnverified] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        setError(null);
        const { data, error } = await authClient.signIn.email({
          email: String(fd.get("email")),
          password: String(fd.get("password")),
          rememberMe: fd.get("remember") === "on",
        });
        setPending(false);
        if (error) {
          setUnverified(error.status === 403);
          setError(error.status === 403 ? "Please verify your email first — we've sent you a new link." : error.status === 429 ? "Too many attempts. Please wait a minute." : "Incorrect email or password.");
          return;
        }
        if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
          router.push(`/account/two-factor?next=${encodeURIComponent(next)}`);
          return;
        }
        router.push(next);
        router.refresh();
      }}
    >
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      <div className="flex items-center justify-between">
        <Checkbox name="remember" label="Keep me signed in" defaultChecked />
        <Link href="/account/forgot" className="text-sm font-medium text-primary hover:underline">Forgot password?</Link>
      </div>
      {error && <Alert tone={unverified ? "warning" : "danger"}>{error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (done)
    return <Alert tone="success">We&apos;ve sent a verification link to <strong>{done}</strong>. Click it to activate your account.</Alert>;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const password = String(fd.get("password"));
        if (password !== String(fd.get("confirm"))) return setError("Passwords do not match.");
        setPending(true);
        setError(null);
        const email = String(fd.get("email"));
        const { error } = await authClient.signUp.email({ name: String(fd.get("name")), email, password, callbackURL: "/account" });
        setPending(false);
        // Same message whether or not the email exists, to avoid account enumeration.
        if (error && error.status !== 422) return setError(error.status === 429 ? "Too many attempts. Please wait a minute." : (error.message ?? "Could not create the account."));
        setDone(email);
      }}
    >
      <Field label="Name" htmlFor="name"><Input id="name" name="name" autoComplete="name" required maxLength={100} /></Field>
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters."><Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></Field>
      <Field label="Confirm password" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required /></Field>
      <p className="text-xs text-muted">By creating an account you agree to our <Link href="/legal/terms" className="underline">Terms</Link> and acknowledge our <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.</p>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
    </form>
  );
}

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  if (sent) return <Alert tone="success">If an account exists for that email, a reset link is on its way. It is valid for one hour.</Alert>;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        await authClient.requestPasswordReset({ email: String(new FormData(e.currentTarget).get("email")), redirectTo: "/account/reset-password" });
        setPending(false);
        setSent(true);
      }}
    >
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Button type="submit" className="w-full" disabled={pending}>Send reset link</Button>
    </form>
  );
}

export function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(params.get("error") ? "This reset link is invalid or has expired." : null);
  const [done, setDone] = useState(false);
  if (done) return <Alert tone="success">Your password has been updated and all sessions were signed out. <Link href="/account/login" className="underline">Sign in</Link></Alert>;
  if (!token) return <Alert tone="danger">{error ?? "Missing reset token."} <Link href="/account/forgot" className="underline">Request a new link</Link></Alert>;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const newPassword = String(fd.get("password"));
        if (newPassword !== String(fd.get("confirm"))) return setError("Passwords do not match.");
        const { error } = await authClient.resetPassword({ newPassword, token });
        if (error) return setError("This reset link is invalid or has expired.");
        setDone(true);
      }}
    >
      <Field label="New password" htmlFor="password" hint="At least 10 characters."><Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /></Field>
      <Field label="Confirm new password" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required /></Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" className="w-full">Update password</Button>
    </form>
  );
}

export function TwoFactorChallenge() {
  const router = useRouter();
  const next = useNext();
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const code = String(fd.get("code")).replace(/\s/g, "");
        setPending(true);
        const { error } = useBackup
          ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: false })
          : await authClient.twoFactor.verifyTotp({ code, trustDevice: fd.get("trust") === "on" });
        setPending(false);
        if (error) return setError(error.status === 429 ? "Too many attempts. Please wait." : "Invalid code. Please try again.");
        router.push(next);
        router.refresh();
      }}
    >
      <Field label={useBackup ? "Backup code" : "6-digit code from your authenticator app"} htmlFor="code">
        <Input id="code" name="code" inputMode={useBackup ? "text" : "numeric"} autoComplete="one-time-code" required autoFocus maxLength={useBackup ? 20 : 6} />
      </Field>
      {!useBackup && <Checkbox name="trust" label="Trust this device for 30 days" />}
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>Verify</Button>
      <button type="button" className="w-full text-sm font-medium text-primary hover:underline" onClick={() => setUseBackup(!useBackup)}>
        {useBackup ? "Use authenticator code instead" : "Use a backup code"}
      </button>
    </form>
  );
}
