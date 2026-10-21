import Image from "next/image";
import Link from "next/link";
import type { PublicProduct } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/misc";

export function ProductCard({ product }: { product: PublicProduct }) {
  const img = product.images[0];
  const hover = product.images[1];
  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-lavender-pale">
        {img && <Image src={img.url} alt={img.alt} fill sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />}
        {hover && <Image src={hover.url} alt="" fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover opacity-0 transition duration-500 group-hover:opacity-100" />}
        {!product.inStock && <Badge tone="neutral" className="absolute left-4 top-4 bg-white">Sold out</Badge>}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink group-hover:text-primary">{product.title}</h3>
          {product.variants.length > 1 && (
            <div className="mt-2 flex gap-1.5" aria-label={`${product.variants.length} colours`}>
              {product.variants.map((v) => <span key={v.id} className="size-3.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: v.swatchHex ?? "#ddd" }} title={v.title} />)}
            </div>
          )}
        </div>
        <p className="shrink-0 font-semibold">
          {product.minPriceCents !== product.maxPriceCents && <span className="text-sm font-normal text-muted">from </span>}
          {formatMoney(product.minPriceCents, product.currency)}
        </p>
      </div>
    </Link>
  );
}
