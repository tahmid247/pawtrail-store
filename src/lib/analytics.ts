import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { CONSENT_COOKIE, parseConsent } from "./consent";
import { getSettings } from "./settings";

/** Records an aggregate first-party event ONLY when the visitor consented to analytics. No IP or user id is stored. */
export async function recordEvent(type: "page_view" | "add_to_cart" | "checkout_started" | "purchase", path?: string) {
  try {
    const settings = await getSettings();
    if (!settings.analytics.firstPartyEnabled) return;
    const consent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
    if (!consent?.analytics) return;
    await prisma.analyticsEvent.create({ data: { type, path: path?.slice(0, 200) ?? null, sessionId: consent.id } });
  } catch {
    /* analytics must never break the shop */
  }
}
