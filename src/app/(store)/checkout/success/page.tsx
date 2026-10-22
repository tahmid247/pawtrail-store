import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { findOrderForViewer } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { Container } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { AutoRefresh } from "@/components/store/auto-refresh";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };

/**
 * Shown after the payment provider redirects back. It only DISPLAYS the order state —
 * orders are marked paid exclusively by verified webhooks.
 */
export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ order?: string; token?: string }> }) {
  const { order: number, token } = await searchParams;
  const user = await getCurrentUser();
  const order = number ? await findOrderForViewer(number, { userId: user?.id, token }) : null;

  if (!order) {
    return (
      <Container className="max-w-xl py-24 text-center">
        <h1 className="text-3xl font-bold">Thank you!</h1>
        <p className="mt-4 text-muted">If your payment succeeded you will receive a confirmation email shortly.</p>
      </Container>
    );
  }

  const paid = order.paymentStatus === "PAID";
  const orderLink = user ? `/account/orders/${order.number}` : `/track/${order.number}?token=${encodeURIComponent(token ?? "")}`;
  return (
    <Container className="max-w-2xl py-20 text-center">
      {paid ? <CheckCircle2 className="mx-auto size-14 text-success" aria-hidden /> : <Clock className="mx-auto size-14 text-primary" aria-hidden />}
      <h1 className="mt-6 text-3xl font-bold sm:text-4xl">{paid ? "Thank you for your order!" : "Confirming your payment…"}</h1>
      <p className="mt-4 text-muted">
        {paid
          ? `Order ${order.number} is confirmed. A confirmation has been sent to ${order.email}.`
          : `We're waiting for confirmation from our payment provider for order ${order.number}. This usually takes a few seconds — this page will update automatically.`}
      </p>
      {!paid && <AutoRefresh seconds={4} />}
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-line p-6 text-left">
        <ul className="space-y-2 text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4">
              <span>{i.quantity} × {i.productTitle} — {i.variantTitle}</span>
              <span className="font-bold">{formatMoney(i.totalCents, order.currency)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between border-t border-line pt-4 font-bold">
          <span>Total</span>
          <span>{formatMoney(order.totalCents, order.currency)}</span>
        </p>
      </div>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <ButtonLink href={orderLink}>View order status</ButtonLink>
        <ButtonLink href="/shop" variant="outline">Continue shopping</ButtonLink>
      </div>
      {!user && (
        <p className="mt-6 text-sm text-muted">
          Want to track all your orders in one place? <Link href="/account/register" className="text-primary hover:underline">Create an account</Link> with the same email.
        </p>
      )}
    </Container>
  );
}
