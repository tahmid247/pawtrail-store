/**
 * DRAFT legal documents. They are templates, not legal advice, and must be completed and reviewed by a
 * qualified professional (e.g. an Italian lawyer / commercialista) before launch. Placeholders are in [BRACKETS].
 * Format: a small, safe Markdown subset (#/## headings, paragraphs, "- " lists, **bold**, [links](/path)).
 */
export const LEGAL_DRAFT_NOTICE =
  "DRAFT — This document is a template and has not been reviewed by a lawyer. Complete every [PLACEHOLDER] and have it reviewed before launch.";

export const legalDefaults: { slug: string; title: string; content: string }[] = [
  {
    slug: "terms",
    title: "Terms and Conditions of Sale",
    content: `> ${LEGAL_DRAFT_NOTICE}

Last updated: [DATE]

These Terms and Conditions ("Terms") govern purchases made by consumers on [WEBSITE URL] (the "Store"). Please read them before placing an order. By placing an order you confirm that you have read and accepted these Terms, our [Privacy Policy](/legal/privacy) and our [Returns & Refunds Policy](/legal/returns).

## 1. Who we are (the seller)

The seller and the party responsible for your purchase contract is:

- **[LEGAL BUSINESS NAME]**, [LEGAL FORM]
- Registered office: [REGISTERED ADDRESS]
- VAT number (Partita IVA): [PARTITA IVA]
- Company register / REA: [REA / COMPANY REGISTRATION NUMBER]
- Certified email (PEC): [PEC ADDRESS]
- Customer service: [SUPPORT EMAIL], [PHONE NUMBER — optional]

We use third-party service providers to run the Store, including a logistics and fulfillment provider, **CJdropshipping**, which stores our inventory in its warehouse and ships orders on our behalf. CJdropshipping is our service provider: it is not the seller and is not a party to your contract with us. Your rights under these Terms and under consumer law are exercised against us.

## 2. Products and availability

Product descriptions, photographs and specifications are provided as accurately as possible. Colours may vary slightly depending on your screen. Products are offered while stock lasts. We buy our stock in advance and hold it in our logistics partner's warehouse; quantities shown in the Store are updated regularly but may change between the time you view a product and the time you complete payment. Products listed as available are in stock and are **not** pre-order items unless a product page expressly states otherwise.

## 3. Prices

All prices are in euro (€) and include Italian VAT ([VAT RATE]%) where applicable. Shipping costs are shown separately before you pay. The total price, including all taxes and delivery charges, is displayed on the checkout summary before you confirm your order. We do not charge any fees that are not shown before payment.

## 4. How the contract is formed

1. You add products to your cart, choose your shipping country and review the order summary, including the total price.
2. You confirm that you accept these Terms and click the button to proceed to payment ("Order with obligation to pay").
3. Your order constitutes an offer to purchase. The contract is concluded when we send you an order confirmation email after your payment has been successfully authorised.
4. If, exceptionally, an item cannot be supplied after payment (for example because of a stock discrepancy at the warehouse), we will inform you without delay and refund all amounts paid, including standard delivery costs, within 14 days at the latest, using the same payment method.

The contract is concluded in [English/Italian]. We store a record of your order; you can view it in your account or via the link in your confirmation email.

## 5. Payment

Payments are processed securely by our payment service provider, **Stripe Payments Europe Ltd.** We never receive or store your full card details. Your payment is charged when you place your order. Accepted payment methods are shown at checkout.

## 6. Shipping and delivery

Orders are prepared and shipped from our logistics partner's warehouse ([WAREHOUSE COUNTRY]). Shipping costs and estimated delivery times for your country are shown before payment and in our [Shipping Policy](/legal/shipping). Delivery estimates are indicative; we will deliver within 30 days of the contract at the latest unless agreed otherwise. If delivery is delayed beyond the agreed period you may set an additional period and, failing delivery, terminate the contract and receive a full refund, in accordance with Art. 61 of the Italian Consumer Code (Legislative Decree 206/2005).

Risk of loss or damage passes to you when you, or a third party you designate (other than the carrier), take physical possession of the goods.

## 7. Right of withdrawal (14 days)

If you are a consumer, you have the right to withdraw from this contract within **[WITHDRAWAL DAYS] days** without giving any reason. The withdrawal period expires [WITHDRAWAL DAYS] days after the day on which you, or a third party other than the carrier indicated by you, acquire physical possession of the goods. Full details, the model withdrawal form, the exceptions and how refunds work are set out in our [Returns & Refunds Policy](/legal/returns).

## 8. Legal guarantee of conformity

All products are covered by the legal guarantee of conformity under Articles 128 et seq. of the Italian Consumer Code. We are liable for any lack of conformity that becomes apparent within **two years** of delivery. In case of non-conformity you are entitled to have the goods brought into conformity by repair or replacement free of charge or, where applicable, to a price reduction or termination of the contract. To report a problem, see section 9. This legal guarantee is in addition to, and not limited by, any commercial guarantee.

## 9. Damaged, defective or incorrect items

If your order arrives damaged, defective, incomplete or different from what you ordered, please contact us at [SUPPORT EMAIL] or via our [contact form](/contact), ideally within 14 days of delivery, stating your order number and, where possible, including photos of the item and packaging. Reporting promptly helps us resolve the issue quickly, but this does not shorten your legal rights. We will offer a replacement, repair, or refund in accordance with the law, and we bear the cost of returning non-conforming goods.

## 10. Personal data

We process your personal data as described in our [Privacy Policy](/legal/privacy). To fulfil your order, we share only the data necessary (name, delivery address, phone number, email and order contents) with our logistics provider (CJdropshipping) and carriers, and payment data with our payment provider (Stripe).

## 11. Liability

Nothing in these Terms excludes or limits our liability where this would be unlawful, including liability for lack of conformity, for death or personal injury caused by negligence, for fraud, or under mandatory product liability rules. Nothing in these Terms affects your mandatory rights as a consumer. Our use of third-party logistics providers does not reduce our responsibility to you as the seller.

## 12. Complaints and dispute resolution

Please contact us first at [SUPPORT EMAIL] — we aim to reply within [NUMBER] business days. You may also use alternative dispute resolution (ADR) procedures available under Italian law (Art. 141 et seq. of the Consumer Code). [Note: the EU Online Dispute Resolution platform was discontinued in July 2025 — confirm current requirements with your advisor.]

## 13. Governing law and jurisdiction

These Terms are governed by Italian law. If you are a consumer habitually resident in another EU country, you keep the protection of the mandatory provisions of the law of your country of residence. For consumers, the competent court is that of the consumer's place of residence or domicile in Italy, as provided by the Consumer Code.

## 14. Changes

We may update these Terms from time to time. The version in force at the time of your order applies to that order.
`,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    content: `> ${LEGAL_DRAFT_NOTICE}

Last updated: [DATE]

This Privacy Policy explains how [LEGAL BUSINESS NAME] ("we", "us") processes personal data when you visit [WEBSITE URL] and buy from us, in accordance with Regulation (EU) 2016/679 ("GDPR") and the Italian Privacy Code (Legislative Decree 196/2003 as amended).

## 1. Data controller

[LEGAL BUSINESS NAME], [REGISTERED ADDRESS], VAT [PARTITA IVA]. Contact: [PRIVACY EMAIL]. [If appointed: Data Protection Officer — DPO CONTACT.]

## 2. What data we process and why

- **Orders and delivery** — name, email, phone, delivery and billing address, order contents, order history. Legal basis: performance of a contract (Art. 6(1)(b) GDPR).
- **Payments** — processed by Stripe; we receive payment status and limited details (e.g. card brand, last four digits), never full card numbers. Legal basis: contract; fraud prevention (legitimate interest, Art. 6(1)(f)).
- **Customer account** — name, email, password (stored only as a secure hash), saved addresses, preferences. Legal basis: contract.
- **Customer support** — messages you send us and related order data. Legal basis: contract / legitimate interest.
- **Marketing emails** — email address and consent record, only if you opt in (double opt-in). Legal basis: consent (Art. 6(1)(a)); you can withdraw consent at any time via the unsubscribe link or your account.
- **Reviews** — the name you choose to display, rating and text; verified-purchase status. Legal basis: consent / legitimate interest.
- **Security and logs** — IP address and technical data needed to protect the Store (e.g. rate limiting, fraud prevention). Legal basis: legitimate interest.
- **Analytics** — only with your consent, see our [Cookie Policy](/legal/cookies).
- **Accounting and tax** — invoices and order records. Legal basis: legal obligation (Art. 6(1)(c)).

## 3. Who we share data with

We share data only when necessary, with providers acting as processors under data processing agreements, or as independent controllers where applicable:

- **Stripe Payments Europe Ltd.** — payment processing.
- **CJdropshipping** ([CJ LEGAL ENTITY, COUNTRY]) — warehousing and fulfillment: name, delivery address, phone, email and order contents, so your parcel can be shipped.
- **Shipping carriers** — delivery details.
- **Hosting and database providers** — [e.g. Vercel Inc., Supabase Inc. / your provider].
- **Email delivery** — [e.g. Resend] for transactional emails.
- Professional advisors and public authorities where required by law.

## 4. International transfers

Some providers (e.g. the fulfillment provider, hosting or email services) may process data outside the European Economic Area, including in [CHINA / USA / OTHER]. Where this happens we rely on an adequacy decision (e.g. the EU-US Data Privacy Framework) or Standard Contractual Clauses with supplementary measures as required. [Complete after reviewing each provider's DPA and transfer mechanism.]

## 5. How long we keep data

- Order and invoice records: 10 years (Italian tax and civil law requirements, Art. 2220 Civil Code).
- Customer account: until you delete it; order records are then retained only as required by law.
- Support requests: [24 months] after closure.
- Marketing consent records: for as long as you are subscribed and for [2 years] after withdrawal, as proof of consent.
- Abandoned carts: deleted after [60 days].
- Security logs: [12 months].

## 6. Your rights

You have the right to access, rectify and erase your data, to restrict or object to processing, to data portability and to withdraw consent at any time without affecting prior processing. You can exercise most rights from your account (download data, request deletion, manage marketing preferences) or by writing to [PRIVACY EMAIL]. You also have the right to lodge a complaint with the Italian Data Protection Authority (Garante per la protezione dei dati personali, www.garanteprivacy.it) or the authority of your country of residence.

## 7. Security

We use encrypted connections (HTTPS/TLS), hashed passwords, access controls with two-factor authentication for administrators, and we never store payment card data.

## 8. Changes

We will publish any changes on this page and, where significant, notify you.
`,
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    content: `> ${LEGAL_DRAFT_NOTICE}

Last updated: [DATE]

We use cookies and similar technologies on [WEBSITE URL]. Strictly necessary cookies are always active. All other cookies are only set after you give consent through our cookie banner. You can change your choice at any time using the **Cookie settings** link in the footer.

## Strictly necessary

- **cart_token** — remembers your shopping cart (60 days).
- **better-auth.session_token** and related auth cookies — keep you signed in securely (up to 14 days).
- **consent** — stores your cookie preferences (12 months).
- **Stripe** — the payment page operated by Stripe sets cookies necessary for secure payment and fraud prevention.

## Analytics (only with consent)

- [If enabled] **Plausible Analytics** — privacy-friendly, cookieless statistics on visits. [Provider details.]
- First-party anonymous page-view counting (no cookies; aggregated).

## Marketing (only with consent)

We do not currently use marketing or advertising cookies. If this changes, we will update this policy and ask for your consent.

## Managing cookies

You can also delete or block cookies in your browser settings. Blocking strictly necessary cookies may prevent the cart and checkout from working.
`,
  },
  {
    slug: "shipping",
    title: "Shipping Policy",
    content: `> ${LEGAL_DRAFT_NOTICE}

Last updated: [DATE]

## Where we ship

We currently ship to the countries available at checkout. [LIST OF COUNTRIES]

## Dispatch and delivery times

Orders are fulfilled by our logistics partner from its warehouse in [WAREHOUSE COUNTRY]. Orders are normally handed to the carrier within [X] business days after payment. Estimated delivery times per country are displayed at checkout before you pay:

- Italy: [X–Y] business days — [PRICE]
- Other EU countries: [X–Y] business days — [PRICE]

These are estimates and do not include weekends or public holidays. Unless otherwise agreed, we deliver within 30 days of your order at the latest.

## Shipping costs

Shipping costs are calculated at checkout based on your country and shown before payment. [Free shipping applies only if and when explicitly advertised, with its conditions.]

## Customs and duties

For deliveries within the EU, no customs duties apply. [If shipping from outside the EU, explain how import VAT/duties are handled — e.g. IOSS — so customers never pay unexpected charges.]

## Tracking

When your order ships you will receive an email with your tracking number. You can also follow your order in your account or via the order link in your confirmation email.

## Lost or damaged parcels

If your parcel is lost or arrives damaged, contact us at [SUPPORT EMAIL]. As the seller, we bear the risk until the goods are delivered to you.
`,
  },
  {
    slug: "returns",
    title: "Returns, Withdrawal & Refunds",
    content: `> ${LEGAL_DRAFT_NOTICE}

Last updated: [DATE]

## Right of withdrawal

If you are a consumer, you have the right to withdraw from this contract within **[WITHDRAWAL DAYS] days** without giving any reason. The withdrawal period expires [WITHDRAWAL DAYS] days after the day on which you, or a third party other than the carrier and indicated by you, acquire physical possession of the goods (for multiple items delivered separately: of the last item).

To exercise the right of withdrawal, inform us — [LEGAL BUSINESS NAME], [REGISTERED ADDRESS], [SUPPORT EMAIL] — of your decision by a clear statement (e.g. an email or our [contact form](/contact) selecting "Withdrawal / return"). You may use the model withdrawal form below, but it is not obligatory. To meet the deadline, it is sufficient to send your communication before the withdrawal period has expired.

## Effects of withdrawal

If you withdraw, we will reimburse all payments received from you, including standard delivery costs (not the extra cost of any more expensive delivery method you chose), without undue delay and in any event within 14 days from the day we are informed of your decision. We use the same means of payment you used, unless expressly agreed otherwise; you will not incur any fees for the reimbursement. We may withhold reimbursement until we have received the goods back or you have supplied evidence of having sent them back, whichever is earliest.

## Returning the goods

Please send the goods back without undue delay and in any event no later than 14 days from the day you communicated your withdrawal, to: [RETURN ADDRESS]. [You bear the direct cost of returning the goods / We bear the cost of return — CHOOSE ONE.] You are only liable for any diminished value of the goods resulting from handling other than what is necessary to establish their nature, characteristics and functioning.

## Exceptions

The right of withdrawal does not apply to sealed goods that are not suitable for return due to health protection or hygiene reasons if they were unsealed after delivery (Art. 59 Consumer Code). [Review whether this applies to any product — e.g. items in contact with pet food/water once used — with your legal advisor before relying on it.]

## Faulty, damaged or incorrect items

Separately from the right of withdrawal, you are protected by the 2-year legal guarantee of conformity. If an item is faulty, damaged in transit or not as described, contact us with your order number and photos. We will repair, replace or refund at no cost to you, including return shipping.

## Model withdrawal form

To: [LEGAL BUSINESS NAME], [REGISTERED ADDRESS], [SUPPORT EMAIL]

- I/We hereby give notice that I/We withdraw from my/our contract of sale of the following goods: [ ]
- Ordered on [ ] / received on [ ]
- Order number: [ ]
- Name of consumer(s): [ ]
- Address of consumer(s): [ ]
- Date: [ ]
`,
  },
  {
    slug: "legal-notice",
    title: "Legal Notice",
    content: `> ${LEGAL_DRAFT_NOTICE}

## Business information

- Business name: [LEGAL BUSINESS NAME]
- Registered office: [REGISTERED ADDRESS]
- VAT number (Partita IVA): [PARTITA IVA]
- Company register / REA: [REA / COMPANY REGISTRATION NUMBER]
- Share capital: [SHARE CAPITAL, if applicable]
- PEC: [PEC ADDRESS]
- Email: [SUPPORT EMAIL]

## Logistics

Orders are stored and shipped on our behalf by CJdropshipping, a third-party fulfillment provider. The seller of all products on this website is [LEGAL BUSINESS NAME].
`,
  },
];
