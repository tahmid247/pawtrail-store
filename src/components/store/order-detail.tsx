import Image from "next/image";
import type { Order, OrderItem, Shipment, TrackingEvent } from "@prisma/client";
import { Check, ExternalLink } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { formatAddress } from "@/lib/order-format";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";

type FullOrder = Order & { items: OrderItem[]; shipments: (Shipment & { events: TrackingEvent[] })[] };

export function orderStage(o: Pick<Order, "paymentStatus" | "fulfillmentStatus" | "status">): number {
  if (o.fulfillmentStatus === "DELIVERED") return 4;
  if (o.fulfillmentStatus === "SHIPPED") return 3;
  if (["SUBMITTED", "AWAITING_SUPPLIER_CONFIRMATION", "PROCESSING"].includes(o.fulfillmentStatus)) return 2;
  if (o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_REFUNDED") return 1;
  return 0;
}

export function OrderStatusBadge({ order }: { order: Pick<Order, "paymentStatus" | "fulfillmentStatus" | "status"> }) {
  if (order.status === "CANCELLED") return <Badge tone="neutral">Cancelled</Badge>;
  if (order.paymentStatus === "REFUNDED") return <Badge tone="neutral">Refunded</Badge>;
  if (order.paymentStatus === "UNPAID") return <Badge tone="warning">Awaiting payment</Badge>;
  if (order.paymentStatus === "FAILED" || order.paymentStatus === "EXPIRED") return <Badge tone="neutral">Not completed</Badge>;
  const stage = orderStage(order);
  return <Badge tone={stage >= 3 ? "success" : "violet"}>{["Placed", "Confirmed", "Preparing", "Shipped", "Delivered"][stage]}</Badge>;
}

export function OrderDetail({ order, showAddress = true }: { order: FullOrder; showAddress?: boolean }) {
  const stage = orderStage(order);
  const steps = ["Order placed", "Payment confirmed", "Preparing at warehouse", "Shipped", "Delivered"];
  const cancelled = order.status === "CANCELLED";
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Order {order.number}</h1>
        <OrderStatusBadge order={order} />
      </div>
      <p className="text-sm text-muted">Placed {order.placedAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}</p>

      {!cancelled && order.paymentStatus !== "UNPAID" && (
        <ol className="grid gap-3 sm:grid-cols-5" aria-label="Order progress">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 sm:flex-col sm:items-start" aria-current={i === stage ? "step" : undefined}>
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", i <= stage ? "bg-primary text-white" : "bg-lavender-pale text-muted")}>
                {i < stage ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn("text-sm", i <= stage ? "font-semibold" : "text-muted")}>{s}</span>
            </li>
          ))}
        </ol>
      )}

      {order.shipments.map((s) => (
        <section key={s.id} className="rounded-2xl border border-line p-5">
          <h2 className="font-bold">Shipment</h2>
          <p className="mt-1 text-sm text-muted">
            {s.carrier ?? "Carrier"} · Tracking <span className="font-mono text-ink">{s.trackingNumber}</span>
            {s.trackingUrl && /^https:\/\//.test(s.trackingUrl) && (
              <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 font-medium text-primary hover:underline">
                Track <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </p>
          {s.events.length > 0 && (
            <ol className="mt-4 space-y-3 border-l-2 border-lavender pl-4">
              {s.events.map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="font-medium">{e.description}</p>
                  <p className="text-xs text-muted">{e.occurredAt.toLocaleString("en-GB")} {e.location ? `· ${e.location}` : ""}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}

      <section className="rounded-2xl border border-line">
        <ul className="divide-y divide-line">
          {order.items.map((i) => (
            <li key={i.id} className="flex items-center gap-4 p-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-lavender-pale">
                {i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="64px" className="object-cover" />}
              </div>
              <div className="flex-1 text-sm">
                <p className="font-semibold">{i.productTitle}</p>
                <p className="text-muted">{i.variantTitle} · Qty {i.quantity}</p>
              </div>
              <p className="text-sm font-semibold">{formatMoney(i.totalCents, order.currency)}</p>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-line p-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatMoney(order.subtotalCents, order.currency)}</dd></div>
          {order.discountCents > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd>−{formatMoney(order.discountCents, order.currency)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">Shipping ({order.shippingRateName})</dt><dd>{formatMoney(order.shippingCents, order.currency)}</dd></div>
          <div className="flex justify-between font-bold"><dt>Total</dt><dd>{formatMoney(order.totalCents, order.currency)}</dd></div>
          {order.refundedCents > 0 && <div className="flex justify-between text-success"><dt>Refunded</dt><dd>{formatMoney(order.refundedCents, order.currency)}</dd></div>}
        </dl>
      </section>

      {showAddress && order.shippingAddress && (
        <section className="text-sm">
          <h2 className="font-bold">Delivery address</h2>
          <p className="mt-1 text-muted">{formatAddress(order.shippingAddress)}</p>
        </section>
      )}
    </div>
  );
}
