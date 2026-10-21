"use client";
import { useState, useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { applyDiscountCode, removeDiscountCode, updateCartItem } from "@/app/actions/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export function CartLineControls({ variantId, quantity, max }: { variantId: string; quantity: number; max: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = (q: number) =>
    start(async () => {
      setError(null);
      const res = await updateCartItem({ variantId, quantity: q });
      if (!res.ok) setError(res.message ?? "Could not update.");
    });
  return (
    <div className="mt-auto flex items-center justify-between pt-3">
      <div className="flex items-center rounded-full border border-line" role="group" aria-label="Quantity">
        <button className="rounded-full p-2 hover:bg-lavender-pale disabled:opacity-40" onClick={() => set(quantity - 1)} disabled={pending || quantity <= 1} aria-label="Decrease quantity"><Minus className="size-4" /></button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums">{quantity}</span>
        <button className="rounded-full p-2 hover:bg-lavender-pale disabled:opacity-40" onClick={() => set(quantity + 1)} disabled={pending || quantity >= max} aria-label="Increase quantity"><Plus className="size-4" /></button>
      </div>
      {error && <span className="text-xs text-danger" role="alert">{error}</span>}
      <button className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger" onClick={() => set(0)} disabled={pending}>
        <Trash2 className="size-4" aria-hidden /> Remove
      </button>
    </div>
  );
}

export function DiscountForm({ applied, error }: { applied: string | null; error: string | null }) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(error);
  const [pending, start] = useTransition();
  if (applied)
    return (
      <div className="mt-5 flex items-center justify-between rounded-xl bg-lavender-pale px-4 py-3 text-sm">
        <span>Code <strong>{applied}</strong> applied</span>
        <button className="font-medium text-primary hover:underline" onClick={() => start(async () => void (await removeDiscountCode()))} disabled={pending}>Remove</button>
      </div>
    );
  return (
    <form
      className="mt-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await applyDiscountCode(code);
          setMsg(res.ok ? null : (res.message ?? "Invalid code."));
        });
      }}
    >
      <label htmlFor="discount" className="text-sm font-medium">Discount code</label>
      <div className="mt-1.5 flex gap-2">
        <Input id="discount" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} autoComplete="off" className="uppercase" />
        <Button type="submit" variant="outline" disabled={pending || !code.trim()}>Apply</Button>
      </div>
      {msg && <p className="mt-1.5 text-xs text-danger" role="alert">{msg}</p>}
    </form>
  );
}
