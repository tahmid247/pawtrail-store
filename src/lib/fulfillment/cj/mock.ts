import "server-only";
import type { FulfillmentClient, SupplierOrderRequest } from "../types";
import { SupplierApiError } from "../types";

/**
 * Deterministic CJ stand-in used in development and tests (CJ_MODE=mock).
 * It never contacts CJ and never places real supplier orders.
 *
 * Behaviour hooks for tests:
 *   - set `_failNext = true` to make the next createOrder fail with a retryable error
 *   - inventory comes from MOCK_CJ_INVENTORY='{"<vid>": <qty>}' or defaults to 100 per mapped vid
 */
const created = new Map<string, { req: SupplierOrderRequest; status: string; tracking: string | null }>();

export const cjMockClient: FulfillmentClient & {
  _setStatus(id: string, status: string, tracking?: string): void;
  _reset(): void;
  _created: typeof created;
  _failNext: boolean;
} = {
  _failNext: false,
  mode: "mock",
  _created: created,

  async testConnection() {
    return { ok: true, message: "Mock mode — no requests are sent to CJdropshipping." };
  },

  async getPrivateInventory() {
    const configured = process.env.MOCK_CJ_INVENTORY ? (JSON.parse(process.env.MOCK_CJ_INVENTORY) as Record<string, number>) : null;
    const { prisma } = await import("../../db");
    const mapped = await prisma.productVariant.findMany({ where: { cjVariantId: { not: null } }, select: { cjVariantId: true } });
    return mapped.map((v) => ({
      vid: v.cjVariantId!,
      sku: null,
      pid: null,
      quantity: configured?.[v.cjVariantId!] ?? 100,
      warehouseCountryCode: "MOCK",
      level: "variant" as const,
    }));
  },

  async createOrder(req) {
    if (this._failNext) {
      this._failNext = false;
      throw new SupplierApiError("Mock CJ failure", true);
    }
    const existing = [...created.entries()].find(([, v]) => v.req.orderNumber === req.orderNumber);
    if (existing) throw new SupplierApiError(`Mock CJ: order number ${req.orderNumber} already exists`, false);
    const id = `MOCK-CJ-${req.orderNumber}`;
    created.set(id, { req, status: "UNPAID", tracking: null });
    return { externalOrderId: id, externalOrderNumber: req.orderNumber, raw: { mock: true } };
  },

  async getOrder(id) {
    const o = created.get(id);
    if (!o) return { externalOrderId: id, status: "UNPAID", trackingNumber: null, logisticName: null, trackingUrl: null };
    return { externalOrderId: id, status: o.status, trackingNumber: o.tracking, logisticName: o.tracking ? "MockPost" : null, trackingUrl: null };
  },

  async getTracking(trackingNumber) {
    const entry = [...created.values()].find((v) => v.tracking === trackingNumber);
    const delivered = entry?.status === "DELIVERED";
    const base = new Date("2026-01-01T10:00:00Z");
    return {
      trackingNumber,
      delivered,
      events: [
        { status: "in_transit", description: "Parcel handed to carrier", location: "Warehouse", occurredAt: base },
        ...(delivered ? [{ status: "delivered", description: "Delivered", location: "Destination", occurredAt: new Date(base.getTime() + 86_400_000) }] : []),
      ],
    };
  },

  _setStatus(id, status, tracking) {
    const o = created.get(id);
    if (o) {
      o.status = status;
      if (tracking) o.tracking = tracking;
    } else {
      created.set(id, { req: { orderNumber: id } as SupplierOrderRequest, status, tracking: tracking ?? null });
    }
  },
  _reset() {
    created.clear();
    this._failNext = false;
  },
};
