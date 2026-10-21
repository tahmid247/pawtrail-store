import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { OrderDetail } from "@/components/store/order-detail";

export const metadata = { title: "Order", robots: { index: false } };

export default async function AccountOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await requireUser(`/account/orders/${number}`);
  const order = await prisma.order.findUnique({
    where: { number },
    include: { items: true, shipments: { include: { events: { orderBy: { occurredAt: "desc" } } } } },
  });
  // Authorization: own order, or a guest order with the user's verified email.
  const allowed = order && (order.userId === user.id || (order.userId === null && user.emailVerified && order.email === user.email));
  if (!allowed) notFound();
  return (
    <>
      <OrderDetail order={order} />
      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link href={`/contact?type=ORDER&order=${order.number}`} className="font-medium text-primary hover:underline">Need help with this order?</Link>
        {order.fulfillmentStatus === "DELIVERED" && (
          <>
            <Link href={`/contact?type=WITHDRAWAL&order=${order.number}`} className="font-medium text-primary hover:underline">Return / withdraw</Link>
            <Link href={`/contact?type=DAMAGED_OR_INCORRECT&order=${order.number}`} className="font-medium text-primary hover:underline">Report a problem</Link>
          </>
        )}
      </div>
    </>
  );
}
