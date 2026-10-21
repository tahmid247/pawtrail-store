# CJdropshipping integration

**Status: framework complete, tested against a mock client. NOT yet verified against CJ's live API.**
Do not treat the integration as operational until the steps in section 5 pass with your real credentials.

## 1. What was researched and how reliable it is

CJ's developer site (`developers.cjdropshipping.com` / `.cn`) was **not reachable** from the build environment (blocked by its network policy), so the API could not be read directly or tested. Endpoints were cross-checked through search-engine extracts of the official docs and community implementations. Treat the table below as a starting point and confirm each item against the live docs.

| Capability | Endpoint used (base `https://developers.cjdropshipping.com/api2.0/v1`) | Confidence |
|---|---|---|
| Get access token | `POST /authentication/getAccessToken` body `{ apiKey }` → `accessToken`, `refreshToken` (both ~180 days). Repeat calls within 24 h return the same token. | Confirmed in official docs extract |
| Refresh token | `POST /authentication/refreshAccessToken` body `{ refreshToken }` | Confirmed (official docs extract) |
| Auth header | `CJ-Access-Token: <token>` | Confirmed |
| **Private (prepaid) inventory** | `POST /product/stock/privateInventory/querySpuPage` — scoped to the token's account; filters `keyword, availableStock, productId, sku`; response items contain `totalWarehouseQuantity` and `warehouseQuantityInfoList[{countryCode, warehouseQuantity, clientTransitQuantity}]` | Confirmed path & sample fields; **per-variant (SKU) breakdown not confirmed** |
| Create order | `POST /shopping/order/createOrderV2` with `orderNumber, shippingZip, shippingCountryCode, shippingCountry, shippingProvince, shippingCity, shippingAddress, shippingCustomerName, shippingPhone, email, fromCountryCode, logisticName, products[{vid, quantity}]` | Path & core fields confirmed; response shape (`orderId`) to verify |
| `payType`, `storageId`, `shopLogisticsType` | Optional fields seen in CJ samples (V3 sample includes `storageId`) | **Unverified meaning** — not sent unless configured |
| Order detail | `GET /shopping/order/getOrderDetail?orderId=` | **To verify** |
| Tracking | `GET /logistic/trackInfo?trackNumber=` (older `getTrackInfo` is deprecated) | Path confirmed; response fields to verify |
| Webhooks | HTTPS POST JSON with `messageId`, `type`, `messageType`; must answer 200 within 3 s | Confirmed (official docs extract) |

All CJ calls live in `src/lib/fulfillment/cj/client.ts`. Response parsing is defensive and the first inventory response's field names are written to the integration log, so mapping can be adjusted quickly once you see real data.

## 2. Known limitations and how the app handles them

1. **Prepaid stock allocation is not proven to be automatic.** CJ's help centre says private inventory is deducted when you place an order for the same variant from the warehouse that holds it, and that some deductions go through "Orders Picking" in the CJ dashboard. The API does not clearly document a "use private inventory" flag. The app therefore:
   - adds a remark asking CJ to use prepaid private inventory;
   - sets the order to **Awaiting supplier confirmation** after creation rather than assuming success;
   - asks the admin to verify in the CJ dashboard that the order was deducted from private inventory (not purchased as new stock), then click **Confirm supplier accepted**. A sync that sees the CJ order as `UNSHIPPED`/`SHIPPED` confirms it automatically;
   - never sends `payType` (which could trigger an automatic balance payment) unless you set `CJ_PAY_TYPE` after confirming its meaning with CJ.
2. **Per-variant private inventory.** If CJ returns only product-level (SPU) totals and a product has several mapped variants, the sync **does not guess a split**. Those variants are flagged "unmatched" and you enter quantities manually in Admin → Inventory (source = MANUAL). Single-variant products use the SPU total.
3. **Webhook authenticity.** CJ's webhook signing scheme could not be confirmed, so the endpoint requires a secret `key` query parameter. It also never trusts payload contents: every webhook only triggers a re-fetch from the CJ API.
4. **Order-number de-duplication** on CJ's side is assumed, not verified. Duplicates are prevented locally with a unique `(order, supplier)` row, an atomic submission lock, and a refusal to resubmit once an external ID exists. If a request times out after CJ actually created the order, check the CJ dashboard before retrying. Admins can also record a CJ order ID manually.

## 3. Admin-assisted workflow (works today, no API needed)

1. A customer pays → order `CONFIRMED`, units move from *reserved* to *pending deduction*.
2. In CJ: place the order manually for the same variant(s), choosing the warehouse that holds your prepaid stock.
3. In Admin → Order: **Record an order placed manually in CJ** (paste the CJ order ID).
4. After CJ shows the order deducted from private inventory: **Confirm supplier accepted** (prepaid stock is deducted locally).
5. When CJ ships: add the tracking number in the order (or let the sync pick it up). The customer is emailed.
6. Inventory: keep Admin → Inventory in line with CJ's private inventory (manual counts or CJ sync).

## 4. Configuration

- Environment: `CJ_MODE=live`, `CJ_API_KEY`, `CJ_WEBHOOK_SECRET` (and optionally `CJ_API_BASE_URL`, `CJ_PAY_TYPE`).
- Admin → Settings → Fulfillment: mode `cj_api`, logistic name (exactly as CJ lists it), ship-from country, optional warehouse country for the inventory sync, optional storage ID. Keep auto-submit **off** until you have verified several orders manually.
- Admin → Products → each variant: CJ product ID (pid), CJ variant ID (vid), CJ SKU.
- Admin → Inventory: set the source to **CJ** for variants that the sync should update.
- CJ dashboard → webhook settings: `https://YOUR_DOMAIN/api/webhooks/cj?key=<CJ_WEBHOOK_SECRET>`.

## 5. Go-live verification (do not skip)

1. Set `CJ_MODE=live` in a **staging** deployment with your real API key.
2. Admin → Integrations → **Test connection**. It must report success.
3. **Sync inventory.** Check the integration log for the response field names. Confirm the quantities match the CJ dashboard per variant.
4. Place a **real low-value order** to your own address, with auto-submit off. Submit it from the admin, then verify in CJ that it appears, is deducted from private inventory, and has the expected logistics/warehouse. Check how CJ handles payment for shipping.
5. Confirm `getOrderDetail` status values and tracking fields by running **Sync orders & tracking** after CJ ships, and adjust the parsing in `client.ts` if field names differ.
6. Only then consider enabling auto-submit.
