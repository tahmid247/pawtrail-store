"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCart, getOrCreateCart } from "@/lib/cart";
import { getAvailability } from "@/lib/inventory";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import { evaluateDiscount, findDiscount, normalizeCode } from "@/lib/discounts";
import { rateLimitByIp } from "@/lib/rate-limit";
import { recordEvent } from "@/lib/analytics";

type CartActionResult = { ok: boolean; message?: string; count?: number };

const addSchema = z.object({ variantId: z.string().min(1).max(64), quantity: z.coerce.number().int().min(1).max(99) });

export async function addToCart(input: { variantId: string; quantity: number }): Promise<CartActionResult> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  if (!(await rateLimitByIp("cart", 60, 60))) return { ok: false, message: "Too many requests. Please slow down." };
  const { variantId, quantity } = parsed.data;

  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, active: true, product: { status: "ACTIVE" } },
  });
  if (!variant) return { ok: false, message: "This item is not available." };

  const settings = await getSettings();
  const user = await getCurrentUser();
  const cart = await getOrCreateCart(user?.id);
  const existing = cart.items.find((i) => i.variantId === variantId)?.quantity ?? 0;
  const available = (await getAvailability([variantId])).get(variantId) ?? 0;
  const wanted = existing + quantity;
  const max = Math.min(available, settings.commerce.maxQuantityPerItem);
  if (max <= 0) return { ok: false, message: "Sorry, this item is out of stock." };
  if (wanted > max) {
    return { ok: false, message: available < settings.commerce.maxQuantityPerItem ? `Only ${available} available.` : `Maximum ${max} per order.` };
  }

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, variantId, quantity },
    update: { quantity: wanted },
  });
  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
  await recordEvent("add_to_cart");
  revalidatePath("/", "layout");
  const count = (await prisma.cartItem.aggregate({ where: { cartId: cart.id }, _sum: { quantity: true } }))._sum.quantity ?? 0;
  return { ok: true, count };
}

export async function updateCartItem(input: { variantId: string; quantity: number }): Promise<CartActionResult> {
  const parsed = z.object({ variantId: z.string().min(1).max(64), quantity: z.coerce.number().int().min(0).max(99) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid quantity." };
  const cart = await getCart();
  if (!cart) return { ok: false, message: "Cart not found." };
  const { variantId, quantity } = parsed.data;
  if (quantity === 0) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
  } else {
    const settings = await getSettings();
    const available = (await getAvailability([variantId])).get(variantId) ?? 0;
    const max = Math.min(available, settings.commerce.maxQuantityPerItem);
    if (quantity > max) return { ok: false, message: max > 0 ? `Only ${max} available.` : "Out of stock." };
    await prisma.cartItem.updateMany({ where: { cartId: cart.id, variantId }, data: { quantity } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function applyDiscountCode(code: string): Promise<CartActionResult> {
  if (!(await rateLimitByIp("discount", 10, 300))) return { ok: false, message: "Too many attempts. Try again later." };
  const cart = await getCart();
  if (!cart || !cart.items.length) return { ok: false, message: "Your cart is empty." };
  const normalized = normalizeCode(String(code ?? "").slice(0, 40));
  if (!normalized) {
    await prisma.cart.update({ where: { id: cart.id }, data: { discountCode: null } });
    revalidatePath("/cart");
    return { ok: true };
  }
  const subtotal = cart.items.reduce((s, i) => s + i.variant.priceCents * i.quantity, 0);
  const result = evaluateDiscount(await findDiscount(normalized), subtotal);
  if (!result.ok) return { ok: false, message: result.reason };
  await prisma.cart.update({ where: { id: cart.id }, data: { discountCode: normalized } });
  revalidatePath("/cart");
  return { ok: true, message: "Discount applied." };
}

export async function removeDiscountCode(): Promise<CartActionResult> {
  const cart = await getCart();
  if (cart) await prisma.cart.update({ where: { id: cart.id }, data: { discountCode: null } });
  revalidatePath("/cart");
  return { ok: true };
}
