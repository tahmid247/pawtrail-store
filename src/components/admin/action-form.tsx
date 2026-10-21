"use client";
import { useFormAction } from "@/components/ui/use-form-action";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import type { AdminResult } from "@/app/admin/result";

/** Generic admin form bound to a server action returning { ok, message | error }. */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  variant = "primary",
  confirmText,
  className,
  inline = false,
}: {
  action: (prev: AdminResult, fd: FormData) => Promise<AdminResult>;
  children?: ReactNode;
  submitLabel?: string;
  variant?: "primary" | "secondary" | "outline" | "danger";
  confirmText?: string;
  className?: string;
  inline?: boolean;
}) {
  const [state, onSubmit, pending] = useFormAction(action, null, { confirm: confirmText });
  return (
    <form
      onSubmit={onSubmit}
      className={className ?? (inline ? "flex flex-wrap items-end gap-2" : "space-y-4")}
    >
      {children}
      <Button type="submit" variant={variant} size={inline ? "sm" : "md"} disabled={pending}>{pending ? "Working…" : submitLabel}</Button>
      {state?.error && <Alert tone="danger" className={inline ? "w-full" : undefined}>{state.error}</Alert>}
      {state?.ok && state.message && <Alert tone="success" className={inline ? "w-full" : undefined}>{state.message}</Alert>}
    </form>
  );
}
