import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-7xl font-extrabold text-lavender">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link href="/" className="mt-8 rounded-full bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-deep">Back to home</Link>
    </main>
  );
}
