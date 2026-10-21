"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { EU_COUNTRY_CODES } from "@/lib/countries";
import type { FormState } from "@/lib/consent";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(40).regex(/^[+0-9 ()-]*$/, "Invalid phone").optional(),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({ name: formData.get("name"), phone: formData.get("phone") || undefined });
  if (!parsed.success) return { error: "Please check your details." };
  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  await prisma.customerProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, phone: parsed.data.phone ?? null },
    update: { phone: parsed.data.phone ?? null },
  });
  revalidatePath("/account");
  return { ok: true, message: "Profile updated." };
}

export async function updateMarketing(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const optIn = formData.get("marketing") === "on";
  await prisma.customerProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, marketingConsent: optIn, marketingConsentAt: new Date() },
    update: { marketingConsent: optIn, marketingConsentAt: new Date() },
  });
  if (optIn) {
    // The account email is already verified, which satisfies double opt-in.
    const { randomToken, sha256 } = await import("@/lib/crypto");
    const { NEWSLETTER_CONSENT_TEXT } = await import("@/lib/consent");
    await prisma.newsletterSubscription.upsert({
      where: { email: user.email },
      create: { email: user.email, status: "CONFIRMED", confirmedAt: new Date(), tokenHash: sha256(randomToken()), consentText: NEWSLETTER_CONSENT_TEXT, source: "account" },
      update: { status: "CONFIRMED", confirmedAt: new Date(), unsubscribedAt: null, consentText: NEWSLETTER_CONSENT_TEXT },
    });
  } else {
    await prisma.newsletterSubscription.updateMany({ where: { email: user.email }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
  }
  await prisma.consentRecord.create({ data: { subjectId: user.id, userId: user.id, kind: "marketing_email", value: { granted: optIn }, policyVersion: "account-v1" } });
  revalidatePath("/account/privacy");
  return { ok: true, message: optIn ? "You're subscribed to marketing emails." : "You won't receive marketing emails." };
}

const addressSchema = z.object({
  id: z.string().max(64).optional(),
  fullName: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  province: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().min(2).max(20),
  country: z.string().refine((c) => EU_COUNTRY_CODES.includes(c) || ["SM", "VA"].includes(c)),
  phone: z.string().trim().max(40).optional(),
  isDefault: z.literal("on").optional(),
});

export async function saveAddress(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ""));
  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) return { error: "Please complete all required address fields." };
  const { id, isDefault, ...data } = parsed.data;
  const count = await prisma.address.count({ where: { userId: user.id } });
  if (!id && count >= 10) return { error: "You can save up to 10 addresses." };
  await prisma.$transaction(async (tx) => {
    const makeDefault = isDefault === "on" || count === 0;
    if (makeDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    if (id) {
      // Ownership enforced in the WHERE clause: users can only edit their own addresses.
      const res = await tx.address.updateMany({ where: { id, userId: user.id }, data: { ...data, isDefault: makeDefault } });
      if (res.count === 0) throw new Error("Address not found");
    } else {
      await tx.address.create({ data: { ...data, userId: user.id, isDefault: makeDefault } });
    }
  });
  revalidatePath("/account/addresses");
  return { ok: true, message: "Address saved." };
}

export async function deleteAddress(id: string) {
  const user = await requireUser();
  await prisma.address.deleteMany({ where: { id: String(id), userId: user.id } });
  revalidatePath("/account/addresses");
}

export async function requestAccountDeletion(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (formData.get("confirm") !== "DELETE") return { error: 'Type DELETE to confirm.' };
  const existing = await prisma.accountDeletionRequest.findFirst({ where: { userId: user.id, status: "PENDING" } });
  if (existing) return { ok: true, message: "Your deletion request is already being processed." };
  await prisma.accountDeletionRequest.create({
    data: { userId: user.id, email: user.email, reason: String(formData.get("reason") ?? "").slice(0, 1000) || null },
  });
  await audit(user.id, "customer.deletion_requested", "User", user.id);
  return { ok: true, message: "Request received. We will delete your account within 30 days and confirm by email. Order records we are legally required to keep will be retained but unlinked from you." };
}
