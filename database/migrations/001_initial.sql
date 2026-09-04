CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  legal_name varchar(200),
  currency char(3) NOT NULL DEFAULT 'MAD',
  timezone varchar(80) NOT NULL DEFAULT 'Africa/Casablanca',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name varchar(120) NOT NULL,
  code varchar(40) NOT NULL,
  type varchar(20) NOT NULL DEFAULT 'WAREHOUSE'
    CHECK (type IN ('WAREHOUSE', 'SHOP', 'VIRTUAL')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  email varchar(254) NOT NULL,
  display_name varchar(160) NOT NULL,
  password_hash text,
  role varchar(30) NOT NULL DEFAULT 'STAFF'
    CHECK (role IN ('OWNER', 'MANAGER', 'CASHIER', 'WAREHOUSE', 'ACCOUNTANT', 'STAFF')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name varchar(160) NOT NULL,
  phone varchar(40),
  email varchar(254),
  address text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  type varchar(20) NOT NULL DEFAULT 'WHOLESALE'
    CHECK (type IN ('WHOLESALE', 'RETAIL')),
  name varchar(160) NOT NULL,
  phone varchar(40),
  email varchar(254),
  address text,
  credit_limit numeric(18,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name varchar(160) NOT NULL,
  brand varchar(100) NOT NULL,
  category varchar(30) NOT NULL DEFAULT 'OTHER'
    CHECK (category IN ('MAKEUP', 'SKIN_CARE', 'FRAGRANCE', 'ACCESSORIES', 'HYGIENE', 'OTHER')),
  description text NOT NULL DEFAULT '',
  retail_visible boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  sku varchar(80) NOT NULL UNIQUE,
  barcode varchar(80),
  reference varchar(100) NOT NULL DEFAULT '',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  base_unit varchar(30) NOT NULL DEFAULT 'PIECE',
  purchase_price numeric(18,2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  wholesale_price numeric(18,2) NOT NULL DEFAULT 0 CHECK (wholesale_price >= 0),
  retail_price numeric(18,2) NOT NULL DEFAULT 0 CHECK (retail_price >= 0),
  low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_variants_barcode_unique
  ON product_variants (barcode) WHERE barcode IS NOT NULL AND barcode <> '';

CREATE TABLE product_supplier_links (
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  supplier_sku varchar(100),
  preferred boolean NOT NULL DEFAULT false,
  PRIMARY KEY (variant_id, supplier_id)
);

CREATE TABLE product_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  name varchar(60) NOT NULL,
  multiplier integer NOT NULL CHECK (multiplier > 0),
  allowed_for_purchase boolean NOT NULL DEFAULT true,
  allowed_for_wholesale boolean NOT NULL DEFAULT true,
  allowed_for_retail boolean NOT NULL DEFAULT false,
  UNIQUE (variant_id, name)
);

CREATE TABLE inventory_balances (
  variant_id uuid NOT NULL REFERENCES product_variants(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  on_hand integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= on_hand),
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, location_id)
);

CREATE TABLE inventory_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  lot_number varchar(100) NOT NULL,
  expires_on date,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id, location_id, lot_number)
);

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  variant_id uuid NOT NULL REFERENCES product_variants(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  lot_id uuid REFERENCES inventory_lots(id),
  quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
  reason varchar(30) NOT NULL CHECK (reason IN (
    'OPENING_BALANCE', 'PURCHASE_RECEIPT', 'WHOLESALE_SALE', 'RETAIL_SALE',
    'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'DAMAGE', 'EXPIRY', 'CORRECTION'
  )),
  reference_type varchar(40),
  reference_id uuid,
  unit_cost numeric(18,2),
  note text,
  actor_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_movements_variant_date_idx
  ON inventory_movements (variant_id, created_at DESC);

CREATE TABLE sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  customer_id uuid REFERENCES customers(id),
  order_number varchar(40) NOT NULL,
  channel varchar(30) NOT NULL CHECK (channel IN ('WHOLESALE_DESKTOP', 'RETAIL_WEB', 'MANUAL')),
  status varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED')),
  subtotal numeric(18,2) NOT NULL DEFAULT 0,
  discount_total numeric(18,2) NOT NULL DEFAULT 0,
  shipping_total numeric(18,2) NOT NULL DEFAULT 0,
  tax_total numeric(18,2) NOT NULL DEFAULT 0,
  grand_total numeric(18,2) NOT NULL DEFAULT 0,
  amount_paid numeric(18,2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'MAD',
  notes text,
  placed_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, order_number)
);

