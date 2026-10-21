"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { setSupplierQuantity } from "@/lib/inventory";
import { saveSettingsSection, settingsSchema, type SettingsSection } from "@/lib/settings";
import { emailTemplateKeys } from "@/lib/email/templates";
import { normalizeCode } from "@/lib/discounts";
import { eraseUser } from "@/lib/privacy";
import { getCjClient, syncFulfillmentUpdates, syncInventoryFromSupplier } from "@/lib/fulfillment/service";
import { cjMockClient } from "@/lib/fulfillment/cj/mock";
import { env } from "@/lib/env";
import { guarded, optInt, toCents } from "./guard";
import type { AdminResult } from "../result";

// ── Inventory ────────────────────────────────────────────────
export async function updateInventory(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const variantId = z.string().parse(fd.get("variantId"));
    const qty = z.coerce.number().int().min(0).max(1_000_000).parse(fd.get("supplierQuantity"));
    const source = z.enum(["MANUAL", "CJ"]).parse(fd.get("source"));
    await setSupplierQuantity(variantId, qty, { reason: "admin_manual_count", actorId: u.id, source });
    await prisma.inventory.update({
      where: { variantId },
      data: {
        safetyBuffer: z.coerce.number().int().min(0).max(100000).parse(fd.get("safetyBuffer") ?? 0),
        lowStockThreshold: z.coerce.number().int().min(0).max(100000).parse(fd.get("lowStockThreshold") ?? 0),
        ...(source === "MANUAL" ? { syncStatus: null, syncError: null } : {}),
        lowStockAlertedAt: null,
      },
    });
    await audit(u.id, "inventory.update", "ProductVariant", variantId, { supplierQuantity: qty, source });
    revalidatePath("/admin/inventory");
    revalidatePath("/", "layout");
    return "Inventory updated.";
  });
}

export async function syncInventoryNow() {
  return guarded({ adminOnly: true }, async (u) => {
    const r = await syncInventoryFromSupplier(u.id);
    await audit(u.id, "inventory.sync", "Supplier", "CJ", r);
    revalidatePath("/admin/inventory");
    return `Sync complete (${getCjClient().mode} mode): ${r.applied} variant(s) updated${r.flagged.length ? `, unmatched: ${r.flagged.join(", ")}` : ""}.`;
  });
}

export async function syncFulfillmentNow() {
  return guarded({}, async () => {
    const r = await syncFulfillmentUpdates();
    return `Checked ${r.checked} supplier order(s); ${r.updated} updated.`;
  });
}

export async function testCjConnection() {
  return guarded({ adminOnly: true }, async (u) => {
    const r = await getCjClient().testConnection();
    await audit(u.id, "integration.cj_test", "Supplier", "CJ", { ok: r.ok, mode: getCjClient().mode });
    if (!r.ok) throw new Error(`CJ connection failed: ${r.message}`);
    return r.message;
  });
}

/** Development helper: makes the mock CJ order "ship" so tracking flows can be tested end-to-end. */
export async function simulateCjShipment(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async () => {
    if (env.cjMode !== "mock") throw new Error("Only available in CJ mock mode.");
    const ext = z.string().parse(fd.get("externalOrderId"));
    const status = z.enum(["UNSHIPPED", "SHIPPED", "DELIVERED"]).parse(fd.get("status"));
    cjMockClient._setStatus(ext, status, status === "UNSHIPPED" ? undefined : `MOCKTRACK${ext.slice(-6)}`);
    const r = await syncFulfillmentUpdates();
    return `Mock CJ order set to ${status}; synced ${r.updated} order(s).`;
  });
}

