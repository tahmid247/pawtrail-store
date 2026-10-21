import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { saveShippingRate } from "../actions/store";

export const metadata = { title: "Shipping" };

export default async function ShippingPage() {
  await requireStaffPage({ adminOnly: true });
  const zones = await prisma.shippingZone.findMany({ include: { rates: { orderBy: { position: "asc" } } }, orderBy: { createdAt: "asc" } });
  const rows = [...zones.flatMap((z) => z.rates.map((r) => ({ z, r }))), { z: null, r: null }];
  return (
    <>
      <PageHeader title="Shipping zones & rates" description="Prices and delivery estimates are shown to customers before payment. Use realistic estimates from your CJ logistics option (dispatch + transit)." />
      <Alert tone="warning" className="mb-6">Free shipping is only shown if you set a threshold. Delivery estimates left empty display as &ldquo;confirmed at dispatch&rdquo; — set them before launch.</Alert>
      <div className="grid gap-6 xl:grid-cols-2">
        {rows.map(({ z, r }) => (
          <Panel key={r?.id ?? "new"} title={z ? `${z.name} — ${r!.name}` : "New zone & rate"}>
            <ActionForm action={saveShippingRate} className="grid gap-3 sm:grid-cols-2">
              {z && <input type="hidden" name="zoneId" value={z.id} />}
              {r && <input type="hidden" name="rateId" value={r.id} />}
              <Field label="Zone name" htmlFor={`zn-${r?.id}`}><Input id={`zn-${r?.id}`} name="zoneName" defaultValue={z?.name} required /></Field>
              <Field label="Rate name" htmlFor={`rn-${r?.id}`}><Input id={`rn-${r?.id}`} name="rateName" defaultValue={r?.name ?? "Standard shipping"} required /></Field>
              <Field label="Countries (ISO codes)" htmlFor={`zc-${r?.id}`} className="sm:col-span-2"><Input id={`zc-${r?.id}`} name="countries" defaultValue={z?.countries.join(", ")} required placeholder="IT, SM, VA" /></Field>
              <Field label="Price (€)" htmlFor={`rp-${r?.id}`}><Input id={`rp-${r?.id}`} name="price" defaultValue={r ? (r.priceCents / 100).toFixed(2) : ""} required /></Field>
              <Field label="Free over (€, optional)" htmlFor={`rf-${r?.id}`}><Input id={`rf-${r?.id}`} name="freeOver" defaultValue={r?.freeOverCents != null ? (r.freeOverCents / 100).toFixed(2) : ""} /></Field>
              <Field label="Min delivery days" htmlFor={`rmin-${r?.id}`}><Input id={`rmin-${r?.id}`} name="minDays" defaultValue={r?.minDeliveryDays ?? ""} /></Field>
              <Field label="Max delivery days" htmlFor={`rmax-${r?.id}`}><Input id={`rmax-${r?.id}`} name="maxDays" defaultValue={r?.maxDeliveryDays ?? ""} /></Field>
              <Checkbox name="active" label="Active" defaultChecked={r?.active ?? true} />
            </ActionForm>
          </Panel>
        ))}
      </div>
    </>
  );
}
