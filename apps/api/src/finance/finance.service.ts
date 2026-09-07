import { recordPaymentSchema, createExpenseSchema } from "@cosmetics/contracts";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateExpenseInput,
  ExpenseItem,
  FinanceBalance,
  FinanceCheck,
  FinanceQuery,
  FinanceSummary,
  Paginated,
  RecordPaymentInput,
  UpdateCheckInput,
} from "@cosmetics/contracts";
import type { PoolClient } from "pg";
import {
  DEFAULT_LOCATION_ID,
  DEFAULT_ORGANIZATION_ID as org,
} from "../constants.js";
import { DatabaseService } from "../database/database.service.js";

const eligibleSales =
  "('CONFIRMED','PARTIALLY_PAID','PAID','DELIVERED','FULFILLED')";
const cents = (value: number) => Math.round(value * 100);

@Injectable()
export class FinanceService {
  constructor(private readonly db: DatabaseService) {}

  async summary(): Promise<FinanceSummary> {
    const result = await this.db.query<FinanceSummary>(
      `SELECT
      (SELECT COALESCE(SUM(GREATEST(0,grand_total-amount_paid)),0)::float FROM sales_orders WHERE organization_id=$1 AND status IN ${eligibleSales}) AS receivables,
      (SELECT COALESCE(SUM(GREATEST(0,total-amount_paid)),0)::float FROM purchase_orders WHERE organization_id=$1 AND status IN ('RECEIVED','PARTIALLY_RECEIVED')) AS payables,
      (SELECT COUNT(*)::int FROM payments WHERE organization_id=$1 AND method='CHECK' AND status='PENDING') AS "pendingChecks",
      (SELECT COALESCE(SUM(amount),0)::float FROM payments WHERE organization_id=$1 AND method='CHECK' AND status='PENDING') AS "pendingCheckAmount",
      (SELECT COUNT(*)::int FROM checks c JOIN payments p ON p.id=c.payment_id WHERE p.organization_id=$1 AND p.status='PENDING' AND c.due_date <= (now() AT TIME ZONE 'Africa/Casablanca')::date) AS "dueChecks",
      (SELECT COALESCE(SUM(amount),0)::float FROM expenses WHERE organization_id=$1 AND voided_at IS NULL AND incurred_on BETWEEN date_trunc('month',now() AT TIME ZONE 'Africa/Casablanca')::date AND (now() AT TIME ZONE 'Africa/Casablanca')::date) AS "monthExpenses",
      (SELECT COALESCE(SUM(amount),0)::float FROM payments WHERE organization_id=$1 AND direction='IN' AND status='COMPLETED' AND paid_at >= date_trunc('month',now() AT TIME ZONE 'Africa/Casablanca') AT TIME ZONE 'Africa/Casablanca' AND paid_at <= now()) AS "monthIncoming",
      (SELECT COALESCE(SUM(amount),0)::float FROM payments WHERE organization_id=$1 AND direction='OUT' AND status='COMPLETED' AND paid_at >= date_trunc('month',now() AT TIME ZONE 'Africa/Casablanca') AT TIME ZONE 'Africa/Casablanca' AND paid_at <= now()) AS "monthOutgoing"`,
      [org],
    );
    return result.rows[0]!;
  }

  private async page<
    T extends
      Record<string, unknown> | FinanceBalance | FinanceCheck | ExpenseItem,
  >(
    sql: string,
    values: unknown[],
    query: FinanceQuery,
  ): Promise<Paginated<T>> {
    // Count independently so an empty/out-of-range page retains the correct total.
    const result = await this.db.query<{ items: T[]; total: number }>(
      `WITH filtered AS (${sql}) SELECT
      (SELECT COUNT(*)::int FROM filtered) AS total,
      COALESCE((SELECT jsonb_agg(row) FROM (SELECT * FROM filtered LIMIT $${values.length + 1} OFFSET $${values.length + 2}) row),'[]'::jsonb) AS items`,
      [...values, query.pageSize, (query.page - 1) * query.pageSize],
    );
    return { ...result.rows[0]!, page: query.page, pageSize: query.pageSize };
  }

