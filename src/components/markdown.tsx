import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Renders a small, safe Markdown subset to React elements. No raw HTML is ever injected,
 * so admin-edited content cannot introduce scripts (XSS-safe by construction).
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${keyPrefix}-b${i++}`}>{m[2]}</strong>);
    else {
      const href = m[5];
      const safe = /^(\/|https:\/\/|mailto:)/.test(href) ? href : "#";
      out.push(
        safe.startsWith("/") ? (
          <Link key={`${keyPrefix}-l${i++}`} href={safe}>{m[4]}</Link>
        ) : (
          <a key={`${keyPrefix}-l${i++}`} href={safe} rel="noopener noreferrer" target={safe.startsWith("http") ? "_blank" : undefined}>{m[4]}</a>
        ),
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const nodes: ReactNode[] = [];
  blocks.forEach((block, bi) => {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (!lines.length) return;
    const first = lines[0];
    if (first.startsWith("### ")) nodes.push(<h3 key={bi}>{inline(first.slice(4), `h${bi}`)}</h3>);
    else if (first.startsWith("## ")) nodes.push(<h2 key={bi}>{inline(first.slice(3), `h${bi}`)}</h2>);
    else if (first.startsWith("# ")) nodes.push(<h2 key={bi}>{inline(first.slice(2), `h${bi}`)}</h2>);
    else if (lines.every((l) => l.startsWith("> "))) nodes.push(<blockquote key={bi}>{inline(lines.map((l) => l.slice(2)).join(" "), `q${bi}`)}</blockquote>);
    else if (lines.every((l) => /^- /.test(l))) nodes.push(<ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.slice(2), `u${bi}-${li}`)}</li>)}</ul>);
    else if (lines.every((l) => /^\d+\. /.test(l))) nodes.push(<ol key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\d+\. /, ""), `o${bi}-${li}`)}</li>)}</ol>);
    else nodes.push(<p key={bi}>{lines.flatMap((l, li) => (li ? [<br key={`br${li}`} />, ...inline(l, `p${bi}-${li}`)] : inline(l, `p${bi}-${li}`)))}</p>);
  });
  return <div className={className ?? "prose-store"}>{nodes}</div>;
}