// ── Settings ─────────────────────────────────────────────────
/** Each settings section is posted as JSON in a hidden "payload" field built by the client form. */
export async function saveSettings(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const section = z.enum(Object.keys(settingsSchema.shape) as [SettingsSection, ...SettingsSection[]]).parse(fd.get("section"));
    const value = JSON.parse(String(fd.get("payload") ?? "null"));
    await saveSettingsSection(section, settingsSchema.shape[section].parse(value) as never);
    await audit(u.id, "settings.update", "StoreSetting", section);
    revalidatePath("/", "layout");
    return "Settings saved.";
  });
}

export async function saveLegalPage(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const data = z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/).max(60),
      title: z.string().trim().min(1).max(150),
      content: z.string().min(1).max(100_000),
      version: z.string().trim().min(1).max(40),
    }).parse(Object.fromEntries(fd));
    const page = await prisma.legalPage.upsert({
      where: { slug: data.slug },
      create: { ...data, published: fd.get("published") === "on" },
      update: { ...data, published: fd.get("published") === "on" },
    });
    await audit(u.id, "legal.update", "LegalPage", page.id, { version: data.version });
    revalidatePath(`/legal/${data.slug}`);
    return "Legal page saved. Remember to update the version when content changes.";
  });
}

export async function saveEmailTemplate(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const data = z.object({
      key: z.enum(emailTemplateKeys as [string, ...string[]]),
      name: z.string().max(100),
      subject: z.string().trim().min(1).max(200),
      body: z.string().min(1).max(10000),
    }).parse(Object.fromEntries(fd));
    await prisma.emailTemplate.upsert({ where: { key: data.key }, create: data, update: data });
    await audit(u.id, "email_template.update", "EmailTemplate", data.key);
    return "Template saved.";
  });
}

// ── Discounts ────────────────────────────────────────────────
export async function saveDiscount(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const type = z.enum(["PERCENT", "FIXED"]).parse(fd.get("type"));
    const rawValue = String(fd.get("value") ?? "");
    const value = type === "PERCENT" ? z.coerce.number().int().min(1).max(100).parse(rawValue) : toCents(rawValue);
    if (value <= 0) throw new Error("Value must be positive.");
    const date = (k: string) => (fd.get(k) ? new Date(String(fd.get(k))) : null);
    const data = {
      code: normalizeCode(z.string().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/).parse(fd.get("code"))),
      description: String(fd.get("description") ?? "").slice(0, 200) || null,
      type,
      value,
      minSubtotalCents: fd.get("minSubtotal") ? toCents(fd.get("minSubtotal")) : 0,
      maxRedemptions: optInt(fd.get("maxRedemptions")),
      startsAt: date("startsAt"),
      endsAt: date("endsAt"),
      active: fd.get("active") === "on",
    };
    const id = String(fd.get("id") ?? "");
    const d = id ? await prisma.discountCode.update({ where: { id }, data }) : await prisma.discountCode.create({ data });
    await audit(u.id, id ? "discount.update" : "discount.create", "DiscountCode", d.id, { code: d.code });
    revalidatePath("/admin/discounts");
    return "Discount saved.";
  });
}

// ── Shipping ─────────────────────────────────────────────────
export async function saveShippingRate(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const countries = String(fd.get("countries") ?? "").toUpperCase().split(/[\s,]+/).filter(Boolean);
    if (!countries.length || countries.some((c) => !/^[A-Z]{2}$/.test(c))) throw new Error("Countries must be 2-letter ISO codes, comma separated.");
    const zoneName = z.string().trim().min(1).max(80).parse(fd.get("zoneName"));
    const rate = {
      name: z.string().trim().min(1).max(80).parse(fd.get("rateName")),
      priceCents: toCents(fd.get("price")),
      freeOverCents: fd.get("freeOver") ? toCents(fd.get("freeOver")) : null,
      minDeliveryDays: optInt(fd.get("minDays")),
      maxDeliveryDays: optInt(fd.get("maxDays")),
      active: fd.get("active") === "on",
    };
    if (rate.minDeliveryDays != null && rate.maxDeliveryDays != null && rate.minDeliveryDays > rate.maxDeliveryDays) throw new Error("Min days cannot exceed max days.");
    const zoneId = String(fd.get("zoneId") ?? "");
    const rateId = String(fd.get("rateId") ?? "");
    if (zoneId) {
      await prisma.shippingZone.update({ where: { id: zoneId }, data: { name: zoneName, countries, active: rate.active } });
      if (rateId) await prisma.shippingRate.update({ where: { id: rateId }, data: rate });
      else await prisma.shippingRate.create({ data: { ...rate, zoneId } });
    } else {
      await prisma.shippingZone.create({ data: { name: zoneName, countries, rates: { create: rate } } });
    }
    await audit(u.id, "shipping.update", "ShippingZone", zoneId || null, { countries, ...rate });
    revalidatePath("/admin/shipping");
    revalidatePath("/", "layout");
    return "Shipping saved.";
  });
}

