ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE products ADD COLUMN subcategory varchar(100);

UPDATE products
SET category = CASE
  WHEN category = 'ACCESSORIES' AND lower(name) ~ 'hair|cheveu|brosse|brush|invisibobble' THEN 'HAIR'
  WHEN category = 'ACCESSORIES' THEN 'MAKEUP'
  WHEN category = 'HYGIENE' AND lower(name) ~ 'hair|cheveu|shampoo|capillaire|gisou|color wow' THEN 'HAIR'
  WHEN category = 'OTHER' AND lower(name) ~ 'hair|cheveu|invisibobble' THEN 'HAIR'
  WHEN category = 'OTHER' AND lower(name) ~ 'solaire|sun|spf' THEN 'SKIN_CARE'
  WHEN category = 'OTHER' THEN 'BATH_BODY'
  ELSE category
END;

ALTER TABLE products ALTER COLUMN category SET DEFAULT 'SKIN_CARE';
ALTER TABLE products ADD CONSTRAINT products_category_check CHECK (
  category IN ('BATH_BODY', 'HAIR', 'SUPPLEMENTS', 'HYGIENE', 'MAKEUP', 'FRAGRANCE', 'SKIN_CARE', 'ORAL_CARE')
);
