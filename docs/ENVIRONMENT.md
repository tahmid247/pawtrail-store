# Environment variables

All variables are read on the **server only**, except `NEXT_PUBLIC_SITE_URL`. Secrets are never sent to the browser. `.env.example` has a ready-to-fill template.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection. Use `sslmode=require` in production. |
| `BETTER_AUTH_SECRET` | ✅ | ≥32 random bytes. Signs sessions and encrypts 2FA secrets. Rotating it signs everyone out. |
| `BETTER_AUTH_URL` | ✅ | Public origin (https). Used for auth callbacks and CSRF origin checks. |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Public origin used for canonical URLs, sitemap, emails, Stripe redirects. |
| `CRON_SECRET` | ✅ | Bearer token for `/api/cron/*`. |
| `STRIPE_SECRET_KEY` | for payments | `sk_test_…` / `sk_live_…`. Without it, production checkout is disabled. |
| `STRIPE_WEBHOOK_SECRET` | for payments | `whsec_…` of your webhook endpoint. The webhook returns 503 without it. |
| `PAYMENT_SIMULATOR` | no | `false` disables the dev-only simulator locally. It is always disabled in production. |
| `RESEND_API_KEY` | for email | Without it, emails are only logged. |
| `EMAIL_FROM` | for email | Sender, e.g. `Wanderpaw <orders@yourdomain.com>`. |
| `ADMIN_ALERT_EMAIL` | recommended | Receives low-stock, fulfillment-failure and payment-attention alerts. |
| `CJ_MODE` | no | `mock` (default) or `live`. |
| `CJ_API_KEY` | for CJ live | CJ API key (CJ dashboard → Authorization → API). |
| `CJ_API_BASE_URL` | no | Defaults to `https://developers.cjdropshipping.com/api2.0/v1`. |
| `CJ_WEBHOOK_SECRET` | for CJ webhooks | Random string, appended as `?key=` to the webhook URL registered at CJ. |
| `CJ_PAY_TYPE` | no | Only set after confirming its meaning with CJ (it can trigger automatic payment). |
| `DATA_ENCRYPTION_KEY` | recommended | Key for AES-256-GCM encryption of supplier tokens stored in the DB. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | for uploads in prod | Image storage. The service role key is a **secret**. |
| `IMAGE_REMOTE_HOST` | with uploads | Hostname allowed for `next/image` optimisation. |
| `ADMIN_REQUIRE_2FA` | no | Defaults to `true`. Never disable in production. |
| `MOCK_CJ_INVENTORY` | tests only | JSON map `{ "<vid>": qty }` for the CJ mock client. |
