import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "./auth";
import { prisma } from "./db";
import { env } from "./env";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  twoFactorEnabled: boolean;
};

/** Resolves the signed-in user. The role is always re-read from the database, never trusted from the cookie. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, emailVerified: true, role: true, twoFactorEnabled: true },
  });
  if (!user) return null;
  return { ...user, twoFactorEnabled: Boolean(user.twoFactorEnabled) };
});

export async function requireUser(next = "/account"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function isStaff(role: Role) {
  return role === "ADMIN" || role === "SUPPORT";
}

/** Pure authorization rule, unit-tested: staff role + (2FA unless explicitly disabled). */
export function checkStaffAccess(
  user: Pick<CurrentUser, "role" | "twoFactorEnabled"> | null,
  opts: { adminOnly?: boolean; require2fa: boolean },
): "ok" | "unauthenticated" | "forbidden" | "needs-2fa" {
  if (!user) return "unauthenticated";
  if (opts.adminOnly ? user.role !== "ADMIN" : !isStaff(user.role)) return "forbidden";
  if (opts.require2fa && !user.twoFactorEnabled) return "needs-2fa";
  return "ok";
}

/** For admin pages: redirects instead of throwing. */
export async function requireStaffPage(opts: { adminOnly?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  const result = checkStaffAccess(user, { ...opts, require2fa: env.adminRequire2fa });
  if (result === "unauthenticated") redirect("/account/login?next=/admin");
  if (result === "forbidden") redirect("/");
  if (result === "needs-2fa") redirect("/account/security?setup2fa=1");
  return user!;
}

/** For server actions & route handlers: throws, so nothing executes without authorization. */
export async function assertStaff(opts: { adminOnly?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  const result = checkStaffAccess(user, { ...opts, require2fa: env.adminRequire2fa });
  if (result !== "ok") throw new AuthorizationError(result);
  return user!;
}
