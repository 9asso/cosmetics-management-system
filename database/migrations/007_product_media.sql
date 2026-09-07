ALTER TABLE products ADD COLUMN images jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN video_url text NOT NULL DEFAULT '';
UPDATE products SET images = jsonb_build_array(image_url) WHERE image_url <> '';
ALTER TABLE products ADD CONSTRAINT product_images_array CHECK (jsonb_typeof(images) = 'array' AND jsonb_array_length(images) <= 10);
CREATE TABLE product_media_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES organizations(id),
 mime_type text NOT NULL CHECK (mime_type IN ('image/webp', 'video/mp4', 'video/webm')),
 data bytea NOT NULL CHECK (octet_length(data) > 0 AND octet_length(data) <= 31457280),
 created_at timestamptz NOT NULL DEFAULT now()
);
