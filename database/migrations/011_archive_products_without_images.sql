UPDATE products p
SET active = false,
    retail_visible = false,
    updated_at = now()
WHERE p.active = true
  AND NULLIF(BTRIM(COALESCE(p.image_url, '')), '') IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(p.images, '[]'::jsonb)) AS media(url)
    WHERE NULLIF(BTRIM(media.url), '') IS NOT NULL
  );
