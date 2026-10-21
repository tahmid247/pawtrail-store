import { Container } from "@/components/ui/misc";
import { UnsubscribeForm } from "@/components/store/newsletter-confirm";

export const metadata = { title: "Unsubscribe", robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <Container className="max-w-lg py-24 text-center">
      <h1 className="text-3xl font-bold">Unsubscribe</h1>
      <p className="mt-4 text-muted">Stop receiving marketing emails from us. Order emails are not affected.</p>
      <UnsubscribeForm token={token ?? ""} />
    </Container>
  );
}
