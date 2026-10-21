import "server-only";
import { randomToken } from "../crypto";
import { env } from "../env";
import type { PaymentProvider } from "./types";

/**
 * DEVELOPMENT/TEST ONLY payment provider used until Stripe keys are configured.
 * It never moves money and refuses to run in production builds.
 */
export const simulatedProvider: PaymentProvider = {
  name: "simulated",
  async createCheckout(req) {
    if (env.isProduction) throw new Error("Simulated payments are disabled in production");
    const sessionId = `sim_${randomToken(12)}`;
    const url = `${env.siteUrl}/checkout/simulate?session=${sessionId}&order=${encodeURIComponent(req.orderNumber)}&next=${encodeURIComponent(req.successUrl)}`;
    return { sessionId, url };
  },
  async refund(_ref, _amount, localRefundId) {
    if (env.isProduction) throw new Error("Simulated payments are disabled in production");
    return { refundId: `sim_re_${localRefundId}`, status: "SUCCEEDED" };
  },
};
