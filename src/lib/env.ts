import "server-only";
import { resolveSiteUrl } from "./runtime-config";

/** Server-only configuration. Secrets are read from environment variables and never sent to the client. */
export const env = {
  get siteUrl() {
    return resolveSiteUrl();
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get stripeSecretKey() {
    return process.env.STRIPE_SECRET_KEY || null;
  },
  get stripeWebhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET || null;
  },
  get resendApiKey() {
    return process.env.RESEND_API_KEY || null;
  },
  get emailFrom() {
    return process.env.EMAIL_FROM || "Store <no-reply@example.com>";
  },
  get adminAlertEmail() {
    return process.env.ADMIN_ALERT_EMAIL || null;
  },
  get cronSecret() {
    return process.env.CRON_SECRET || null;
  },
  /** "mock" (default, never contacts CJ), "live" (real API calls) */
  get cjMode(): "mock" | "live" {
    return process.env.CJ_MODE === "live" ? "live" : "mock";
  },
  get cjApiKey() {
    return process.env.CJ_API_KEY || null;
  },
  get cjBaseUrl() {
    return (process.env.CJ_API_BASE_URL || "https://developers.cjdropshipping.com/api2.0/v1").replace(/\/$/, "");
  },
  get cjWebhookSecret() {
    return process.env.CJ_WEBHOOK_SECRET || null;
  },
  get adminRequire2fa() {
    return process.env.ADMIN_REQUIRE_2FA !== "false";
  },
};
