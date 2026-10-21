import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { Container } from "@/components/ui/misc";
import { ConfirmNewsletter } from "@/components/store/newsletter-confirm";

export const metadata = { title: "Confirm subscription", robots: { index: false } };

/** Confirmation requires an explicit click (POST), so email link scanners cannot subscribe people automatically. */
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const sub = token ? await prisma.newsletterSubscription.findUnique({ where: { tokenHash: sha256(token) } }) : null;
  return (
    <Container className="max-w-lg py-24 text-center">
      {sub ? (
        sub.status === "CONFIRMED" ? (
          <><h1 className="text-3xl font-bold">You&apos;re subscribed</h1><p className="mt-4 text-muted">Thanks — your subscription is already confirmed.</p></>
        ) : (
          <><h1 className="text-3xl font-bold">Confirm your subscription</h1><p className="mt-4 text-muted">Click below to confirm you want to receive our emails.</p><ConfirmNewsletter token={token!} /></>
        )
      ) : (
        <><h1 className="text-3xl font-bold">Link not valid</h1><p className="mt-4 text-muted">This confirmation link is invalid or has already been used.</p></>
      )}
    </Container>
  );
}
