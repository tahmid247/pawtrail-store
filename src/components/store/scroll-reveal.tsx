"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STAGGER_MS = 90;
const MAX_STAGGER_MS = 540;

/**
 * Scroll-reveal for any element marked `data-reveal` ("up" default, "fade", "left", "right", "scale").
 * Children of a `data-reveal-stagger` container reveal one after another.
 *
 * Progressive enhancement: content is fully visible until this runs (the `js-reveal` class gates the
 * hidden state), elements already on screen are shown instantly, and reduced-motion users get no animation.
 */
export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      root.classList.remove("js-reveal");
      return;
    }

    const finish = (el: HTMLElement) => {
      el.classList.add("is-visible");
      const delay = parseFloat(el.style.getPropertyValue("--reveal-delay")) || 0;
      // Once the entrance is over, drop the hooks so the element's own hover transitions work normally.
      window.setTimeout(() => {
        el.removeAttribute("data-reveal");
        el.classList.remove("is-visible");
        el.style.removeProperty("--reveal-delay");
      }, delay + 900);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          finish(entry.target as HTMLElement);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    const prepare = (scope: ParentNode) => {
      scope.querySelectorAll<HTMLElement>("[data-reveal-stagger]").forEach((group) => {
        Array.from(group.children).forEach((child, i) => {
          const el = child as HTMLElement;
          if (!el.hasAttribute("data-reveal")) el.setAttribute("data-reveal", group.dataset.revealStagger || "up");
          el.style.setProperty("--reveal-delay", `${Math.min(i * STAGGER_MS, MAX_STAGGER_MS)}ms`);
        });
        group.removeAttribute("data-reveal-stagger");
      });
      scope.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)").forEach((el) => {
        const r = el.getBoundingClientRect();
        // Already on screen at load: show immediately rather than hiding and re-animating it.
        if (!root.classList.contains("js-reveal") && r.top < window.innerHeight && r.bottom > 0) {
          el.removeAttribute("data-reveal");
          return;
        }
        io.observe(el);
      });
    };

    prepare(document);
    root.classList.add("js-reveal");

    // Pick up content added later (client navigation, refreshed server components).
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations)
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement) prepare(n.parentElement ?? n);
        });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}
