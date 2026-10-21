import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "./db";

export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Prisma.InputJsonValue,
  tx: Tx | typeof prisma = prisma,
) {
  await tx.auditLog.create({ data: { actorId, action, entityType, entityId, metadata } });
}

export async function logIntegration(
  provider: string,
  level: "info" | "warn" | "error",
  action: string,
  message: string,
  opts: { orderId?: string; details?: Prisma.InputJsonValue } = {},
) {
  await prisma.integrationLog.create({
    data: { provider, level, action, message: message.slice(0, 2000), orderId: opts.orderId, details: opts.details },
  });
}
