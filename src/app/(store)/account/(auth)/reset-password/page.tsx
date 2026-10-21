import { Suspense } from "react";
import { ResetForm } from "@/components/account/auth-forms";

export const metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPage() {
  return (
    <>
      <h1 className="mb-8 text-2xl font-extrabold">Choose a new password</h1>
      <Suspense><ResetForm /></Suspense>
    </>
  );
}