  balances(query: FinanceQuery) {
    const sale = query.kind === "sale";
    return this.page<FinanceBalance>(
      `SELECT d.id, '${query.kind}' AS kind, d.order_number AS "documentNumber",
      COALESCE(d.partner_snapshot->>'name','Contact non renseigné') AS "partnerName", COALESCE(d.partner_snapshot->>'phone','') AS phone,
      ${sale ? "grand_total" : "total"}::float AS total, amount_paid::float AS "amountPaid", p.pending::float AS "pendingAmount",
      (${sale ? "grand_total" : "total"}-amount_paid)::float AS balance,
      GREATEST(0,${sale ? "grand_total" : "total"}-amount_paid-p.pending)::float AS "availableToPay",
      COALESCE(${sale ? "placed_at" : "ordered_at"},d.created_at)::text AS "issuedAt",
      GREATEST(0,(now() AT TIME ZONE 'Africa/Casablanca')::date - (COALESCE(${sale ? "placed_at" : "ordered_at"},d.created_at) AT TIME ZONE 'Africa/Casablanca')::date)::int AS "ageDays"
      FROM ${sale ? "sales_orders" : "purchase_orders"} d
      CROSS JOIN LATERAL (SELECT COALESCE(SUM(amount),0) AS pending FROM payments WHERE ${sale ? "sales_order_id" : "purchase_order_id"}=d.id AND status='PENDING' AND method='CHECK') p
      WHERE d.organization_id=$1 AND d.status IN ${sale ? eligibleSales : "('RECEIVED','PARTIALLY_RECEIVED')"}
      AND ${sale ? "grand_total" : "total"} > amount_paid AND (d.order_number ILIKE $2 OR d.partner_snapshot->>'name' ILIKE $2)
      ORDER BY COALESCE(${sale ? "placed_at" : "ordered_at"},d.created_at), d.id`,
      [org, `%${query.search}%`],
      query,
    );
  }

  checks(query: FinanceQuery) {
    return this.page<FinanceCheck>(
      `SELECT p.id, CASE WHEN p.sales_order_id IS NOT NULL THEN 'sale' WHEN p.purchase_order_id IS NOT NULL THEN 'purchase' END AS kind,
      COALESCE(p.sales_order_id,p.purchase_order_id) AS "documentId", COALESCE(p.reference,'Sans référence') AS "documentNumber",
      COALESCE(s.partner_snapshot->>'name',b.partner_snapshot->>'name',cu.name,su.name,'Contact non renseigné') AS "partnerName",
      p.direction, p.amount::float, COALESCE(c.bank_name,'') AS "bankName", COALESCE(c.check_number,'') AS "checkNumber", c.due_date::text AS "dueDate",
      CASE WHEN p.status='COMPLETED' THEN 'CLEARED' WHEN p.status='FAILED' THEN 'BOUNCED' WHEN p.status='CANCELLED' THEN 'CANCELLED' ELSE COALESCE(c.status,'PENDING') END AS status,
      COALESCE(s.status,b.status) AS "documentStatus"
      FROM payments p LEFT JOIN checks c ON c.payment_id=p.id LEFT JOIN sales_orders s ON s.id=p.sales_order_id LEFT JOIN purchase_orders b ON b.id=p.purchase_order_id
      LEFT JOIN customers cu ON cu.id=p.customer_id LEFT JOIN suppliers su ON su.id=p.supplier_id
      WHERE p.organization_id=$1 AND p.method='CHECK' AND ($2='all' OR p.status='PENDING')
      AND (COALESCE(p.reference,'') ILIKE $3 OR COALESCE(c.check_number,'') ILIKE $3 OR COALESCE(s.partner_snapshot->>'name',b.partner_snapshot->>'name',cu.name,su.name,'') ILIKE $3)
      ORDER BY (p.status='PENDING') DESC,c.due_date ASC NULLS FIRST,p.created_at,p.id`,
      [org, query.status, `%${query.search}%`],
      query,
    );
  }

  expenses(query: FinanceQuery) {
    return this.page<ExpenseItem>(
      `SELECT id,name,category,amount::float,incurred_on::text AS "incurredOn",COALESCE(notes,'') AS notes,voided_at::text AS "voidedAt",void_reason AS "voidReason"
      FROM expenses WHERE organization_id=$1 AND (name ILIKE $2 OR category ILIKE $2) ORDER BY incurred_on DESC,created_at DESC,id`,
      [org, `%${query.search}%`],
      query,
    );
  }

  private async document(
    client: PoolClient,
    kind: "sale" | "purchase",
    id: string,
  ) {
    const sale = kind === "sale";
    const result = await client.query<{
      id: string;
      total: number;
      amountPaid: number;
      partnerId: string | null;
      documentNumber: string;
      status: string;
      channel: string;
    }>(
      `SELECT id,${sale ? "grand_total" : "total"}::float AS total,amount_paid::float AS "amountPaid",${sale ? "customer_id" : "supplier_id"} AS "partnerId",order_number AS "documentNumber",status,${sale ? "channel" : "'PURCHASE'"} AS channel
      FROM ${sale ? "sales_orders" : "purchase_orders"} WHERE id=$1 AND organization_id=$2 FOR UPDATE`,
      [id, org],
    );
    const doc = result.rows[0];
    if (!doc) throw new NotFoundException("Document introuvable.");
    return doc;
  }

