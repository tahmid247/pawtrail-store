-- Database-level guards so that application bugs can never create impossible states.
ALTER TABLE "Inventory" ADD CONSTRAINT "inventory_nonneg"
  CHECK ("supplierQuantity" >= 0 AND "reservedQuantity" >= 0 AND "pendingDeductionQuantity" >= 0 AND "safetyBuffer" >= 0 AND "lowStockThreshold" >= 0);
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "reservation_qty_pos" CHECK ("quantity" > 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "cart_item_qty_range" CHECK ("quantity" > 0 AND "quantity" <= 99);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "variant_price_nonneg" CHECK ("priceCents" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "order_item_valid" CHECK ("quantity" > 0 AND "unitPriceCents" >= 0 AND "totalCents" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "order_amounts_valid"
  CHECK ("subtotalCents" >= 0 AND "discountCents" >= 0 AND "shippingCents" >= 0 AND "totalCents" >= 0 AND "refundedCents" >= 0 AND "refundedCents" <= "totalCents");
ALTER TABLE "Refund" ADD CONSTRAINT "refund_amount_pos" CHECK ("amountCents" > 0);
ALTER TABLE "Review" ADD CONSTRAINT "review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "DiscountCode" ADD CONSTRAINT "discount_value_valid"
  CHECK ("value" > 0 AND ("type" <> 'PERCENT' OR "value" <= 100) AND "redemptionCount" >= 0);
ALTER TABLE "ShippingRate" ADD CONSTRAINT "shipping_rate_valid" CHECK ("priceCents" >= 0);
