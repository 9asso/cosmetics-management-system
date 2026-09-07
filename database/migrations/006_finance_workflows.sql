ALTER TABLE payments ADD COLUMN sales_order_id uuid REFERENCES sales_orders(id),
  ADD COLUMN purchase_order_id uuid REFERENCES purchase_orders(id),
  ADD COLUMN request_id uuid,
  ADD CONSTRAINT payment_single_document CHECK (num_nonnulls(sales_order_id, purchase_order_id) <= 1);
CREATE UNIQUE INDEX payments_request_unique ON payments (organization_id, request_id) WHERE request_id IS NOT NULL;
CREATE INDEX payments_sale ON payments(sales_order_id);
CREATE INDEX payments_purchase ON payments(purchase_order_id);
UPDATE payments p SET sales_order_id = s.id FROM sales_orders s
  WHERE p.organization_id = s.organization_id AND p.reference = s.order_number AND p.direction = 'IN';
UPDATE payments p SET purchase_order_id = s.id FROM purchase_orders s
  WHERE p.organization_id = s.organization_id AND p.reference = s.order_number AND p.direction = 'OUT';
-- Historical check entry incremented amount_paid before bank clearance.
UPDATE sales_orders s SET amount_paid = GREATEST(0, s.amount_paid - p.amount)
  FROM (SELECT sales_order_id, SUM(amount) AS amount FROM payments WHERE method = 'CHECK' AND status = 'PENDING' GROUP BY sales_order_id) p
  WHERE s.id = p.sales_order_id;
UPDATE purchase_orders s SET amount_paid = GREATEST(0, s.amount_paid - p.amount)
  FROM (SELECT purchase_order_id, SUM(amount) AS amount FROM payments WHERE method = 'CHECK' AND status = 'PENDING' GROUP BY purchase_order_id) p
  WHERE s.id = p.purchase_order_id;
UPDATE sales_orders SET status = CASE WHEN amount_paid >= grand_total THEN 'PAID' WHEN amount_paid > 0 THEN 'PARTIALLY_PAID' ELSE 'CONFIRMED' END
  WHERE status IN ('PAID', 'PARTIALLY_PAID');
ALTER TABLE expenses ADD COLUMN request_id uuid, ADD COLUMN voided_at timestamptz, ADD COLUMN void_reason text;
CREATE UNIQUE INDEX expenses_request_unique ON expenses(organization_id, request_id) WHERE request_id IS NOT NULL;
