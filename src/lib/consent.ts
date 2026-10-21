export const CONSENT_COOKIE = "consent";
export const CONSENT_POLICY_VERSION = "2026-10";

export type ConsentState = { v: 1; analytics: boolean; marketing: boolean; ts: number; id: string; policy: string };

export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(decodeURIComponent(raw)) as ConsentState;
    if (c.v !== 1 || typeof c.analytics !== "boolean" || typeof c.marketing !== "boolean") return null;
    if (c.policy !== CONSENT_POLICY_VERSION) return null; // re-ask when the policy changes
    return c;
  } catch {
    return null;
  }
}

export const NEWSLETTER_CONSENT_TEXT =
  "I agree to receive occasional emails about new products and offers. I can unsubscribe at any time.";

export type FormState = { ok?: boolean; message?: string; error?: string } | null;
