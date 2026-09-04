-- Uploaded files are normalized to WebP by the API before storage.
CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  data bytea NOT NULL CHECK (octet_length(data) <= 2097152),
  created_at timestamptz NOT NULL DEFAULT now()
);
