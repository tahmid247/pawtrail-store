import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { deleteCollection, saveCollection } from "../actions/catalog";

export const metadata = { title: "Collections" };

export default async function CollectionsPage() {
  await requireStaffPage({ adminOnly: true });
  const collections = await prisma.collection.findMany({ orderBy: { position: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <>
      <PageHeader title="Collections" description="Group products into categories. Assign products from the product editor." />
      <div className="grid gap-6 xl:grid-cols-2">
        {[...collections, null].map((c) => (
          <Panel key={c?.id ?? "new"} title={c ? `${c.title} (${c._count.products} products)` : "New collection"}>
            <ActionForm action={saveCollection}>
              {c && <input type="hidden" name="id" value={c.id} />}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title" htmlFor={`ct-${c?.id}`}><Input id={`ct-${c?.id}`} name="title" defaultValue={c?.title} required /></Field>
                <Field label="Slug" htmlFor={`cs-${c?.id}`}><Input id={`cs-${c?.id}`} name="slug" defaultValue={c?.slug} required /></Field>
              </div>
              <Field label="Description" htmlFor={`cd-${c?.id}`}><Textarea id={`cd-${c?.id}`} name="description" rows={2} defaultValue={c?.description ?? ""} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="SEO title" htmlFor={`cst-${c?.id}`}><Input id={`cst-${c?.id}`} name="seoTitle" defaultValue={c?.seoTitle ?? ""} /></Field>
                <Field label="SEO description" htmlFor={`csd-${c?.id}`}><Input id={`csd-${c?.id}`} name="seoDescription" defaultValue={c?.seoDescription ?? ""} /></Field>
              </div>
              <div className="flex gap-6">
                <Checkbox name="published" label="Published" defaultChecked={c?.published ?? true} />
                <Field label="Position" htmlFor={`cp-${c?.id}`}><Input id={`cp-${c?.id}`} name="position" defaultValue={c?.position ?? collections.length} className="h-9 w-20" /></Field>
              </div>
            </ActionForm>
            {c && <div className="mt-3"><ActionForm action={deleteCollection} submitLabel="Delete" variant="outline" confirmText="Delete this collection?" inline><input type="hidden" name="id" value={c.id} /></ActionForm></div>}
          </Panel>
        ))}
      </div>
    </>
  );
}
