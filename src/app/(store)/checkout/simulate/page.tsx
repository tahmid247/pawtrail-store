import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments";
import { simulatePayment } from "@/app/actions/simulate";
import { formatMoney } from "@/lib/money";
import { countryName } from "@/lib/countries";
import { Alert, Container } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export const metadata = { title: "Simulated payment", robots: { index: false } };

export default async function SimulatePage({ searchParams }: { searchParams: Promise<{ session?: string; next?: string }> }) {
  if (env.isProduction || getPaymentProvider()?.name !== "simulated") notFound();
  const { session, next } = await searchParams;
  const order = session ? await prisma.order.findUnique({ where: { stripeCheckoutSessionId: session } }) : null;
  if (!order || !next) notFound();
  return (
    <Container className="max-w-lg py-16">
      <Alert tone="warning">
        <strong>Development payment simulator.</strong> This page replaces Stripe Checkout until Stripe keys are configured. It does not charge anything and is unavailable in production.
      </Alert>
      <h1 className="mt-8 text-2xl font-bold">Pay {formatMoney(order.totalCents, order.currency)}</h1>
      <p className="mt-1 text-sm text-muted">Order {order.number} · shipping to {countryName(order.shippingCountry)}</p>
      <form action={simulatePayment} className="mt-6 space-y-4">
        <input type="hidden" name="session" value={session} />
        <input type="hidden" name="next" value={next} />
        <Field label="Full name" htmlFor="name"><Input id="name" name="name" required defaultValue="Test Customer" /></Field>
        <Field label="Address" htmlFor="line1"><Input id="line1" name="line1" required defaultValue="Via Roma 1" /></Field>
        <Field label="Address line 2" htmlFor="line2"><Input id="line2" name="line2" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Postal code" htmlFor="postalCode"><Input id="postalCode" name="postalCode" required defaultValue="20121" /></Field>
          <Field label="City" htmlFor="city"><Input id="city" name="city" required defaultValue="Milano" /></Field>
        </div>
        <Field label="Province" htmlFor="state"><Input id="state" name="state" defaultValue="MI" /></Field>
        <Field label="Phone" htmlFor="phone"><Input id="phone" name="phone" defaultValue="+39 000 0000000" /></Field>
        <div className="flex gap-3 pt-2">
          <Button type="submit" name="outcome" value="success" className="flex-1">Simulate successful payment</Button>
          <Button type="submit" name="outcome" value="failure" variant="outline" formNoValidate>Simulate failure</Button>
        </div>
      </form>
    </Container>
  );
}
