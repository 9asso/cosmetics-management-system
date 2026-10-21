CREATE OR REPLACE FUNCTION public.repair_onight_history(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  org constant uuid := '00000000-0000-4000-8000-000000000001';
  loc constant uuid := '00000000-0000-4000-8000-000000000001';
  actual jsonb;
  expected jsonb := payload->'expected';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('onight-history-repair',0));
  LOCK TABLE sales_orders,purchase_orders,payments,sales_order_items,returns,inventory_balances IN SHARE ROW EXCLUSIVE MODE;
  IF jsonb_array_length(payload->'source_rows') < 1000 OR jsonb_array_length(payload->'items') < 1000 THEN
    RAISE EXCEPTION 'Incomplete source payload';
  END IF;
  IF EXISTS (
    SELECT 1 FROM sales_orders s JOIN jsonb_to_recordset(payload->'before_orders')
    AS x(id uuid,grand_total numeric,amount_paid numeric,status text) ON x.id=s.id
    WHERE s.grand_total<>x.grand_total OR s.amount_paid<>x.amount_paid OR s.status<>x.status
  ) OR EXISTS (
    SELECT 1 FROM purchase_orders s JOIN jsonb_to_recordset(payload->'before_purchases')
    AS x(id uuid,total numeric,amount_paid numeric) ON x.id=s.id
    WHERE s.total<>x.total OR s.amount_paid<>x.amount_paid
  ) THEN RAISE EXCEPTION 'A document changed after the backup; take a new backup and reconcile it first'; END IF;
  -- Never overwrite an imported document whose balance has since been edited.
  IF EXISTS (
    SELECT 1 FROM sales_orders s JOIN jsonb_to_recordset(payload->'orders')
    AS x(id uuid,grand_total numeric,amount_paid numeric) ON x.id=s.id
    WHERE s.grand_total<>x.grand_total OR s.amount_paid<>x.amount_paid
  ) THEN RAISE EXCEPTION 'Source and live invoice balances differ'; END IF;

  INSERT INTO customers(id,organization_id,name,active)
  SELECT id,org,name,false FROM jsonb_to_recordset(payload->'customers') AS x(id uuid,name text)
  ON CONFLICT(id) DO NOTHING;
  INSERT INTO suppliers(id,organization_id,name,active)
  SELECT id,org,name,false FROM jsonb_to_recordset(payload->'suppliers') AS x(id uuid,name text)
  ON CONFLICT(id) DO NOTHING;

  INSERT INTO products(id,organization_id,name,brand,category,description,active,retail_visible)
  SELECT product_id,org,name,brand,'BATH_BODY','Produit historique archivé — absent du stock actuel.',false,false
  FROM jsonb_to_recordset(payload->'archived') AS x(product_id uuid,name text,brand text)
  ON CONFLICT(id) DO NOTHING;
  INSERT INTO product_variants(id,product_id,sku,purchase_price,active)
  SELECT id,product_id,sku,purchase_price,false
  FROM jsonb_to_recordset(payload->'archived') AS x(id uuid,product_id uuid,sku text,purchase_price numeric)
  ON CONFLICT(id) DO NOTHING;

  INSERT INTO sales_orders(id,organization_id,location_id,customer_id,order_number,channel,status,
    subtotal,grand_total,amount_paid,placed_at,legacy_kind,legacy_payment_method,notes)
  SELECT id,org,loc,customer_id,order_number,'MANUAL',status,grand_total,grand_total,amount_paid,
    placed_at,legacy_kind,legacy_payment_method,'Historique repris depuis onight_.db.'
  FROM jsonb_to_recordset(payload->'orders') AS x(id uuid,customer_id uuid,order_number text,status text,
    grand_total numeric,amount_paid numeric,placed_at timestamptz,legacy_kind text,legacy_payment_method text)
  ON CONFLICT(id) DO UPDATE SET legacy_kind=EXCLUDED.legacy_kind,legacy_payment_method=EXCLUDED.legacy_payment_method,
    status=EXCLUDED.status,placed_at=EXCLUDED.placed_at;
  INSERT INTO sales_order_items(id,sales_order_id,variant_id,description,quantity,unit_price,unit_cost_snapshot,line_total)
  SELECT id,sales_order_id,variant_id,description,quantity,unit_price,unit_cost_snapshot,line_total
  FROM jsonb_to_recordset(payload->'items') AS x(id uuid,sales_order_id uuid,variant_id uuid,description text,
    quantity integer,unit_price numeric,unit_cost_snapshot numeric,line_total numeric)
  ON CONFLICT(id) DO NOTHING;

  INSERT INTO purchase_orders(id,organization_id,location_id,supplier_id,order_number,status,total,amount_paid,ordered_at,notes)
  SELECT id,org,loc,supplier_id,order_number,'RECEIVED',total,amount_paid,ordered_at,notes
  FROM jsonb_to_recordset(payload->'purchases') AS x(id uuid,supplier_id uuid,order_number text,total numeric,
    amount_paid numeric,ordered_at timestamptz,notes text)
  ON CONFLICT(id) DO NOTHING;
  INSERT INTO returns(id,organization_id,return_number,status,refund_total,returned_at,legacy_source_id,reason)
  SELECT id,org,return_number,'COMPLETED',refund_total,returned_at,legacy_source_id,'Retour historique repris sans mouvement de stock.'
  FROM jsonb_to_recordset(payload->'returns') AS x(id uuid,return_number text,refund_total numeric,returned_at timestamptz,legacy_source_id integer)
  ON CONFLICT(id) DO NOTHING;
  INSERT INTO return_items(id,return_id,variant_id,quantity,refund_amount)
  SELECT id,return_id,variant_id,quantity,refund_amount FROM jsonb_to_recordset(payload->'return_items')
    AS x(id uuid,return_id uuid,variant_id uuid,quantity integer,refund_amount numeric)
  ON CONFLICT(id) DO NOTHING;
  INSERT INTO payments(id,organization_id,customer_id,supplier_id,sales_order_id,purchase_order_id,return_id,
    direction,method,status,amount,reference,paid_at)
  SELECT id,org,customer_id,supplier_id,sales_order_id,purchase_order_id,return_id,direction,method,'COMPLETED',amount,reference,paid_at
  FROM jsonb_to_recordset(payload->'payments') AS x(id uuid,customer_id uuid,supplier_id uuid,sales_order_id uuid,
    purchase_order_id uuid,return_id uuid,direction text,method text,amount numeric,reference text,paid_at timestamptz)
  ON CONFLICT(id) DO NOTHING;
  UPDATE organizations SET opening_cash_balance=(payload->>'opening_cash')::numeric WHERE id=org;
  INSERT INTO legacy_import_rows(organization_id,source_table,source_id,source_sha256,data)
  SELECT org,source_table,source_id,payload->>'source_sha256',data
  FROM jsonb_to_recordset(payload->'source_rows') AS x(source_table text,source_id integer,data jsonb)
  ON CONFLICT(organization_id,source_table,source_id) DO NOTHING;

  SELECT jsonb_build_object(
    'revenue',(SELECT COALESCE(sum(revenue),0) FROM dashboard_sales_facts WHERE organization_id=org),
    'grossMargin',(SELECT COALESCE(sum(margin),0) FROM dashboard_sales_facts WHERE organization_id=org),
    'expenses',(SELECT COALESCE(sum(amount),0) FROM expenses WHERE organization_id=org AND voided_at IS NULL),
    'october',jsonb_build_object(
      'revenue',(SELECT COALESCE(sum(revenue),0) FROM dashboard_sales_facts WHERE organization_id=org AND (occurred_at AT TIME ZONE 'Africa/Casablanca')::date BETWEEN '2026-10-01' AND '2026-10-31'),
      'grossMargin',(SELECT COALESCE(sum(margin),0) FROM dashboard_sales_facts WHERE organization_id=org AND (occurred_at AT TIME ZONE 'Africa/Casablanca')::date BETWEEN '2026-10-01' AND '2026-10-31'),
      'expenses',(SELECT COALESCE(sum(amount),0) FROM expenses WHERE organization_id=org AND voided_at IS NULL AND incurred_on BETWEEN '2026-10-01' AND '2026-10-31')),
    'cash',(SELECT opening_cash_balance FROM organizations WHERE id=org)
      +(SELECT COALESCE(sum(CASE direction WHEN 'IN' THEN amount ELSE -amount END),0) FROM payments WHERE organization_id=org AND status='COMPLETED')
      -(SELECT COALESCE(sum(amount),0) FROM expenses WHERE organization_id=org AND voided_at IS NULL),
    'receivables',(SELECT COALESCE(sum(grand_total-amount_paid),0) FROM sales_orders WHERE organization_id=org AND legacy_payment_method IS DISTINCT FROM 'Cheque' AND status IN ('CONFIRMED','PARTIALLY_PAID','PAID','FULFILLED','DELIVERED')),
    'payables',(SELECT COALESCE(sum(total-amount_paid),0) FROM purchase_orders WHERE organization_id=org AND status='RECEIVED'),
    'stockValue',(SELECT COALESCE(sum(b.on_hand*v.purchase_price),0) FROM inventory_balances b JOIN product_variants v ON v.id=b.variant_id WHERE b.location_id=loc),
    'units',(SELECT sum(on_hand) FROM inventory_balances WHERE location_id=loc),
    'activeProducts',(SELECT count(*) FROM products WHERE organization_id=org AND active)
  ) INTO actual;
  IF actual<>expected THEN RAISE EXCEPTION 'Reconciliation failed. Expected %, actual %',expected,actual; END IF;
  IF (SELECT count(*) FROM legacy_import_rows WHERE organization_id=org AND source_sha256=payload->>'source_sha256')<>jsonb_array_length(payload->'source_rows')
    OR (SELECT count(*) FROM sales_order_items WHERE id IN (SELECT (value->>'id')::uuid FROM jsonb_array_elements(payload->'items')))<>jsonb_array_length(payload->'items')
    THEN RAISE EXCEPTION 'Incomplete history import'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(payload->'before_user_ids') x WHERE NOT EXISTS(SELECT 1 FROM users WHERE id=x.value::uuid))
    THEN RAISE EXCEPTION 'User preservation failed'; END IF;
  RETURN actual;
END; $$;
REVOKE ALL ON FUNCTION public.repair_onight_history(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_onight_history(jsonb) TO service_role;
