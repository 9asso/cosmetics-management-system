ALTER TABLE sales_orders ADD COLUMN partner_snapshot jsonb;
ALTER TABLE purchase_orders ADD COLUMN partner_snapshot jsonb;

UPDATE sales_orders o SET partner_snapshot = jsonb_build_object('id', c.id, 'name', c.name,
  'phone', COALESCE(c.phone, ''), 'email', COALESCE(c.email, ''), 'address', COALESCE(c.address, ''))
FROM customers c WHERE c.id = o.customer_id;
UPDATE purchase_orders o SET partner_snapshot = jsonb_build_object('id', s.id, 'name', s.name,
  'phone', COALESCE(s.phone, ''), 'email', COALESCE(s.email, ''), 'address', COALESCE(s.address, ''))
FROM suppliers s WHERE s.id = o.supplier_id;

CREATE FUNCTION capture_order_partner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'sales_orders' THEN
    SELECT jsonb_build_object('id', id, 'name', name, 'phone', COALESCE(phone, ''),
      'email', COALESCE(email, ''), 'address', COALESCE(address, '')) INTO NEW.partner_snapshot
    FROM customers WHERE id = NEW.customer_id;
  ELSE
    SELECT jsonb_build_object('id', id, 'name', name, 'phone', COALESCE(phone, ''),
      'email', COALESCE(email, ''), 'address', COALESCE(address, '')) INTO NEW.partner_snapshot
    FROM suppliers WHERE id = NEW.supplier_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sales_partner_snapshot BEFORE INSERT ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION capture_order_partner();
CREATE TRIGGER purchase_partner_snapshot BEFORE INSERT ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION capture_order_partner();
