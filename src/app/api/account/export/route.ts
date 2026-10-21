import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { exportUserData } from "@/lib/privacy";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GDPR Art. 15/20: machine-readable export of the signed-in customer's data. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await rateLimit("export", user.id, 5, 3600))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const data = await exportUserData(user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
