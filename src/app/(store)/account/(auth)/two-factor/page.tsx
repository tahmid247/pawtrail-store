import { Suspense } from "react";
import { TwoFactorChallenge } from "@/components/account/auth-forms";

export const metadata = { title: "Two-factor verification", robots: { index: false } };

export default function TwoFactorPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Two-factor verification</h1>
      <p className="mb-8 mt-2 text-sm text-muted">Enter the code from your authenticator app to finish signing in.</p>
      <Suspense><TwoFactorChallenge /></Suspense>
    </>
  );
}
