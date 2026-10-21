import "server-only";
import { prisma } from "../../db";
import { env } from "../../env";
import { seal, unseal } from "../../secret-box";
import { logIntegration } from "../../audit";
import {
  SupplierApiError,
  type FulfillmentClient,
  type SupplierInventoryRecord,
  type SupplierOrderRequest,
  type SupplierOrderStatus,
  type SupplierTracking,
} from "../types";

/**
 * CJdropshipping API v2 client.
 *
 * Endpoint status (see docs/CJ_INTEGRATION.md):
 *   CONFIRMED in CJ's public docs
 *     POST /authentication/getAccessToken            { apiKey } → accessToken/refreshToken (180-day lifetime)
 *     POST /authentication/refreshAccessToken        { refreshToken }
 *     POST /product/stock/privateInventory/querySpuPage   private (prepaid) inventory for the token's account
 *     POST /shopping/order/createOrderV2             order creation (orderNumber, shipping*, logisticName, fromCountryCode, products[{vid, quantity}])
 *     GET  /logistic/trackInfo                       tracking query
 *   TO VERIFY against the live docs before go-live (paths & field names taken from CJ's API index but not re-checked here)
 *     GET  /shopping/order/getOrderDetail?orderId=
 *     createOrderV2 fields: payType, storageId, shopLogisticsType
 *
 * All responses use CJ's envelope { code, result, message, data, requestId }; code 200 = success.
 * The API key never leaves the server; tokens are cached encrypted at rest.
 */

const TOKEN_KEY = "secret:cj_token";

type Envelope<T> = { code: number; result: boolean; message: string; data: T; requestId?: string };
type TokenData = { accessToken: string; accessTokenExpiryDate: string; refreshToken: string; refreshTokenExpiryDate: string };

let memoryToken: { token: string; expiresAt: number } | null = null;

async function rawRequest<T>(path: string, init: { method: "GET" | "POST"; body?: unknown; token?: string; query?: Record<string, string> }) {
  const url = new URL(env.cjBaseUrl + path);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        ...(init.token ? { "CJ-Access-Token": init.token } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (err) {
    throw new SupplierApiError(`CJ request failed: ${String(err)}`, true);
  }
  if (res.status === 429) throw new SupplierApiError("CJ rate limit reached", true);
  if (res.status >= 500) throw new SupplierApiError(`CJ server error ${res.status}`, true);
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!json) throw new SupplierApiError(`CJ returned a non-JSON response (HTTP ${res.status})`, res.status >= 500);
  if (json.code !== 200 || json.result === false) {
    throw new SupplierApiError(`CJ error ${json.code}: ${json.message}`, false, { code: json.code, requestId: json.requestId });
  }
  return json.data;
}

async function loadStoredToken(): Promise<TokenData | null> {
  const row = await prisma.storeSetting.findUnique({ where: { key: TOKEN_KEY } });
  if (!row || typeof row.value !== "string") return null;
  try {
    return JSON.parse(unseal(row.value)) as TokenData;
  } catch {
    return null;
  }
}

async function storeToken(t: TokenData) {
  const value = seal(JSON.stringify(t));
  await prisma.storeSetting.upsert({ where: { key: TOKEN_KEY }, create: { key: TOKEN_KEY, value }, update: { value } });
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (memoryToken && memoryToken.expiresAt - 3600_000 > now) return memoryToken.token;

  const stored = await loadStoredToken();
  if (stored && Date.parse(stored.accessTokenExpiryDate) - 3600_000 > now) {
    memoryToken = { token: stored.accessToken, expiresAt: Date.parse(stored.accessTokenExpiryDate) };
    return stored.accessToken;
  }

  let fresh: TokenData;
  if (stored && Date.parse(stored.refreshTokenExpiryDate) > now) {
    fresh = await rawRequest<TokenData>("/authentication/refreshAccessToken", { method: "POST", body: { refreshToken: stored.refreshToken } });
  } else {
    if (!env.cjApiKey) throw new SupplierApiError("CJ_API_KEY is not configured", false);
    fresh = await rawRequest<TokenData>("/authentication/getAccessToken", { method: "POST", body: { apiKey: env.cjApiKey } });
  }
  await storeToken(fresh);
  memoryToken = { token: fresh.accessToken, expiresAt: Date.parse(fresh.accessTokenExpiryDate) };
  return fresh.accessToken;
}

async function cjRequest<T>(path: string, init: { method: "GET" | "POST"; body?: unknown; query?: Record<string, string> }) {
  const token = await getAccessToken();
  return rawRequest<T>(path, { ...init, token });
}

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const str = (v: unknown) => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null);

/**
 * Parses the private-inventory page defensively. The documented sample shows per-SPU totals
 * (totalWarehouseQuantity, warehouseQuantityInfoList[{countryCode, warehouseQuantity}]). If a per-SKU list
 * is present it is preferred. Anything unrecognised is logged so the mapping can be adjusted.
 */
