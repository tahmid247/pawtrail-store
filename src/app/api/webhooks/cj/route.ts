import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { logIntegration } from "@/lib/audit";
import { syncFulfillmentUpdates, syncInventoryFromSupplier } from "@/lib/fulfillment/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CJ webhook receiver. Register as https://<domain>/api/webhooks/cj?key=<CJ_WEBHOOK_SECRET>.
 * CJ's documented payload carries messageId/type/messageType; we de-duplicate on messageId and
 * NEVER trust payload contents — we re-fetch the authoritative state from the CJ API instead.
 * CJ requires a 200 within 3 seconds, so work is kicked off without awaiting it.
 */
export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!env.cjWebhookSecret || !safeEqual(key, env.cjWebhookSecret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { messageId?: string; type?: string; messageType?: string } | null;
  if (!body?.messageId) return NextResponse.json({ ok: true });
  try {
    await prisma.webhookEvent.create({ data: { provider: "cj", eventId: String(body.messageId).slice(0, 200), type: String(body.type ?? "unknown").slice(0, 100) } });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  const type = String(body.type ?? "").toUpperCase();
  const job = type.includes("STOCK") || type.includes("INVENTORY") ? syncInventoryFromSupplier() : syncFulfillmentUpdates();
  void job
    .then(() => prisma.webhookEvent.update({ where: { provider_eventId: { provider: "cj", eventId: String(body.messageId) } }, data: { status: "processed", processedAt: new Date() } }))
    .catch((err) => logIntegration("cj", "error", "webhook", String(err)));
  return NextResponse.json({ ok: true });
}
