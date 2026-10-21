import "server-only";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { prisma } from "./db";
import { sha256 } from "./crypto";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Fixed-window rate limiter stored in Postgres (atomic upsert, works across serverless instances).
 * Returns true when the request is allowed.
 */
export async function rateLimit(bucket: string, identifier: string, max: number, windowSeconds: number) {
  const key = `app:${bucket}:${sha256(identifier).slice(0, 32)}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${randomUUID()}, ${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rateLimit"."lastRequest" < ${windowStart} THEN 1 ELSE "rateLimit"."count" + 1 END,
      "lastRequest" = CASE WHEN "rateLimit"."lastRequest" < ${windowStart} THEN ${now} ELSE "rateLimit"."lastRequest" END
    RETURNING "count"`;
  return (rows[0]?.count ?? 1) <= max;
}

export async function rateLimitByIp(bucket: string, max: number, windowSeconds: number) {
  return rateLimit(bucket, await clientIp(), max, windowSeconds);
}
