import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogUrl = process.env.DEMO_CATALOG_URL;
if (!catalogUrl) throw new Error('Set DEMO_CATALOG_URL to the authorized demo catalogue JSON endpoint.');
const imageDirectory = join(repoRoot, 'apps/storefront/public/products/catalog');
const sqlPath = join(repoRoot, 'database/seeds/catalog-demo.sql');
const organizationId = '00000000-0000-4000-8000-000000000001';
const locationId = '00000000-0000-4000-8000-000000000001';
const supplierId = '10000000-0000-4000-8000-00000000a001';
const targetCount = 60;
const categoryCaps = { SKIN_CARE: 18, MAKEUP: 12, FRAGRANCE: 10, HAIR: 10, BATH_BODY: 10 };

function uuid(namespace, value) {
  const hex = createHash('sha256').update(`${namespace}:${value}`).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

function decodeHtml(text) {
  const entities = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', eacute: 'é', agrave: 'à', egrave: 'è', ecirc: 'ê', rsquo: '’' };
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, key) => {
    if (key.startsWith('#x')) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith('#')) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    return entities[key.toLowerCase()] ?? match;
  });
}

function plainText(html = '') {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 2000);
}

function inferCategory(product) {
  const text = `${product.title} ${(product.tags ?? []).join(' ')}`.toLowerCase();
  if (/pinceau|éponge|sponge|trousse|makeup bag/.test(text)) return 'MAKEUP';
  if (/mascara|lip|rouge à lèvres|blush|poudre|powder|concealer|foundation|eyeliner|palette|makeup|maquillage|gloss|brow/.test(text)) return 'MAKEUP';
  if (/parfum|perfume|fragrance|eau de parfum|body mist|brume parfumée|cheirosa/.test(text)) return 'FRAGRANCE';
  if (/shampoo|shampoing|cheveu|cheveux|hair|scalp|conditioner|après-shampoing|capillaire|brush|brosse/.test(text)) return 'HAIR';
  if (/body|corps|bronz|gommage|scrub|bain|douche/.test(text)) return 'BATH_BODY';
  if (/déodorant|deodorant|hygiène|intime/.test(text)) return 'HYGIENE';
  return 'SKIN_CARE';
}

function brandFromTitle(title) {
  const first = title.split(/\s+-\s+/)[0]?.trim() || 'Catalogue Selection';
  return first.replace(/\s+/g, ' ').slice(0, 100);
}

