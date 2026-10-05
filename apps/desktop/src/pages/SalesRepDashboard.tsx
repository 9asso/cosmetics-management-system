import { useQuery } from "@tanstack/react-query";
import { FileClock, PackageSearch, ShoppingBag, Users } from "lucide-react";
import { api } from "../lib/api";
import { allPages } from "../lib/csv";
import { money } from "../lib/format";
import type { Section } from "../lib/navigation";
import { ui } from "../lib/ui";

const actions: Array<{
  section: Section;
  label: string;
  icon: typeof ShoppingBag;
}> = [
  { section: "sales", label: "Nouvelle vente", icon: ShoppingBag },
  { section: "invoices", label: "Mes factures", icon: FileClock },
  { section: "partners", label: "Mes clients", icon: Users },
  { section: "inventory", label: "Catalogue produits", icon: PackageSearch },
];

export function SalesRepDashboard({
  onNavigate,
}: {
  onNavigate: (section: Section) => void;
}) {
  const invoices = useQuery({
    queryKey: ["sales-rep-dashboard", "invoices"],
    queryFn: () =>
      allPages((page) => api.invoices({ kind: "sale", search: "", page })),
  });
  const products = useQuery({
    queryKey: ["sales-rep-dashboard", "products"],
    queryFn: () =>
      api.products({ search: "", stock: "all", page: 1, pageSize: 1 }),
  });
  const total = invoices.data?.reduce((sum, row) => sum + row.total, 0) ?? 0;
  const paid =
    invoices.data?.reduce((sum, row) => sum + row.amountPaid, 0) ?? 0;

  return (
    <div className={ui("page-stack")}>
      <section className={ui("summary-strip")}>
        <div>
          <small>Mes factures</small>
          <strong>{invoices.data?.length ?? 0}</strong>
        </div>
        <div>
          <small>Mes ventes</small>
          <strong>{money.format(total)}</strong>
        </div>
        <div>
          <small>Solde clients</small>
          <strong>{money.format(Math.max(0, total - paid))}</strong>
        </div>
        <div>
          <small>Produits disponibles</small>
          <strong>{products.data?.total ?? 0}</strong>
        </div>
      </section>
      <section className={ui("panel data-panel")}>
        <div className={ui("data-toolbar")}>
          <strong>Mes outils</strong>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map(({ section, label, icon: Icon }) => (
            <button
              key={section}
              className={ui("secondary-button")}
              onClick={() => onNavigate(section)}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
