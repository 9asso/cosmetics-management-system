export type Section =
  | "dashboard"
  | "inventory"
  | "purchases"
  | "sales"
  | "orders"
  | "invoices"
  | "partners"
  | "team"
  | "finance";
export type NavigationOptions = {
  stock?: "all" | "low" | "out";
  createProduct?: boolean;
  financeTab?: "receivables" | "payables" | "checks" | "expenses";
};
