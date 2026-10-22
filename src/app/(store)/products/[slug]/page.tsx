import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getApprovedReviews, getProductBySlug, getReviewSummary, listProducts } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { getShippingSummary } from "@/lib/storefront";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { Accordion, Container, Stars } from "@/components/ui/misc";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductPurchase } from "@/components/store/product-purchase";
import { ReviewList } from "@/components/store/reviews";
import { ReviewForm } from "@/components/store/review-form";
import { ProductCard } from "@/components/store/product-card";
import { JsonLd } from "@/components/store/json-ld";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: "Product not found" };
  const title = product.seoTitle || product.title;
  const description = product.seoDescription || product.description.slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title, description, type: "website", images: product.images.slice(0, 4).map((i) => ({ url: i.url, alt: i.alt })) },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [settings, summary, reviews, shippingSummary, user, related] = await Promise.all([
    getSettings(),
    getReviewSummary(product.id),
    getApprovedReviews(product.id),
    getShippingSummary(),
    getCurrentUser(),
    listProducts(),
  ]);
  const canReview =
    user &&
    (await prisma.order.count({ where: { userId: user.id, paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] }, items: { some: { productId: product.id } } } })) > 0 &&
    !(await prisma.review.findUnique({ where: { userId_productId: { userId: user.id, productId: product.id } } }));
  const others = related.filter((p) => p.id !== product.id).slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.images.map((i) => new URL(i.url, env.siteUrl).toString()),
    brand: { "@type": "Brand", name: settings.brand.name },
    sku: product.variants[0]?.sku,
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      name: `${product.title} — ${v.title}`,
      price: (v.priceCents / 100).toFixed(2),
      priceCurrency: v.currency,
      availability: v.available > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${env.siteUrl}/products/${product.slug}`,
      itemCondition: "https://schema.org/NewCondition",
    })),
    ...(summary.count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: summary.average.toFixed(1), reviewCount: summary.count } } : {}),
  };

  const details = [
    { title: "Description", content: <p className="whitespace-pre-line">{product.description}</p> },
    ...(product.specifications.length
      ? [{
          title: "Specifications",
          content: (
            <dl className="divide-y divide-line">
              {product.specifications.map((s) => (
                <div key={s.label} className="grid grid-cols-2 gap-4 py-2.5">
                  <dt className="font-medium text-ink">{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          ),
        }]
      : []),
    ...(product.careInstructions ? [{ title: "Care instructions", content: <p className="whitespace-pre-line">{product.careInstructions}</p> }] : []),
    {
      title: "Shipping & returns",
      content: (
        <div className="space-y-3">
          <p>{shippingSummary ?? "Shipping costs and delivery estimates for your country are shown at checkout before you pay."}</p>
          <p>{settings.shippingNote}</p>
          <p>
            You can withdraw from your purchase within {settings.commerce.withdrawalDays} days of delivery. See our{" "}
            <Link href="/legal/shipping" className="text-primary underline">Shipping Policy</Link> and{" "}
            <Link href="/legal/returns" className="text-primary underline">Returns &amp; Refunds</Link>.
          </p>
        </div>
      ),
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <Container className="pt-6 pb-4">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-sm text-muted">
            <li><Link href="/" className="hover:text-primary">Home</Link></li>
            <li aria-hidden><ChevronRight className="size-3.5" /></li>
            <li><Link href="/shop" className="hover:text-primary">Shop</Link></li>
            <li aria-hidden><ChevronRight className="size-3.5" /></li>
            <li aria-current="page" className="truncate text-ink">{product.title}</li>
          </ol>
        </nav>
      </Container>

      <Container className="grid gap-10 pb-16 lg:grid-cols-2 lg:gap-16">
        <ProductGallery images={product.images} />
        <div>
          {product.category && <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{product.category}</p>}
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{product.title}</h1>
          {product.subtitle && <p className="mt-3 text-lg text-muted">{product.subtitle}</p>}
          {summary.count > 0 && (
            <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm text-muted hover:text-primary">
              <Stars rating={summary.average} /> {summary.average.toFixed(1)} · {summary.count} review{summary.count === 1 ? "" : "s"}
            </a>
          )}
          {product.highlights.length > 0 && (
            <ul className="mt-6 space-y-2.5">
              {product.highlights.map((h) => (
                <li key={h} className="flex items-start gap-3 text-[0.95rem]">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden /> {h}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-8">
            <ProductPurchase
              productTitle={product.title}
              variants={product.variants}
              maxPerOrder={settings.commerce.maxQuantityPerItem}
              shippingSummary={shippingSummary}
              withdrawalDays={settings.commerce.withdrawalDays}
            />
          </div>
          <div className="mt-10">
            <div data-reveal><Accordion items={details} /></div>
          </div>
        </div>
      </Container>

      <section id="reviews" className="scroll-mt-24 bg-lavender py-16 sm:py-20" aria-labelledby="reviews-heading">
        <Container>
          <div data-reveal className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="reviews-heading" className="text-2xl font-bold sm:text-3xl">Customer reviews</h2>
              <p className="mt-1 text-sm text-muted">
                {summary.count > 0 ? `${summary.average.toFixed(1)} out of 5 · ${summary.count} review${summary.count === 1 ? "" : "s"}. ` : ""}
                Only customers who bought this product can review it; reviews are moderated but never edited.
              </p>
            </div>
          </div>
          {reviews.length ? <ReviewList reviews={reviews} /> : <p className="rounded-2xl bg-white p-6 text-sm text-muted">No reviews yet.</p>}
          {canReview && (
            <div className="mt-10 max-w-2xl rounded-3xl bg-white p-6 shadow-soft">
              <h3 className="text-lg font-bold">Write a review</h3>
              <ReviewForm productId={product.id} defaultName={user!.name} />
            </div>
          )}
        </Container>
      </section>

      {product.faqs.length > 0 && (
        <section className="py-16 sm:py-20" aria-labelledby="pfaq">
          <Container className="max-w-3xl">
            <h2 id="pfaq" data-reveal className="mb-8 text-center text-2xl font-bold sm:text-3xl">Product FAQ</h2>
            <div data-reveal><Accordion items={product.faqs.map((f) => ({ title: f.question, content: <p className="whitespace-pre-line">{f.answer}</p> }))} /></div>
          </Container>
        </section>
      )}

      {others.length > 0 && (
        <section className="pb-8" aria-labelledby="related">
          <Container>
            <h2 id="related" data-reveal className="mb-8 text-2xl font-bold">You may also like</h2>
            <ul data-reveal-stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
            </ul>
          </Container>
        </section>
      )}
    </>
  );
}
