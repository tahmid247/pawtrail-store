"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";

export function ChangePasswordForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const { error } = await authClient.changePassword({
          currentPassword: String(fd.get("current")),
          newPassword: String(fd.get("new")),
          revokeOtherSessions: true,
        });
        setMsg(error ? { ok: false, text: error.message ?? "Could not change password." } : { ok: true, text: "Password changed. Other sessions were signed out." });
        if (!error) form.reset();
      }}
    >
      <Field label="Current password" htmlFor="current"><Input id="current" name="current" type="password" autoComplete="current-password" required /></Field>
      <Field label="New password" htmlFor="new" hint="At least 10 characters."><Input id="new" name="new" type="password" autoComplete="new-password" minLength={10} required /></Field>
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <Button type="submit">Change password</Button>
    </form>
  );
}

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "scan" | "done">("idle");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (enabled && step !== "done")
    return (
      <form
        className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await authClient.twoFactor.disable({ password: String(new FormData(e.currentTarget).get("password")) });
          if (error) return setError("Incorrect password.");
          router.refresh();
        }}
      >
        <p className="text-sm font-semibold text-success sm:hidden">Enabled</p>
        <Field label="Password to disable 2FA" htmlFor="pw-dis" className="flex-1"><Input id="pw-dis" name="password" type="password" required autoComplete="current-password" /></Field>
        <Button type="submit" variant="outline">Disable</Button>
        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    );

  if (step === "done")
    return (
      <div className="space-y-3">
        <Alert tone="success">Two-factor authentication is enabled.</Alert>
        <p className="text-sm font-semibold">Save these backup codes somewhere safe. Each can be used once if you lose your device.</p>
        <ul className="grid max-w-sm grid-cols-2 gap-2 rounded-xl bg-lavender-pale p-4 font-mono text-sm">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
        <Button onClick={() => router.refresh()} variant="outline">I&apos;ve saved them</Button>
      </div>
    );

  if (step === "scan")
    return (
      <form
        className="max-w-md space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await authClient.twoFactor.verifyTotp({ code: String(new FormData(e.currentTarget).get("code")).replace(/\s/g, "") });
          if (error) return setError("That code didn't match. Check your device's clock and try again.");
          setStep("done");
        }}
      >
        <p className="text-sm">Scan this QR code with an authenticator app (e.g. 1Password, Google Authenticator, Authy), then enter the 6-digit code.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="QR code for your authenticator app" width={200} height={200} className="rounded-xl border border-line" />}
        {secret && <p className="break-all text-xs text-muted">Can&apos;t scan? Enter this key manually: <span className="font-mono text-ink">{secret}</span></p>}
        <Field label="Verification code" htmlFor="code"><Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit">Verify &amp; enable</Button>
      </form>
    );

  return (
    <form
      className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const { data, error } = await authClient.twoFactor.enable({ password: String(new FormData(e.currentTarget).get("password")), method: "totp" });
        if (error || !data || data.method !== "totp") return setError("Incorrect password.");
        setCodes(data.backupCodes);
        setSecret(new URL(data.totpURI).searchParams.get("secret"));
        setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 200 }));
        setStep("scan");
      }}
    >
      <Field label="Confirm your password" htmlFor="pw-en" className="flex-1"><Input id="pw-en" name="password" type="password" required autoComplete="current-password" /></Field>
      <Button type="submit">Set up 2FA</Button>
      {error && <Alert tone="danger">{error}</Alert>}
    </form>
  );
}
