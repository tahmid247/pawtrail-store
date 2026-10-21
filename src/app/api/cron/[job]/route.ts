import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { releaseExpiredReservations } from "@/lib/inventory";
import { syncFulfillmentUpdates, syncInventoryFromSupplier, checkLowStock } from "@/lib/fulfillment/service";
import { runRetention } from "@/lib/retention";
import { logIntegration } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jobs: Record<string, () => Promise<unknown>> = {
  "release-reservations": () => releaseExpiredReservations(),
  "sync-inventory": () => syncInventoryFromSupplier(),
  "sync-fulfillment": () => syncFulfillmentUpdates(),
  "low-stock": () => checkLowStock(),
  retention: () => runRetention(),
};

/** Scheduled jobs (Vercel Cron or any scheduler). Authenticated with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const run = jobs[job];
  if (!run) return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  try {
    const result = await run();
    return NextResponse.json({ ok: true, job, result });
  } catch (err) {
    await logIntegration("cron", "error", job, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, job }, { status: 500 });
  }
}
