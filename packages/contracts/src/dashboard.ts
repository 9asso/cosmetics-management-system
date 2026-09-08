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
  incomeReceived: number;
  supplierPayables: number;
  pendingChecks: number;
}

export interface DashboardReport {
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  salesRevenue: number;
  grossMargin: number;
  incomeReceived: number;
  customerRefunds: number;
  purchases: number;
  supplierPayments: number;
  expenses: number;
  netCash: number;
  documents: {
    id: string;
    kind: "sale" | "purchase" | "expense";
    number: string;
    partner: string;
    amount: number;
    occurredOn: string;
  }[];
}

export type DashboardAnalyticsRange = "year" | "month" | "week";

export interface DashboardAnalytics {
  range: DashboardAnalyticsRange;
  grain: "month" | "day";
  generatedAt: string;
  periods: {
    period: string;
    revenue: number;
    grossMargin: number;
    orderCount: number;
  }[];
  activity: { id: string; title: string; detail: string; occurredAt: string }[];
}
