# Production deployment

Recommended: **Vercel** (app + cron) + **Supabase** (PostgreSQL in an EU region, Storage for images) + **Stripe** + **Resend**.
Any Node 20+ host with PostgreSQL works; replace `vercel.json` crons with your own scheduler hitting `/api/cron/<job>` with `Authorization: Bearer $CRON_SECRET`.

## 1. Database (Supabase)

1. Create a project in an **EU region** (e.g. Frankfurt) for GDPR data locality.
2. Copy the **connection string** into `DATABASE_URL` and add `sslmode=require`. For serverless hosting use the pooled connection (`…:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require`) and run migrations with the direct connection.
3. Apply the schema: `DATABASE_URL=<direct url> npx prisma migrate deploy`.
4. Seed once: `npm run db:seed`, then `npm run create-admin -- you@domain "long-password" "Name"`.
5. Supabase encrypts data at rest and takes daily backups (Pro plan: point-in-time recovery). Enable PITR before launch.
6. The app uses its own role-based authorization in server code, and the database is only reached server-side through Prisma. **Do not expose the database through Supabase's public REST API**: turn on Row Level Security with no policies on all tables, or disable the Data API.

## 2. Storage for product images

Create a **public** bucket `product-images`, then set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only!), `SUPABASE_STORAGE_BUCKET` and `IMAGE_REMOTE_HOST=<project>.supabase.co`.

## 3. Vercel

1. Import the repository. Framework: Next.js. The build command comes from `vercel.json` (it runs `prisma migrate deploy` first).
2. Set the environment variables from `.env.example` (Production and Preview separately; use Stripe **test** keys in Preview).
3. Add your domain and enforce HTTPS (automatic). HSTS is sent by the app in production.
4. Cron jobs in `vercel.json` (Vercel sends `CRON_SECRET` automatically). Some plans allow only daily crons; on those, the 15-minute reservation release falls back to "on next run". Stripe's `checkout.session.expired` webhook releases stock in real time anyway.

## 4. Stripe

1. Create the account, complete business verification, and enable the payment methods you want (cards, Apple Pay/Google Pay, SEPA, iDEAL, Bancontact…) in the Dashboard. Checkout shows them automatically.
2. Developers → API keys: set `STRIPE_SECRET_KEY` (test first).
3. Developers → Webhooks → Add endpoint: `https://YOUR_DOMAIN/api/webhooks/stripe` with events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`, `refund.updated`.
   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and use the printed `whsec_…`.
5. Test in test mode (card `4242 4242 4242 4242`, failure `4000 0000 0000 0002`, 3-D Secure `4000 0027 6000 3184`). Then switch to live keys and a live webhook endpoint.
6. Orders are marked paid **only** by verified webhooks, never by the browser redirect.
7. Tax: prices are VAT-inclusive at the configured rate (default 22% IT). For EU distance sales above €10,000/year, register for OSS and review VAT rates per country with your accountant. Stripe Tax can be added later.

## 5. Email (Resend)

Verify your sending domain (SPF/DKIM), set `RESEND_API_KEY`, `EMAIL_FROM` and `ADMIN_ALERT_EMAIL`. Review the templates in Admin → Email templates.

## 6. CJdropshipping

Follow `docs/CJ_INTEGRATION.md` section 5 on a staging deployment before enabling `CJ_MODE=live` in production.

## 7. Monitoring and maintenance

- **Errors:** add Sentry (`@sentry/nextjs`) or use Vercel's logs. Server code logs no secrets or card data. Integration errors appear in Admin → Integrations.
- **Dependencies:** enable GitHub Dependabot / `npm audit` in CI.
- **Uptime:** monitor `/robots.txt` and the Stripe webhook delivery dashboard.
- **Backups:** Supabase PITR, plus a periodic `pg_dump` to separate storage. Test a restore into a scratch project at least once before launch (see `docs/SECURITY.md`).
