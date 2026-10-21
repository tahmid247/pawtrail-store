import { countryName } from "./countries";

export function formatAddress(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "—";
  const a = addr as Record<string, string | null>;
  return [a.name, a.line1, a.line2, [a.postalCode, a.city].filter(Boolean).join(" "), a.state, a.country ? countryName(a.country) : null]
    .filter(Boolean)
    .join(", ");
}
