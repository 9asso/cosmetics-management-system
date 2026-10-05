import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";

const sourcePath = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !existsSync(sourcePath)) {
  throw new Error(
    "Usage: node scripts/restore-onight-receivables.mjs /absolute/path/onight.db",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const organizationId = "00000000-0000-4000-8000-000000000001";
const locationId = "00000000-0000-4000-8000-000000000001";
const marker = "Crédit client restauré depuis onight.db";
const sqlite = new DatabaseSync(sourcePath, { readOnly: true });
const sales = sqlite
  .prepare("SELECT * FROM ventes ORDER BY vendu_le, id")
  .all();

const clean = (value, fallback = "") => String(value ?? "").trim() || fallback;
const money = (value) =>
  Math.max(0, Math.round(Number(value ?? 0) * 100) / 100);
const isoDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(clean(value))
    ? clean(value)
    : new Date().toISOString().slice(0, 10);
const clipped = (value, length, fallback = "") =>
  clean(value, fallback).slice(0, length);

const grouped = new Map();
for (const row of sales) {
  const reference = clean(row.facture_ref) || `VENTE-${row.id}`;
  if (!grouped.has(reference)) grouped.set(reference, []);
  grouped.get(reference).push(row);
}
const receivables = [...grouped.entries()]
  .map(([reference, rows]) => {
    const total = money(
      rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0),
    );
    const paid = Math.min(
      total,
      money(rows.reduce((sum, row) => sum + Number(row.montant_paye ?? 0), 0)),
    );
    return {
      reference,
      total,
      paid,
      customerName: clipped(rows[0]?.client_nom, 160, "Client comptoir"),
      placedAt: isoDate(rows[0]?.vendu_le),
    };
  })
  .filter((invoice) => invoice.total > invoice.paid);

const expectedBalance = money(
  receivables.reduce((sum, invoice) => sum + invoice.total - invoice.paid, 0),
);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const previous = await client.query(
    "SELECT count(*)::int AS count FROM sales_orders WHERE notes=$1",
    [marker],
  );
  if (previous.rows[0].count > 0) {
    throw new Error(
      `Receivables were already restored (${previous.rows[0].count} rows); refusing to duplicate them.`,
    );
  }
  const owner = await client.query(
    `SELECT id FROM users
     WHERE organization_id=$1 AND role='OWNER' AND active=true
     ORDER BY created_at LIMIT 1`,
    [organizationId],
  );
  if (!owner.rows[0]) throw new Error("No active owner exists in production");

  let renamed = 0;
  for (const [index, invoice] of receivables.entries()) {
    let orderNumber = clipped(invoice.reference, 40, `CREDIT-${index + 1}`);
    const conflict = await client.query(
      "SELECT 1 FROM sales_orders WHERE organization_id=$1 AND order_number=$2",
      [organizationId, orderNumber],
    );
    if (conflict.rows[0]) {
      orderNumber = clipped(
        `${orderNumber.slice(0, 28)}-CREDIT-${index + 1}`,
        40,
      );
      renamed += 1;
    }
    const inserted = await client.query(
      `INSERT INTO sales_orders
        (organization_id,location_id,customer_id,order_number,channel,status,
         subtotal,grand_total,amount_paid,placed_at,created_by,notes)
       VALUES ($1,$2,NULL,$3,'MANUAL',$4,$5,$5,$6,$7::date,$8,$9)
       RETURNING id`,
      [
        organizationId,
        locationId,
        orderNumber,
        invoice.paid > 0 ? "PARTIALLY_PAID" : "CONFIRMED",
        invoice.total,
        invoice.paid,
        invoice.placedAt,
        owner.rows[0].id,
        marker,
      ],
    );
    await client.query(
      `UPDATE sales_orders
       SET partner_snapshot=jsonb_build_object(
         'name',$2::text,'phone','','email','','address',''
       )
       WHERE id=$1`,
      [inserted.rows[0].id, invoice.customerName],
    );
  }

  const restored = await client.query(
    `SELECT count(*)::int AS count,
      COALESCE(sum(GREATEST(0,grand_total-amount_paid)),0)::float AS balance
     FROM sales_orders WHERE notes=$1`,
    [marker],
  );
  if (
    restored.rows[0].count !== receivables.length ||
    Number(restored.rows[0].balance) !== expectedBalance
  ) {
    throw new Error("Restored Credits clients totals do not match onight.db");
  }
  await client.query(
    `INSERT INTO audit_logs
      (organization_id,actor_id,action,entity_type,entity_id,after_data)
     VALUES ($1,$2,'LEGACY_RECEIVABLES_RESTORED','organization',$1,$3::jsonb)`,
    [
      organizationId,
      owner.rows[0].id,
      JSON.stringify({
        source: "onight.db",
        invoices: receivables.length,
        balance: expectedBalance,
        renamedOrderNumbers: renamed,
      }),
    ],
  );
  await client.query("COMMIT");
  console.log(
    JSON.stringify(
      {
        restoredInvoices: receivables.length,
        restoredBalance: expectedBalance,
        renamedOrderNumbers: renamed,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
  sqlite.close();
}
