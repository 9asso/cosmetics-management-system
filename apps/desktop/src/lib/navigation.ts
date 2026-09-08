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

export const sectionSlugs: Record<Section, string> = {
  dashboard: "vue-ensemble",
  inventory: "produits-stock",
  purchases: "reception-fournisseur",
  sales: "vente-en-gros",
  orders: "commandes-livraisons",
  invoices: "factures",
  partners: "clients-fournisseurs",
  team: "equipe-roles",
  finance: "finances-depenses",
};

export function sectionFromPath(pathname: string): Section {
  const base = import.meta.env.BASE_URL.replace(/^\/+|\/+$/g, "");
  const parts = pathname.split("/").filter(Boolean);
  const slug = parts[parts.length - 1];
  if (base && parts[0] === base && parts.length === 1) return "dashboard";
  return (
    (Object.entries(sectionSlugs).find(([, value]) => value === slug)?.[0] as
      Section | undefined) ?? "dashboard"
  );
}

export function sectionPath(section: Section) {
  const base = import.meta.env.BASE_URL.replace(/^\/+|\/+$/g, "");
  return `${base ? `/${base}` : ""}/${sectionSlugs[section]}`;
}
