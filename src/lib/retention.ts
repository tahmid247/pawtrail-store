import "server-only";
import { prisma } from "./db";

const days = (n: number) => new Date(Date.now() - n * 86_400_000);

/**
 * Data-retention job (GDPR storage limitation). Paid order records are kept (tax/accounting obligations)
 * and are only unlinked from accounts on deletion. Adjust periods to match your Privacy Policy.
 */
export async function runRetention() {
  const [carts, unpaidOrders, analytics, emails, logs, rate, sessions, verifications, webhooks] = await prisma.$transaction([
    prisma.cart.deleteMany({ where: { updatedAt: { lt: days(60) } } }),
    prisma.order.deleteMany({ where: { paymentStatus: { in: ["UNPAID", "EXPIRED", "FAILED"] }, placedAt: { lt: days(90) } } }),
    prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: days(395) } } }),
    prisma.emailLog.deleteMany({ where: { createdAt: { lt: days(365) } } }),
    prisma.integrationLog.deleteMany({ where: { createdAt: { lt: days(365) } } }),
    prisma.rateLimit.deleteMany({ where: { lastRequest: { lt: BigInt(Date.now() - 86_400_000) } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.verification.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.webhookEvent.deleteMany({ where: { receivedAt: { lt: days(90) } } }),
  ]);
  return { carts: carts.count, unpaidOrders: unpaidOrders.count, analytics: analytics.count, emails: emails.count, logs: logs.count, rate: rate.count, sessions: sessions.count, verifications: verifications.count, webhooks: webhooks.count };
}
