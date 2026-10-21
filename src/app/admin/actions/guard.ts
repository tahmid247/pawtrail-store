import "server-only";
import { ZodError } from "zod";
import { assertStaff, AuthorizationError, type CurrentUser } from "@/lib/session";
import type { AdminResult } from "../result";

/** Wraps an admin mutation: authorization first, then validated execution with safe error messages. */
export async function guarded(opts: { adminOnly?: boolean }, fn: (user: CurrentUser) => Promise<string | void>): Promise<AdminResult> {
  let user: CurrentUser;
  try {
    user = await assertStaff(opts);
  } catch (err) {
    if (err instanceof AuthorizationError) return { error: "You are not authorized to perform this action." };
    throw err;
  }
  try {
    const message = await fn(user);
    return { ok: true, message: message ?? "Saved." };
  } catch (err) {
    if (err instanceof ZodError) return { error: `Invalid input: ${err.issues.map((i) => `${i.path.join(".") || "field"} ${i.message}`).join("; ")}` };
    console.error("[admin action]", err);
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export const toCents = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid amount");
  return Math.round(n * 100);
};
export const optInt = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : Number.parseInt(String(v), 10));
