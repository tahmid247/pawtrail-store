# Security

## Controls implemented

| Area | Implementation |
|---|---|
| Transport | HTTPS redirect + HSTS (`max-age=2y; preload`) in production; `upgrade-insecure-requests` |
| Headers | Nonce-based CSP (`strict-dynamic`), `frame-ancestors 'none'`, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP; `no-store` + `noindex` on /admin and /account |
| Authentication | Better Auth: scrypt password hashing, min 10 chars, email verification required, password reset tokens (1 h, single use, revoke sessions), http-only `SameSite=Lax` cookies, `Secure` in production, 14-day sessions |
| MFA | TOTP 2FA with backup codes. **Mandatory for ADMIN and SUPPORT** (`checkStaffAccess`), enforced on every admin page *and* server action |
| Authorization | Roles stored in DB and re-read on every request (never trusted from cookies). Every admin mutation goes through `guarded()` → `assertStaff()`. Customer data access is scoped in queries (`where: { userId }`) |
| CSRF | Better Auth origin checks; Next.js Server Actions verify Origin/Host; webhooks verified by signature/secret |
| Injection | Prisma parameterised queries; raw SQL uses tagged templates only; zod validation on every input; HTML never rendered from user/admin content (custom safe Markdown renderer, escaped email templates, `<` escaped in JSON-LD); CSV export neutralises formula injection |
| Uploads | Magic-byte type detection (JPEG/PNG/WebP only, no SVG), 5 MB limit, random file names |
| Rate limiting | Better Auth limits on sign-in/up/reset/2FA (DB-backed); app limiter (Postgres atomic upsert) on cart, checkout, discount codes, newsletter, contact, reviews, tracking, export |
| Bots | Honeypot fields, rate limits, double opt-in. Add Cloudflare Turnstile at the edge if abuse appears |
| Payments | Stripe Checkout (PCI SAQ-A: card data never touches our servers). Webhook signature verification, event de-duplication table, row-locked idempotent `markOrderPaid`, Stripe idempotency keys on session/coupon/refund creation. Amount/currency cross-checked against the order |
| Inventory/orders | Conditional atomic UPDATEs, DB CHECK constraints (no negative stock), unique constraints preventing duplicate fulfillment |
| Secrets | Environment variables only, `server-only` imports prevent bundling into client code. CJ tokens AES-256-GCM encrypted at rest |
| Audit | `AuditLog` for admin actions (refunds, cancellations, role changes, inventory, settings, customer record views, exports) |
| Privacy | Consent records, data export, erasure workflow, retention job, minimal analytics (consent-gated, no IP stored) |
| Errors | Generic messages to clients; details only in server logs and `IntegrationLog` |

## Operational procedures

- **Secret rotation:** rotate Stripe/CJ/Resend keys in their dashboards, then update env vars and redeploy. Rotating `BETTER_AUTH_SECRET` invalidates all sessions and **existing 2FA secrets**, so staff must re-enrol.
- **Staff off-boarding:** Admin → Customers → set role to CUSTOMER (this revokes sessions immediately).
- **Backups & recovery:** Supabase PITR plus a weekly encrypted `pg_dump` stored separately. Restore drill: create a scratch project, restore, point a preview deployment at it, then smoke-test login, product page and admin orders.
- **Incident response (personal-data breach):** contain (rotate keys, revoke sessions), assess, and notify the Garante **within 72 hours** where required (GDPR Art. 33). Notify affected customers if the risk is high (Art. 34). Record the incident.
- **Dependency monitoring:** Dependabot + `npm audit --omit=dev` in CI. Review Better Auth, Next.js, Stripe and Prisma advisories.

## Before launch

Run a dependency audit, an OWASP ZAP baseline scan against staging, and check the CSP report in the browser console (no violations) on every page type.
