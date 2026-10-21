import Link from "next/link";
import { RegisterForm } from "@/components/account/auth-forms";

export const metadata = { title: "Create account", robots: { index: false } };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-extrabold">Create your account</h1>
      <p className="mb-8 mt-2 text-sm text-muted">Track orders and save addresses. Checking out as a guest is always possible too.</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link href="/account/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>
    </>
  );
}
