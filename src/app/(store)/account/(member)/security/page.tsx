import { requireUser } from "@/lib/session";
import { Alert } from "@/components/ui/misc";
import { ChangePasswordForm, TwoFactorSetup } from "@/components/account/security-forms";

export const metadata = { title: "Security", robots: { index: false } };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ setup2fa?: string }> }) {
  const user = await requireUser("/account/security");
  const { setup2fa } = await searchParams;
  const staff = user.role !== "CUSTOMER";
  return (
    <>
      <h1 className="text-3xl font-bold">Security</h1>
      {setup2fa && staff && !user.twoFactorEnabled && (
        <Alert tone="warning" className="mt-6">Two-factor authentication is required for staff accounts. Set it up below to unlock the admin dashboard.</Alert>
      )}
      <section className="mt-8 rounded-3xl border border-line p-6">
        <h2 className="text-lg font-bold">Two-factor authentication</h2>
        <p className="mt-1 text-sm text-muted">Protect your account with a one-time code from an authenticator app.{staff ? " Required for administrators." : ""}</p>
        <div className="mt-5"><TwoFactorSetup enabled={user.twoFactorEnabled} /></div>
      </section>
      <section className="mt-6 rounded-3xl border border-line p-6">
        <h2 className="mb-5 text-lg font-bold">Change password</h2>
        <ChangePasswordForm />
      </section>
    </>
  );
}
