import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/session";
import { availableFrom } from "@/lib/inventory";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { ActionForm } from "@/components/admin/action-form";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { deleteProduct, saveVariant, updateImage, uploadImages } from "../../actions/catalog";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage({ adminOnly: true });
  const { id } = await params;
  const [product, collections] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { images: { orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" }, include: { inventory: true } }, collections: true },
    }),
    prisma.collection.findMany({ orderBy: { position: "asc" } }),
  ]);
  if (!product) notFound();

  return (
    <>
      <PageHeader title={product.title} description={<Link href={`/products/${product.slug}`} className="text-primary" target="_blank">View on store ↗</Link>} />
      <div className="grid gap-6 2xl:grid-cols-[1fr_520px]">
        <ProductForm product={product} collections={collections} />
        <div className="space-y-6">
          <Panel title="Variants, prices & CJ mapping">
            <p className="mb-4 text-xs text-muted">Prices are VAT-inclusive (EUR). Changes apply to new checkouts immediately; existing orders keep the price paid. Find CJ IDs (pid/vid) in your CJ dashboard product details.</p>
            <div className="space-y-4">
              {[...product.variants, null].map((v) => (
                <details key={v?.id ?? "new"} className="rounded-xl border border-line p-4" open={!v}>
                  <summary className="cursor-pointer text-sm font-semibold">
                    {v ? <>{v.title} · {v.sku} · {(v.priceCents / 100).toFixed(2)} € · {availableFrom(v.inventory)} available {!v.active && "(inactive)"}</> : "＋ Add variant"}
                  </summary>
                  <ActionForm action={saveVariant} submitLabel={v ? "Save variant" : "Add variant"} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="productId" value={product.id} />
                    {v && <input type="hidden" name="id" value={v.id} />}
                    <Field label="Title (e.g. colour)" htmlFor={`t-${v?.id}`}><Input id={`t-${v?.id}`} name="title" defaultValue={v?.title} required /></Field>
                    <Field label="SKU" htmlFor={`s-${v?.id}`}><Input id={`s-${v?.id}`} name="sku" defaultValue={v?.sku} required /></Field>
                    <Field label="Price (€ incl. VAT)" htmlFor={`p-${v?.id}`}><Input id={`p-${v?.id}`} name="price" inputMode="decimal" defaultValue={v ? (v.priceCents / 100).toFixed(2) : ""} required /></Field>
                    <Field label="Swatch colour" htmlFor={`h-${v?.id}`}><Input id={`h-${v?.id}`} name="swatchHex" defaultValue={v?.swatchHex ?? ""} placeholder="#C9B6F2" /></Field>
                    <Field label="CJ product ID (pid)" htmlFor={`cp-${v?.id}`}><Input id={`cp-${v?.id}`} name="cjProductId" defaultValue={v?.cjProductId ?? ""} /></Field>
                    <Field label="CJ variant ID (vid)" htmlFor={`cv-${v?.id}`}><Input id={`cv-${v?.id}`} name="cjVariantId" defaultValue={v?.cjVariantId ?? ""} /></Field>
                    <Field label="CJ SKU" htmlFor={`cs-${v?.id}`}><Input id={`cs-${v?.id}`} name="cjSku" defaultValue={v?.cjSku ?? ""} /></Field>
                    <Field label="Weight (g)" htmlFor={`w-${v?.id}`}><Input id={`w-${v?.id}`} name="weightGrams" inputMode="numeric" defaultValue={v?.weightGrams ?? ""} /></Field>
                    <Field label="Position" htmlFor={`o-${v?.id}`}><Input id={`o-${v?.id}`} name="position" inputMode="numeric" defaultValue={v?.position ?? product.variants.length} /></Field>
                    <Checkbox name="active" label="Active (sellable)" defaultChecked={v?.active ?? true} className="self-end" />
                  </ActionForm>
                </details>
              ))}
            </div>
          </Panel>

          <Panel title="Images">
            <ul className="space-y-3">
              {product.images.map((img) => (
                <li key={img.id} className="flex gap-3 rounded-xl border border-line p-3">
                  <Image src={img.url} alt="" width={72} height={72} className="size-18 shrink-0 rounded-lg object-cover" />
                  <div className="flex-1 space-y-2">
                    <ActionForm action={updateImage} submitLabel="Save" inline>
                      <input type="hidden" name="imageId" value={img.id} />
                      <Input name="alt" defaultValue={img.alt} aria-label="Alt text" className="h-9 min-w-48 flex-1" required />
                      <Input name="position" defaultValue={img.position} aria-label="Position" className="h-9 w-16" inputMode="numeric" />
                    </ActionForm>
                    <ActionForm action={updateImage} submitLabel="Remove" variant="outline" confirmText="Remove this image?" inline>
                      <input type="hidden" name="imageId" value={img.id} />
                      <input type="hidden" name="delete" value="1" />
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-line pt-5">
              <ActionForm action={uploadImages} submitLabel="Upload">
                <input type="hidden" name="productId" value={product.id} />
                <Field label="Image files (JPEG/PNG/WebP, max 5 MB)" htmlFor="files"><input id="files" name="files" type="file" accept="image/jpeg,image/png,image/webp" multiple className="text-sm" /></Field>
                <Field label="…or image URL (https)" htmlFor="url"><Input id="url" name="url" placeholder="https://…" /></Field>
                <Field label="Alt text (describe the image)" htmlFor="alt"><Input id="alt" name="alt" required /></Field>
              </ActionForm>
            </div>
          </Panel>

          <Panel title="Danger zone">
            <ActionForm action={deleteProduct} submitLabel="Delete product" variant="danger" confirmText="Delete this product? Products with orders are archived instead.">
              <input type="hidden" name="id" value={product.id} />
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
