import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "@/components/account/auth-forms";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/account");
  return (
    <>
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mb-8 mt-2 text-sm text-muted">Sign in to view orders and manage your details.</p>
      <Suspense><LoginForm /></Suspense>
      <p className="mt-6 text-center text-sm text-muted">New here? <Link href="/account/register" className="font-semibold text-primary hover:underline">Create an account</Link></p>
    </>
  );
}
