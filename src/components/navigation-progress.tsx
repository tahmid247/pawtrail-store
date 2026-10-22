"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin top progress bar that starts the instant an internal link is clicked and finishes when the
 * new page has rendered, so slow server responses never look like an ignored click.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setState("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Route changed → finish the bar.
  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
  }, [pathname, search]);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (state === "done") timer.current = window.setTimeout(() => setState("idle"), 400);
    if (state === "loading") timer.current = window.setTimeout(() => setState("idle"), 20_000); // safety net
  }, [state]);

  if (state === "idle") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]" role="progressbar" aria-label="Loading page" aria-busy={state === "loading"}>
      <div
        className="h-full bg-gradient-to-r from-glow via-primary to-glow shadow-[0_0_10px_var(--brand-primary)]"
        style={{
          width: state === "loading" ? "85%" : "100%",
          opacity: state === "done" ? 0 : 1,
          transition: state === "loading" ? "width 8s cubic-bezier(0.1, 0.7, 0.1, 1)" : "width 0.2s ease, opacity 0.3s ease 0.15s",
          animation: state === "loading" ? "nav-progress-start 0.4s ease-out" : undefined,
        }}
      />
    </div>
  );
}
