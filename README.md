# Wanderpaw — Premium D2C Pet Store

A production-oriented e-commerce platform built with **Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + PostgreSQL (Prisma) + Better Auth + Stripe + CJdropshipping**.
It launches with one product, the **Portable Pet Water Bottle**, but supports any number of products, variants, collections and images.

> "Wanderpaw" is a placeholder brand name. Change it, along with the logo, colours and every business/legal field, in **Admin → Settings**.

---

## 1. Status at a glance

| Area | Status | Notes |
|---|---|---|
| Storefront: home, shop, collections, product page, cart, checkout, about, contact, track order, legal pages, 404 | ✅ Complete | Responsive, accessible, lavender/violet design |
| Product catalogue: products, variants, images, collections, SEO, verified-claims system | ✅ Complete | Unverified supplier claims are stored but **hidden** from shoppers |
| Cart (persistent, server-validated), discount codes, shipping zones & rates | ✅ Complete | Prices/stock never trusted from the client |
| Inventory with prepaid stock, reservations, pending deduction, safety buffer | ✅ Complete | Concurrency-safe (tested) |
| Customer accounts: register, email verification, login, reset password, 2FA, profile, addresses, orders, tracking, data export, deletion request, marketing preferences | ✅ Complete | Better Auth |
| Admin dashboard: overview & conversion, orders, refunds, cancellations, fulfillment, products, inventory, customers, support, reviews, discounts, shipping, settings, legal, email templates, newsletter, audit log, integrations | ✅ Complete | RBAC (ADMIN / SUPPORT) + mandatory 2FA |
| GDPR: cookie consent (accept/reject/customize), consent records, double opt-in newsletter, data export, erasure workflow, retention job | ✅ Complete | Legal texts are **drafts** for lawyer review |
| Security: CSP with nonces, HSTS, rate limiting, RBAC, audit log, webhook signature verification, idempotency | ✅ Complete | See `docs/SECURITY.md` |
| SEO: metadata, canonical URLs, Open Graph, Product JSON-LD, sitemap.xml, robots.txt | ✅ Complete | |
| **Stripe payments** | 🟡 Code complete, **needs your keys** | Checkout Sessions + signed webhooks. Webhook flow is tested with Stripe's signing helper. Until keys exist, dev uses a payment **simulator** (disabled in production). |
| **Transactional email** | 🟡 Code complete, **needs `RESEND_API_KEY`** | Without it, emails are logged to the console and `EmailLog` table |
| **CJdropshipping integration** | 🟠 Framework complete, **NOT verified against the live API** | Runs against a mock client. CJ's docs host was unreachable from the build environment; see `docs/CJ_INTEGRATION.md` for what is confirmed vs. to verify. Admin-assisted workflow works today. |
| Image uploads in production | 🟡 Needs Supabase Storage config | Dev writes to `public/uploads` |
| Legal documents | 🟠 **Drafts** with `[PLACEHOLDERS]` | Must be completed and reviewed by a qualified professional |
| Product facts (capacity, material, dimensions, leak-proofing, compatibility) | 🟠 **Unverified** | Marked unverified and hidden until you confirm them with the supplier |
| Price (€24.90), stock (25/colour), shipping rates (€4.90 IT / €7.90 EU) | 🟠 **Placeholders** from the seed | Set real values in Admin before launch |

The admin **Overview** page contains a live **launch-readiness checklist** that turns green as you complete these items.

---

## 2. Quick start (local)

Requirements: Node 20+ (22 recommended), PostgreSQL 14+.

```bash
npm install
cp .env.example .env            # then fill DATABASE_URL, BETTER_AUTH_SECRET, etc.
npx prisma migrate deploy        # create tables
npm run db:seed                  # product, variants, images, shipping zones, legal drafts
npm run create-admin -- you@example.com "a-long-unique-password" "Your Name"
npm run dev                      # http://localhost:3000
```

Sign in at `/account/login` with the admin account. You'll be sent to **Account → Security** to enable two-factor authentication (required for staff), after which `/admin` unlocks.

Without Stripe keys, checkout redirects to a clearly labelled **payment simulator** (`/checkout/simulate`) so you can test the whole flow. The simulator is impossible to use in production builds.

---

## 3. Project structure

```
prisma/
  schema.prisma          42 tables: users/auth, catalogue, inventory, carts, orders, payments, refunds,
                         suppliers, fulfillment, shipments, tracking, discounts, reviews, newsletter,
                         support, consent, audit, webhooks, settings, legal pages, email templates
  migrations/            includes DB CHECK constraints (no negative stock, valid ratings…)
  seed.ts                initial catalogue & configuration (idempotent)
src/
  app/(store)/           storefront pages (home, shop, products, cart, checkout, account, legal…)
  app/admin/             admin dashboard + server actions (all role-checked & audited)
  app/actions/           storefront server actions (cart, checkout, newsletter, contact, reviews…)
  app/api/               auth, Stripe & CJ webhooks, cron jobs, data export, CSV export
  lib/
    auth.ts, session.ts  Better Auth config, RBAC & 2FA enforcement
    pricing.ts           server-side quote (subtotal, discount, shipping, VAT)
    inventory.ts         prepaid-stock accounting with atomic reservations
    orders.ts            order lifecycle, idempotent payment confirmation
    payments/            provider interface, Stripe, dev simulator, webhook handler, refunds
    fulfillment/         CJ live client, CJ mock client, fulfillment service (submit/sync/track)
    email/               Resend sender + editable templates
    settings.ts          typed, validated store settings
    privacy.ts, retention.ts   GDPR export/erasure, retention job
  components/            UI kit (shadcn-style), storefront, account & admin components
  middleware.ts          CSP nonce, security headers, HTTPS redirect
tests/                   Vitest integration tests (real PostgreSQL)
e2e/                     Playwright browser tests (desktop + mobile)
docs/                    deployment, environment, CJ, security, operations, launch checklist
```

Payments and fulfillment are behind small interfaces (`PaymentProvider`, `FulfillmentClient`), so other providers can be added without touching order logic.

---

## 4. Documentation

| Document | Contents |
|---|---|
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Vercel + Supabase deployment, Stripe & webhooks, Resend, CJ, cron, backups |
| [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) | Every environment variable explained |
| [`docs/TESTING.md`](docs/TESTING.md) | Running unit/integration/E2E tests, Stripe test mode, manual test plan |
| [`docs/CJ_INTEGRATION.md`](docs/CJ_INTEGRATION.md) | CJ API research, confirmed vs. unverified endpoints, limitations, admin-assisted workflow |
| [`docs/CJ_PREPAID_INVENTORY_OPERATIONS.md`](docs/CJ_PREPAID_INVENTORY_OPERATIONS.md) | **Private** operations manual for the prepaid-inventory model |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Security controls, threat model notes, incident & backup procedures |
| [`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md) | Everything to do before going live |

---

## 5. Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck`, `npm run lint` | Static checks |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Seed catalogue & config (safe to re-run) |
| `npm run create-admin -- <email> <password> [name] [ADMIN\|SUPPORT]` | Create or promote a staff account |
| `npm test` | Integration tests against `shop_test` DB (see `.env.test`) |
| `npm run test:e2e` | Playwright browser tests against `shop_e2e` DB (see `.env.e2e`) |
