"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { rateLimitByIp } from "@/lib/rate-limit";
import type { FormState } from "@/lib/consent";

export async function confirmNewsletter(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const sub = token ? await prisma.newsletterSubscription.findUnique({ where: { tokenHash: sha256(token) } }) : null;
  if (!sub) return { error: "This link is invalid." };
  await prisma.newsletterSubscription.update({ where: { id: sub.id }, data: { status: "CONFIRMED", confirmedAt: new Date(), unsubscribedAt: null } });
  await prisma.consentRecord.create({ data: { subjectId: sub.email, kind: "marketing_email", value: { granted: true, text: sub.consentText }, policyVersion: "newsletter-v1" } });
  return { ok: true, message: "Subscription confirmed — welcome to the pack!" };
}

/** Unsubscribe by token (from email footer) or by email address; always responds generically. */
export async function unsubscribeNewsletter(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await rateLimitByIp("unsubscribe", 10, 600))) return { error: "Too many attempts." };
  const token = String(formData.get("token") ?? "");
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  const where = token ? { tokenHash: sha256(token) } : email.success ? { email: email.data } : null;
  if (where) {
    const sub = await prisma.newsletterSubscription.findUnique({ where });
    if (sub) {
      await prisma.newsletterSubscription.update({ where: { id: sub.id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
      await prisma.customerProfile.updateMany({ where: { user: { email: sub.email } }, data: { marketingConsent: false } });
      await prisma.consentRecord.create({ data: { subjectId: sub.email, kind: "marketing_email", value: { granted: false }, policyVersion: "newsletter-v1" } });
    }
  }
  return { ok: true, message: "You have been unsubscribed from marketing emails." };
}
