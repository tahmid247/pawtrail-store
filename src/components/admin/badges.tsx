import { Badge } from "@/components/ui/misc";

export function PayBadge({ s }: { s: string }) {
  const tone = s === "PAID" ? "success" : s === "UNPAID" ? "warning" : s.includes("REFUND") ? "violet" : "neutral";
  return <Badge tone={tone}>{s.replaceAll("_", " ").toLowerCase()}</Badge>;
}
