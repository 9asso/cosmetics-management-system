ALTER TABLE inventory_movements
  ADD COLUMN wholesale_price numeric(18,2) CHECK (wholesale_price >= 0),
  ADD COLUMN retail_price numeric(18,2) CHECK (retail_price >= 0);

-- Backfill existing movements from product_variants
UPDATE inventory_movements m
SET wholesale_price = v.wholesale_price,
    retail_price = v.retail_price
FROM product_variants v
WHERE v.id = m.variant_id AND m.quantity_delta > 0;

-- Override with snapshots from purchase_order_items if available
UPDATE inventory_movements m
SET wholesale_price = COALESCE(NULLIF(i.wholesale_price_snapshot, 0), m.wholesale_price),
    retail_price = COALESCE(NULLIF(i.retail_price_snapshot, 0), m.retail_price)
FROM purchase_order_items i
WHERE m.reference_type = 'purchase_order'
  AND i.purchase_order_id = m.reference_id
  AND i.variant_id = m.variant_id
  AND m.quantity_delta > 0;
