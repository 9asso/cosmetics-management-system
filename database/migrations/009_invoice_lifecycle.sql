ALTER TABLE sales_order_items
  ADD COLUMN returned_quantity integer NOT NULL DEFAULT 0
  CHECK (returned_quantity >= 0 AND returned_quantity <= quantity);

ALTER TABLE purchase_orders
  ADD COLUMN notes text NOT NULL DEFAULT '';

CREATE TABLE document_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  document_kind varchar(12) NOT NULL CHECK (document_kind IN ('sale', 'purchase')),
  document_id uuid NOT NULL,
  event_type varchar(40) NOT NULL,
  snapshot jsonb NOT NULL,
  actor_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX document_history_document_date_idx
  ON document_history (organization_id, document_kind, document_id, created_at DESC);
