export const DEFAULT_CURRENCY = "EUR";

export function formatMoney(cents: number, currency = DEFAULT_CURRENCY, locale = "en-IE"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** VAT contained in a VAT-inclusive amount, rounded to the cent. */
export function includedVat(grossCents: number, ratePercent: number): number {
  if (ratePercent <= 0) return 0;
  return Math.round(grossCents - grossCents / (1 + ratePercent / 100));
}
