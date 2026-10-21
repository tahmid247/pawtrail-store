import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertStaff } from "@/lib/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const csvCell = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; // neutralise spreadsheet formula injection
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET() {
  let user;
  try {
    user = await assertStaff({ adminOnly: true });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const subs = await prisma.newsletterSubscription.findMany({ where: { status: "CONFIRMED" }, orderBy: { confirmedAt: "asc" } });
  await audit(user.id, "newsletter.export", "NewsletterSubscription", null, { count: subs.length });
  const rows = [["email", "confirmed_at", "consent_text"], ...subs.map((s) => [s.email, s.confirmedAt?.toISOString() ?? "", s.consentText])];
  return new NextResponse(rows.map((r) => r.map(csvCell).join(",")).join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="newsletter-confirmed.csv"', "Cache-Control": "no-store" },
  });
}
