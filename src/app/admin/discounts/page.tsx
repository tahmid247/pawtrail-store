import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { saveDiscount } from "../actions/store";

export const metadata = { title: "Discounts" };

const d8 = (d: Date | null) => (d ? d.toISOString().slice(0, 16) : "");

export default async function DiscountsPage() {
  await requireStaffPage({ adminOnly: true });
  const codes = await prisma.discountCode.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Discount codes" description="Codes are validated and applied on the server. Advertise only genuine reductions (EU price-indication rules)." />
      <div className="grid gap-6 xl:grid-cols-2">
        {[null, ...codes].map((c) => (
          <Panel key={c?.id ?? "new"} title={c ? `${c.code} — ${c.type === "PERCENT" ? `${c.value}%` : formatMoney(c.value)} · used ${c.redemptionCount}${c.maxRedemptions ? `/${c.maxRedemptions}` : ""}` : "New discount code"}>
            <ActionForm action={saveDiscount} className="grid gap-3 sm:grid-cols-2">
              {c && <input type="hidden" name="id" value={c.id} />}
              <Field label="Code" htmlFor={`dc-${c?.id}`}><Input id={`dc-${c?.id}`} name="code" defaultValue={c?.code} required className="uppercase" /></Field>
              <Field label="Description (internal)" htmlFor={`dd-${c?.id}`}><Input id={`dd-${c?.id}`} name="description" defaultValue={c?.description ?? ""} /></Field>
              <Field label="Type" htmlFor={`dt-${c?.id}`}><Select id={`dt-${c?.id}`} name="type" defaultValue={c?.type ?? "PERCENT"}><option value="PERCENT">Percent</option><option value="FIXED">Fixed amount (€)</option></Select></Field>
              <Field label="Value (% or €)" htmlFor={`dv-${c?.id}`}><Input id={`dv-${c?.id}`} name="value" defaultValue={c ? (c.type === "PERCENT" ? c.value : (c.value / 100).toFixed(2)) : ""} required /></Field>
              <Field label="Minimum subtotal (€)" htmlFor={`dm-${c?.id}`}><Input id={`dm-${c?.id}`} name="minSubtotal" defaultValue={c ? (c.minSubtotalCents / 100).toFixed(2) : ""} /></Field>
              <Field label="Max redemptions" htmlFor={`dr-${c?.id}`}><Input id={`dr-${c?.id}`} name="maxRedemptions" defaultValue={c?.maxRedemptions ?? ""} /></Field>
              <Field label="Starts" htmlFor={`ds-${c?.id}`}><Input id={`ds-${c?.id}`} type="datetime-local" name="startsAt" defaultValue={d8(c?.startsAt ?? null)} /></Field>
              <Field label="Ends" htmlFor={`de-${c?.id}`}><Input id={`de-${c?.id}`} type="datetime-local" name="endsAt" defaultValue={d8(c?.endsAt ?? null)} /></Field>
              <Checkbox name="active" label="Active" defaultChecked={c?.active ?? true} />
            </ActionForm>
          </Panel>
        ))}
      </div>
    </>
  );
}
