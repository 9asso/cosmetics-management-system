-- Preserve the source distinction between sales, opening debt and cheque sales.
ALTER TABLE organizations ADD COLUMN opening_cash_balance numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN legacy_kind text,
  ADD COLUMN legacy_payment_method text;
ALTER TABLE returns ADD COLUMN legacy_source_id integer;
ALTER TABLE payments ADD COLUMN return_id uuid REFERENCES returns(id);
CREATE INDEX IF NOT EXISTS sales_order_items_order_idx ON sales_order_items(sales_order_id);

-- Lossless source evidence, accessible only through the backend/database owner.
CREATE TABLE legacy_import_rows (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  source_table text NOT NULL,
  source_id integer NOT NULL,
  source_sha256 text NOT NULL,
  data jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,source_table,source_id)
);
ALTER TABLE legacy_import_rows ENABLE ROW LEVEL SECURITY;

-- A shared revenue/margin definition for the dashboard and exported reports.
-- Native returns already reduce their invoice. Legacy returns were independent
-- transactions and must reduce revenue and margin on their own date, once.
CREATE VIEW dashboard_sales_facts WITH (security_invoker=true) AS
SELECT s.id,s.organization_id,s.channel,COALESCE(s.placed_at,s.created_at) AS occurred_at,
  s.grand_total AS revenue,
  COALESCE((SELECT SUM((i.unit_price-i.unit_cost_snapshot)*
    (i.quantity-i.returned_quantity)*i.unit_multiplier)
    FROM sales_order_items i WHERE i.sales_order_id=s.id),0)-s.discount_total AS margin,
  COALESCE((SELECT SUM((i.quantity-i.returned_quantity)*i.unit_multiplier)
    FROM sales_order_items i WHERE i.sales_order_id=s.id),0)::integer AS units,
  1 AS order_count,s.discount_total,s.shipping_total,s.tax_total
FROM sales_orders s
WHERE s.status IN ('CONFIRMED','PARTIALLY_PAID','PAID','DELIVERED','FULFILLED')
  AND s.legacy_kind IS DISTINCT FROM 'OPENING_DEBT'
UNION ALL
SELECT r.id,r.organization_id,'MANUAL',r.returned_at,-r.refund_total,-r.refund_total,
  0,0,0,0,0
FROM returns r WHERE r.status='COMPLETED' AND r.legacy_source_id IS NOT NULL;

REVOKE ALL ON legacy_import_rows,dashboard_sales_facts FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON legacy_import_rows,dashboard_sales_facts FROM anon;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON legacy_import_rows,dashboard_sales_facts FROM authenticated;
  END IF;
END $$;
