import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { formatAddress } from "@/lib/order-format";
import { env } from "@/lib/env";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/misc";
import { addShipment, cancelOrder, confirmSupplier, issueRefund, markFulfillmentCancelled, recordManualCjOrder, resolveAttention, setDelivered, submitToSupplier, updateOrderNotes } from "../../actions/orders";
import { simulateCjShipment } from "../../actions/store";
import { PayBadge } from "@/components/admin/badges";

export const metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffPage();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      payments: true,
      refunds: { orderBy: { createdAt: "desc" } },
      fulfillmentOrders: true,
      shipments: { include: { events: { orderBy: { occurredAt: "desc" } } } },
      user: { select: { id: true, email: true } },
    },
  });
  if (!order) notFound();
  const logs = await prisma.integrationLog.findMany({ where: { orderId: id }, orderBy: { createdAt: "desc" }, take: 20 });
  const fo = order.fulfillmentOrders[0];
  const isAdmin = user.role === "ADMIN";
  const paid = order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED";
  const refundable = order.totalCents - order.refunds.filter((r) => r.status !== "FAILED" && r.status !== "CANCELED").reduce((s, r) => s + r.amountCents, 0);
  const hidden = <input type="hidden" name="orderId" value={order.id} />;

  return (
    <>
      <PageHeader
        title={`Order ${order.number}`}
        description={`Placed ${order.placedAt.toLocaleString("en-GB")}${order.paidAt ? ` · paid ${order.paidAt.toLocaleString("en-GB")}` : ""}`}
        actions={<><PayBadge s={order.paymentStatus} /><Badge>{order.status}</Badge><Badge tone="violet">{order.fulfillmentStatus}</Badge></>}
      />
      {order.status === "REQUIRES_ATTENTION" && (
        <Alert tone="danger" className="mb-6">
          This order needs attention: <span className="whitespace-pre-line">{order.adminNotes}</span>
          {isAdmin && <div className="mt-3"><ActionForm action={resolveAttention} submitLabel="Mark resolved" variant="outline" inline>{hidden}</ActionForm></div>}
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Items">
            <ul className="divide-y divide-line text-sm">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 py-2.5">
                  <span><span className="font-medium">{i.quantity} × {i.productTitle}</span> — {i.variantTitle}<br /><span className="text-xs text-muted">SKU {i.sku} · CJ vid {i.cjVariantId ?? <span className="text-danger">not mapped</span>}</span></span>
                  <span>{formatMoney(i.totalCents, order.currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
              <Row k="Subtotal" v={formatMoney(order.subtotalCents, order.currency)} />
              {order.discountCents > 0 && <Row k={`Discount (${order.discountCodeText})`} v={`−${formatMoney(order.discountCents, order.currency)}`} />}
              <Row k={`Shipping — ${order.shippingRateName}`} v={formatMoney(order.shippingCents, order.currency)} />
              <Row k="Total (incl. VAT)" v={formatMoney(order.totalCents, order.currency)} bold />
              <Row k="VAT included" v={formatMoney(order.taxIncludedCents, order.currency)} />
              {order.refundedCents > 0 && <Row k="Refunded" v={formatMoney(order.refundedCents, order.currency)} />}
            </dl>
          </Panel>

          <Panel title="Fulfillment (CJdropshipping)">
            <div className="space-y-4 text-sm">
              <p>
                Supplier order: {fo?.externalOrderId ? <span className="font-mono">{fo.externalOrderId}</span> : "not submitted"} · status <strong>{fo?.status ?? "—"}</strong> · attempts {fo?.attempts ?? 0}
                {fo?.confirmedAt && <> · prepaid stock confirmed {fo.confirmedAt.toLocaleString("en-GB")}</>}
              </p>
              {fo?.lastError && <Alert tone="danger">Last error: {fo.lastError}</Alert>}

              {paid && order.status === "CONFIRMED" && ["UNFULFILLED", "FAILED"].includes(order.fulfillmentStatus) && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl bg-lavender-pale p-4">
                    <p className="mb-3 font-semibold">Submit via CJ API {env.cjMode === "mock" && <Badge tone="warning">mock mode</Badge>}</p>
                    <ActionForm action={submitToSupplier} submitLabel={order.fulfillmentStatus === "FAILED" ? "Retry submission" : "Submit to CJ"} inline>{hidden}</ActionForm>
                  </div>
                  <div className="rounded-xl bg-lavender-pale p-4">
                    <p className="mb-3 font-semibold">Or record an order placed manually in CJ</p>
                    <ActionForm action={recordManualCjOrder} submitLabel="Record" inline>
                      {hidden}
                      <Input name="externalOrderId" placeholder="CJ order ID" required className="h-9 max-w-52" aria-label="CJ order ID" />
                    </ActionForm>
                  </div>
                </div>
              )}

              {fo?.externalOrderId && !fo.confirmedAt && order.fulfillmentStatus !== "CANCELLED" && (
                <div className="rounded-xl border border-line p-4">
                  <p className="mb-1 font-semibold">Confirm prepaid inventory was used</p>
                  <p className="mb-3 text-muted">Check in the CJ dashboard that this order is paid and deducted from your private inventory (not a new stock purchase). Syncing also confirms automatically once CJ reports the order as processing.</p>
                  <ActionForm action={confirmSupplier} submitLabel="Confirm supplier accepted" variant="outline" inline>{hidden}</ActionForm>
                </div>
              )}

              {paid && ["AWAITING_SUPPLIER_CONFIRMATION", "PROCESSING", "SHIPPED", "UNFULFILLED"].includes(order.fulfillmentStatus) && (
                <div className="rounded-xl border border-line p-4">
                  <p className="mb-3 font-semibold">Add tracking manually</p>
                  <ActionForm action={addShipment} submitLabel="Add shipment" className="grid gap-3 sm:grid-cols-3">
                    {hidden}
                    <Input name="trackingNumber" placeholder="Tracking number" required aria-label="Tracking number" />
                    <Input name="carrier" placeholder="Carrier" aria-label="Carrier" />
                    <Input name="trackingUrl" placeholder="https://tracking URL" aria-label="Tracking URL" />
                  </ActionForm>
                </div>
              )}

              {order.fulfillmentStatus === "SHIPPED" && <ActionForm action={setDelivered} submitLabel="Mark as delivered" variant="outline" inline>{hidden}</ActionForm>}

              {env.cjMode === "mock" && fo?.externalOrderId && isAdmin && (
                <ActionForm action={simulateCjShipment} submitLabel="Simulate CJ update" variant="outline" inline>
                  <input type="hidden" name="externalOrderId" value={fo.externalOrderId} />
                  <Select name="status" className="h-9 w-40" aria-label="Mock status"><option>UNSHIPPED</option><option>SHIPPED</option><option>DELIVERED</option></Select>
                </ActionForm>
              )}
              {isAdmin && fo?.externalOrderId && ["AWAITING_SUPPLIER_CONFIRMATION", "PROCESSING"].includes(order.fulfillmentStatus) && (
                <ActionForm action={markFulfillmentCancelled} submitLabel="Supplier order was cancelled in CJ" variant="outline" confirmText="Only use this after cancelling the order in the CJ dashboard. Continue?" inline>{hidden}</ActionForm>
              )}

              {order.shipments.map((s) => (
                <div key={s.id} className="rounded-xl border border-line p-4">
                  <p className="font-semibold">{s.carrier ?? "Carrier"} · <span className="font-mono">{s.trackingNumber}</span> · {s.status}</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted">{s.events.map((e) => <li key={e.id}>{e.occurredAt.toLocaleString("en-GB")} — {e.description}</li>)}</ul>
                </div>
              ))}
            </div>
          </Panel>

          {logs.length > 0 && (
            <Panel title="Integration log">
              <ul className="space-y-1.5 text-xs">
                {logs.map((l) => <li key={l.id}><Badge tone={l.level === "error" ? "danger" : l.level === "warn" ? "warning" : "neutral"}>{l.level}</Badge> {l.createdAt.toLocaleString("en-GB")} · {l.provider}/{l.action}: {l.message}</li>)}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <p className="text-sm">{order.customerName ?? "—"}<br /><a className="text-primary" href={`mailto:${order.email}`}>{order.email}</a><br />{order.phone}</p>
            {order.user && <Link href={`/admin/customers/${order.user.id}`} className="mt-2 inline-block text-sm text-primary">View account</Link>}
            <h3 className="mt-4 text-sm font-semibold">Shipping address</h3>
            <p className="text-sm text-muted">{formatAddress(order.shippingAddress)}</p>
            <p className="mt-3 text-xs text-muted">Terms {order.termsVersion} accepted {order.termsAcceptedAt?.toLocaleString("en-GB")}. Marketing opt-in: {order.marketingOptIn ? "yes" : "no"}.</p>
          </Panel>

          <Panel title="Payment">
            <ul className="space-y-1 text-sm">
              {order.payments.map((p) => <li key={p.id}>{p.provider} · <span className="font-mono text-xs">{p.providerRef}</span> · {formatMoney(p.amountCents, p.currency)} · {p.status}</li>)}
              {order.payments.length === 0 && <li className="text-muted">No payment recorded.</li>}
            </ul>
            {order.refunds.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                {order.refunds.map((r) => <li key={r.id}>Refund {formatMoney(r.amountCents, order.currency)} · {r.status} · {r.reason}</li>)}
              </ul>
            )}
            {isAdmin && paid && refundable > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <ActionForm action={issueRefund} submitLabel="Issue refund" variant="outline" confirmText="Issue this refund to the customer's original payment method?">
                  {hidden}
                  <Field label={`Amount (max ${formatMoney(refundable, order.currency)})`} htmlFor="amount"><Input id="amount" name="amount" inputMode="decimal" defaultValue={(refundable / 100).toFixed(2)} required /></Field>
                  <Field label="Reason" htmlFor="reason"><Input id="reason" name="reason" required placeholder="e.g. Withdrawal — goods returned" /></Field>
                </ActionForm>
              </div>
            )}
          </Panel>

          {isAdmin && order.status !== "CANCELLED" && !["SHIPPED", "DELIVERED"].includes(order.fulfillmentStatus) && (
            <Panel title="Cancel order">
              <ActionForm action={cancelOrder} submitLabel="Cancel order" variant="danger" confirmText="Cancel this order? Paid orders are fully refunded automatically.">
                {hidden}
                <Field label="Reason (sent to customer)" htmlFor="creason"><Input id="creason" name="reason" required /></Field>
              </ActionForm>
            </Panel>
          )}

          <Panel title="Internal notes">
            <ActionForm action={updateOrderNotes}>
              {hidden}
              <Textarea name="adminNotes" defaultValue={order.adminNotes ?? ""} rows={4} aria-label="Internal notes" />
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? "font-bold" : ""}`}><dt className={bold ? "" : "text-muted"}>{k}</dt><dd>{v}</dd></div>;
}
