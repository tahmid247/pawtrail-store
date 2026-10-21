import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { availableFrom } from "@/lib/inventory";
import { env } from "@/lib/env";
import { PageHeader, Panel, Table, td } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { Input, Select } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/misc";
import { syncInventoryNow, updateInventory } from "../actions/store";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const user = await requireStaffPage();
  const isAdmin = user.role === "ADMIN";
  const variants = await prisma.productVariant.findMany({ include: { inventory: true, product: true }, orderBy: [{ productId: "asc" }, { position: "asc" }] });
  const movements = await prisma.inventoryMovement.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { variant: true } });
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Prepaid stock held for you at the CJ warehouse. Available = prepaid − reserved (unpaid checkouts) − pending deduction (paid, not yet deducted by CJ) − safety buffer."
        actions={isAdmin ? <ActionForm action={syncInventoryNow} submitLabel={`Sync from CJ${env.cjMode === "mock" ? " (mock)" : ""}`} inline /> : undefined}
      />
      {env.cjMode === "mock" && <Alert tone="warning" className="mb-4">CJ is in mock mode — syncing applies simulated quantities only to variants whose source is set to CJ. Variants set to MANUAL are never overwritten.</Alert>}
      <Table head={["Variant", "Prepaid", "Reserved", "Pending deduction", "Buffer", "Available", "Low at", "Source / sync", isAdmin ? "Update" : ""]}>
        {variants.map((v) => {
          const inv = v.inventory;
          const avail = availableFrom(inv);
          return (
            <tr key={v.id}>
              <td className={td}><span className="font-medium">{v.product.title}</span><br /><span className="text-xs text-muted">{v.title} · {v.sku}{v.cjVariantId ? ` · vid ${v.cjVariantId}` : ""}</span></td>
              <td className={td}>{inv?.supplierQuantity ?? 0}</td>
              <td className={td}>{inv?.reservedQuantity ?? 0}</td>
              <td className={td}>{inv?.pendingDeductionQuantity ?? 0}</td>
              <td className={td}>{inv?.safetyBuffer ?? 0}</td>
              <td className={td}><Badge tone={avail <= 0 ? "danger" : avail <= (inv?.lowStockThreshold ?? 0) ? "warning" : "success"}>{avail}</Badge></td>
              <td className={td}>{inv?.lowStockThreshold ?? 0}</td>
              <td className={td}>
                <Badge tone={inv?.source === "CJ" ? "violet" : "neutral"}>{inv?.source ?? "MANUAL"}</Badge>
                {inv?.lastSyncedAt && <span className="block text-xs text-muted">synced {inv.lastSyncedAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>}
                {inv?.syncError && <span className="block max-w-48 text-xs text-danger">{inv.syncError}</span>}
              </td>
              {isAdmin && (
                <td className={td}>
                  <ActionForm action={updateInventory} submitLabel="Save" inline>
                    <input type="hidden" name="variantId" value={v.id} />
                    <Input name="supplierQuantity" defaultValue={inv?.supplierQuantity ?? 0} className="h-9 w-20" aria-label="Prepaid quantity" inputMode="numeric" />
                    <Input name="safetyBuffer" defaultValue={inv?.safetyBuffer ?? 0} className="h-9 w-16" aria-label="Safety buffer" inputMode="numeric" />
                    <Input name="lowStockThreshold" defaultValue={inv?.lowStockThreshold ?? 10} className="h-9 w-16" aria-label="Low-stock threshold" inputMode="numeric" />
                    <Select name="source" defaultValue={inv?.source ?? "MANUAL"} className="h-9 w-28" aria-label="Source"><option>MANUAL</option><option>CJ</option></Select>
                  </ActionForm>
                </td>
              )}
            </tr>
          );
        })}
      </Table>
      <Panel title="Recent stock movements" className="mt-6">
        <ul className="space-y-1 text-xs">
          {movements.map((m) => <li key={m.id}>{m.createdAt.toLocaleString("en-GB")} · {m.variant.sku} · {m.field} {m.delta > 0 ? "+" : ""}{m.delta} · {m.reason}{m.reference ? ` · ${m.reference}` : ""}</li>)}
          {!movements.length && <li className="text-muted">No movements yet.</li>}
        </ul>
      </Panel>
    </>
  );
}
