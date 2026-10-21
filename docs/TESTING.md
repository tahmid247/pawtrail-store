# Testing

No live payments are processed and no real supplier orders are placed by any automated test.

## Integration tests (Vitest, real PostgreSQL)

```bash
createdb shop_test            # once (owner must match .env.test)
npm run test:db:setup         # apply migrations to shop_test
npm test
```

The suite refuses to run against a database whose name doesn't contain `_test`. **41 tests** cover:

- **Pricing:** server-side totals, VAT, shipping, discount validation (expiry, limits, minimums).
- **Inventory:** reservations, **12 concurrent checkouts for 5 units → exactly 5 succeed**, expiry release, idempotent commit.
- **Checkout & payment:** guest orders, out-of-stock rejection, idempotent payment confirmation, amount mismatch → *requires attention*, payment after reservation expiry with no stock, payment failure releases stock, order access control.
- **Stripe webhook route:** invalid signature rejected, verified event marks paid, **duplicate delivery ignored**, delayed (unpaid) sessions not marked paid, expiry releases stock. Payloads are signed with Stripe's official test helper.
- **Fulfillment (CJ mock):** submission, duplicate and **concurrent** submission prevention, failure logging and admin retry, unpaid and unmapped orders refused, tracking sync (shipped → delivered, no duplicate emails), inventory sync respecting manual sources, low-stock alert throttling, defensive CJ response parsing.
- **Authorization:** anonymous, customer, admin-without-2FA and support users are refused admin mutations. A 2FA admin can refund (validated and audited). Cron endpoints need the secret. Data export needs a session. Open-redirect protection.
- **Privacy:** erasure keeps legally required orders unlinked, staff accounts can't be erased, retention purges, consent cookie parsing, email HTML escaping, rate limiting.

## End-to-end tests (Playwright)

```bash
createdb shop_e2e             # once
npm run test:e2e              # starts `next dev` on :3100 with .env.e2e
```

Runs on desktop Chrome and Pixel 7 emulation:

1. Homepage shows no fake reviews and hides unverified claims.
2. Guest buys 2 units: variant selection, cart, checkout disclosures, terms enforcement, simulated payment, confirmation, cart emptied.
3. Guest order lookup needs the matching email.
4. Admin signs in, is **forced to set up TOTP 2FA**, submits the order to CJ (mock), simulates shipment, and the customer sees tracking.
5. An unverified customer can't sign in or reach the admin.
6. Mobile: menu, sticky Add to Cart, no horizontal scroll.

## Manual test plan with Stripe test mode

1. Set test keys, then run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
2. Pay with `4242…` → order paid, confirmation email logged, stock moves to *pending deduction*.
3. Pay with `4000 0000 0000 0002` (declined) → no order paid, retry possible.
4. Abandon checkout → after expiry (or `stripe trigger checkout.session.expired`), stock is released.
5. Resend an event from the Stripe dashboard → logged as duplicate, no double processing.
6. Refund from Admin (full/partial) and from the Stripe dashboard → both reflected on the order.
7. Check accessibility with keyboard only, plus Lighthouse/axe on home, product, cart and checkout.
