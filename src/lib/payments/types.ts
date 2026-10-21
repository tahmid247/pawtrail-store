export type CheckoutLine = { name: string; description?: string; unitAmountCents: number; quantity: number; imageUrl?: string | null };

export type CheckoutRequest = {
  orderId: string;
  orderNumber: string;
  email: string;
  currency: string;
  country: string;
  lines: CheckoutLine[];
  shipping: { name: string; amountCents: number; minDays: number | null; maxDays: number | null };
  discountCents: number;
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
};

export type CheckoutSessionResult = { sessionId: string; url: string };

export interface PaymentProvider {
  readonly name: "stripe" | "simulated";
  createCheckout(req: CheckoutRequest): Promise<CheckoutSessionResult>;
  refund(paymentRef: string, amountCents: number, localRefundId: string): Promise<{ refundId: string; status: "PENDING" | "SUCCEEDED" | "FAILED" }>;
}
