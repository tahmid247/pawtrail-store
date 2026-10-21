"use server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import { CONSENT_COOKIE, CONSENT_POLICY_VERSION, parseConsent, type ConsentState } from "@/lib/consent";
import { getCurrentUser } from "@/lib/session";
import { rateLimitByIp } from "@/lib/rate-limit";

export async function saveConsent(choice: { analytics: boolean; marketing: boolean }) {
  if (!(await rateLimitByIp("consent", 30, 60))) return { ok: false };
  const jar = await cookies();
  const previous = parseConsent(jar.get(CONSENT_COOKIE)?.value);
  const state: ConsentState = {
    v: 1,
    analytics: Boolean(choice.analytics),
    marketing: Boolean(choice.marketing),
    ts: Date.now(),
    id: previous?.id ?? randomToken(12),
    policy: CONSENT_POLICY_VERSION,
  };
  jar.set(CONSENT_COOKIE, encodeURIComponent(JSON.stringify(state)), {
    httpOnly: false, // read by the client to gate optional scripts; contains no personal data
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  const user = await getCurrentUser();
  await prisma.consentRecord.create({
    data: {
      subjectId: state.id,
      userId: user?.id ?? null,
      kind: "cookies",
      value: { necessary: true, analytics: state.analytics, marketing: state.marketing },
      policyVersion: CONSENT_POLICY_VERSION,
    },
  });
  return { ok: true, state };
}
