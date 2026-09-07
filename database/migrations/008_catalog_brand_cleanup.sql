-- Remove source promotions from the imported demo catalogue; preserve business history.
UPDATE products SET
 description = trim(regexp_replace(description, '[^\n]*[Zz]wine[^\n]*', '', 'g')),
 source_url = '',
 image_url = replace(image_url, '/products/zwine/', '/products/catalog/'),
 images = replace(images::text, '/products/zwine/', '/products/catalog/')::jsonb
WHERE source_url ILIKE '%zwine.ma%' OR image_url LIKE '/products/zwine/%';
UPDATE suppliers SET name = 'Catalogue Démo', email = '', notes = 'Catalogue de démonstration'
WHERE id = '10000000-0000-4000-8000-00000000a001' AND name = 'Catalogue Démo Zwine';
UPDATE product_variants SET sku = regexp_replace(sku, '^ZWN-', 'DEMO-'), reference = regexp_replace(reference, '^ZWINE-', 'CAT-')
WHERE sku LIKE 'ZWN-%' AND reference LIKE 'ZWINE-%';
