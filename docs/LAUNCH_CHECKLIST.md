# Launch readiness checklist

The admin **Overview** shows the automatically checkable items live. Tick everything below before accepting real orders.

## Business & legal
- [ ] Brand name, logo, support email (Admin → Settings → Brand)
- [ ] Legal name, address, Partita IVA, REA, PEC (Settings → Business). These fill the legal pages automatically
- [ ] All six legal pages completed (every `[PLACEHOLDER]`), **reviewed by a lawyer**, DRAFT notice removed, version bumped
- [ ] Return address and who pays return shipping decided and stated
- [ ] Withdrawal exceptions reviewed (hygiene exception applies only if genuinely relevant)
- [ ] VAT setup confirmed with your accountant (rate, OSS registration if needed, invoicing/receipts obligations)
- [ ] Data processing agreements in place with Stripe, CJdropshipping, Supabase, Vercel, Resend. International transfers documented in the Privacy Policy
- [ ] Records of processing activities (GDPR Art. 30) prepared

## Product truthfulness
- [ ] Capacity, material, dimensions, weight, leak resistance and pet compatibility **confirmed with the supplier** (ideally with a sample in hand), then marked `[x]` in Admin → Products
- [ ] Each colour variant visually matches what CJ ships
- [ ] Product photos are authentic product photos (current images come from the supplier listing; replace them with your own when possible, and consider higher-resolution versions, since the current files are 800×800)
- [ ] Real price set per variant (seed price €24.90 is a placeholder)
- [ ] No compare-at/strike-through prices unless genuine (EU Omnibus: prior price = lowest of the last 30 days)

## Shipping & inventory
- [ ] Shipping zones, prices and **realistic delivery estimates** (dispatch + transit) per country
- [ ] Prepaid stock purchased at CJ. Variants mapped (pid/vid). Inventory source set to CJ and synced, or counted manually
- [ ] Safety buffers and low-stock thresholds set
- [ ] CJ live verification steps completed (`docs/CJ_INTEGRATION.md` §5)

## Payments & email
- [ ] Stripe account verified. Live keys and live webhook endpoint configured, webhook test delivery succeeded
- [ ] One real low-value live purchase and refund completed end to end
- [ ] Resend domain verified. Confirmation, shipping and reset emails received and checked on mobile
- [ ] `ADMIN_ALERT_EMAIL` set

## Security & operations
- [ ] All admins have 2FA. Admin passwords unique and long. Only necessary staff accounts exist
- [ ] Production env vars set. `CRON_SECRET`, `BETTER_AUTH_SECRET` and `DATA_ENCRYPTION_KEY` are strong random values
- [ ] Database in EU region, SSL enforced, PITR on, Supabase Data API locked down, restore drill done
- [ ] Error monitoring and uptime checks configured
- [ ] `npm audit` clean (or risks accepted), dependency alerts enabled

## SEO & analytics
- [ ] Domain verified in Google Search Console. `sitemap.xml` submitted
- [ ] SEO titles and descriptions reviewed per product
- [ ] Analytics (if any) configured in Settings and listed in the Cookie Policy

## Final smoke test (production)
- [ ] Browse → add to cart → checkout → pay → confirmation email → admin sees order → fulfil → tracking email → customer sees tracking
- [ ] Cookie banner: reject/accept/customise all work. Footer "Cookie settings" reopens it
- [ ] Mobile check on iOS Safari and Android Chrome
