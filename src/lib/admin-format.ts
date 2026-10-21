/**
 * Plain-text formats used by the admin editor for product claims:
 *   Highlights:      "[x] Integrated drinking bowl"        ([x] = verified, shown;  [ ] = unverified, hidden)
 *   Specifications:  "[x] Capacity: 350 ml"
 *   FAQs:            "Q: question" / "A: answer" blocks separated by a blank line
 */
type Claim = { text: string; verified: boolean };
type Spec = { label: string; value: string; verified: boolean };

export function parseClaims(input: string, asSpecs: true): Spec[];
export function parseClaims(input: string, asSpecs: false): Claim[];
export function parseClaims(input: string, asSpecs: boolean): (Claim | Spec)[] {
  return input
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((line) => {
      const m = /^\[( |x|X)\]\s*(.*)$/.exec(line);
      const verified = m ? m[1].toLowerCase() === "x" : false;
      const body = (m ? m[2] : line).slice(0, 300);
      if (!asSpecs) return { text: body, verified };
      const idx = body.indexOf(":");
      if (idx < 1) throw new Error(`Specification "${body}" must be "Label: Value"`);
      return { label: body.slice(0, idx).trim(), value: body.slice(idx + 1).trim(), verified };
    });
}

export function formatClaims(items: unknown, asSpecs: boolean): string {
  if (!Array.isArray(items)) return "";
  return items
    .map((i) => {
      const box = i.verified ? "[x]" : "[ ]";
      return asSpecs ? `${box} ${i.label}: ${i.value}` : `${box} ${i.text}`;
    })
    .join("\n");
}

export function parseFaqs(input: string): { question: string; answer: string }[] {
  return input
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((block) => {
      const q = /^Q:\s*(.+)$/m.exec(block)?.[1]?.trim();
      const a = /^A:\s*([\s\S]+)$/m.exec(block)?.[1]?.trim();
      if (!q || !a) throw new Error('Each FAQ needs a "Q:" line and an "A:" line.');
      return { question: q.slice(0, 200), answer: a.slice(0, 2000) };
    });
}

export function formatFaqs(items: unknown): string {
  if (!Array.isArray(items)) return "";
  return items.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
}
