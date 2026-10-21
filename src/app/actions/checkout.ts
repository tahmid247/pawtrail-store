"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/session";
import { CheckoutError, createPendingOrder } from "@/lib/orders";
import { startPaymentSession } from "@/lib/payments";
import { rateLimitByIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { recordEvent } from "@/lib/analytics";

const schema = z.object({
  email: z.email().max(254),
  country: z.string().regex(/^[A-Z]{2}$/),
  shippingRateId: z.string().max(64).optional().nullable(),
  acceptTerms: z.literal("on"),
  marketingOptIn: z.literal("on").optional().nullable(),
});

type CheckoutState = { error?: string; fieldErrors?: Record<string, string> } | null;

export async function startCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  if (!(await rateLimitByIp("checkout", 10, 300))) return { error: "Too many checkout attempts. Please wait a few minutes." };

  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    country: String(formData.get("country") ?? "").toUpperCase(),
    shippingRateId: formData.get("shippingRateId") || null,
    acceptTerms: formData.get("acceptTerms"),
    marketingOptIn: formData.get("marketingOptIn"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] =
        key === "acceptTerms" ? "Please accept the Terms and Conditions to continue." : key === "email" ? "Enter a valid email address." : "Please check this field.";
    }
    return { fieldErrors };
  }

  const cart = await getCart();
  if (!cart || cart.items.length === 0) return { error: "Your cart is empty." };
  const user = await getCurrentUser();
  const terms = await prisma.legalPage.findUnique({ where: { slug: "terms" }, select: { version: true } });

  let url: string;
  try {
    const pending = await createPendingOrder({
      cartId: cart.id,
      items: cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      email: user?.email ?? parsed.data.email,
      userId: user?.id ?? null,
      country: parsed.data.country,
      shippingRateId: parsed.data.shippingRateId,
      discountCode: cart.discountCode,
      termsVersion: terms?.version ?? "unknown",
      marketingOptIn: parsed.data.marketingOptIn === "on",
    });
    url = await startPaymentSession(pending);
    await recordEvent("checkout_started");
  } catch (err) {
    if (err instanceof CheckoutError) return { error: err.message };
    console.error("checkout failed", err);
    return { error: err instanceof Error && err.message === "Payments are not configured yet." ? err.message : "We could not start the payment. Please try again." };
  }
  redirect(url);
}
