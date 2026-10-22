import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { OrderStatusBadge } from "@/components/store/order-detail";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "My orders", robots: { index: false } };

export default async function AccountPage() {
  const user = await requireUser();
  // Orders placed as a guest with the same (verified) email are shown too.
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: { notIn: ["UNPAID", "EXPIRED", "FAILED"] },
      OR: [{ userId: user.id }, ...(user.emailVerified ? [{ userId: null, email: user.email }] : [])],
    },
    orderBy: { placedAt: "desc" },
    include: { items: true },
  });
  return (
    <>
      <h1 className="text-3xl font-bold">My orders</h1>
      {orders.length === 0 ? (
        <div className="mt-8 rounded-3xl bg-white p-10 text-center shadow-soft">
          <p className="font-semibold">No orders yet</p>
          <ButtonLink href="/shop" className="mt-5">Start shopping</ButtonLink>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line rounded-2xl border border-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/account/orders/${o.number}`} className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-lavender-pale/50">
                <div>
                  <p className="font-semibold">{o.number}</p>
                  <p className="text-sm text-muted">{o.placedAt.toLocaleDateString("en-GB", { dateStyle: "medium" })} · {o.items.reduce((n, i) => n + i.quantity, 0)} item(s)</p>
                </div>
                <div className="flex items-center gap-4">
                  <OrderStatusBadge order={o} />
                  <span className="font-bold">{formatMoney(o.totalCents, o.currency)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
