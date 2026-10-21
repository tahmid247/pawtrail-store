import type { Collection, Product, ProductCollection } from "@prisma/client";
import { formatClaims, formatFaqs } from "@/lib/admin-format";
import { saveProduct } from "@/app/admin/actions/catalog";
import { Panel } from "./ui";
import { ActionForm } from "./action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";

export function ProductForm({ product, collections }: { product?: Product & { collections: ProductCollection[] }; collections: Collection[] }) {
  return (
    <Panel title="Product details">
      <ActionForm action={saveProduct} submitLabel="Save product">
        {product && <input type="hidden" name="id" value={product.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="title"><Input id="title" name="title" defaultValue={product?.title} required /></Field>
          <Field label="URL slug" htmlFor="slug" hint="/products/your-slug"><Input id="slug" name="slug" defaultValue={product?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></Field>
        </div>
        <Field label="Subtitle" htmlFor="subtitle"><Input id="subtitle" name="subtitle" defaultValue={product?.subtitle ?? ""} /></Field>
        <Field label="Description" htmlFor="description"><Textarea id="description" name="description" rows={6} defaultValue={product?.description} required /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={product?.status ?? "DRAFT"}><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option></Select>
          </Field>
          <Field label="Category" htmlFor="category"><Input id="category" name="category" defaultValue={product?.category ?? ""} /></Field>
          <Field label="Product type" htmlFor="productType"><Input id="productType" name="productType" defaultValue={product?.productType ?? ""} /></Field>
        </div>
        <Checkbox name="featured" label="Featured on homepage" defaultChecked={product?.featured} />
        <Field label="Highlights" htmlFor="highlights" hint="One per line. Start with [x] for a claim verified against supplier specs (shown), or [ ] for unverified (hidden from shoppers).">
          <Textarea id="highlights" name="highlights" rows={6} className="font-mono text-sm" defaultValue={formatClaims(product?.highlights, false)} />
        </Field>
        <Field label="Specifications" htmlFor="specifications" hint='One per line as "[x] Label: Value". Only [x] verified specs are shown.'>
          <Textarea id="specifications" name="specifications" rows={7} className="font-mono text-sm" defaultValue={formatClaims(product?.specifications, true)} />
        </Field>
        <Field label="Care instructions" htmlFor="careInstructions"><Textarea id="careInstructions" name="careInstructions" rows={3} defaultValue={product?.careInstructions ?? ""} /></Field>
        <Field label="Product FAQ" htmlFor="faqs" hint='Blocks of "Q: …" and "A: …", separated by a blank line.'>
          <Textarea id="faqs" name="faqs" rows={6} className="text-sm" defaultValue={formatFaqs(product?.faqs)} />
        </Field>
        {collections.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Collections</legend>
            <div className="flex flex-wrap gap-4">
              {collections.map((c) => <Checkbox key={c.id} name="collections" value={c.id} label={c.title} defaultChecked={product?.collections.some((pc) => pc.collectionId === c.id)} />)}
            </div>
          </fieldset>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SEO title (≤ 70)" htmlFor="seoTitle"><Input id="seoTitle" name="seoTitle" maxLength={70} defaultValue={product?.seoTitle ?? ""} /></Field>
          <Field label="SEO description (≤ 170)" htmlFor="seoDescription"><Input id="seoDescription" name="seoDescription" maxLength={170} defaultValue={product?.seoDescription ?? ""} /></Field>
        </div>
      </ActionForm>
    </Panel>
  );
}
