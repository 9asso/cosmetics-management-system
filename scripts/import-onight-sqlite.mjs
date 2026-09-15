import "dotenv/config";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";

const sourcePath = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !existsSync(sourcePath)) {
  throw new Error(
    "Usage: node scripts/import-onight-sqlite.mjs /absolute/path/onight.db",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const organizationId = "00000000-0000-4000-8000-000000000001";
const locationId = "00000000-0000-4000-8000-000000000001";
const adminEmail = (
  process.env.IMPORT_ADMIN_EMAIL ??
  process.env.ADMIN_EMAIL ??
  "owner@onight.ma"
).toLowerCase();
const adminPassword =
  process.env.IMPORT_ADMIN_PASSWORD ??
  process.env.ADMIN_PASSWORD ??
  randomBytes(18).toString("base64url");
const adminName = process.env.IMPORT_ADMIN_NAME ?? "Admin ONight";

const sqlite = new DatabaseSync(sourcePath, { readOnly: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

const all = (sql) => sqlite.prepare(sql).all();
const inventory = all("SELECT * FROM inventaire ORDER BY id");
const sales = all("SELECT * FROM ventes ORDER BY vendu_le, id");
const purchases = all("SELECT * FROM achats ORDER BY date_achat, id");
const expenses = all("SELECT * FROM depenses ORDER BY ajoute_le, id");
const salaries = all("SELECT * FROM salaires ORDER BY ajoute_le, id");
const checks = all("SELECT * FROM cheques ORDER BY ajoute_le, id");
const returns = all("SELECT * FROM retours ORDER BY retourne_le, id");
const settings = all("SELECT * FROM parametres ORDER BY id");

const clean = (value, fallback = "") => String(value ?? "").trim() || fallback;
const clipped = (value, length, fallback = "") =>
  clean(value, fallback).slice(0, length);
const money = (value) =>
  Math.max(0, Math.round(Number(value ?? 0) * 100) / 100);
const integer = (value, minimum = 0) =>
  Math.max(minimum, Math.trunc(Number(value ?? 0)));
const isoDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(clean(value))
    ? clean(value)
    : new Date().toISOString().slice(0, 10);
const key = (value) =>
  clean(value).toLocaleLowerCase("fr").replace(/\s+/g, " ");
const category = (value) => {
  const normalized = key(value);
  if (normalized.includes("maqu")) return "MAKEUP";
  if (normalized.includes("parfum")) return "FRAGRANCE";
  if (normalized.includes("skin")) return "SKIN_CARE";
  return "HYGIENE";
};
const paymentMethod = (value) => {
  const normalized = key(value);
  if (normalized.includes("cheq")) return "CHECK";
  if (normalized.includes("virement") || normalized.includes("versement"))
    return "TRANSFER";
  if (normalized.includes("credit")) return "CREDIT";
  return "CASH";
};
const checkState = (value) => {
  const normalized = key(value);
  if (
    normalized.includes("encaiss") ||
    normalized.includes("clair") ||
    normalized.includes("pay")
  ) {
    return { payment: "COMPLETED", check: "CLEARED" };
  }
  if (normalized.includes("rej") || normalized.includes("impay")) {
    return { payment: "FAILED", check: "BOUNCED" };
  }
  if (normalized.includes("annul"))
    return { payment: "CANCELLED", check: "CANCELLED" };
  return { payment: "PENDING", check: "PENDING" };
};

async function insertPartner(table, name) {
  const result =
    table === "suppliers"
      ? await client.query(
          `INSERT INTO suppliers (organization_id,name,notes) VALUES ($1,$2,'Importé depuis onight.db') RETURNING id`,
          [organizationId, clipped(name, 160, "Fournisseur non renseigné")],
        )
      : await client.query(
          `INSERT INTO customers (organization_id,name) VALUES ($1,$2) RETURNING id`,
          [organizationId, clipped(name, 160, "Client comptoir")],
        );
  return result.rows[0].id;
}

const supplierIds = new Map();
const customerIds = new Map();
const productIds = new Map();
const variantIds = new Map();
const productByName = new Map();
const usedBarcodes = new Set();
let syntheticSequence = 0;

async function ensureSupplier(name) {
  const label = clean(name, "Fournisseur non renseigné");
  const normalized = key(label);
  if (!supplierIds.has(normalized))
    supplierIds.set(normalized, await insertPartner("suppliers", label));
  return supplierIds.get(normalized);
}

async function ensureCustomer(name) {
  const label = clean(name, "Client comptoir");
  const normalized = key(label);
  if (!customerIds.has(normalized))
    customerIds.set(normalized, await insertPartner("customers", label));
  return customerIds.get(normalized);
}

async function createProduct({
  legacyId,
  name,
  brand,
  sourceCategory = "Autre",
  purchasePrice = 0,
  salePrice = 0,
  barcode = "",
  reference = "",
  stock = 0,
  supplier = "",
  synthetic = false,
  createdAt,
}) {
  const product = await client.query(
    `INSERT INTO products (organization_id,name,brand,category,description,retail_visible,created_at)
     VALUES ($1,$2,$3,$4,$5,false,$6::date) RETURNING id`,
    [
      organizationId,
      clipped(name, 160, "Produit historique"),
      clipped(brand, 100, "Sans marque"),
      category(sourceCategory),
      synthetic
        ? "Élément historique créé pendant l'import du fichier client."
        : `Produit importé depuis l'inventaire historique #${legacyId}.`,
      isoDate(createdAt),
    ],
  );
  const normalizedBarcode = clipped(barcode, 80);
  const safeBarcode =
    normalizedBarcode && !usedBarcodes.has(normalizedBarcode)
      ? normalizedBarcode
      : null;
  if (safeBarcode) usedBarcodes.add(safeBarcode);
  const sku = legacyId
    ? `LEGACY-${legacyId}`
    : `LEGACY-HIST-${++syntheticSequence}`;
  const variant = await client.query(
    `INSERT INTO product_variants
      (product_id,sku,barcode,reference,purchase_price,wholesale_price,retail_price,low_stock_threshold)
     VALUES ($1,$2,$3,$4,$5,$6,$6,5) RETURNING id`,
    [
      product.rows[0].id,
      sku,
      safeBarcode,
      clipped(reference, 100),
      money(purchasePrice),
      money(salePrice),
    ],
  );
  const variantId = variant.rows[0].id;
  if (stock > 0) {
    await client.query(
      `INSERT INTO inventory_balances (variant_id,location_id,on_hand) VALUES ($1,$2,$3)`,
      [variantId, locationId, integer(stock)],
    );
    await client.query(
      `INSERT INTO inventory_movements
        (organization_id,variant_id,location_id,quantity_delta,reason,unit_cost,note,actor_id,created_at)
       VALUES ($1,$2,$3,$4,'OPENING_BALANCE',$5,'Solde repris depuis onight.db',$6,$7::date)`,
      [
        organizationId,
        variantId,
        locationId,
        integer(stock),
        money(purchasePrice),
        adminId,
        isoDate(createdAt),
      ],
    );
  } else {
    await client.query(
      `INSERT INTO inventory_balances (variant_id,location_id,on_hand) VALUES ($1,$2,0)`,
      [variantId, locationId],
    );
  }
  if (supplier) {
    const supplierId = await ensureSupplier(supplier);
    await client.query(
      `INSERT INTO product_supplier_links (variant_id,supplier_id,preferred) VALUES ($1,$2,true) ON CONFLICT DO NOTHING`,
      [variantId, supplierId],
    );
  }
  productByName.set(`${key(brand)}|${key(name)}`, variantId);
  return { productId: product.rows[0].id, variantId };
}

async function variantForHistory(row, source) {
  const legacyId = Number(row.produit_id ?? 0);
  if (legacyId && variantIds.has(legacyId)) return variantIds.get(legacyId);
  const named = productByName.get(`${key(row.marque)}|${key(row.produit)}`);
  if (named) return named;
  const created = await createProduct({
    name: row.produit,
    brand: row.marque,
    purchasePrice: row.prix_achat_hist,
    salePrice: row.prix_unit,
    createdAt: row.vendu_le ?? row.retourne_le,
    synthetic: true,
    reference: `${source} #${row.id}`,
  });
  return created.variantId;
}

let adminId;
try {
  await client.query("BEGIN");
  await client.query(
    `TRUNCATE TABLE
      document_history, return_items, returns, checks, payment_allocations, payments,
      sales_order_items, sales_orders, purchase_order_items, purchase_orders,
      inventory_movements, inventory_lots, inventory_balances, product_units,
      product_supplier_links, product_variants, products, customers, suppliers,
      expenses, recurring_expenses, audit_logs, outbox_events, users
     RESTART IDENTITY CASCADE`,
  );
  const admin = await client.query(
    `INSERT INTO users (organization_id,email,display_name,password_hash,role,active)
     VALUES ($1,$2,$3,crypt($4,gen_salt('bf',12)),'OWNER',true) RETURNING id`,
    [organizationId, adminEmail, adminName, adminPassword],
  );
  adminId = admin.rows[0].id;

  for (const row of inventory) {
    const created = await createProduct({
      legacyId: row.id,
      name: row.produit,
      brand: row.marque,
      sourceCategory: row.categorie,
      purchasePrice: row.prix_achat,
      salePrice: row.prix_vente,
      barcode: row.code_barre,
      reference: row.reference,
      stock: row.quantite,
      supplier: row.fournisseur,
      createdAt: row.ajoute_le,
    });
    productIds.set(Number(row.id), created.productId);
    variantIds.set(Number(row.id), created.variantId);
  }

  for (const row of purchases) await ensureSupplier(row.fournisseur);
  for (const row of sales) await ensureCustomer(row.client_nom);
  for (const row of checks) await ensureCustomer(row.nom_client);

  const saleGroups = new Map();
  for (const row of sales) {
    const groupKey = clean(row.facture_ref) || `VENTE-${row.id}`;
    if (!saleGroups.has(groupKey)) saleGroups.set(groupKey, []);
    saleGroups.get(groupKey).push(row);
  }
  for (const [reference, rows] of saleGroups) {
    const total = money(
      rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0),
    );
    const paid = Math.min(
      total,
      money(rows.reduce((sum, row) => sum + Number(row.montant_paye ?? 0), 0)),
    );
    const first = rows[0];
    const customerId = await ensureCustomer(first.client_nom);
    const status =
      total > 0 && paid >= total
        ? "PAID"
        : paid > 0
          ? "PARTIALLY_PAID"
          : "CONFIRMED";
    const order = await client.query(
      `INSERT INTO sales_orders
        (organization_id,location_id,customer_id,order_number,channel,status,subtotal,grand_total,amount_paid,placed_at,created_by,notes)
       VALUES ($1,$2,$3,$4,'WHOLESALE_DESKTOP',$5,$6,$6,$7,$8::date,$9,'Importé depuis onight.db') RETURNING id`,
      [
        organizationId,
        locationId,
        customerId,
        clipped(reference, 40),
        status,
        total,
        paid,
        isoDate(first.vendu_le),
        adminId,
      ],
    );
    for (const row of rows) {
      const variantId = await variantForHistory(row, "vente");
      await client.query(
        `INSERT INTO sales_order_items
          (sales_order_id,variant_id,description,quantity,unit_price,unit_cost_snapshot,line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          order.rows[0].id,
          variantId,
          clipped(
            `${clean(row.marque)} ${clean(row.produit)}`,
            240,
            "Produit historique",
          ),
          integer(row.quantite, 1),
          money(row.prix_unit),
          money(row.prix_achat_hist),
          money(row.total),
        ],
      );
    }
    if (paid > 0) {
      await client.query(
        `INSERT INTO payments
          (organization_id,customer_id,direction,method,status,amount,reference,paid_at,created_by,sales_order_id)
         VALUES ($1,$2,'IN',$3,'COMPLETED',$4,$5,$6::date,$7,$8)`,
        [
          organizationId,
          customerId,
          paymentMethod(first.mode_paiement),
          paid,
          clipped(reference, 120),
          isoDate(first.vendu_le),
          adminId,
          order.rows[0].id,
        ],
      );
    }
  }

  for (const row of purchases) {
    const supplierId = await ensureSupplier(row.fournisseur);
    const label = clipped(row.produit_nom, 160, `Achat historique #${row.id}`);
    const historical = await createProduct({
      name: label,
      brand: "Achat historique",
      purchasePrice:
        Number(row.prix_total ?? 0) / Math.max(1, Number(row.quantite ?? 1)),
      createdAt: row.date_achat,
      synthetic: true,
      reference: `achat #${row.id}`,
    });
    const total = money(row.prix_total);
    const paid = Math.min(total, money(row.montant_paye));
    const order = await client.query(
      `INSERT INTO purchase_orders
        (organization_id,location_id,supplier_id,order_number,status,total,amount_paid,ordered_at,created_by,notes)
       VALUES ($1,$2,$3,$4,'RECEIVED',$5,$6,$7::date,$8,$9) RETURNING id`,
      [
        organizationId,
        locationId,
        supplierId,
        `ACHAT-${row.id}`,
        total,
        paid,
        isoDate(row.date_achat),
        adminId,
        clipped(row.produit_nom, 2000),
      ],
    );
    const quantity = integer(row.quantite, 1);
    await client.query(
      `INSERT INTO purchase_order_items
        (purchase_order_id,variant_id,quantity,received_quantity,unit_cost,line_total)
       VALUES ($1,$2,$3,$3,$4,$5)`,
      [
        order.rows[0].id,
        historical.variantId,
        quantity,
        money(total / quantity),
        total,
      ],
    );
    if (paid > 0) {
      await client.query(
        `INSERT INTO payments
          (organization_id,supplier_id,direction,method,status,amount,reference,paid_at,created_by,purchase_order_id)
         VALUES ($1,$2,'OUT','CASH','COMPLETED',$3,$4,$5::date,$6,$7)`,
        [
          organizationId,
          supplierId,
          paid,
          `ACHAT-${row.id}`,
          isoDate(row.date_achat),
          adminId,
          order.rows[0].id,
        ],
      );
    }
  }

  for (const row of [...expenses, ...salaries]) {
    const isSalary = Object.hasOwn(row, "employe");
    await client.query(
      `INSERT INTO expenses
        (organization_id,location_id,category,name,amount,notes,incurred_on,created_by,expense_type,payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9,'CASH')`,
      [
        organizationId,
        locationId,
        isSalary ? "Salaire" : clipped(row.categorie, 40, "Autre"),
        clipped(isSalary ? row.employe : row.nom, 160, "Dépense historique"),
        money(row.montant),
        clipped(row.note, 2000),
        isoDate(row.ajoute_le),
        adminId,
        key(row.categorie).includes("fixe") || isSalary ? "FIXED" : "VARIABLE",
      ],
    );
  }

  for (const row of checks) {
    const state = checkState(row.statut);
    const customerId = await ensureCustomer(row.nom_client);
    const payment = await client.query(
      `INSERT INTO payments
        (organization_id,customer_id,direction,method,status,amount,reference,paid_at,created_by)
       VALUES ($1,$2,'IN','CHECK',$3,$4,$5,$6::date,$7) RETURNING id`,
      [
        organizationId,
        customerId,
        state.payment,
        money(row.montant),
        clipped(`Chèque historique #${row.id}`, 120),
        isoDate(row.ajoute_le),
        adminId,
      ],
    );
    await client.query(
      `INSERT INTO checks (payment_id,bank_name,check_number,due_date,status,cleared_at,contact_name)
       VALUES ($1,$2,$3,$4::date,$5,$6::date,$7)`,
      [
        payment.rows[0].id,
        clipped(row.banque, 120),
        clipped(row.num_cheque, 100),
        isoDate(row.date_depot),
        state.check,
        state.check === "CLEARED" ? isoDate(row.date_depot) : null,
        clipped(row.nom_client, 160),
      ],
    );
  }

  for (const row of returns) {
    const variantId = await variantForHistory(row, "retour");
    const record = await client.query(
      `INSERT INTO returns
        (organization_id,return_number,status,refund_total,reason,returned_at,created_by)
       VALUES ($1,$2,'COMPLETED',$3,'Retour importé depuis onight.db',$4::date,$5) RETURNING id`,
      [
        organizationId,
        `RETOUR-${row.id}`,
        money(row.montant_rembourse),
        isoDate(row.retourne_le),
        adminId,
      ],
    );
    await client.query(
      `INSERT INTO return_items (return_id,variant_id,quantity,refund_amount,disposition)
       VALUES ($1,$2,$3,$4,'RESTOCK')`,
      [
        record.rows[0].id,
        variantId,
        integer(row.quantite, 1),
        money(row.montant_rembourse),
      ],
    );
  }

  await client.query(
    `INSERT INTO audit_logs
      (organization_id,actor_id,action,entity_type,entity_id,after_data)
     VALUES ($1,$2,'LEGACY_DATABASE_IMPORTED','organization',$1,$3::jsonb)`,
    [
      organizationId,
      adminId,
      JSON.stringify({
        source: "onight.db",
        importedAt: new Date().toISOString(),
        legacySettings: settings,
      }),
    ],
  );

  const summary = await client.query(
    `SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM products) AS products,
      (SELECT COALESCE(sum(on_hand),0)::int FROM inventory_balances) AS stock,
      (SELECT count(*)::int FROM sales_orders) AS sales,
      (SELECT COALESCE(sum(grand_total),0)::float FROM sales_orders) AS sales_total,
      (SELECT count(*)::int FROM purchase_orders) AS purchases,
      (SELECT COALESCE(sum(total),0)::float FROM purchase_orders) AS purchase_total,
      (SELECT count(*)::int FROM expenses) AS expenses,
      (SELECT count(*)::int FROM checks) AS checks,
      (SELECT count(*)::int FROM returns) AS returns,
      (SELECT count(*)::int FROM customers) AS customers,
      (SELECT count(*)::int FROM suppliers) AS suppliers`,
  );
  await client.query("COMMIT");
  console.log(
    JSON.stringify({ adminEmail, adminPassword, ...summary.rows[0] }, null, 2),
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
  sqlite.close();
}
