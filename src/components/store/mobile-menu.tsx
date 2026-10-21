"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export function MobileMenu({ nav, signedIn }: { nav: { href: string; label: string }[]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button onClick={() => setOpen(true)} className="-ml-2 rounded-full p-2.5 text-ink hover:bg-lavender-pale" aria-label="Open menu" aria-expanded={open} aria-controls="mobile-menu">
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs animate-fade-up flex-col bg-white p-6 shadow-lift">
            <button ref={closeRef} onClick={() => setOpen(false)} className="mb-6 self-end rounded-full p-2 hover:bg-lavender-pale" aria-label="Close menu">
              <X className="size-5" />
            </button>
            <ul className="space-y-1">
              {[...nav, { href: signedIn ? "/account" : "/account/login", label: signedIn ? "My account" : "Sign in" }, { href: "/cart", label: "Cart" }].map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="block rounded-xl px-4 py-3 text-lg font-semibold text-ink hover:bg-lavender-pale hover:text-primary" aria-current={pathname === n.href ? "page" : undefined}>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
