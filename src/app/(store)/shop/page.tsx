import type { Metadata } from "next";
import Link from "next/link";
import { listCollections, listProducts } from "@/lib/catalog";
import { Container } from "@/components/ui/misc";
import { ProductCard } from "@/components/store/product-card";

export const metadata: Metadata = { title: "Shop", description: "Shop all products.", alternates: { canonical: "/shop" } };

export default async function ShopPage() {
  const [products, collections] = await Promise.all([listProducts(), listCollections()]);
  return (
    <Container className="py-12 sm:py-16">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold">Shop</h1>
        <p className="mt-3 text-muted">{products.length} product{products.length === 1 ? "" : "s"}</p>
        {collections.length > 0 && (
          <nav aria-label="Collections" className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white">All</span>
            {collections.map((c) => (
              <Link key={c.id} href={`/collections/${c.slug}`} className="rounded-full border border-line px-4 py-1.5 text-sm font-medium hover:border-primary hover:text-primary">{c.title}</Link>
            ))}
          </nav>
        )}
      </header>
      {products.length ? (
        <ul data-reveal-stagger className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
        </ul>
      ) : (
        <p className="text-muted">No products available right now — check back soon.</p>
      )}
    </Container>
  );
}
