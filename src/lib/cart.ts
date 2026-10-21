import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { randomToken, sha256 } from "./crypto";

export const CART_COOKIE = "cart_token";
const CART_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

async function readToken() {
  return (await cookies()).get(CART_COOKIE)?.value ?? null;
}

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      variant: {
        include: {
          inventory: true,
          product: { include: { images: { orderBy: { position: "asc" as const }, take: 1 } } },
        },
      },
    },
  },
};

/** Read-only lookup (safe to call from server components). */
export async function getCart() {
  const token = await readToken();
  if (!token) return null;
  return prisma.cart.findUnique({ where: { tokenHash: sha256(token) }, include: cartInclude });
}

export type CartWithItems = NonNullable<Awaited<ReturnType<typeof getCart>>>;

/** Must be called from a server action or route handler (it may set a cookie). */
export async function getOrCreateCart(userId?: string | null) {
  const existing = await getCart();
  if (existing) {
    if (userId && !existing.userId) await prisma.cart.update({ where: { id: existing.id }, data: { userId } });
    return existing;
  }
  const token = randomToken();
  const cart = await prisma.cart.create({ data: { tokenHash: sha256(token), userId: userId ?? null }, include: cartInclude });
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_MAX_AGE,
  });
  return cart;
}

export async function clearCartCookie() {
  (await cookies()).delete(CART_COOKIE);
}

export function cartItemCount(cart: { items: { quantity: number }[] } | null) {
  return cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
}
