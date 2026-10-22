import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DATABASE_URL_CANDIDATES, rawDatabaseUrl } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

/**
 * Deployment health check. Reports only yes/no facts and error codes — never values of secrets.
 */
export async function GET() {
  const configured = Object.fromEntries(DATABASE_URL_CANDIDATES.map((n) => [n, Boolean(process.env[n])]));
  const url = rawDatabaseUrl();
  let database: { reachable: boolean; tables: boolean; products?: number; error?: string } = { reachable: false, tables: false };
  if (url) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = { reachable: true, tables: false };
      database.products = await prisma.product.count();
      database.tables = true;
    } catch (err) {
      const e = err as { code?: string; message?: string };
      database.error = e.code ?? (e.message ?? "unknown").split("\n").find((l) => l.trim())?.slice(0, 160);
    }
  }
  const ok = database.reachable && database.tables;

  // Payment configuration: only presence and mode are reported, never key values.
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
  let lastStripeWebhook: { type: string; status: string; at: string } | null = null;
  if (database.tables) {
    const w = await prisma.webhookEvent.findFirst({ where: { provider: "stripe" }, orderBy: { receivedAt: "desc" } }).catch(() => null);
    if (w) lastStripeWebhook = { type: w.type, status: w.status, at: w.receivedAt.toISOString() };
  }
  const stripe = {
    secretKeySet: Boolean(secretKey),
    mode: secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_") ? "live" : secretKey ? "test" : null,
    keyLooksValid: !secretKey || /^(sk|rk)_(test|live)_/.test(secretKey),
    webhookSecretSet: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    webhookSecretLooksValid: !process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_"),
    lastWebhook: lastStripeWebhook,
  };

  return NextResponse.json(
    { ok, databaseUrlFound: Boolean(url), envVarsPresent: configured, database, stripe },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
