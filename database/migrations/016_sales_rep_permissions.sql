ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('OWNER', 'MANAGER', 'CASHIER', 'WAREHOUSE', 'ACCOUNTANT', 'SALES_REP', 'STAFF'));

ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);
CREATE INDEX IF NOT EXISTS customers_created_by_idx ON customers (organization_id, created_by)
  WHERE active = true;
