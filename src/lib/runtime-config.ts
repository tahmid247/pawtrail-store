import { createHash } from "node:crypto";

/**
 * Zero-config defaults so the store can run on Vercel with only a database attached.
 * Explicit environment variables always take precedence.
 */
export function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.BETTER_AUTH_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Extra origins allowed to call the auth API (the deployment's own preview/branch URLs on Vercel). */
export function extraTrustedOrigins(): string[] {
  return [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((h): h is string => Boolean(h))
    .map((h) => `https://${h}`);
}

/**
 * Auth secret. If BETTER_AUTH_SECRET is not set, a key is derived from the (secret) database
 * credentials so a fresh deployment works securely out of the box. Set BETTER_AUTH_SECRET explicitly
 * for production; changing it signs everyone out.
 */
export function resolveAuthSecret(): string | undefined {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
  const db = rawDatabaseUrl();
  if (db) return createHash("sha256").update(`wanderpaw-auth:${db}`).digest("base64url");
  // Lets `next build` succeed before a database is attached; no sessions can exist without a database.
  if (process.env.NEXT_PHASE === "phase-production-build") return "build-phase-placeholder-secret-0000000000000000";
  return undefined;
}

/** Names under which hosting integrations (Vercel Postgres / Neon, Supabase) expose the connection string. */
export const DATABASE_URL_CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "STORAGE_DATABASE_URL",
  "STORAGE_URL",
  "NEON_DATABASE_URL",
] as const;

export function rawDatabaseUrl(): string | undefined {
  for (const name of DATABASE_URL_CANDIDATES) if (process.env[name]) return process.env[name];
  // Integrations created with a custom prefix expose e.g. MYDB_DATABASE_URL.
  const prefixed = Object.keys(process.env).find((k) => /_DATABASE_URL$/.test(k) && !/UNPOOLED/.test(k));
  return prefixed ? process.env[prefixed] : undefined;
}

/** Prisma needs `pgbouncer=true` when connecting through a transaction-mode pooler (e.g. Neon "-pooler" hosts). */
export function resolveDatabaseUrl(): string | undefined {
  const url = rawDatabaseUrl();
  if (!url) return undefined;
  if (url.includes("-pooler.") && !url.includes("pgbouncer=")) return `${url}${url.includes("?") ? "&" : "?"}pgbouncer=true`;
  return url;
}
