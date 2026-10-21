import "server-only";
import { prisma } from "./db";
import { audit } from "./audit";

/** Everything we hold about a customer, for GDPR access/portability requests. */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, emailVerified: true, createdAt: true,
      profile: { select: { phone: true, marketingConsent: true, marketingConsentAt: true } },
      addresses: { select: { fullName: true, line1: true, line2: true, city: true, province: true, postalCode: true, country: true, phone: true, isDefault: true } },
      orders: { select: { number: true, placedAt: true, email: true, totalCents: true, currency: true, paymentStatus: true, fulfillmentStatus: true, shippingAddress: true, items: { select: { productTitle: true, variantTitle: true, quantity: true, unitPriceCents: true } } } },
      reviews: { select: { rating: true, title: true, body: true, createdAt: true } },
      supportRequests: { select: { subject: true, message: true, createdAt: true, status: true } },
    },
  });
  const newsletter = await prisma.newsletterSubscription.findUnique({ where: { email: user.email }, select: { status: true, consentAt: true, confirmedAt: true, consentText: true } });
  const consents = await prisma.consentRecord.findMany({ where: { OR: [{ userId }, { subjectId: user.email }] }, select: { kind: true, value: true, policyVersion: true, createdAt: true } });
  return { exportedAt: new Date().toISOString(), user, newsletter, consents };
}

/**
 * Erases a customer account. Order records required for tax/accounting are retained but unlinked
 * from the account (legal obligation, Art. 17(3)(b) GDPR); everything else is deleted or anonymised.
 */
export async function eraseUser(userId: string, actorId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role !== "CUSTOMER") throw new Error("Staff accounts must be demoted before deletion.");
  await prisma.$transaction(async (tx) => {
    await tx.review.updateMany({ where: { userId }, data: { authorName: "Former customer", userId: null } });
    await tx.supportRequest.updateMany({ where: { userId }, data: { userId: null } });
    await tx.order.updateMany({ where: { userId }, data: { userId: null } });
    await tx.cart.deleteMany({ where: { userId } });
    await tx.newsletterSubscription.deleteMany({ where: { email: user.email } });
    await tx.consentRecord.updateMany({ where: { userId }, data: { userId: null } });
    await tx.accountDeletionRequest.updateMany({ where: { userId, status: "PENDING" }, data: { status: "COMPLETED", processedAt: new Date(), processedById: actorId } });
    await tx.user.delete({ where: { id: userId } }); // cascades sessions, accounts, 2FA, profile, addresses
    await audit(actorId, "customer.erased", "User", userId, {}, tx);
  });
}
