-- Online shop settings and discount codes, managed from the desktop Settings page.
ALTER TABLE organizations
  ADD COLUMN store_catalog_source varchar(10) NOT NULL DEFAULT 'LIVE'
    CHECK (store_catalog_source IN ('LIVE', 'DEMO')),
  ADD COLUMN store_product_scope varchar(10) NOT NULL DEFAULT 'VISIBLE'
    CHECK (store_product_scope IN ('VISIBLE', 'IN_STOCK')),
  ADD COLUMN store_free_shipping_threshold numeric(18,2) NOT NULL DEFAULT 500
    CHECK (store_free_shipping_threshold >= 0),
  ADD COLUMN store_shipping_fee numeric(18,2) NOT NULL DEFAULT 35
    CHECK (store_shipping_fee >= 0);

CREATE TABLE discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  code varchar(40) NOT NULL CHECK (code = upper(code) AND code ~ '^[A-Z0-9_-]{2,40}$'),
  type varchar(10) NOT NULL CHECK (type IN ('PERCENT', 'FIXED')),
  value numeric(18,2) NOT NULL CHECK (value > 0 AND (type <> 'PERCENT' OR value <= 100)),
  min_subtotal numeric(18,2) NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  expires_on date,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

ALTER TABLE sales_orders ADD COLUMN discount_code varchar(40);
CREATE INDEX sales_orders_discount_code_idx ON sales_orders (organization_id, discount_code)
  WHERE discount_code IS NOT NULL;
