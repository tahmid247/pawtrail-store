import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { findOrderForViewer } from "@/lib/orders";
import { Container } from "@/components/ui/misc";
import { OrderDetail } from "@/components/store/order-detail";

export const metadata = { title: "Order status", robots: { index: false } };

export default async function GuestOrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ token?: string }> }) {
  const [{ number }, { token }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const order = await findOrderForViewer(number, { userId: user?.id, token });
  if (!order) notFound();
  return (
    <Container className="max-w-3xl py-12">
      <OrderDetail order={order} />
    </Container>
  );
}
