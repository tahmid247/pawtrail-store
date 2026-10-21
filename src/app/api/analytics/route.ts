import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/analytics";
import { rateLimitByIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!(await rateLimitByIp("analytics", 120, 60))) return new NextResponse(null, { status: 204 });
  const body = (await req.json().catch(() => null)) as { type?: string; path?: string } | null;
  if (body?.type === "page_view" && typeof body.path === "string" && body.path.startsWith("/")) {
    await recordEvent("page_view", body.path); // no-op unless the analytics consent cookie is set
  }
  return new NextResponse(null, { status: 204 });
}
