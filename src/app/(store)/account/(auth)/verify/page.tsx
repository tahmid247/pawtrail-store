import Link from "next/link";

export const metadata = { title: "Email verified", robots: { index: false } };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return error ? (
    <>
      <h1 className="text-2xl font-bold">Link expired</h1>
      <p className="mt-3 text-muted">This verification link is invalid or expired. Sign in to receive a new one.</p>
      <Link href="/account/login" className="mt-6 inline-block font-semibold text-primary">Sign in</Link>
    </>
  ) : (
    <>
      <h1 className="text-2xl font-bold">Email verified</h1>
      <p className="mt-3 text-muted">Your account is active.</p>
      <Link href="/account" className="mt-6 inline-block font-semibold text-primary">Go to my account</Link>
    </>
  );
}
