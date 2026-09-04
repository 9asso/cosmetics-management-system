export interface DashboardSummary {
  revenue: number;
  grossMargin: number;
  expenses: number;
  netProfit: number;
  inventoryValue: number;
  unitsInStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  customerReceivables: number;
  supplierPayables: number;
  pendingChecks: number;
}

export type DashboardAnalyticsRange = 'year' | 'month' | 'week';

export interface DashboardAnalytics {
  range: DashboardAnalyticsRange;
  grain: 'month' | 'day';
  generatedAt: string;
  periods: { period: string; revenue: number; grossMargin: number; orderCount: number }[];
  activity: { id: string; title: string; detail: string; occurredAt: string }[];
}