// ── Reviews, support, customers ──────────────────────────────
export async function moderateReview(_p: AdminResult, fd: FormData) {
  return guarded({}, async (u) => {
    const id = z.string().parse(fd.get("id"));
    const status = z.enum(["APPROVED", "REJECTED", "PENDING"]).parse(fd.get("status"));
    const r = await prisma.review.update({ where: { id }, data: { status }, include: { product: true } });
    await audit(u.id, "review.moderate", "Review", id, { status });
    revalidatePath("/admin/reviews");
    revalidatePath(`/products/${r.product.slug}`);
    return `Review ${status.toLowerCase()}.`;
  });
}

export async function updateSupportRequest(_p: AdminResult, fd: FormData) {
  return guarded({}, async (u) => {
    const id = z.string().parse(fd.get("id"));
    const status = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).parse(fd.get("status"));
    const adminNotes = z.string().max(5000).parse(fd.get("adminNotes") ?? "");
    await prisma.supportRequest.update({ where: { id }, data: { status, adminNotes: adminNotes || null } });
    await audit(u.id, "support.update", "SupportRequest", id, { status });
    revalidatePath("/admin/support");
    return "Request updated.";
  });
}

export async function processDeletionRequest(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const id = z.string().parse(fd.get("requestId"));
    const decision = z.enum(["erase", "reject"]).parse(fd.get("decision"));
    const req = await prisma.accountDeletionRequest.findUniqueOrThrow({ where: { id } });
    if (req.status !== "PENDING") throw new Error("Request already processed.");
    if (decision === "reject") {
      const notes = z.string().trim().min(5, "explain why").max(2000).parse(fd.get("notes"));
      await prisma.accountDeletionRequest.update({ where: { id }, data: { status: "REJECTED", adminNotes: notes, processedAt: new Date(), processedById: u.id } });
      await audit(u.id, "customer.deletion_rejected", "AccountDeletionRequest", id);
      revalidatePath("/admin/customers");
      return "Request rejected. Inform the customer of the reason.";
    }
    if (req.userId) await eraseUser(req.userId, u.id);
    await prisma.accountDeletionRequest.update({ where: { id }, data: { status: "COMPLETED", processedAt: new Date(), processedById: u.id } });
    revalidatePath("/admin/customers");
    return "Account erased. Retained order records have been unlinked.";
  });
}

export async function setUserRole(_p: AdminResult, fd: FormData) {
  return guarded({ adminOnly: true }, async (u) => {
    const userId = z.string().parse(fd.get("userId"));
    const role = z.enum(["CUSTOMER", "SUPPORT", "ADMIN"]).parse(fd.get("role"));
    if (userId === u.id) throw new Error("You cannot change your own role.");
    await prisma.user.update({ where: { id: userId }, data: { role } });
    await prisma.session.deleteMany({ where: { userId } }); // force re-authentication with the new role
    await audit(u.id, "user.role_change", "User", userId, { role });
    revalidatePath(`/admin/customers/${userId}`);
    return `Role set to ${role}. The user's sessions were revoked.`;
  });
}
