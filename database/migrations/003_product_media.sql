ALTER TABLE products
  ADD COLUMN image_url text NOT NULL DEFAULT '',
  ADD COLUMN source_url text NOT NULL DEFAULT '';

ALTER TABLE product_variants
  ADD COLUMN compare_at_price numeric(18,2)
    CHECK (compare_at_price IS NULL OR compare_at_price >= 0);
