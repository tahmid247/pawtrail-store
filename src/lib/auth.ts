import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { prisma } from "./db";
import { sendEmail } from "./email";
import { extraTrustedOrigins, resolveAuthSecret, resolveSiteUrl } from "./runtime-config";

const siteUrl = resolveSiteUrl();

/**
 * Authentication is handled by Better Auth (scrypt password hashing, http-only session cookies,
 * CSRF/origin checks, built-in rate limiting, TOTP two-factor authentication).
 */
export const auth = betterAuth({
  appName: "Store",
  baseURL: siteUrl,
  secret: resolveAuthSecret(),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: [siteUrl, ...extraTrustedOrigins()],
  user: {
    additionalFields: {
      // Roles are never accepted from client input; they are only changed by admins on the server.
      role: { type: "string", required: false, input: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail("reset_password", user.email, { name: user.name, url });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail("verify_email", user.email, { name: user.name, url });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 15,
  },
  rateLimit: {
    enabled: process.env.NODE_ENV !== "test",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 300, max: 3 },
      "/forget-password": { window: 300, max: 3 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
      "/send-verification-email": { window: 300, max: 3 },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },
  plugins: [twoFactor({ issuer: "Wanderpaw Store" }), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
