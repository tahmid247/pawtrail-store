# PRIVATE — Prepaid inventory operations manual (CJdropshipping)

> Internal document for the business owner and staff. Not for publication.

## The model

- **We buy stock in advance** from CJdropshipping ("private inventory"). CJ stores it in its warehouse under its storage terms ([confirm storage fees, free-storage period, and loss/damage liability in your CJ agreement]).
- When a customer pays on our site, the order is fulfilled **from that prepaid stock**. CJ picks, packs and ships it.
- **We are the seller.** CJ is our logistics provider. Customers' contractual and statutory rights (withdrawal, legal guarantee, refunds) are exercised against us, and we recover costs from CJ under our own agreement where appropriate.
- Prepaid inventory is **not** a customer pre-order. Products are only offered as available when we actually hold stock. Never label in-stock products as "pre-order".

## Numbers the store tracks (Admin → Inventory)

| Field | Meaning | Who changes it |
|---|---|---|
| Prepaid | Units CJ holds for us | CJ sync, or manual count |
| Reserved | Units held by checkouts awaiting payment (released after ~35 min if unpaid) | Automatic |
| Pending deduction | Paid units not yet confirmed as taken from our CJ stock | Automatic; cleared on supplier confirmation |
| Safety buffer | Units deliberately not sold, to absorb sync delays or count errors | Admin |
| Available | Prepaid − Reserved − Pending − Buffer, which is what customers can buy | Calculated |

**Recommended:** keep a safety buffer of at least 1–2 units per variant while the CJ sync is unverified.

## Daily routine

1. Check Admin → Overview → *Needs attention*: failed submissions, orders requiring attention, low stock, support, deletion requests.
2. Orders **To fulfil**: submit to CJ (API), or place manually in CJ and record the CJ order ID.
3. In the CJ dashboard, check that each submitted order was **deducted from private inventory** (not bought as new stock) and pay any shipping charges. Then click **Confirm supplier accepted**.
4. Run or check **Sync orders & tracking**. Shipped orders email customers automatically.
5. Reply to support requests. Withdrawal requests: acknowledge within 1–2 days; refunds are due **within 14 days** of the withdrawal notice (they can be held until the goods are back or proof of return is provided).

## Restocking

- Low-stock alerts are emailed to `ADMIN_ALERT_EMAIL` (at most once per day per variant).
- Allow for CJ procurement and inbound lead time ([X] days) when choosing thresholds.
- After CJ confirms the new stock: run **Sync inventory**, or enter the new count manually.

## Exceptions

| Situation | What to do |
|---|---|
| Paid order flagged *Requires attention* (stock ran out / amount mismatch) | Restock and **Mark resolved**, or **Cancel order** (automatic full refund) and apologise to the customer |
| CJ rejects or fails an order | Read the error in the order's integration log, fix the mapping/settings/address, then **Retry submission** |
| CJ cancels an order on their side | Use **Supplier order was cancelled in CJ**, then resubmit or cancel/refund |
| Parcel lost or damaged | We refund or replace the customer first (seller responsibility), then claim from CJ under our agreement |
| Return (withdrawal) | Agree the return address ([own address or CJ returns service]), refund within 14 days, then add returned units back to inventory if resellable |

## Records to keep

- CJ purchase invoices for prepaid stock (cost of goods, customs/VAT documentation for EU import).
- Monthly reconciliation: CJ private-inventory report vs Admin → Inventory → movements.
- Order and invoice records: 10 years (Italian requirements). The app keeps paid orders even when customer accounts are deleted.
