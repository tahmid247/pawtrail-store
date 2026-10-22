import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Container } from "@/components/ui/misc";
import { SetupForm } from "@/components/account/setup-form";

export const metadata = { title: "Store setup", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await prisma.user.count({ where: { role: "ADMIN" } })) > 0) notFound();
  return (
    <Container className="flex justify-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-bold">Create your admin account</h1>
        <p className="mb-6 mt-2 text-sm text-muted">One-time setup. This page disappears once an administrator exists — complete it right after deploying.</p>
        <SetupForm />
      </div>
    </Container>
  );
}
