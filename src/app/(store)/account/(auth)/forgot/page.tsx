import { ForgotForm } from "@/components/account/auth-forms";

export const metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Forgot your password?</h1>
      <p className="mb-8 mt-2 text-sm text-muted">Enter your email and we&apos;ll send you a secure reset link.</p>
      <ForgotForm />
    </>
  );
}
