/**
 * Creates (or promotes) an administrator account.
 *   npm run create-admin -- admin@example.com "a-long-unique-password" "Admin Name"
 * The admin must enable two-factor authentication at first sign-in before the dashboard unlocks.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

async function main() {
  const [email, password, name = "Store Admin", role = "ADMIN"] = process.argv.slice(2);
  if (!email || !password) throw new Error('Usage: npm run create-admin -- <email> <password> ["Name"] [ADMIN|SUPPORT]');
  if (password.length < 12) throw new Error("Use a password of at least 12 characters.");
  if (role !== "ADMIN" && role !== "SUPPORT") throw new Error("Role must be ADMIN or SUPPORT");

  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { role, emailVerified: true } });
    console.log(`Promoted existing user ${normalized} to ${role}.`);
    return;
  }
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: normalized,
      name,
      emailVerified: true,
      role,
      accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(password) } },
    },
  });
  await prisma.auditLog.create({ data: { action: "admin.created_via_cli", entityType: "User", entityId: id, metadata: { role } } });
  console.log(`Created ${role} ${normalized}. Sign in at /account/login and set up two-factor authentication.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
