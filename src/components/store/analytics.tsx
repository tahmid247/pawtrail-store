"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ConsentState } from "@/lib/consent";

/** Loads analytics only after the visitor has consented to the analytics category. */
export function Analytics({ plausibleDomain, initialConsent }: { plausibleDomain: string | null; initialConsent: boolean }) {
  const [allowed, setAllowed] = useState(initialConsent);
  const pathname = usePathname();

  useEffect(() => {
    const onChange = (e: Event) => setAllowed(Boolean((e as CustomEvent<ConsentState>).detail?.analytics));
    window.addEventListener("consent-changed", onChange);
    return () => window.removeEventListener("consent-changed", onChange);
  }, []);

  useEffect(() => {
    if (!allowed || pathname.startsWith("/admin")) return;
    navigator.sendBeacon?.("/api/analytics", JSON.stringify({ type: "page_view", path: pathname }));
  }, [allowed, pathname]);

  useEffect(() => {
    if (!allowed || !plausibleDomain || document.getElementById("plausible-script")) return;
    const s = document.createElement("script");
    s.id = "plausible-script";
    s.defer = true;
    s.dataset.domain = plausibleDomain;
    s.src = "https://plausible.io/js/script.js";
    document.head.appendChild(s);
  }, [allowed, plausibleDomain]);

  return null;
}
