"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Admin error boundary. A page left open across a deployment can call a server action that no longer
 * exists; in that case we reload once automatically to fetch the current version.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = /Server Action|older or newer deployment|Failed to fetch|ChunkLoadError|Loading chunk/i.test(error.message);

  useEffect(() => {
    if (!stale) return;
    const key = "admin-auto-reload";
    try {
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }, [stale]);

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
      <h1 className="text-xl font-bold">{stale ? "The dashboard was updated" : "Something went wrong"}</h1>
      <p className="mt-2 text-sm text-muted">
        {stale ? "A newer version is available. Reloading to continue…" : "The action could not be completed. Please try again."}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={() => window.location.reload()}>Reload page</Button>
        {!stale && <Button variant="outline" onClick={reset}>Try again</Button>}
      </div>
    </div>
  );
}
