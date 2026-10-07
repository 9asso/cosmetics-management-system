import "dotenv/config";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { Pool } from "pg";

const organizationId = "00000000-0000-4000-8000-000000000001";
const locationId = "00000000-0000-4000-8000-000000000001";
const sourcePath = resolve(
  process.argv.find((argument) => argument.endsWith(".db")) ??
    "/Users/macbook/Downloads/onight.db",
);
const apply = process.argv.includes("--apply");
const confirmation = "RESET_TO_853_ONIGHT_PRODUCTS";

function uuid(namespace, value) {
  const bytes = createHash("sha256")
    .update(`${namespace}:${value}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  bytes[12] = "4";
  bytes[16] = ["8", "9", "a", "b"][Number.parseInt(bytes[16], 16) % 4];
  return `${bytes.slice(0, 8).join("")}-${bytes.slice(8, 12).join("")}-${bytes.slice(12, 16).join("")}-${bytes.slice(16, 20).join("")}-${bytes.slice(20).join("")}`;
}

function category(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "maquillage") return "MAKEUP";
  if (normalized === "parfum") return "FRAGRANCE";
  if (normalized === "skin care") return "SKIN_CARE";
  return "HYGIENE";
}

function slug(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55);
}

const rows = JSON.parse(
  execFileSync(
    "sqlite3",
    [
      "-readonly",
      "-json",
      sourcePath,
      `SELECT id, code_barre, marque, produit, categorie, quantite,
        prix_achat, prix_vente, ajoute_le, reference
       FROM inventaire ORDER BY id`,
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  ),
);

const seenBarcodes = new Set();
const products = rows.map((row) => {
  const rawBarcode = String(row.code_barre ?? "").trim();
  const barcode = rawBarcode && !seenBarcodes.has(rawBarcode) ? rawBarcode : "";
  if (barcode) seenBarcodes.add(barcode);
  const name = String(row.produit ?? "").trim() || `Produit ${row.id}`;
  const brand = String(row.marque ?? "").trim() || "Sans marque";
  return {
    sourceId: Number(row.id),
    productId: uuid("onight-product", row.id),
    variantId: uuid("onight-variant", row.id),
    name: name.slice(0, 160),
    brand: brand.slice(0, 100),
    category: category(row.categorie),
    description: `Produit importé depuis l'inventaire ONight #${row.id}.`,
    sku: `${slug(`${brand}-${name}`) || "PRODUIT"}-${row.id}`.slice(0, 80),
    barcode,
    reference: String(row.reference ?? "")
      .trim()
      .slice(0, 100),
    quantity: Math.max(0, Number.parseInt(row.quantite ?? 0, 10) || 0),
    purchasePrice: Math.max(0, Number(row.prix_achat) || 0),
    salePrice: Math.max(0, Number(row.prix_vente) || 0),
    createdAt: /^\d{4}-\d{2}-\d{2}$/.test(String(row.ajoute_le ?? ""))
      ? `${row.ajoute_le}T00:00:00Z`
      : new Date().toISOString(),
  };
});

const categories = Object.fromEntries(
  [...new Set(products.map((product) => product.category))].map((name) => [
    name,
    products.filter((product) => product.category === name).length,
  ]),
);
process.stdout.write(
  `${JSON.stringify({ sourcePath, products: products.length, categories }, null, 2)}\n`,
);

if (!apply) {
  process.stdout.write(
    `Preview only. Set PRODUCTS_ONLY_RESET_CONFIRM=${confirmation} and add --apply to replace the target database.\n`,
  );
  process.exit(0);
}

if (process.env.PRODUCTS_ONLY_RESET_CONFIRM !== confirmation) {
  throw new Error(`PRODUCTS_ONLY_RESET_CONFIRM must equal ${confirmation}`);
}
for (const name of ["DATABASE_URL", "ADMIN_EMAIL", "ADMIN_PASSWORD"]) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl:
    process.env.DATABASE_SSL === "disable"
      ? false
      : { rejectUnauthorized: false },
});
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(`
    TRUNCATE TABLE
      return_items, returns, payment_allocations, checks, payments,
      sales_order_items, sales_orders, purchase_order_items, purchase_orders,
      expenses, recurring_expenses, document_history,
      inventory_movements, inventory_lots, inventory_balances,
      product_supplier_links, product_units, product_media_assets, product_images,
      product_variants, products, customers, suppliers,
      audit_logs, outbox_events, users, locations, organizations
    RESTART IDENTITY CASCADE
  `);
  await client.query(
    `INSERT INTO organizations (id,name,legal_name,currency,timezone)
     VALUES ($1,'ONight Business','ONight Business','MAD','Africa/Casablanca')`,
    [organizationId],
  );
  await client.query(
    `INSERT INTO locations (id,organization_id,name,code,type)
     VALUES ($1,$2,'Stock principal','MAIN','WAREHOUSE')`,
    [locationId, organizationId],
  );
  await client.query(
    `INSERT INTO users
      (organization_id,email,display_name,password_hash,role,active)
     VALUES ($1,lower($2),'Admin ONight',crypt($3,gen_salt('bf',12)),'OWNER',true)`,
    [organizationId, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD],
  );

  for (const product of products) {
    await client.query(
      `INSERT INTO products
        (id,organization_id,name,brand,category,subcategory,description,
         retail_visible,active,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,'',$6,false,true,$7,$7)`,
      [
        product.productId,
        organizationId,
        product.name,
        product.brand,
        product.category,
        product.description,
        product.createdAt,
      ],
    );
    await client.query(
      `INSERT INTO product_variants
        (id,product_id,sku,barcode,reference,purchase_price,wholesale_price,
         retail_price,low_stock_threshold,active,created_at,updated_at)
       VALUES ($1,$2,$3,NULLIF($4,''),$5,$6,$7,$7,5,true,$8,$8)`,
      [
        product.variantId,
        product.productId,
        product.sku,
        product.barcode,
        product.reference,
        product.purchasePrice,
        product.salePrice,
        product.createdAt,
      ],
    );
    await client.query(
      `INSERT INTO inventory_balances
        (variant_id,location_id,on_hand,reserved,version)
       VALUES ($1,$2,$3,0,0)`,
      [product.variantId, locationId, product.quantity],
    );
  }

  const result = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM products WHERE active=true) AS products,
      (SELECT COUNT(*)::int FROM users WHERE active=true) AS users,
      (SELECT COUNT(*)::int FROM customers) AS customers,
      (SELECT COUNT(*)::int FROM suppliers) AS suppliers,
      (SELECT COUNT(*)::int FROM sales_orders) AS sales,
      (SELECT COUNT(*)::int FROM purchase_orders) AS purchases,
      (SELECT COUNT(*)::int FROM payments) AS payments,
      (SELECT COUNT(*)::int FROM expenses) AS expenses
  `);
  if (
    result.rows[0].products !== products.length ||
    result.rows[0].users !== 1
  ) {
    throw new Error("Products-only verification failed; rolling back");
  }
  await client.query("COMMIT");
  process.stdout.write(`${JSON.stringify(result.rows[0], null, 2)}\n`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
