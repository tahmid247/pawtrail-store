import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { listProducts } from "@/lib/catalog";
import { Container } from "@/components/ui/misc";
import { ProductCard } from "@/components/store/product-card";

type Props = { params: Promise<{ slug: string }> };

async function getCollection(slug: string) {
  return prisma.collection.findFirst({ where: { slug, published: true } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCollection((await params).slug);
  if (!c) return {};
  return { title: c.seoTitle || c.title, description: c.seoDescription || c.description || undefined, alternates: { canonical: `/collections/${c.slug}` } };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) notFound();
  const products = await listProducts({ collectionSlug: slug });
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-4xl font-extrabold">{collection.title}</h1>
      {collection.description && <p className="mt-3 max-w-2xl text-muted">{collection.description}</p>}
      <ul data-reveal-stagger className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
      </ul>
    </Container>
  );
}