CREATE TABLE sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
  variant_id uuid NOT NULL REFERENCES product_variants(id),
  description varchar(240) NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_multiplier integer NOT NULL DEFAULT 1 CHECK (unit_multiplier > 0),
  unit_price numeric(18,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost_snapshot numeric(18,2) NOT NULL CHECK (unit_cost_snapshot >= 0),
  discount_total numeric(18,2) NOT NULL DEFAULT 0,
  line_total numeric(18,2) NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  customer_id uuid REFERENCES customers(id),
  supplier_id uuid REFERENCES suppliers(id),
  direction varchar(10) NOT NULL CHECK (direction IN ('IN', 'OUT')),
  method varchar(20) NOT NULL CHECK (method IN ('CASH', 'CHECK', 'CARD', 'TRANSFER', 'CREDIT', 'COD', 'OTHER')),
  status varchar(20) NOT NULL DEFAULT 'COMPLETED'
    CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'MAD',
  reference varchar(120),
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payment_allocations (
  payment_id uuid NOT NULL REFERENCES payments(id),
  sales_order_id uuid REFERENCES sales_orders(id),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  CHECK (sales_order_id IS NOT NULL),
  PRIMARY KEY (payment_id, sales_order_id)
);

CREATE TABLE checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL UNIQUE REFERENCES payments(id),
  bank_name varchar(120),
  check_number varchar(100),
  due_date date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED')),
  cleared_at timestamptz
);

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  order_number varchar(40) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')),
  total numeric(18,2) NOT NULL DEFAULT 0,
  amount_paid numeric(18,2) NOT NULL DEFAULT 0,
  ordered_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, order_number)
);

CREATE TABLE purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
  variant_id uuid NOT NULL REFERENCES product_variants(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  received_quantity integer NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  unit_cost numeric(18,2) NOT NULL CHECK (unit_cost >= 0),
  line_total numeric(18,2) NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  sales_order_id uuid REFERENCES sales_orders(id),
  return_number varchar(40) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'COMPLETED'
    CHECK (status IN ('DRAFT', 'COMPLETED', 'CANCELLED')),
  refund_total numeric(18,2) NOT NULL DEFAULT 0,
  reason text,
  returned_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  UNIQUE (organization_id, return_number)
);

CREATE TABLE return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES returns(id),
  sales_order_item_id uuid REFERENCES sales_order_items(id),
  variant_id uuid NOT NULL REFERENCES product_variants(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  refund_amount numeric(18,2) NOT NULL DEFAULT 0,
  disposition varchar(20) NOT NULL DEFAULT 'RESTOCK'
    CHECK (disposition IN ('RESTOCK', 'DAMAGED', 'DISCARD'))
);

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  location_id uuid REFERENCES locations(id),
  category varchar(40) NOT NULL,
  name varchar(160) NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'MAD',
  notes text,
  incurred_on date NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  actor_id uuid REFERENCES users(id),
  action varchar(80) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type varchar(80) NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type varchar(120) NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX outbox_events_unprocessed_idx
  ON outbox_events (occurred_at) WHERE processed_at IS NULL;

INSERT INTO organizations (id, name)
VALUES ('00000000-0000-4000-8000-000000000001', 'ONight Cosmetics');

INSERT INTO locations (id, organization_id, name, code, type)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Main warehouse',
  'MAIN',
  'WAREHOUSE'
);
