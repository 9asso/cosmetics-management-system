ALTER TABLE purchase_order_items
  ADD COLUMN wholesale_price_snapshot numeric(18,2) NOT NULL DEFAULT 0 CHECK (wholesale_price_snapshot >= 0),
  ADD COLUMN retail_price_snapshot numeric(18,2) NOT NULL DEFAULT 0 CHECK (retail_price_snapshot >= 0);

UPDATE purchase_order_items i
SET wholesale_price_snapshot = v.wholesale_price,
    retail_price_snapshot = v.retail_price
FROM product_variants v
WHERE v.id = i.variant_id;

CREATE TABLE recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  location_id uuid REFERENCES locations(id),
  name varchar(160) NOT NULL,
  category varchar(40) NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  payment_method varchar(20) NOT NULL CHECK (payment_method IN ('CASH', 'CHECK', 'CREDIT')),
  day_of_month integer NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  starts_on date NOT NULL,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expenses
  ADD COLUMN expense_type varchar(12) NOT NULL DEFAULT 'VARIABLE'
    CHECK (expense_type IN ('FIXED', 'VARIABLE')),
  ADD COLUMN payment_method varchar(20) NOT NULL DEFAULT 'CASH'
    CHECK (payment_method IN ('CASH', 'CHECK', 'CREDIT')),
  ADD COLUMN recurring_expense_id uuid REFERENCES recurring_expenses(id);

CREATE UNIQUE INDEX expenses_recurring_occurrence_unique
  ON expenses (recurring_expense_id, incurred_on)
  WHERE recurring_expense_id IS NOT NULL;

CREATE INDEX recurring_expenses_due_idx
  ON recurring_expenses (organization_id, active, starts_on);
