import { Injectable } from "@nestjs/common";
import type {
  DashboardSummary,
  DashboardAnalytics,
  DashboardAnalyticsRange,
  DashboardReport,
} from "@cosmetics/contracts";
import { DEFAULT_LOCATION_ID, DEFAULT_ORGANIZATION_ID } from "../constants.js";
import { DatabaseService } from "../database/database.service.js";

type SummaryRow = Record<keyof DashboardSummary, string>;

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async analytics(
    range: DashboardAnalyticsRange = "year",
  ): Promise<DashboardAnalytics> {
    const config = {
      year: {
        grain: "month" as const,
        count: 12,
        interval: "1 month",
        format: "YYYY-MM",
      },
      month: {
        grain: "day" as const,
        count: 30,
        interval: "1 day",
        format: "YYYY-MM-DD",
      },
      week: {
        grain: "day" as const,
        count: 7,
        interval: "1 day",
        format: "YYYY-MM-DD",
      },
    }[range];
    const periods = await this.db.query<{
      period: string;
      revenue: string;
      grossMargin: string;
      orderCount: number;
    }>(
      `WITH buckets AS (
        SELECT generate_series(
          date_trunc('${config.grain}', now() AT TIME ZONE 'Africa/Casablanca') - ($2::int - 1) * interval '${config.interval}',
          date_trunc('${config.grain}', now() AT TIME ZONE 'Africa/Casablanca'), interval '${config.interval}') AS period
      ), eligible AS (
        SELECT so.id, date_trunc('${config.grain}', COALESCE(so.placed_at, so.created_at) AT TIME ZONE 'Africa/Casablanca') AS period,
          so.grand_total, COALESCE((SELECT SUM(
            (i.unit_price - i.unit_cost_snapshot) * (i.quantity - i.returned_quantity) * i.unit_multiplier)
          FROM sales_order_items i WHERE i.sales_order_id = so.id), 0) - so.discount_total AS margin
        FROM sales_orders so WHERE so.organization_id = $1
          AND so.status IN ('CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'DELIVERED', 'FULFILLED')
          AND COALESCE(so.placed_at, so.created_at) <= now()
      ) SELECT to_char(b.period, '${config.format}') AS period, COALESCE(SUM(e.grand_total), 0)::text AS revenue,
        COALESCE(SUM(e.margin), 0)::text AS "grossMargin", COUNT(e.id)::int AS "orderCount"
      FROM buckets b LEFT JOIN eligible e ON e.period = b.period GROUP BY b.period ORDER BY b.period`,
      [DEFAULT_ORGANIZATION_ID, config.count],
    );
    const activity = await this.db.query<
      DashboardAnalytics["activity"][number]
    >(
      `SELECT * FROM (
        SELECT id::text, 'Vente · ' || order_number AS title, channel || ' · ' || status AS detail,
          COALESCE(placed_at, created_at)::text AS "occurredAt"
        FROM sales_orders WHERE organization_id = $1
        UNION ALL
        SELECT id::text, 'Achat · ' || order_number, status, COALESCE(ordered_at, created_at)::text
        FROM purchase_orders WHERE organization_id = $1
        UNION ALL
        SELECT m.id::text, 'Stock · ' || p.name, m.quantity_delta::text || ' unités · ' || m.reason, m.created_at::text
        FROM inventory_movements m JOIN product_variants v ON v.id = m.variant_id JOIN products p ON p.id = v.product_id
        WHERE m.organization_id = $1 AND m.reason = 'CORRECTION'
      ) events ORDER BY "occurredAt" DESC LIMIT 5`,
      [DEFAULT_ORGANIZATION_ID],
    );
    return {
      range,
      grain: config.grain,
      generatedAt: new Date().toISOString(),
      periods: periods.rows.map((row) => ({
        ...row,
        revenue: Number(row.revenue),
        grossMargin: Number(row.grossMargin),
      })),
      activity: activity.rows,
    };
  }

  async summary(): Promise<DashboardSummary> {
    const result = await this.db.query<SummaryRow>(
      `SELECT
        COALESCE((SELECT SUM(grand_total) FROM sales_orders
          WHERE organization_id = $1 AND status IN ('CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'DELIVERED', 'FULFILLED')), 0)::text AS revenue,
        COALESCE((SELECT SUM(COALESCE((SELECT SUM((soi.unit_price - soi.unit_cost_snapshot) *
          (soi.quantity - soi.returned_quantity) * soi.unit_multiplier)
          FROM sales_order_items soi WHERE soi.sales_order_id=so.id),0)-so.discount_total)
          FROM sales_orders so WHERE so.organization_id = $1
          AND so.status IN ('CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'DELIVERED', 'FULFILLED')), 0)::text AS "grossMargin",
        COALESCE((SELECT SUM(amount) FROM expenses WHERE organization_id = $1 AND voided_at IS NULL), 0)::text AS expenses,
        (COALESCE((SELECT SUM(COALESCE((SELECT SUM((soi.unit_price - soi.unit_cost_snapshot) *
          (soi.quantity - soi.returned_quantity) * soi.unit_multiplier)
          FROM sales_order_items soi WHERE soi.sales_order_id=so.id),0)-so.discount_total)
          FROM sales_orders so WHERE so.organization_id = $1
          AND so.status IN ('CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'DELIVERED', 'FULFILLED')), 0)
          - COALESCE((SELECT SUM(amount) FROM expenses WHERE organization_id = $1 AND voided_at IS NULL), 0))::text AS "netProfit",
        COALESCE((SELECT SUM(b.on_hand * v.purchase_price)
          FROM inventory_balances b JOIN product_variants v ON v.id = b.variant_id
          WHERE b.location_id = $2), 0)::text AS "inventoryValue",
        COALESCE((SELECT SUM(on_hand) FROM inventory_balances WHERE location_id = $2), 0)::text AS "unitsInStock",
        COALESCE((SELECT COUNT(*) FROM product_variants v JOIN products p ON p.id=v.product_id
          LEFT JOIN inventory_balances b ON b.variant_id=v.id AND b.location_id=$2
          WHERE p.organization_id=$1 AND p.active=true AND v.active=true AND COALESCE(b.on_hand,0)-COALESCE(b.reserved,0) > 0 AND COALESCE(b.on_hand,0)-COALESCE(b.reserved,0) <= v.low_stock_threshold),0)::text AS "lowStockCount",
        COALESCE((SELECT COUNT(*) FROM product_variants v JOIN products p ON p.id=v.product_id
          LEFT JOIN inventory_balances b ON b.variant_id=v.id AND b.location_id=$2
          WHERE p.organization_id=$1 AND p.active=true AND v.active=true AND COALESCE(b.on_hand,0)-COALESCE(b.reserved,0)=0),0)::text AS "outOfStockCount",
        COALESCE((SELECT SUM(grand_total - amount_paid) FROM sales_orders
          WHERE organization_id = $1 AND status IN ('CONFIRMED', 'PARTIALLY_PAID', 'DELIVERED', 'FULFILLED')), 0)::text AS "customerReceivables",
        COALESCE((SELECT SUM(amount) FROM payments
          WHERE organization_id=$1 AND direction='IN' AND status='COMPLETED'),0)::text AS "incomeReceived",
        COALESCE((SELECT SUM(total - amount_paid) FROM purchase_orders
          WHERE organization_id = $1 AND status IN ('RECEIVED', 'PARTIALLY_RECEIVED')), 0)::text AS "supplierPayables",
        COALESCE((SELECT COUNT(*) FROM payments p WHERE p.organization_id = $1 AND p.method = 'CHECK' AND p.status = 'PENDING'), 0)::text AS "pendingChecks"`,
      [DEFAULT_ORGANIZATION_ID, DEFAULT_LOCATION_ID],
    );
    const row = result.rows[0]!;
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, Number(value)]),
    ) as unknown as DashboardSummary;
  }

  async report(dateFrom: string, dateTo: string): Promise<DashboardReport> {
    const totals = await this.db.query<{
      salesRevenue: string;
      grossMargin: string;
      incomeReceived: string;
      customerRefunds: string;
      purchases: string;
      supplierPayments: string;
      expenses: string;
    }>(
      `SELECT
        COALESCE((SELECT SUM(grand_total) FROM sales_orders
          WHERE organization_id=$1 AND status IN ('CONFIRMED','PARTIALLY_PAID','PAID','DELIVERED','FULFILLED')
          AND (COALESCE(placed_at,created_at) AT TIME ZONE 'Africa/Casablanca')::date BETWEEN $2::date AND $3::date),0)::text AS "salesRevenue",
        COALESCE((SELECT SUM(COALESCE((SELECT SUM((i.unit_price-i.unit_cost_snapshot)*
          (i.quantity-i.returned_quantity)*i.unit_multiplier) FROM sales_order_items i
          WHERE i.sales_order_id=s.id),0)-s.discount_total)
          FROM sales_orders s WHERE s.organization_id=$1
          AND s.status IN ('CONFIRMED','PARTIALLY_PAID','PAID','DELIVERED','FULFILLED')
          AND (COALESCE(s.placed_at,s.created_at) AT TIME ZONE 'Africa/Casablanca')::date BETWEEN $2::date AND $3::date),0)::text AS "grossMargin",
        COALESCE((SELECT SUM(amount) FROM payments WHERE organization_id=$1 AND direction='IN' AND status='COMPLETED'
          AND (paid_at AT TIME ZONE 'Africa/Casablanca')::date BETWEEN $2::date AND $3::date),0)::text AS "incomeReceived",
        COALESCE((SELECT SUM(amount) FROM payments WHERE organization_id=$1 AND direction='OUT' AND status='COMPLETED'
          AND sales_order_id IS NOT NULL AND (paid_at AT TIME ZONE 'Africa/Casablanca')::date BETWEEN $2::date AND $3::date),0)::text AS "customerRefunds",
        COALESCE((SELECT SUM(total) FROM purchase_orders WHERE organization_id=$1 AND status IN ('RECEIVED','PARTIALLY_RECEIVED')
          AND (COALESCE(ordered_at,created_at) AT TIME ZONE 'Africa/Casablanca')::date BETWEEN $2::date AND $3::date),0)::text AS purchases,
        COALESCE((SELECT SUM(amount) FROM payments WHERE organization_id=$1 AND direction='OUT' AND status='COMPLETED'
          AND purchase_order_id IS NOT NULL AND (paid_at AT TIME ZONE 'Africa/Casablanca')::date BETWEEN $2::date AND $3::date),0)::text AS "supplierPayments",
        COALESCE((SELECT SUM(amount) FROM expenses WHERE organization_id=$1 AND voided_at IS NULL
          AND incurred_on BETWEEN $2::date AND $3::date),0)::text AS expenses`,
      [DEFAULT_ORGANIZATION_ID, dateFrom, dateTo],
    );
    const documents = await this.db.query<DashboardReport["documents"][number]>(
      `SELECT * FROM (
        SELECT id,'sale' AS kind,order_number AS number,COALESCE(partner_snapshot->>'name','Client') AS partner,
          grand_total::float AS amount,(COALESCE(placed_at,created_at) AT TIME ZONE 'Africa/Casablanca')::date::text AS "occurredOn"
        FROM sales_orders WHERE organization_id=$1 AND status NOT IN ('DRAFT','ORDERED','CANCELED','CANCELLED','REFUNDED')
        UNION ALL
        SELECT id,'purchase',order_number,COALESCE(partner_snapshot->>'name','Fournisseur'),total::float,
          (COALESCE(ordered_at,created_at) AT TIME ZONE 'Africa/Casablanca')::date::text
        FROM purchase_orders WHERE organization_id=$1 AND status IN ('RECEIVED','PARTIALLY_RECEIVED')
        UNION ALL
        SELECT id,'expense',name,category,amount::float,incurred_on::text
        FROM expenses WHERE organization_id=$1 AND voided_at IS NULL
      ) d WHERE d."occurredOn"::date BETWEEN $2::date AND $3::date
      ORDER BY d."occurredOn" DESC,d.number`,
      [DEFAULT_ORGANIZATION_ID, dateFrom, dateTo],
    );
    const row = totals.rows[0]!;
    const incomeReceived = Number(row.incomeReceived);
    const customerRefunds = Number(row.customerRefunds);
    const supplierPayments = Number(row.supplierPayments);
    const expenses = Number(row.expenses);
    return {
      dateFrom,
      dateTo,
      generatedAt: new Date().toISOString(),
      salesRevenue: Number(row.salesRevenue),
      grossMargin: Number(row.grossMargin),
      incomeReceived,
      customerRefunds,
      purchases: Number(row.purchases),
      supplierPayments,
      expenses,
      netCash: incomeReceived - customerRefunds - supplierPayments - expenses,
      documents: documents.rows,
    };
  }
}
