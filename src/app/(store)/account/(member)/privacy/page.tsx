import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { DeletionForm, MarketingForm } from "@/components/account/forms";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: "Privacy & data", robots: { index: false } };

export default async function PrivacyPage() {
  const user = await requireUser("/account/privacy");
  const [sub, pending] = await Promise.all([
    prisma.newsletterSubscription.findUnique({ where: { email: user.email } }),
    prisma.accountDeletionRequest.findFirst({ where: { userId: user.id, status: "PENDING" } }),
  ]);
  return (
    <>
      <h1 className="text-3xl font-extrabold">Privacy &amp; data</h1>
      <section className="mt-8 rounded-3xl border border-line p-6">
        <h2 className="text-lg font-bold">Marketing emails</h2>
        <div className="mt-4"><MarketingForm subscribed={sub?.status === "CONFIRMED"} /></div>
      </section>
      <section className="mt-6 rounded-3xl border border-line p-6">
        <h2 className="text-lg font-bold">Download your data</h2>
        <p className="mt-1 text-sm text-muted">Get a copy of your account details, addresses, orders, reviews and consent records (JSON).</p>
        <a href="/api/account/export" className={buttonClass("outline", "md", "mt-4")}>Download my data</a>
      </section>
      <section className="mt-6 rounded-3xl border border-line p-6">
        <h2 className="text-lg font-bold">Delete your account</h2>
        <p className="mb-5 mt-1 text-sm text-muted">We will delete your account and personal data. Order and invoice records we must keep for tax purposes are retained for the legally required period, unlinked from your account.</p>
        <DeletionForm pendingRequest={Boolean(pending)} />
      </section>
    </>
  );
}
