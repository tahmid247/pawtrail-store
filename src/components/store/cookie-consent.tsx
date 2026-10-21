"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { saveConsent } from "@/app/actions/consent";
import type { ConsentState } from "@/lib/consent";
import { Button } from "@/components/ui/button";

export const OPEN_CONSENT_EVENT = "open-cookie-settings";

/**
 * GDPR cookie banner: equal-weight Accept / Reject buttons, granular preferences,
 * nothing optional loads before a choice, and the choice can be changed any time from the footer.
 */
export function CookieConsent({ initial }: { initial: ConsentState | null }) {
  const [open, setOpen] = useState(initial === null);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(initial?.analytics ?? false);
  const [marketing, setMarketing] = useState(initial?.marketing ?? false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setCustomize(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, handler);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, handler);
  }, []);

  const save = (choice: { analytics: boolean; marketing: boolean }) =>
    start(async () => {
      const res = await saveConsent(choice);
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("consent-changed", { detail: res.state }));
        setOpen(false);
        setCustomize(false);
      }
    });

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="cookie-title" className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-md">
      <div className="animate-fade-up rounded-2xl border border-line bg-white p-5 shadow-lift sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="cookie-title" className="flex items-center gap-2 text-base font-bold">
            <Cookie className="size-5 text-primary" aria-hidden /> Your privacy choices
          </h2>
          {initial && (
            <button onClick={() => setOpen(false)} className="rounded-full p-1 text-muted hover:bg-lavender-pale" aria-label="Close">
              <X className="size-4" />
            </button>
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted">
          We use strictly necessary cookies to run the shop (cart, sign-in, checkout). With your permission we would also like to
          measure visits to improve the store. See our <Link href="/legal/cookies" className="font-medium text-primary underline underline-offset-2">Cookie Policy</Link>.
        </p>

        {customize && (
          <fieldset className="mt-4 space-y-3 rounded-xl bg-lavender-pale p-4">
            <legend className="sr-only">Cookie categories</legend>
            <Toggle label="Strictly necessary" description="Cart, secure sign-in and checkout. Always on." checked disabled />
            <Toggle label="Analytics" description="Anonymous visit statistics." checked={analytics} onChange={setAnalytics} />
            <Toggle label="Marketing" description="Not currently used. We will ask before using any." checked={marketing} onChange={setMarketing} />
          </fieldset>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" disabled={pending} onClick={() => save({ analytics: false, marketing: false })}>
            Reject non-essential
          </Button>
          <Button variant="outline" size="sm" disabled={pending} onClick={() => save({ analytics: true, marketing: true })}>
            Accept all
          </Button>
          {customize ? (
            <Button size="sm" className="col-span-2" disabled={pending} onClick={() => save({ analytics, marketing })}>
              Save preferences
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="col-span-2" onClick={() => setCustomize(true)}>
              Customize preferences
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
      <input type="checkbox" role="switch" className="mt-1 size-5 shrink-0 accent-primary" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
    </label>
  );
}

export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
      Cookie settings
    </button>
  );
}
