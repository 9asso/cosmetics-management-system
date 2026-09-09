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
  ordersToProcess: number;
  reservedUnits: number;
  dueChecks: number;
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
  salesCount: number;
  unitsSold: number;
  purchaseCount: number;
  expenseCount: number;
  periods: {
    period: string;
    salesRevenue: number;
    grossMargin: number;
    incomeReceived: number;
    cashOut: number;
  }[];
  documents: {
    id: string;
    kind: "sale" | "purchase" | "expense";
    number: string;
    partner: string;
    amount: number;
    paidAmount: number;
    status: string;
    occurredOn: string;
  }[];
}

export type DashboardAnalyticsRange = "year" | "month" | "week";

export interface DashboardRecentProduct {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  brand: string;
  sku: string;
  imageUrl: string;
  quantity: number;
  amount: number;
  partnerName: string;
  documentNumber: string;
  occurredAt: string;
  channel: "PURCHASE" | "WHOLESALE" | "RETAIL";
}

export interface DashboardTopProduct {
  productId: string;
  variantId: string;
  name: string;
  brand: string;
  sku: string;
  imageUrl: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
}

export interface DashboardTopCustomer {
  customerId: string;
  name: string;
  city: string;
  revenue: number;
  orderCount: number;
  unitsBought: number;
}

export interface DashboardTopCity {
  city: string;
  revenue: number;
  orderCount: number;
  customerCount: number;
}

export interface DashboardAnalytics {
  range: DashboardAnalyticsRange;
  grain: "month" | "day";
  generatedAt: string;
  periods: {
    period: string;
    revenue: number;
    wholesaleRevenue: number;
    retailRevenue: number;
    grossMargin: number;
    orderCount: number;
    unitsSold: number;
    discountTotal: number;
    shippingTotal: number;
    taxTotal: number;
  }[];
  activity: { id: string; title: string; detail: string; occurredAt: string }[];
  products: {
    recentPurchases: DashboardRecentProduct[];
    recentSales: DashboardRecentProduct[];
    topWholesale: DashboardTopProduct[];
    topRetail: DashboardTopProduct[];
  };
  customers: {
    topWholesale: DashboardTopCustomer[];
    topRetail: DashboardTopCustomer[];
    topCities: DashboardTopCity[];
  };
}