function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function download(product) {
  const source = product.images[0].src;
  const filename = `${product.handle.slice(0, 100)}-${product.id}.webp`.replace(/[^a-z0-9._-]/gi, '-');
  const output = join(imageDirectory, filename);
  const url = new URL(source);
  url.searchParams.set('width', '700');
  const response = await fetch(url, { headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg' } });
  if (!response.ok) throw new Error(`Image ${response.status}: ${product.title}`);
  await writeFile(output, Buffer.from(await response.arrayBuffer()));
  return `/products/catalog/${filename}`;
}

const response = await fetch(catalogUrl, { headers: { Accept: 'application/json' } });
if (!response.ok) throw new Error(`Demo catalog request failed with ${response.status}`);
const { products: rawProducts } = await response.json();
const candidates = rawProducts.filter((product) => product.images?.[0]?.src && product.variants?.some((variant) => Number(variant.price) > 0));
const counts = Object.fromEntries(Object.keys(categoryCaps).map((category) => [category, 0]));
const selected = [];
for (const product of candidates) {
  const category = inferCategory(product);
  if (selected.length < targetCount && counts[category] < categoryCaps[category]) {
    selected.push({ ...product, category });
    counts[category] += 1;
  }
}
for (const product of candidates) {
  if (selected.length >= targetCount) break;
  if (!selected.some((item) => item.id === product.id)) selected.push({ ...product, category: inferCategory(product) });
}

await mkdir(imageDirectory, { recursive: true });
const imported = [];
for (let offset = 0; offset < selected.length; offset += 6) {
  const batch = selected.slice(offset, offset + 6);
  imported.push(...await Promise.all(batch.map(async (product) => ({ ...product, localImage: await download(product) }))));
  process.stdout.write(`Downloaded ${Math.min(offset + batch.length, selected.length)}/${selected.length} images\n`);
}

const lines = [
  'BEGIN;',
  '',
  `INSERT INTO suppliers (id, organization_id, name, email, notes) VALUES (${sql(supplierId)}, ${sql(organizationId)}, 'Catalogue Démo', 'contact@catalog-demo.invalid', 'Catalogue de démonstration') ON CONFLICT (id) DO NOTHING;`,
  '',
];

for (const [index, product] of imported.entries()) {
  const variant = product.variants.find((item) => item.available) ?? product.variants[0];
  const retailPrice = Number(variant.price);
  const compareAtPrice = variant.compare_at_price ? Number(variant.compare_at_price) : null;
  const purchasePrice = Math.round(retailPrice * 0.58 * 100) / 100;
  const wholesalePrice = Math.round(retailPrice * 0.78 * 100) / 100;
  const quantity = 18 + ((index * 11) % 75);
  const productId = uuid('catalog-product', product.id);
  const variantId = uuid('catalog-variant', variant.id);
  const name = product.title.replace(/\s+/g, ' ').trim().slice(0, 160);
  const sourceUrl = '';
  const sku = `DEMO-${product.id}`.slice(0, 80);
  const reference = `CAT-${product.id}`.slice(0, 100);
  const description = plainText(product.body_html) || `${name}. Produit de démonstration importé du catalogue de démonstration.`;
  lines.push(
    `INSERT INTO products (id, organization_id, name, brand, category, description, image_url, source_url, retail_visible) VALUES (${sql(productId)}, ${sql(organizationId)}, ${sql(name)}, ${sql(brandFromTitle(product.title))}, ${sql(product.category)}, ${sql(description)}, ${sql(product.localImage)}, ${sql(sourceUrl)}, true) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, brand=EXCLUDED.brand, category=EXCLUDED.category, description=EXCLUDED.description, source_url=EXCLUDED.source_url, retail_visible=true, updated_at=now();`,
    `INSERT INTO product_variants (id, product_id, sku, reference, purchase_price, wholesale_price, retail_price, compare_at_price, low_stock_threshold) VALUES (${sql(variantId)}, ${sql(productId)}, ${sql(sku)}, ${sql(reference)}, ${purchasePrice}, ${wholesalePrice}, ${retailPrice}, ${compareAtPrice ?? 'NULL'}, 8) ON CONFLICT (id) DO UPDATE SET purchase_price=EXCLUDED.purchase_price, wholesale_price=EXCLUDED.wholesale_price, retail_price=EXCLUDED.retail_price, compare_at_price=EXCLUDED.compare_at_price, updated_at=now();`,
    `INSERT INTO product_supplier_links (variant_id, supplier_id, preferred) VALUES (${sql(variantId)}, ${sql(supplierId)}, true) ON CONFLICT DO NOTHING;`,
    `INSERT INTO inventory_balances (variant_id, location_id, on_hand, reserved) VALUES (${sql(variantId)}, ${sql(locationId)}, ${quantity}, 0) ON CONFLICT (variant_id, location_id) DO NOTHING;`,
    `INSERT INTO inventory_movements (organization_id, variant_id, location_id, quantity_delta, reason, unit_cost, note) SELECT ${sql(organizationId)}, ${sql(variantId)}, ${sql(locationId)}, ${quantity}, 'OPENING_BALANCE', ${purchasePrice}, 'Stock initial du catalogue démo' WHERE NOT EXISTS (SELECT 1 FROM inventory_movements WHERE variant_id=${sql(variantId)} AND reason='OPENING_BALANCE');`,
    '',
  );
}
lines.push("UPDATE products SET images = jsonb_build_array(image_url) WHERE images = '[]'::jsonb AND image_url <> '';", 'COMMIT;', '');
await writeFile(sqlPath, lines.join('\n'));
process.stdout.write(`Imported ${imported.length} products into ${sqlPath}\n`);
process.stdout.write(`${JSON.stringify(counts)}\n`);
