ALTER TABLE sales_orders DROP CONSTRAINT sales_orders_status_check;

UPDATE sales_orders SET status = 'DELIVERED' WHERE status = 'FULFILLED';
UPDATE sales_orders SET status = 'CANCELED' WHERE status = 'CANCELLED';

ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_status_check
  CHECK (status IN (
    'DRAFT', 'ORDERED', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID',
    'DELIVERED', 'CANCELED', 'REFUNDED'
  ));

CREATE INDEX sales_orders_channel_status_date_idx
  ON sales_orders (organization_id, channel, status, placed_at DESC);
