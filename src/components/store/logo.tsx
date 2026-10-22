import Link from "next/link";
import Image from "next/image";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="color-mix(in oklab, var(--brand-primary) 70%, #fff)" />
          <stop offset="1" stopColor="var(--brand-primary)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#lg)" />
      <g fill="#fff">
        <ellipse cx="11" cy="12" rx="2.2" ry="2.8" />
        <ellipse cx="16" cy="9.6" rx="2.2" ry="2.8" />
        <ellipse cx="21" cy="12" rx="2.2" ry="2.8" />
        <path d="M16 15.2c-3.6 0-6.4 3.6-6.4 6.1 0 1.9 1.6 2.7 3.2 2.3 1.2-.3 2.1-.7 3.2-.7s2 .4 3.2.7c1.6.4 3.2-.4 3.2-2.3 0-2.5-2.8-6.1-6.4-6.1z" />
      </g>
    </svg>
  );
}

export function Logo({ name, logoUrl, tone = "light" }: { name: string; logoUrl: string | null; tone?: "light" | "dark" }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label={`${name} — home`}>
      {logoUrl ? (
        <Image src={logoUrl} alt="" width={120} height={32} className="h-8 w-auto" />
      ) : (
        <>
          <LogoMark />
          <span translate="no" className={`font-display text-lg font-extrabold tracking-tight ${tone === "dark" ? "text-white" : "text-ink"}`}>{name}</span>
        </>
      )}
    </Link>
  );
}
