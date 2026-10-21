"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { rateLimitByIp } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/consent";

import type { FormState } from "@/lib/consent";

/** Double opt-in newsletter signup. Always answers the same way to avoid revealing who is subscribed. */
export async function subscribeNewsletter(_prev: FormState, formData: FormData): Promise<FormState> {
  if (String(formData.get("company") ?? "") !== "") return { ok: true, message: "Thanks! Check your inbox to confirm." }; // honeypot
  if (!(await rateLimitByIp("newsletter", 5, 600))) return { error: "Too many attempts. Please try again later." };
  const parsed = z.object({ email: z.email().max(254), consent: z.literal("on") }).safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    consent: formData.get("consent"),
  });
  if (!parsed.success) return { error: "Enter a valid email and tick the consent box." };

  const existing = await prisma.newsletterSubscription.findUnique({ where: { email: parsed.data.email } });
  if (existing?.status !== "CONFIRMED") {
    const token = randomToken();
    await prisma.newsletterSubscription.upsert({
      where: { email: parsed.data.email },
      create: { email: parsed.data.email, tokenHash: sha256(token), consentText: NEWSLETTER_CONSENT_TEXT, source: "footer" },
      update: { tokenHash: sha256(token), status: "PENDING", consentText: NEWSLETTER_CONSENT_TEXT, consentAt: new Date(), unsubscribedAt: null },
    });
    await sendEmail("newsletter_confirm", parsed.data.email, { url: `${env.siteUrl}/newsletter/confirm?token=${token}` });
  }
  return { ok: true, message: "Thanks! Please check your inbox to confirm your subscription." };
}

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  orderNumber: z.string().trim().max(40).optional(),
  type: z.enum(["GENERAL", "ORDER", "DAMAGED_OR_INCORRECT", "WITHDRAWAL", "DATA_REQUEST"]),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(10).max(5000),
});

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  if (String(formData.get("company") ?? "") !== "") return { ok: true, message: "Thanks — we'll be in touch." };
  if (!(await rateLimitByIp("contact", 5, 600))) return { error: "Too many messages. Please try again later." };
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Please complete all required fields (message at least 10 characters)." };
  const user = await getCurrentUser();
  await prisma.supportRequest.create({
    data: { ...parsed.data, email: parsed.data.email.toLowerCase(), orderNumber: parsed.data.orderNumber || null, userId: user?.id ?? null },
  });
  await sendEmail("support_received", parsed.data.email, { name: parsed.data.name, subject: parsed.data.subject }).catch(() => null);
  return { ok: true, message: "Thanks for your message — we'll reply by email as soon as possible." };
}

const reviewSchema = z.object({
  productId: z.string().min(1).max(64),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10).max(3000),
  authorName: z.string().trim().min(1).max(60),
});

/** Only customers who bought the product can review it, so every review is a verified purchase. */
export async function submitReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to write a review." };
  if (!(await rateLimitByIp("review", 5, 3600))) return { error: "Too many reviews submitted. Try again later." };
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Please add a rating and a review of at least 10 characters." };
  const order = await prisma.order.findFirst({
    where: { userId: user.id, paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] }, items: { some: { productId: parsed.data.productId } } },
    orderBy: { placedAt: "desc" },
  });
  if (!order) return { error: "Reviews can only be written for products you have purchased." };
  const existing = await prisma.review.findUnique({ where: { userId_productId: { userId: user.id, productId: parsed.data.productId } } });
  if (existing) return { error: "You have already reviewed this product." };
  await prisma.review.create({
    data: { ...parsed.data, title: parsed.data.title || null, userId: user.id, orderId: order.id, verifiedPurchase: true, status: "PENDING" },
  });
  return { ok: true, message: "Thank you! Your review will appear after moderation." };
}