  private ensurePayable(doc: { status: string; channel: string }) {
    if (
      ![
        "CONFIRMED",
        "PARTIALLY_PAID",
        "PAID",
        "DELIVERED",
        "FULFILLED",
        "RECEIVED",
        "PARTIALLY_RECEIVED",
      ].includes(doc.status)
    )
      throw new BadRequestException(
        "Ce document ne peut pas recevoir de règlement.",
      );
    if (
      doc.channel === "RETAIL_WEB" &&
      !["DELIVERED", "FULFILLED"].includes(doc.status)
    )
      throw new BadRequestException(
        "Le paiement COD est enregistré lors de la livraison.",
      );
  }

  private async applyAmount(
    client: PoolClient,
    kind: "sale" | "purchase",
    id: string,
    amount: number,
  ) {
    await client.query(
      `UPDATE ${kind === "sale" ? "sales_orders" : "purchase_orders"} SET amount_paid=amount_paid+$2,updated_at=now()
      ${kind === "sale" ? ", status=CASE WHEN status IN ('DELIVERED','FULFILLED') THEN status WHEN amount_paid+$2 >= grand_total THEN 'PAID' ELSE 'PARTIALLY_PAID' END" : ""} WHERE id=$1`,
      [id, amount],
    );
  }

  async recordPayment(
    kind: "sale" | "purchase",
    id: string,
    input: RecordPaymentInput,
    actorId: string,
  ) {
    input = recordPaymentSchema.parse(input);
    return this.db.withTransaction(async (client) => {
      // Serialize retries even when the same request ID is submitted for different documents.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [`${org}:${input.requestId}`],
      );
      const previous = await client.query<{
        id: string;
        amount: number;
        method: string;
        documentId: string;
        bankName: string | null;
        checkNumber: string | null;
        dueDate: string | null;
      }>(
        `SELECT p.id,amount::float,method,${kind === "sale" ? "sales_order_id" : "purchase_order_id"} AS "documentId", c.bank_name AS "bankName",c.check_number AS "checkNumber",c.due_date::text AS "dueDate" FROM payments p LEFT JOIN checks c ON c.payment_id=p.id WHERE organization_id=$1 AND request_id=$2`,
        [org, input.requestId],
      );
      if (previous.rows[0]) {
        const row = previous.rows[0];
        if (
          row.documentId !== id ||
          row.amount !== input.amount ||
          row.method !== input.method ||
          (input.method === "CHECK" &&
            (row.bankName !== input.check?.bankName ||
              row.checkNumber !== input.check?.checkNumber ||
              row.dueDate !== input.check?.dueDate))
        )
          throw new ConflictException(
            "Cette demande a déjà été utilisée pour un autre règlement.",
          );
        return { id: row.id };
      }
      const doc = await this.document(client, kind, id);
      this.ensurePayable(doc);
      const pending = await client.query<{ amount: number }>(
        `SELECT COALESCE(SUM(amount),0)::float AS amount FROM payments WHERE ${kind === "sale" ? "sales_order_id" : "purchase_order_id"}=$1 AND method='CHECK' AND status='PENDING'`,
        [id],
      );
      if (
        cents(input.amount) >
        cents(doc.total) -
          cents(doc.amountPaid) -
          cents(pending.rows[0]!.amount)
      )
        throw new BadRequestException(
          "Le montant dépasse le solde disponible (chèques en attente déduits).",
        );
      const payment = await client.query<{ id: string }>(
        `INSERT INTO payments (organization_id,${kind === "sale" ? "customer_id" : "supplier_id"},direction,method,status,amount,reference,created_by,${kind === "sale" ? "sales_order_id" : "purchase_order_id"},request_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          org,
          doc.partnerId,
          kind === "sale" ? "IN" : "OUT",
          input.method,
          input.method === "CHECK" ? "PENDING" : "COMPLETED",
          input.amount,
          doc.documentNumber,
          actorId,
          id,
          input.requestId,
        ],
      );
      const paymentId = payment.rows[0]!.id;
      if (input.method === "CHECK") {
        if (!input.check)
          throw new BadRequestException("Informations du chèque requises.");
        await client.query(
          `INSERT INTO checks(payment_id,bank_name,check_number,due_date) VALUES($1,$2,$3,$4)`,
          [
            paymentId,
            input.check.bankName,
            input.check.checkNumber,
            input.check.dueDate,
          ],
        );
      } else await this.applyAmount(client, kind, id, input.amount);
      await this.audit(
        client,
        actorId,
        "PAYMENT_RECORDED",
        "payment",
        paymentId,
        { ...input, kind, documentId: id },
      );
      return { id: paymentId };
    });
  }

  async updateCheck(id: string, input: UpdateCheckInput, actorId: string) {
    return this.db.withTransaction(async (client) => {
      // Lock document before payment, consistently with settlement and cancellation.
      const found = await client.query<{
        sales_order_id: string | null;
        purchase_order_id: string | null;
      }>(
        "SELECT sales_order_id,purchase_order_id FROM payments WHERE id=$1 AND organization_id=$2 AND method='CHECK'",
        [id, org],
      );
      const link = found.rows[0];
      if (!link) throw new NotFoundException("Chèque introuvable.");
      const kind = link.sales_order_id ? "sale" : "purchase";
      const documentId = link.sales_order_id ?? link.purchase_order_id;
      const doc = documentId
        ? await this.document(client, kind, documentId)
        : null;
      const result = await client.query<{
        amount: number;
        status: string;
        checkStatus: string | null;
      }>(
        `SELECT p.amount::float,p.status,c.status AS "checkStatus" FROM payments p LEFT JOIN checks c ON c.payment_id=p.id WHERE p.id=$1 AND p.organization_id=$2 FOR UPDATE OF p`,
        [id, org],
      );
      const payment = result.rows[0]!;
      if (payment.status !== "PENDING")
        throw new BadRequestException("Ce chèque a déjà été traité.");
      if (input.status === "DEPOSITED" && payment.checkStatus === "DEPOSITED")
        throw new BadRequestException("Ce chèque est déjà déposé.");
      if (input.status === "CLEARED") {
        if (!doc || !documentId)
          throw new BadRequestException(
            "Ce chèque historique doit être rapproché d’une facture avant encaissement.",
          );
        this.ensurePayable(doc);
        if (cents(payment.amount) > cents(doc.total) - cents(doc.amountPaid))
          throw new BadRequestException(
            "Le chèque dépasse le solde de la facture.",
          );
        await this.applyAmount(client, kind, documentId, payment.amount);
      }
      const paymentStatus = {
        DEPOSITED: "PENDING",
        CLEARED: "COMPLETED",
        BOUNCED: "FAILED",
        CANCELLED: "CANCELLED",
      }[input.status];
      if (input.status === "DEPOSITED" && !payment.checkStatus)
        throw new BadRequestException(
          "Les informations bancaires de ce chèque historique sont manquantes.",
        );
      await client.query(
        `UPDATE payments SET status=$2::varchar,paid_at=CASE WHEN $2::varchar='COMPLETED' THEN now() ELSE paid_at END WHERE id=$1`,
        [id, paymentStatus],
      );
      await client.query(
        `UPDATE checks SET status=$2::varchar,cleared_at=CASE WHEN $2::varchar='CLEARED' THEN now() ELSE NULL END WHERE payment_id=$1`,
        [id, input.status],
      );
      await this.audit(client, actorId, "CHECK_STATUS_CHANGED", "payment", id, {
        from: payment.checkStatus ?? payment.status,
        to: input.status,
      });
      return { id };
    });
  }

  async createExpense(input: CreateExpenseInput, actorId: string) {
    input = createExpenseSchema.parse(input);
    return this.db.withTransaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [`${org}:${input.requestId}`],
      );
      const existing = await client.query<ExpenseItem>(
        `SELECT id,name,category,amount::float,incurred_on::text AS "incurredOn",COALESCE(notes,'') AS notes FROM expenses WHERE organization_id=$1 AND request_id=$2`,
        [org, input.requestId],
      );
      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (
          row.name !== input.name ||
          row.category !== input.category ||
          row.amount !== input.amount ||
          row.incurredOn !== input.incurredOn ||
          row.notes !== input.notes
        )
          throw new ConflictException(
            "Cette demande a déjà été utilisée pour une autre dépense.",
          );
        return { id: row.id };
      }
      const result = await client.query<{ id: string }>(
        `INSERT INTO expenses(organization_id,location_id,name,category,amount,incurred_on,notes,created_by,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          org,
          DEFAULT_LOCATION_ID,
          input.name,
          input.category,
          input.amount,
          input.incurredOn,
          input.notes,
          actorId,
          input.requestId,
        ],
      );
      await this.audit(
        client,
        actorId,
        "EXPENSE_CREATED",
        "expense",
        result.rows[0]!.id,
        input,
      );
      return result.rows[0]!;
    });
  }

  async voidExpense(id: string, reason: string, actorId: string) {
    return this.db.withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE expenses SET voided_at=now(),void_reason=$3 WHERE id=$1 AND organization_id=$2 AND voided_at IS NULL RETURNING id`,
        [id, org, reason],
      );
      if (!result.rowCount)
        throw new BadRequestException("Dépense introuvable ou déjà annulée.");
      await this.audit(client, actorId, "EXPENSE_VOIDED", "expense", id, {
        reason,
      });
      return { id };
    });
  }

  private audit(
    client: PoolClient,
    actorId: string,
    action: string,
    entity: string,
    id: string,
    data: unknown,
  ) {
    return client.query(
      `INSERT INTO audit_logs(organization_id,actor_id,action,entity_type,entity_id,after_data) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
      [org, actorId, action, entity, id, JSON.stringify(data)],
    );
  }
}
