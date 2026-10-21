"use client";
import { useFormAction } from "@/components/ui/use-form-action";
import { useState } from "react";
import { submitReview } from "@/app/actions/engagement";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

export function ReviewForm({ productId, defaultName }: { productId: string; defaultName: string }) {
  const [state, action, pending] = useFormAction(submitReview, null);
  const [rating, setRating] = useState(0);
  if (state?.ok) return <p className="mt-4 text-sm font-medium text-success" role="status">{state.message}</p>;
  return (
    <form onSubmit={action} className="mt-5 space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} className="peer sr-only" required onChange={() => setRating(n)} />
              <span className="block rounded p-0.5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
                <svg viewBox="0 0 20 20" className={`size-7 ${n <= rating ? "fill-primary" : "fill-line"}`} aria-hidden><path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" /></svg>
              </span>
              <span className="sr-only">{n} star{n > 1 ? "s" : ""}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Display name" htmlFor="authorName"><Input id="authorName" name="authorName" defaultValue={defaultName.split(" ")[0]} maxLength={60} required /></Field>
      <Field label="Title (optional)" htmlFor="title"><Input id="title" name="title" maxLength={120} /></Field>
      <Field label="Your review" htmlFor="body"><Textarea id="body" name="body" minLength={10} maxLength={3000} required /></Field>
      {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      <Button type="submit" disabled={pending}>Submit review</Button>
    </form>
  );
}
