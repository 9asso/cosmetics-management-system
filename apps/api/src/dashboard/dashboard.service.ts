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
      wholesaleRevenue: string;
      retailRevenue: string;
      grossMargin: string;
      orderCount: number;
      unitsSold: number;
      discountTotal: string;
      shippingTotal: string;
      taxTotal: string;
    }>(
      `WITH buckets AS (
        SELECT generate_series(
          date_trunc('${config.grain}', now() AT TIME ZONE 'Africa/Casablanca') - ($2::int - 1) * interval '${config.interval}',
          date_trunc('${config.grain}', now() AT TIME ZONE 'Africa/Casablanca'), interval '${config.interval}') AS period
      ), eligible AS (
        SELECT so.id, so.channel,
          date_trunc('${config.grain}', COALESCE(so.placed_at, so.created_at) AT TIME ZONE 'Africa/Casablanca') AS period,
          so.grand_total, so.discount_total, so.shipping_total, so.tax_total,
          COALESCE((SELECT SUM((i.quantity - i.returned_quantity) * i.unit_multiplier)
            FROM sales_order_items i WHERE i.sales_order_id = so.id), 0)::int AS units,
          COALESCE((SELECT SUM(
            (i.unit_price - i.unit_cost_snapshot) * (i.quantity - i.returned_quantity) * i.unit_multiplier)
          FROM sales_order_items i WHERE i.sales_order_id = so.id), 0) - so.discount_total AS margin
        FROM sales_orders so WHERE so.organization_id = $1
          AND so.status IN ('CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'DELIVERED', 'FULFILLED')
          AND COALESCE(so.placed_at, so.created_at) <= now()
      ) SELECT to_char(b.period, '${config.format}') AS period,
        COALESCE(SUM(e.grand_total), 0)::text AS revenue,
        COALESCE(SUM(e.grand_total) FILTER (WHERE e.channel IN ('WHOLESALE_DESKTOP','MANUAL')), 0)::text AS "wholesaleRevenue",
        COALESCE(SUM(e.grand_total) FILTER (WHERE e.channel = 'RETAIL_WEB'), 0)::text AS "retailRevenue",
        COALESCE(SUM(e.margin), 0)::text AS "grossMargin",
        COUNT(e.id)::int AS "orderCount",COALESCE(SUM(e.units),0)::int AS "unitsSold",
        COALESCE(SUM(e.discount_total),0)::text AS "discountTotal",
        COALESCE(SUM(e.shipping_total),0)::text AS "shippingTotal",
        COALESCE(SUM(e.tax_total),0)::text AS "taxTotal"
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
    const recentPurchases = await this.db.query<
      DashboardAnalytics["products"]["recentPurchases"][number]
    >(
      `SELECT poi.id::text AS id,p.id::text AS "productId",v.id::text AS "variantId",
        p.name,p.brand,v.sku,
        COALESCE(NULLIF(p.image_url,''),NULLIF(p.images->>0,''),'') AS "imageUrl",
        poi.received_quantity::int AS quantity,
        (poi.received_quantity * poi.unit_cost)::float AS amount,
        COALESCE(po.partner_snapshot->>'name','Fournisseur') AS "partnerName",
        po.order_number AS "documentNumber",
        COALESCE(po.ordered_at,po.created_at)::text AS "occurredAt",
        'PURCHASE' AS channel
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id=poi.purchase_order_id
      JOIN product_variants v ON v.id=poi.variant_id
      JOIN products p ON p.id=v.product_id
      WHERE po.organization_id=$1 AND po.status IN ('RECEIVED','PARTIALLY_RECEIVED')
        AND poi.received_quantity > 0
      ORDER BY COALESCE(po.ordered_at,po.created_at) DESC,poi.id DESC LIMIT 6`,
      [DEFAULT_ORGANIZATION_ID],
    );
    const recentSales = await this.db.query<
      DashboardAnalytics["products"]["recentSales"][number]
    >(
      `SELECT soi.id::text AS id,p.id::text AS "productId",v.id::text AS "variantId",
        p.name,p.brand,v.sku,
        COALESCE(NULLIF(p.image_url,''),NULLIF(p.images->>0,''),'') AS "imageUrl",
        ((soi.quantity-soi.returned_quantity)*soi.unit_multiplier)::int AS quantity,
        (soi.unit_price*(soi.quantity-soi.returned_quantity)*soi.unit_multiplier)::float AS amount,
        COALESCE(so.partner_snapshot->>'name',CASE WHEN so.channel='RETAIL_WEB' THEN 'Client boutique' ELSE 'Client grossiste' END) AS "partnerName",
        so.order_number AS "documentNumber",
        COALESCE(so.placed_at,so.created_at)::text AS "occurredAt",
        CASE WHEN so.channel='RETAIL_WEB' THEN 'RETAIL' ELSE 'WHOLESALE' END AS channel
      FROM sales_order_items soi
      JOIN sales_orders so ON so.id=soi.sales_order_id
      JOIN product_variants v ON v.id=soi.variant_id
      JOIN products p ON p.id=v.product_id
      WHERE so.organization_id=$1
        AND so.status IN ('CONFIRMED','PARTIALLY_PAID','PAID','DELIVERED','FULFILLED')
        AND soi.quantity > soi.returned_quantity
      ORDER BY COALESCE(so.placed_at,so.created_at) DESC,soi.id DESC LIMIT 6`,
      [DEFAULT_ORGANIZATION_ID],
    );
    const topProducts = await this.db.query<
      DashboardAnalytics["products"]["topWholesale"][number] & {
        segment: "WHOLESALE" | "RETAIL";
        rank: number;
      }
    >(
      `WITH totals AS (
        SELECT p.id::text AS "productId",v.id::text AS "variantId",p.name,p.brand,v.sku,
          COALESCE(NULLIF(p.image_url,''),NULLIF(p.images->>0,''),'') AS "imageUrl",
          CASE WHEN so.channel='RETAIL_WEB' THEN 'RETAIL' ELSE 'WHOLESALE' END AS segment,
          SUM((soi.quantity-soi.returned_quantity)*soi.unit_multiplier)::int AS "unitsSold",
          SUM(soi.unit_price*(soi.quantity-soi.returned_quantity)*soi.unit_multiplier)::float AS revenue,
          COUNT(DISTINCT so.id)::int AS "orderCount"
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id=soi.sales_order_id
        JOIN product_variants v ON v.id=soi.variant_id
        JOIN products p ON p.id=v.product_id
        WHERE so.organization_id=$1
          AND so.status IN ('CONFIRMED','PARTIALLY_PAID','PAID','DELIVERED','FULFILLED')
          AND soi.quantity > soi.returned_quantity
          AND date_trunc('${config.grain}',COALESCE(so.placed_at,so.created_at) AT TIME ZONE 'Africa/Casablanca') >=
            date_trunc('${config.grain}',now() AT TIME ZONE 'Africa/Casablanca') - ($2::int - 1) * interval '${config.interval}'
        GROUP BY p.id,v.id,p.name,p.brand,v.sku,p.image_url,p.images,segment
      ), ranked AS (
        SELECT *,row_number() OVER (PARTITION BY segment ORDER BY "unitsSold" DESC,revenue DESC,"productId")::int AS rank
        FROM totals
      ) SELECT * FROM ranked WHERE rank <= 5 ORDER BY segment,rank`,
      [DEFAULT_ORGANIZATION_ID, config.count],
    );
    const topCustomers = await this.db.query<
      DashboardAnalytics["customers"]["topWholesale"][number] & {
        segment: "WHOLESALE" | "RETAIL";
        rank: number;
      }
    >(
      `WITH totals AS (
        SELECT COALESCE(so.customer_id::text,so.id::text) AS "customerId",
          COALESCE(c.name,so.partner_snapshot->>'name','Client') AS name,
          CASE WHEN POSITION(',' IN COALESCE(c.address,so.partner_snapshot->>'address','')) > 0
            THEN INITCAP(BTRIM(regexp_replace(COALESCE(c.address,so.partner_snapshot->>'address',''),'^.*,' ,'')))
            ELSE 'Ville non renseignée' END AS city,
          CASE WHEN so.channel='RETAIL_WEB' THEN 'RETAIL' ELSE 'WHOLESALE' END AS segment,
          SUM(so.grand_total)::float AS revenue,
          COUNT(DISTINCT so.id)::int AS "orderCount",
          SUM(COALESCE((SELECT SUM((i.quantity-i.returned_quantity)*i.unit_multiplier)
            FROM sales_order_items i WHERE i.sales_order_id=so.id),0))::int AS "unitsBought"
        FROM sales_orders so LEFT JOIN customers c ON c.id=so.customer_id
        WHERE so.organization_id=$1
          AND so.status IN ('CONFIRMED','PARTIALLY_PAID','PAID','DELIVERED','FULFILLED')
          AND date_trunc('${config.grain}',COALESCE(so.placed_at,so.created_at) AT TIME ZONE 'Africa/Casablanca') >=
            date_trunc('${config.grain}',now() AT TIME ZONE 'Africa/Casablanca') - ($2::int - 1) * interval '${config.interval}'
        GROUP BY COALESCE(so.customer_id::text,so.id::text),
          COALESCE(c.name,so.partner_snapshot->>'name','Client'),city,segment
      ), ranked AS (
        SELECT *,row_number() OVER (PARTITION BY segment ORDER BY revenue DESC,"orderCount" DESC,"customerId")::int AS rank
        FROM totals
      ) SELECT * FROM ranked WHERE rank <= 5 ORDER BY segment,rank`,
      [DEFAULT_ORGANIZATION_ID, config.count],
    );
    const topCities = await this.db.query<
      DashboardAnalytics["customers"]["topCities"][number]
    >(
      `WITH eligible AS (
        SELECT so.id,so.customer_id,so.grand_total,
          CASE WHEN POSITION(',' IN COALESCE(c.address,so.partner_snapshot->>'address','')) > 0
            THEN INITCAP(BTRIM(regexp_replace(COALESCE(c.address,so.partner_snapshot->>'address',''),'^.*,' ,'')))
            ELSE 'Ville non renseignée' END AS city
        FROM sales_orders so LEFT JOIN customers c ON c.id=so.customer_id
        WHERE so.organization_id=$1
          AND so.status IN ('CONFIRMED','PARTIALLY_PAID','PAID','DELIVERED','FULFILLED')
          AND date_trunc('${config.grain}',COALESCE(so.placed_at,so.created_at) AT TIME ZONE 'Africa/Casablanca') >=
            date_trunc('${config.grain}',now() AT TIME ZONE 'Africa/Casablanca') - ($2::int - 1) * interval '${config.interval}'
      ) SELECT city,SUM(grand_total)::float AS revenue,COUNT(*)::int AS "orderCount",
        COUNT(DISTINCT customer_id)::int AS "customerCount"
      FROM eligible GROUP BY city ORDER BY revenue DESC,"orderCount" DESC,city LIMIT 5`,
      [DEFAULT_ORGANIZATION_ID, config.count],
    );
    return {
      range,
      grain: config.grain,
      generatedAt: new Date().toISOString(),
      periods: periods.rows.map((row) => ({
        ...row,
        revenue: Number(row.revenue),
        wholesaleRevenue: Number(row.wholesaleRevenue),
        retailRevenue: Number(row.retailRevenue),
        grossMargin: Number(row.grossMargin),
        discountTotal: Number(row.discountTotal),
        shippingTotal: Number(row.shippingTotal),
        taxTotal: Number(row.taxTotal),
      })),
      activity: activity.rows,
      products: {
        recentPurchases: recentPurchases.rows,
        recentSales: recentSales.rows,
        topWholesale: topProducts.rows.filter(
          (product) => product.segment === "WHOLESALE",
        ),
        topRetail: topProducts.rows.filter(
          (product) => product.segment === "RETAIL",
        ),
      },
      customers: {
        topWholesale: topCustomers.rows.filter(
          (customer) => customer.segment === "WHOLESALE",
        ),
        topRetail: topCustomers.rows.filter(
          (customer) => customer.segment === "RETAIL",
        ),
        topCities: topCities.rows,
      },
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
        COALESCE((SELECT COUNT(*) FROM payments p WHERE p.organization_id = $1 AND p.method = 'CHECK' AND p.status = 'PENDING'), 0)::text AS "pendingChecks",
        COALESCE((SELECT COUNT(*) FROM sales_orders
          WHERE organization_id = $1 AND channel = 'RETAIL_WEB'
          AND status IN ('ORDERED', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID')), 0)::text AS "ordersToProcess",
        COALESCE((SELECT SUM(reserved) FROM inventory_balances WHERE location_id = $2), 0)::text AS "reservedUnits",
        COALESCE((SELECT COUNT(*) FROM checks c JOIN payments p ON p.id = c.payment_id
          WHERE p.organization_id = $1 AND p.status = 'PENDING'
          AND c.due_date <= (now() AT TIME ZONE 'Africa/Casablanca')::date), 0)::text AS "dueChecks"`,
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
      salesCount: string;
      unitsSold: string;
      purchaseCount: string;
      expenseCount: string;
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
          AND incurred_on BETWEEN $2::date AND $3::date),0)::text AS expenses,
        COALESCE((SELECT COUNT(*) FROM sales_orders
          WHERE organization_id=$1 AND status IN ('CONFIRMED','PARTIALLY_PAID','PAID','DELIVERED','FULFILLED')
          AND (COALESCE(placed_at,created_at) AT TIME ZONE 'Africa/Casablanca')::date BETWEEN $2::date AND $3::date),0)::text AS "salesCount",
        COALESCE((SELECT SUM((i.quantity-i.returned_quantity)*i.unit_multiplier)
          FROM sales_order_items i JOIN sales_orders s ON s.id=i.sales_order_id
          WHERE s.organization_id=$1 AND s.status IN ('CONFIRMED','PARTIALLY_PAID','PAID','DELIVERED','FULFILLED')
          AND (COALESCE(s.placed_at,s.created_at) AT TIME ZONE 'Africa/Casablanca')::date BETWEEN $2::date AND $3::date),0)::text AS "unitsSold",
        COALESCE((SELECT COUNT(*) FROM purchase_orders WHERE organization_id=$1
          AND status IN ('RECEIVED','PARTIALLY_RECEIVED')
          AND (COALESCE(ordered_at,created_at) AT TIME ZONE 'Africa/Casablanca')::date BETWEEN $2::date AND $3::date),0)::text AS "purchaseCount",
        COALESCE((SELECT COUNT(*) FROM expenses WHERE organization_id=$1 AND voided_at IS NULL
          AND incurred_on BETWEEN $2::date AND $3::date),0)::text AS "expenseCount"`,
      [DEFAULT_ORGANIZATION_ID, dateFrom, dateTo],
    );
    const documents = await this.db.query<DashboardReport["documents"][number]>(
      `SELECT * FROM (
        SELECT id,'sale' AS kind,order_number AS number,COALESCE(partner_snapshot->>'name','Client') AS partner,
          grand_total::float AS amount,amount_paid::float AS "paidAmount",status,
          (COALESCE(placed_at,created_at) AT TIME ZONE 'Africa/Casablanca')::date::text AS "occurredOn"
        FROM sales_orders WHERE organization_id=$1 AND status NOT IN ('DRAFT','ORDERED','CANCELED','CANCELLED','REFUNDED')
        UNION ALL
        SELECT id,'purchase',order_number,COALESCE(partner_snapshot->>'name','Fournisseur'),total::float,amount_paid::float,status,
          (COALESCE(ordered_at,created_at) AT TIME ZONE 'Africa/Casablanca')::date::text
        FROM purchase_orders WHERE organization_id=$1 AND status IN ('RECEIVED','PARTIALLY_RECEIVED')
        UNION ALL
        SELECT id,'expense',name,category,amount::float,amount::float,'PAYÉE',incurred_on::text
        FROM expenses WHERE organization_id=$1 AND voided_at IS NULL
      ) d WHERE d."occurredOn"::date BETWEEN $2::date AND $3::date
      ORDER BY d."occurredOn" DESC,d.number`,
      [DEFAULT_ORGANIZATION_ID, dateFrom, dateTo],
    );
    const spanDays = Math.max(
      1,
      Math.round(
        (Date.parse(`${dateTo}T12:00:00Z`) -
          Date.parse(`${dateFrom}T12:00:00Z`)) /
          86_400_000,
      ) + 1,
    );
    const reportConfig =
      spanDays <= 45
        ? { grain: "day", interval: "1 day", format: "YYYY-MM-DD" }
        : spanDays <= 180
          ? { grain: "week", interval: "1 week", format: "YYYY-MM-DD" }
          : { grain: "month", interval: "1 month", format: "YYYY-MM" };
    const reportPeriods = await this.db.query<{
      period: string;
      salesRevenue: string;
      grossMargin: string;
      incomeReceived: string;
      cashOut: string;
    }>(
      `WITH buckets AS (
        SELECT generate_series(date_trunc('${reportConfig.grain}',$2::timestamp),
          date_trunc('${reportConfig.grain}',$3::timestamp),interval '${reportConfig.interval}') AS period
      ), sales AS (
        SELECT date_trunc('${reportConfig.grain}',COALESCE(s.placed_at,s.created_at) AT TIME ZONE 'Africa/Casablanca') AS period,
          SUM(s.grand_total) AS revenue,
          SUM(COALESCE((SELECT SUM((i.unit_price-i.unit_cost_snapshot)*(i.quantity-i.returned_quantity)*i.unit_multiplier)
            FROM sales_order_items i WHERE i.sales_order_id=s.id),0)-s.discount_total) AS margin
        FROM sales_orders s WHERE s.organization_id=$1
          AND s.status IN ('CONFIRMED','PARTIALLY_PAID','PAID','DELIVERED','FULFILLED')
          AND (COALESCE(s.placed_at,s.created_at) AT TIME ZONE 'Africa/Casablanca')::date BETWEEN $2::date AND $3::date
        GROUP BY period
      ), cash AS (
        SELECT date_trunc('${reportConfig.grain}',paid_at AT TIME ZONE 'Africa/Casablanca') AS period,
          SUM(amount) FILTER (WHERE direction='IN') AS received,
          SUM(amount) FILTER (WHERE direction='OUT') AS paid_out
        FROM payments WHERE organization_id=$1 AND status='COMPLETED'
          AND (paid_at AT TIME ZONE 'Africa/Casablanca')::date BETWEEN $2::date AND $3::date
        GROUP BY period
      ), costs AS (
        SELECT date_trunc('${reportConfig.grain}',incurred_on)::timestamp AS period,SUM(amount) AS amount
        FROM expenses WHERE organization_id=$1 AND voided_at IS NULL
          AND incurred_on BETWEEN $2::date AND $3::date GROUP BY period
      ) SELECT to_char(b.period,'${reportConfig.format}') AS period,
        COALESCE(s.revenue,0)::text AS "salesRevenue",COALESCE(s.margin,0)::text AS "grossMargin",
        COALESCE(c.received,0)::text AS "incomeReceived",
        (COALESCE(c.paid_out,0)+COALESCE(x.amount,0))::text AS "cashOut"
      FROM buckets b LEFT JOIN sales s ON s.period=b.period LEFT JOIN cash c ON c.period=b.period
      LEFT JOIN costs x ON x.period=b.period ORDER BY b.period`,
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
      salesCount: Number(row.salesCount),
      unitsSold: Number(row.unitsSold),
      purchaseCount: Number(row.purchaseCount),
      expenseCount: Number(row.expenseCount),
      periods: reportPeriods.rows.map((period) => ({
        ...period,
        salesRevenue: Number(period.salesRevenue),
        grossMargin: Number(period.grossMargin),
        incomeReceived: Number(period.incomeReceived),
        cashOut: Number(period.cashOut),
      })),
      documents: documents.rows,
    };
  }
}
