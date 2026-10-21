import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Backpack, Droplets, MapPinned, MessageSquareHeart, PawPrint, Soup, Sparkles } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { getApprovedReviews, getProductBySlug, getReviewSummary, listProducts } from "@/lib/catalog";
import { getShippingSummary } from "@/lib/storefront";
import { Accordion, Container, SectionHeading, Stars } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { ProductPurchase } from "@/components/store/product-purchase";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { ReviewList } from "@/components/store/reviews";

export default async function HomePage() {
  const settings = await getSettings();
  const product =
    (settings.home.featuredProductSlug && (await getProductBySlug(settings.home.featuredProductSlug))) ||
    (await listProducts({ featuredOnly: true }))[0] ||
    null;
  const [summary, reviews, shippingSummary] = await Promise.all([
    product ? getReviewSummary(product.id) : null,
    product ? getApprovedReviews(product.id, 6) : [],
    getShippingSummary(),
  ]);

  const features = [
    { icon: Droplets, title: "Convenient Hydration", body: "Fresh water for your pet wherever you are — fill the integrated bowl straight from the bottle when they're thirsty." },
    { icon: Soup, title: "Food and Water in One", body: "A separate food container attaches to the bottle, so treats or kibble travel with the water instead of in your pocket." },
    { icon: Backpack, title: "Travel-Friendly Design", body: "A compact, all-in-one bottle that slips into a bag or car door — one item to grab instead of three." },
    { icon: MapPinned, title: "Outdoor Convenience", body: "Made for walks, park visits, hikes and road trips — anywhere a water bowl isn't." },
  ];

  const steps = [
    { title: "Fill", body: "Fill the bottle with fresh water and the food container with your pet's kibble or treats." },
    { title: "Pour", body: "When your pet is thirsty, release water into the integrated bowl — no separate bowl needed." },
    { title: "Enjoy", body: "Let your pet drink, empty any leftover water, close the bowl and continue the adventure." },
  ];

  const gallery = product?.images ?? [];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-lavender-pale via-white to-white">
        <div className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-lavender blur-3xl" aria-hidden />
        <Container className="relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div className="animate-fade-up">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-primary-deep shadow-soft">
              <Sparkles className="size-3.5 text-primary" aria-hidden /> The 2-in-1 water &amp; food bottle
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.05] text-ink sm:text-5xl lg:text-6xl">{settings.home.heroHeadline}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{settings.home.heroSubheadline}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={product ? `/products/${product.slug}` : "/shop"} size="lg">
                Shop Now <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="#features" size="lg" variant="outline">
                Explore Features
              </ButtonLink>
            </div>
            {summary && summary.count > 0 && (
              <p className="mt-8 flex items-center gap-2 text-sm text-muted">
                <Stars rating={summary.average} /> {summary.average.toFixed(1)} from {summary.count} verified review{summary.count === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <div className="relative">
            <div className="relative aspect-square overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-black/5">
              <Image src={settings.home.heroImage} alt="A corgi drinking from the Portable Pet Water Bottle on a walk" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            </div>
            <div className="absolute -bottom-5 -left-3 hidden rounded-2xl bg-white p-4 shadow-lift sm:flex sm:items-center sm:gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-lavender text-primary"><PawPrint className="size-5" aria-hidden /></span>
              <span className="text-sm">
                <span className="block font-semibold">Water + food</span>
                <span className="text-muted">in one bottle</span>
              </span>
            </div>
          </div>
        </Container>
      </section>

      {/* Featured product */}
      {product && (
        <section className="py-20 sm:py-28" aria-labelledby="featured-title">
          <Container className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-lavender-pale">
              {product.images[0] && <Image src={product.images[0].url} alt={product.images[0].alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />}
            </div>
            <div className="lg:py-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">Featured</p>
              <h2 id="featured-title" className="text-3xl font-bold sm:text-4xl">
                <Link href={`/products/${product.slug}`} className="hover:text-primary">{product.title}</Link>
              </h2>
              {product.subtitle && <p className="mt-3 text-muted">{product.subtitle}</p>}
              {product.highlights.length > 0 && (
                <ul className="mt-6 space-y-2.5">
                  {product.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-3 text-[0.95rem]">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden /> {h}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-8 rounded-3xl border border-line p-6 shadow-soft">
                <ProductPurchase
                  productTitle={product.title}
                  variants={product.variants}
                  maxPerOrder={settings.commerce.maxQuantityPerItem}
                  shippingSummary={shippingSummary}
                  withdrawalDays={settings.commerce.withdrawalDays}
                  compact
                />
              </div>
              <Link href={`/products/${product.slug}`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Full details &amp; specifications <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </Container>
        </section>
      )}

      {/* Why pet owners love it */}
      <section id="features" className="scroll-mt-24 bg-lavender-pale py-20 sm:py-28">
        <Container>
          <SectionHeading eyebrow="Why pet owners love it" title="Everything your pet needs on the go, in one hand" description="Designed around the small, everyday moments of being out with your pet." />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <li key={f.title} className="group rounded-3xl bg-white p-7 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-lavender text-primary transition group-hover:bg-primary group-hover:text-white">
                  <f.icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-6 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-28" aria-labelledby="how-title">
        <Container>
          <SectionHeading eyebrow="How it works" title={<span id="how-title">Three steps to a happy, hydrated pet</span>} />
          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="relative rounded-3xl border border-line p-8">
                <span className="font-display text-5xl font-extrabold text-lavender" aria-hidden>0{i + 1}</span>
                <h3 className="mt-4 text-xl font-bold">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </h3>
                <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Lifestyle gallery */}
      {gallery.length > 2 && (
        <section className="pb-20 sm:pb-28" aria-labelledby="gallery-title">
          <Container>
            <SectionHeading eyebrow="Out and about" title={<span id="gallery-title">Made for life outdoors</span>} />
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-2">
              {gallery.slice(0, 5).map((img, i) => (
                <li key={img.id} className={i === 0 ? "col-span-2 row-span-2" : ""}>
                  <div className="group relative aspect-square overflow-hidden rounded-3xl bg-lavender-pale">
                    <Image src={img.url} alt={img.alt} fill loading="lazy" sizes={i === 0 ? "(min-width:1024px) 50vw, 100vw" : "(min-width:1024px) 25vw, 50vw"} className="object-cover transition duration-500 group-hover:scale-105" />
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {/* Reviews */}
      <section className="bg-lavender-pale py-20 sm:py-28" aria-labelledby="reviews-title">
        <Container>
          <SectionHeading eyebrow="Customer reviews" title={<span id="reviews-title">What customers say</span>} />
          {reviews.length > 0 ? (
            <ReviewList reviews={reviews} />
          ) : (
            <div className="mx-auto max-w-lg rounded-3xl bg-white p-10 text-center shadow-soft">
              <MessageSquareHeart className="mx-auto size-10 text-primary" aria-hidden />
              <p className="mt-4 font-semibold">No reviews yet</p>
              <p className="mt-2 text-sm text-muted">
                We&apos;re a new store, so we don&apos;t have reviews to show you yet. Every review here will come from a verified customer — never invented.
              </p>
            </div>
          )}
        </Container>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 py-20 sm:py-28" aria-labelledby="faq-title">
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="FAQ" title={<span id="faq-title">Questions, answered</span>} />
          <Accordion items={settings.faq.map((f) => ({ title: f.question, content: <p className="whitespace-pre-line">{f.answer}</p> }))} />
          <p className="mt-8 text-center text-sm text-muted">
            Still have questions? <Link href="/contact" className="font-semibold text-primary hover:underline">Contact us</Link>
          </p>
        </Container>
      </section>

      {/* Newsletter */}
      <section aria-labelledby="newsletter-title">
        <Container>
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-primary-deep px-6 py-14 text-white sm:px-14">
            <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="relative grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h2 id="newsletter-title" className="text-3xl font-bold">Join the pack</h2>
                <p className="mt-3 text-white/80">Be the first to hear about new products. Only occasional emails, and only if you confirm.</p>
              </div>
              <div className="rounded-2xl bg-white p-5 text-ink [&_form]:mt-0">
                <NewsletterForm id="home-newsletter" />
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
