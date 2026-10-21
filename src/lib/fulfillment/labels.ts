import type { FulfillmentStatus } from "@prisma/client";

export function fulfillmentLabel(s: FulfillmentStatus): string {
  return {
    UNFULFILLED: "Preparing",
    SUBMITTED: "Sent to warehouse",
    AWAITING_SUPPLIER_CONFIRMATION: "Sent to warehouse",
    PROCESSING: "Being packed",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    FAILED: "Preparing",
    CANCELLED: "Cancelled",
  }[s];
}