export function parsePrivateInventoryPage(data: unknown): SupplierInventoryRecord[] {
  const out: SupplierInventoryRecord[] = [];
  const d = data as Record<string, unknown> | null;
  const list = (Array.isArray(d) ? d : (d?.list ?? d?.content ?? d?.records ?? [])) as Record<string, unknown>[];
  for (const spu of list) {
    const pid = str(spu.productId ?? spu.pid);
    const skuList = (spu.skuList ?? spu.variantList ?? spu.skus) as Record<string, unknown>[] | undefined;
    if (Array.isArray(skuList) && skuList.length) {
      for (const sku of skuList) {
        const whs = (sku.warehouseQuantityInfoList as Record<string, unknown>[] | undefined) ?? [];
        if (whs.length) {
          for (const w of whs) {
            const q = num(w.warehouseQuantity ?? w.quantity);
            if (!Number.isFinite(q)) continue;
            out.push({ vid: str(sku.vid ?? sku.variantId), sku: str(sku.sku ?? sku.variantSku), pid, quantity: q, warehouseCountryCode: str(w.countryCode), level: "variant" });
          }
        } else {
          const q = num(sku.availableQuantity ?? sku.warehouseQuantity ?? sku.quantity ?? sku.totalWarehouseQuantity);
          if (Number.isFinite(q)) out.push({ vid: str(sku.vid ?? sku.variantId), sku: str(sku.sku ?? sku.variantSku), pid, quantity: q, warehouseCountryCode: null, level: "variant" });
        }
      }
      continue;
    }
    const whs = (spu.warehouseQuantityInfoList as Record<string, unknown>[] | undefined) ?? [];
    if (whs.length) {
      for (const w of whs) {
        const q = num(w.warehouseQuantity);
        if (Number.isFinite(q)) out.push({ vid: null, sku: str(spu.sku), pid, quantity: q, warehouseCountryCode: str(w.countryCode), level: "product" });
      }
    } else {
      const q = num(spu.totalWarehouseQuantity);
      if (Number.isFinite(q)) out.push({ vid: null, sku: str(spu.sku), pid, quantity: q, warehouseCountryCode: null, level: "product" });
    }
  }
  return out;
}

export const cjLiveClient: FulfillmentClient = {
  mode: "live",

  async testConnection() {
    try {
      await getAccessToken();
      await cjRequest("/product/stock/privateInventory/querySpuPage", { method: "POST", body: { pageNum: 1, pageSize: 1 } });
      return { ok: true, message: "Authenticated and private inventory endpoint reachable." };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },

  async getPrivateInventory() {
    const all: SupplierInventoryRecord[] = [];
    for (let page = 1; page <= 50; page++) {
      const data = await cjRequest<Record<string, unknown>>("/product/stock/privateInventory/querySpuPage", {
        method: "POST",
        body: { pageNum: page, pageSize: 50 },
      });
      if (page === 1) {
        await logIntegration("cj", "info", "inventory_shape", "Private inventory response keys", {
          details: { keys: Object.keys(data ?? {}), firstItemKeys: Object.keys(((data?.list as unknown[]) ?? [])[0] ?? {}) },
        });
      }
      all.push(...parsePrivateInventoryPage(data));
      const totalPages = num(data?.totalPages ?? data?.pages);
      if (!Number.isFinite(totalPages) || page >= totalPages) break;
    }
    return all;
  },

  async createOrder(req: SupplierOrderRequest) {
    const payType = process.env.CJ_PAY_TYPE; // leave unset unless verified with CJ; see docs/CJ_INTEGRATION.md
    const body: Record<string, unknown> = {
      orderNumber: req.orderNumber,
      shippingCountryCode: req.shipping.countryCode,
      shippingCountry: req.shipping.countryName,
      shippingProvince: req.shipping.province ?? req.shipping.city,
      shippingCity: req.shipping.city,
      shippingAddress: req.shipping.line1,
      shippingAddress2: req.shipping.line2 ?? "",
      shippingCustomerName: req.shipping.name,
      shippingZip: req.shipping.postalCode,
      shippingPhone: req.phone,
      email: req.email,
      remark: req.remark,
      fromCountryCode: req.fromCountryCode,
      logisticName: req.logisticName,
      products: req.products.map((p) => ({ vid: p.vid, quantity: p.quantity })),
      ...(req.storageId ? { storageId: req.storageId } : {}),
      ...(payType ? { payType: Number(payType) } : {}),
    };
    const data = await cjRequest<Record<string, unknown> | string>("/shopping/order/createOrderV2", { method: "POST", body });
    const externalOrderId = typeof data === "string" ? data : str(data?.orderId ?? data?.id);
    if (!externalOrderId) throw new SupplierApiError("CJ did not return an order id", false, data);
    return { externalOrderId, externalOrderNumber: typeof data === "object" ? str(data?.orderNumber ?? data?.orderNum) : null, raw: data };
  },

  async getOrder(externalOrderId: string): Promise<SupplierOrderStatus | null> {
    const d = await cjRequest<Record<string, unknown> | null>("/shopping/order/getOrderDetail", {
      method: "GET",
      query: { orderId: externalOrderId },
    });
    if (!d) return null;
    return {
      externalOrderId,
      status: String(d.orderStatus ?? d.status ?? "UNKNOWN").toUpperCase(),
      trackingNumber: str(d.trackNumber ?? d.trackingNumber),
      logisticName: str(d.logisticName),
      trackingUrl: str(d.trackingUrl),
    };
  },

  async getTracking(trackingNumber: string): Promise<SupplierTracking | null> {
    const d = await cjRequest<unknown>("/logistic/trackInfo", { method: "GET", query: { trackNumber: trackingNumber } });
    const rec = (Array.isArray(d) ? d[0] : d) as Record<string, unknown> | undefined;
    if (!rec) return null;
    const rawEvents = (rec.trackingEvents ?? rec.trackInfoList ?? rec.routes ?? []) as Record<string, unknown>[];
    const events = rawEvents
      .map((e) => ({
        status: String(e.status ?? e.trackingStatus ?? ""),
        description: String(e.description ?? e.info ?? e.message ?? e.status ?? "Update"),
        location: str(e.location ?? e.place),
        occurredAt: new Date(String(e.time ?? e.date ?? e.eventTime ?? "")),
      }))
      .filter((e) => !Number.isNaN(e.occurredAt.getTime()));
    const status = String(rec.trackingStatus ?? rec.status ?? "").toLowerCase();
    return { trackingNumber, delivered: status.includes("deliver"), events };
  },
};
