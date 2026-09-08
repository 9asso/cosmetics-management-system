import { NotFoundException } from "@nestjs/common";
import type {
  InvoiceDetail,
  InvoiceHistoryEntry,
  InvoiceSnapshot,
} from "@cosmetics/contracts";
import type { QueryResult, QueryResultRow } from "pg";
import { DEFAULT_ORGANIZATION_ID as org } from "../constants.js";

export interface InvoiceQueryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
}

export async function loadInvoiceSnapshot(
  db: InvoiceQueryable,
  kind: "sale" | "purchase",
  id: string,
): Promise<InvoiceSnapshot> {
  const sale = kind === "sale";
  const result = await db.query<
    Omit<InvoiceSnapshot, "items" | "payments" | "returns">
  >(
    `SELECT id, '${kind}' AS kind, order_number AS "documentNumber", status, partner_snapshot AS partner,
      COALESCE(partner_snapshot->>'name', '${sale ? "Client comptoir" : "Fournisseur"}') AS "partnerName",
      ${sale ? "grand_total" : "total"}::float AS total, amount_paid::float AS "amountPaid",
      COALESCE(${sale ? "placed_at" : "ordered_at"}, created_at)::text AS "issuedAt",
      ${
        sale
          ? `channel, COALESCE(notes, '') AS notes, subtotal::float,
             shipping_total::float AS "shippingTotal", tax_total::float AS "taxTotal",
             discount_total::float AS "discountTotal"`
          : `'PURCHASE' AS channel, COALESCE(notes, '') AS notes, total::float AS subtotal,
             0::float AS "shippingTotal", 0::float AS "taxTotal", 0::float AS "discountTotal"`
      }
    FROM ${sale ? "sales_orders" : "purchase_orders"}
    WHERE id=$1 AND organization_id=$2`,
    [id, org],
  );
  const header = result.rows[0];
  if (!header) throw new NotFoundException("Document introuvable.");

  const items = await db.query<InvoiceSnapshot["items"][number]>(
    sale
      ? `SELECT i.id, i.variant_id AS "variantId", i.description,
           COALESCE(p.image_url, '') AS "imageUrl", i.quantity,
           i.returned_quantity AS "returnedQuantity", i.unit_multiplier AS "unitMultiplier",
           i.unit_price::float AS "unitPrice", i.line_total::float AS "lineTotal"
         FROM sales_order_items i JOIN product_variants v ON v.id=i.variant_id
         JOIN products p ON p.id=v.product_id WHERE i.sales_order_id=$1 ORDER BY i.id`
      : `SELECT i.id, i.variant_id AS "variantId", p.name || ' · ' || v.sku AS description,
           COALESCE(p.image_url, '') AS "imageUrl", i.quantity, 0 AS "returnedQuantity",
           1 AS "unitMultiplier", i.unit_cost::float AS "unitPrice", i.line_total::float AS "lineTotal"
         FROM purchase_order_items i JOIN product_variants v ON v.id=i.variant_id
         JOIN products p ON p.id=v.product_id WHERE i.purchase_order_id=$1 ORDER BY i.id`,
    [id],
  );
  const payments = await db.query<InvoiceSnapshot["payments"][number]>(
    `SELECT id, direction, method, status, amount::float, paid_at::text AS "paidAt"
     FROM payments WHERE organization_id=$1 AND
       (${sale ? "sales_order_id" : "purchase_order_id"}=$2 OR
        (${sale ? "sales_order_id" : "purchase_order_id"} IS NULL AND reference=$3))
     ORDER BY paid_at DESC, id DESC`,
    [org, id, header.documentNumber],
  );
  const returns = sale
    ? await db.query<InvoiceSnapshot["returns"][number]>(
        `SELECT r.id, r.return_number AS "returnNumber", r.refund_total::float AS "refundTotal",
          COALESCE(r.reason, '') AS reason, r.returned_at::text AS "returnedAt",
          COALESCE(SUM(i.quantity),0)::int AS quantity
         FROM returns r LEFT JOIN return_items i ON i.return_id=r.id
         WHERE r.organization_id=$1 AND r.sales_order_id=$2 AND r.status='COMPLETED'
         GROUP BY r.id ORDER BY r.returned_at DESC`,
        [org, id],
      )
    : { rows: [] as InvoiceSnapshot["returns"] };
  return {
    ...header,
    kind,
    items: items.rows,
    payments: payments.rows,
    returns: returns.rows,
  };
}

export async function loadInvoice(
  db: InvoiceQueryable,
  kind: "sale" | "purchase",
  id: string,
): Promise<InvoiceDetail> {
  const snapshot = await loadInvoiceSnapshot(db, kind, id);
  const history = await db.query<InvoiceHistoryEntry>(
    `SELECT h.id, h.event_type AS "eventType", COALESCE(u.display_name, 'Système') AS "actorName",
      h.created_at::text AS "occurredAt", h.snapshot
     FROM document_history h LEFT JOIN users u ON u.id=h.actor_id
     WHERE h.organization_id=$1 AND h.document_kind=$2 AND h.document_id=$3
     ORDER BY h.created_at DESC, h.id DESC`,
    [org, kind, id],
  );
  return { ...snapshot, history: history.rows };
}

export async function captureInvoiceHistory(
  db: InvoiceQueryable,
  kind: "sale" | "purchase",
  id: string,
  eventType: string,
  actorId: string,
) {
  const snapshot = await loadInvoiceSnapshot(db, kind, id);
  await db.query(
    `INSERT INTO document_history
      (organization_id,document_kind,document_id,event_type,snapshot,actor_id,created_at)
     VALUES($1,$2,$3,$4,$5::jsonb,$6,clock_timestamp())`,
    [org, kind, id, eventType, JSON.stringify(snapshot), actorId],
  );
}

export async function ensureInitialInvoiceHistory(
  db: InvoiceQueryable,
  kind: "sale" | "purchase",
  id: string,
  actorId: string,
) {
  const found = await db.query(
    `SELECT 1 FROM document_history
     WHERE organization_id=$1 AND document_kind=$2 AND document_id=$3 LIMIT 1`,
    [org, kind, id],
  );
  if (!found.rowCount)
    await captureInvoiceHistory(db, kind, id, "INITIAL_STATE", actorId);
}
