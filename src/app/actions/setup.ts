"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";
import { rateLimitByIp } from "@/lib/rate-limit";
import type { FormState } from "@/lib/consent";

/**
 * One-time first-run setup: creates the first administrator. Permanently disabled as soon as
 * any ADMIN exists (checked under a transaction-scoped advisory lock, so two people can't race it).
 */
export async function createFirstAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await rateLimitByIp("setup", 5, 600))) return { error: "Too many attempts. Try again later." };
  const parsed = z
    .object({ name: z.string().trim().min(1).max(100), email: z.email().max(254), password: z.string().min(12).max(128), confirm: z.string() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your name, a valid email and a password of at least 12 characters." };
  if (parsed.data.password !== parsed.data.confirm) return { error: "Passwords do not match." };
  const email = parsed.data.email.toLowerCase();
  const passwordHash = await hashPassword(parsed.data.password);

  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
    if ((await tx.user.count({ where: { role: "ADMIN" } })) > 0) return false;
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) {
      await tx.user.update({ where: { id: existing.id }, data: { role: "ADMIN", emailVerified: true } });
      await tx.auditLog.create({ data: { actorId: existing.id, action: "admin.created_via_setup", entityType: "User", entityId: existing.id } });
      return true;
    }
    const id = randomUUID();
    await tx.user.create({
      data: {
        id, email, name: parsed.data.name, emailVerified: true, role: "ADMIN",
        accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: passwordHash } },
      },
    });
    await tx.auditLog.create({ data: { actorId: id, action: "admin.created_via_setup", entityType: "User", entityId: id } });
    return true;
  });
  if (!created) return { error: "Setup has already been completed." };
  return { ok: true, message: "Admin account created. Sign in to continue — you'll be asked to set up two-factor authentication." };
}
