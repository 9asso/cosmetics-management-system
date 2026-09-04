import { Injectable } from '@nestjs/common';
import type { DashboardSummary } from '@cosmetics/contracts';
import { DEFAULT_LOCATION_ID, DEFAULT_ORGANIZATION_ID } from '../constants.js';
import { DatabaseService } from '../database/database.service.js';

type SummaryRow = Record<keyof DashboardSummary, string>;

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async summary(): Promise<DashboardSummary> {
    const result = await this.db.query<SummaryRow>(
      `SELECT
        COALESCE((SELECT SUM(grand_total) FROM sales_orders
          WHERE organization_id = $1 AND status NOT IN ('DRAFT', 'ORDERED', 'CANCELLED', 'CANCELED')), 0)::text AS revenue,
        COALESCE((SELECT SUM(soi.line_total - (soi.unit_cost_snapshot * soi.quantity * soi.unit_multiplier))
          FROM sales_order_items soi JOIN sales_orders so ON so.id = soi.sales_order_id
          WHERE so.organization_id = $1 AND so.status NOT IN ('DRAFT', 'ORDERED', 'CANCELLED', 'CANCELED')), 0)::text AS "grossMargin",
        COALESCE((SELECT SUM(amount) FROM expenses WHERE organization_id = $1), 0)::text AS expenses,
        (COALESCE((SELECT SUM(soi.line_total - (soi.unit_cost_snapshot * soi.quantity * soi.unit_multiplier))
          FROM sales_order_items soi JOIN sales_orders so ON so.id = soi.sales_order_id
          WHERE so.organization_id = $1 AND so.status NOT IN ('DRAFT', 'ORDERED', 'CANCELLED', 'CANCELED')), 0)
          - COALESCE((SELECT SUM(amount) FROM expenses WHERE organization_id = $1), 0))::text AS "netProfit",
        COALESCE((SELECT SUM(b.on_hand * v.purchase_price)
          FROM inventory_balances b JOIN product_variants v ON v.id = b.variant_id
          WHERE b.location_id = $2), 0)::text AS "inventoryValue",
        COALESCE((SELECT SUM(on_hand) FROM inventory_balances WHERE location_id = $2), 0)::text AS "unitsInStock",
        COALESCE((SELECT COUNT(*) FROM inventory_balances b
          JOIN product_variants v ON v.id = b.variant_id
          WHERE b.location_id = $2 AND b.on_hand > 0 AND b.on_hand <= v.low_stock_threshold), 0)::text AS "lowStockCount",
        COALESCE((SELECT COUNT(*) FROM inventory_balances
          WHERE location_id = $2 AND on_hand = 0), 0)::text AS "outOfStockCount",
        COALESCE((SELECT SUM(grand_total - amount_paid) FROM sales_orders
          WHERE organization_id = $1 AND status IN ('CONFIRMED', 'PARTIALLY_PAID', 'DELIVERED', 'FULFILLED')), 0)::text AS "customerReceivables",
        COALESCE((SELECT SUM(total - amount_paid) FROM purchase_orders
          WHERE organization_id = $1 AND status NOT IN ('CANCELLED', 'CANCELED')), 0)::text AS "supplierPayables",
        COALESCE((SELECT COUNT(*) FROM checks c JOIN payments p ON p.id = c.payment_id
          WHERE p.organization_id = $1 AND c.status IN ('PENDING', 'DEPOSITED')), 0)::text AS "pendingChecks"`,
      [DEFAULT_ORGANIZATION_ID, DEFAULT_LOCATION_ID],
    );
    const row = result.rows[0]!;
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, Number(value)]),
    ) as unknown as DashboardSummary;
  }
}
