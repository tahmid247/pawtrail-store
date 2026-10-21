export type SupplierInventoryRecord = {
  /** CJ variant id (vid) when the API exposes it */
  vid: string | null;
  sku: string | null;
  /** CJ product id (pid / SPU) */
  pid: string | null;
  quantity: number;
  warehouseCountryCode: string | null;
  /** "variant" when the quantity is per variant; "product" when CJ only returned a product-level total */
  level: "variant" | "product";
};

export type SupplierOrderRequest = {
  orderNumber: string;
  email: string;
  phone: string;
  shipping: {
    name: string;
    line1: string;
    line2: string | null;
    city: string;
    province: string | null;
    postalCode: string;
    countryCode: string;
    countryName: string;
  };
  logisticName: string;
  fromCountryCode: string;
  storageId: string | null;
  remark: string;
  products: { vid: string; quantity: number }[];
};

export type SupplierOrderStatus = {
  externalOrderId: string;
  /** Raw supplier status string, e.g. CREATED, UNPAID, UNSHIPPED, SHIPPED, DELIVERED, CANCELLED */
  status: string;
  trackingNumber: string | null;
  logisticName: string | null;
  trackingUrl: string | null;
};

export type SupplierTrackingEvent = { status: string; description: string; location: string | null; occurredAt: Date };

export type SupplierTracking = {
  trackingNumber: string;
  delivered: boolean;
  events: SupplierTrackingEvent[];
};

export interface FulfillmentClient {
  readonly mode: "mock" | "live";
  testConnection(): Promise<{ ok: boolean; message: string }>;
  getPrivateInventory(): Promise<SupplierInventoryRecord[]>;
  createOrder(req: SupplierOrderRequest): Promise<{ externalOrderId: string; externalOrderNumber: string | null; raw: unknown }>;
  getOrder(externalOrderId: string): Promise<SupplierOrderStatus | null>;
  getTracking(trackingNumber: string): Promise<SupplierTracking | null>;
}

export class SupplierApiError extends Error {
  constructor(message: string, public retryable: boolean, public details?: unknown) {
    super(message);
    this.name = "SupplierApiError";
  }
}
