import { ui } from "../lib/ui";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import type {
  DashboardAnalytics,
  DashboardAnalyticsRange,
  DashboardRecentProduct,
  DashboardTopCity,
  DashboardTopCustomer,
  DashboardTopProduct,
  UserRole,
} from "@cosmetics/contracts";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LockKeyhole,
  MapPinned,
  PackageX,
  Scale,
  TrendingUp,
  WalletCards,
  CircleDollarSign,
  PackageOpen,
  Printer,
  ReceiptText,
  Store,
  UsersRound,
} from "lucide-react";
import { ErrorState } from "../components/EmptyState";
import { api, ApiRequestError } from "../lib/api";
import type { Section, NavigationOptions } from "../lib/navigation";
import { integer, money } from "../lib/format";
import { resolveMediaUrl } from "../lib/media";
import { Modal } from "../components/Modal";

const dashboardToday = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Casablanca" }).format(
    new Date(),
  );

type AnalyticsPeriod = DashboardAnalytics["periods"][number];

type DashboardInsight =
  | {
      kind: "recent-product";
      item: DashboardRecentProduct;
      context: "purchase" | "sale";
    }
  | {
      kind: "top-product";
      item: DashboardTopProduct;
      segment: "wholesale" | "retail";
    }
  | {
      kind: "customer";
      item: DashboardTopCustomer;
      segment: "wholesale" | "retail";
    }
  | { kind: "city"; item: DashboardTopCity };

function PerformanceTooltip({
  active,
  label,
  payload,
  periodLabel,
}: {
  active?: boolean;
  label?: string;
  payload?: ReadonlyArray<{ payload?: AnalyticsPeriod }>;
  periodLabel: (period: string) => string;
}) {
  const period = payload?.[0]?.payload;
  if (!active || !period) return null;
  const average = period.orderCount ? period.revenue / period.orderCount : 0;
  const marginRate = period.revenue
    ? (period.grossMargin / period.revenue) * 100
    : 0;
  return (
    <div className="min-w-60 rounded-xl border border-line bg-white p-3 text-[11px] text-ink shadow-xl dark:bg-[#282428]/80 backdrop-blur-xl">
      <strong className="mb-2 block text-xs capitalize">
        {periodLabel(String(label))}
      </strong>
      <div className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-1.5">
        <span className="text-muted">CA total</span>
        <b>{money.format(period.revenue)}</b>
        <span className="text-muted">Ventes grossistes</span>
        <b>{money.format(period.wholesaleRevenue)}</b>
        <span className="text-muted">Ventes boutique</span>
        <b>{money.format(period.retailRevenue)}</b>
        <span className="text-muted">Marge brute</span>
        <b>
          {money.format(period.grossMargin)} · {marginRate.toFixed(1)}%
        </b>
        <span className="text-muted">Commandes / unités</span>
        <b>
          {integer.format(period.orderCount)} /{" "}
          {integer.format(period.unitsSold)}
        </b>
        <span className="text-muted">Panier moyen</span>
        <b>{money.format(average)}</b>
        <span className="text-muted">Remises</span>
        <b>{money.format(period.discountTotal)}</b>
        <span className="text-muted">Livraison / taxes</span>
        <b>
          {money.format(period.shippingTotal)} / {money.format(period.taxTotal)}
        </b>
      </div>
    </div>
  );
}

function ProductImage({
  product,
  size = "large",
}: {
  product: Pick<DashboardRecentProduct, "name" | "imageUrl">;
  size?: "small" | "large";
}) {
  const [failed, setFailed] = useState(false);
  const className =
    size === "large" ? "h-28 w-full rounded-xl" : "size-12 shrink-0 rounded-xl";
  return product.imageUrl && !failed ? (
    <img
      src={resolveMediaUrl(product.imageUrl)}
      alt={product.name.slice(0, 1).toUpperCase()}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} border border-line dark:bg-white/10 bg-black/5 object-contain p-1`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${className} grid place-items-center bg-linear-to-br from-brand/10 to-[#ff848f]/10 text-xl font-bold text-brand`}
    >
      {product.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function RecentProductsPanel({
  eyebrow,
  title,
  icon,
  items,
  empty,
  onSelect,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  items: DashboardRecentProduct[];
  empty: string;
  onSelect: (item: DashboardRecentProduct) => void;
}) {
  return (
    <article className={`${ui("panel")} overflow-hidden p-0!`}>
      <header className="flex items-center gap-3 border-b border-line bg-linear-to-r from-brand-soft/80 via-white to-amber-50/60 p-4 dark:via-[#282428] dark:to-[#332c27]">
        <span className="grid size-10 place-items-center rounded-xl bg-white text-brand shadow-sm dark:bg-[#352f34]">
          {icon}
        </span>
        <div>
          <p className={ui("overline")}>{eyebrow}</p>
          <h2 className="mt-1 text-sm font-bold">{title}</h2>
        </div>
      </header>
      {items.length ? (
        <div className="grid auto-cols-[minmax(185px,1fr)] grid-flow-col gap-3 overflow-x-auto p-4 [scrollbar-width:thin]">
          {items.map((product) => (
            <button
              type="button"
              key={product.id}
              aria-label={`Voir les détails de ${product.name}`}
              onClick={() => onSelect(product)}
              className="group rounded-2xl border border-line bg-surface p-2.5 text-left transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <div className="relative">
                <ProductImage product={product} />
                <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[9px] font-bold text-ink shadow-sm dark:bg-[#282428]/95">
                  {integer.format(product.quantity)} unité(s)
                </span>
              </div>
              <p className="mt-2 truncate text-[9px] font-bold uppercase tracking-wider text-brand">
                {product.brand}
              </p>
              <h3 className="mt-0.5 line-clamp-2 min-h-8 text-xs font-bold leading-4">
                {product.name}
              </h3>
              <p className="mt-1 truncate text-[9px] text-muted">
                {product.partnerName}
              </p>
              <div className="mt-2 flex items-end justify-between gap-2 border-t border-line pt-2">
                <strong className="text-xs">
                  {money.format(product.amount)}
                </strong>
                <time className="text-[9px] text-muted">
                  {new Date(product.occurredAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </time>
              </div>
              <span className="mt-2 block text-[9px] font-semibold text-brand opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                Voir les détails →
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="p-8 text-center text-xs text-muted">{empty}</p>
      )}
    </article>
  );
}

function TopProductsPanel({
  eyebrow,
  title,
  icon,
  items,
  empty,
  onSelect,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  items: DashboardTopProduct[];
  empty: string;
  onSelect: (item: DashboardTopProduct) => void;
}) {
  const maximum = Math.max(...items.map((item) => item.unitsSold), 1);
  return (
    <article className={`${ui("panel")} overflow-hidden p-0!`}>
      <header className="flex items-center gap-3 border-b border-line bg-linear-to-r from-brand-soft/80 via-white to-amber-50/60 p-4 dark:via-[#282428] dark:to-[#332c27]">
        <span className="grid size-10 place-items-center rounded-xl bg-white text-brand shadow-sm dark:bg-[#352f34]">
          {icon}
        </span>
        <div>
          <p className={ui("overline")}>{eyebrow}</p>
          <h2 className="mt-1 text-sm font-bold">{title}</h2>
        </div>
      </header>
      <div className="space-y-2.5 p-4">
        {items.map((product, index) => (
          <button
            type="button"
            key={product.variantId}
            aria-label={`Voir les détails de ${product.name}`}
            onClick={() => onSelect(product)}
            className="group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-line bg-brand-soft/5 p-2.5 text-left transition hover:border-brand/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:bg-black/10"
          >
            <span
              className="absolute inset-y-0 left-0 dark:bg-black/30 bg-brand-soft/70 transition-all rounded-md"
              style={{ width: `${(product.unitsSold / maximum) * 100}%` }}
            />
            <span className="relative grid size-6 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-brand shadow-sm dark:bg-[#302b2f]">
              {index + 1}
            </span>
            <div className="relative">
              <ProductImage product={product} size="small" />
            </div>
            <div className="relative min-w-0 flex-1">
              <strong className="block truncate text-xs">{product.name}</strong>
              <small className="mt-0.5 block truncate text-[9px] text-muted">
                {product.brand} · {product.sku} · {product.orderCount}{" "}
                commande(s)
              </small>
            </div>
            <div className="relative shrink-0 text-right">
              <strong className="block text-xs">
                {integer.format(product.unitsSold)} u.
              </strong>
              <small className="text-[9px] text-muted">
                {money.format(product.revenue)}
              </small>
            </div>
          </button>
        ))}
        {!items.length && (
          <p className="py-8 text-center text-xs text-muted">{empty}</p>
        )}
      </div>
    </article>
  );
}

function TopCustomersPanel({
  eyebrow,
  title,
  icon,
  items,
  empty,
  onSelect,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  items: DashboardTopCustomer[];
  empty: string;
  onSelect: (item: DashboardTopCustomer) => void;
}) {
  const maximum = Math.max(...items.map((item) => item.revenue), 1);
  return (
    <article className={`${ui("panel")} overflow-hidden p-0!`}>
      <header className="flex items-center gap-3 border-b border-line bg-linear-to-r from-brand-soft/80 via-white to-amber-50/60 p-4 dark:via-[#282428] dark:to-[#332c27]">
        <span className="grid size-10 place-items-center rounded-xl bg-white text-brand shadow-sm dark:bg-[#352f34]">
          {icon}
        </span>
        <div>
          <p className={ui("overline")}>{eyebrow}</p>
          <h2 className="mt-1 text-sm font-bold">{title}</h2>
        </div>
      </header>
      <div className="space-y-2.5 p-4">
        {items.map((customer, index) => (
          <button
            type="button"
            key={customer.customerId}
            aria-label={`Voir les détails de ${customer.name}`}
            onClick={() => onSelect(customer)}
            className="relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-line bg-brand-soft/5 p-2.5 text-left transition hover:border-brand/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:bg-black/10"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-md bg-brand-soft/70 dark:bg-black/30"
              style={{ width: `${(customer.revenue / maximum) * 100}%` }}
            />
            <span className="relative grid size-7 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-brand shadow-sm dark:bg-[#302b2f]">
              {index + 1}
            </span>
            {/* <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand/10 to-[#ff848f]/10 text-xs font-bold text-brand">
              {customer.name.slice(0, 1).toUpperCase()}
            </span> */}
            <div className="relative min-w-0 flex-1">
              <strong className="block truncate text-xs">
                {customer.name}
              </strong>
              <small className="mt-0.5 block truncate text-[9px] text-muted">
                {customer.city} · {integer.format(customer.orderCount)}{" "}
                commande(s) · {integer.format(customer.unitsBought)} unité(s)
              </small>
            </div>
            <strong className="relative shrink-0 text-xs">
              {money.format(customer.revenue)}
            </strong>
          </button>
        ))}
        {!items.length && (
          <p className="py-8 text-center text-xs text-muted">{empty}</p>
        )}
      </div>
    </article>
  );
}

function TopCitiesPanel({
  eyebrow,
  items,
  onSelect,
}: {
  eyebrow: string;
  items: DashboardTopCity[];
  onSelect: (item: DashboardTopCity) => void;
}) {
  const maximum = Math.max(...items.map((item) => item.revenue), 1);
  return (
    <article className={`${ui("panel")} overflow-hidden p-0!`}>
      <header className="flex items-center gap-3 border-b border-line bg-linear-to-r from-brand-soft/80 via-white to-amber-50/60 p-4 dark:via-[#282428] dark:to-[#332c27]">
        <span className="grid size-10 place-items-center rounded-xl bg-white text-brand shadow-sm dark:bg-[#352f34]">
          <MapPinned size={19} />
        </span>
        <div>
          <p className={ui("overline")}>{eyebrow}</p>
          <h2 className="mt-1 text-sm font-bold">Villes les plus actives</h2>
        </div>
      </header>
      <div className="space-y-2.5 p-4">
        {items.map((city, index) => (
          <button
            type="button"
            key={city.city}
            aria-label={`Voir les détails de ${city.city}`}
            onClick={() => onSelect(city)}
            className="relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-line bg-brand-soft/5 p-2.5 text-left transition hover:border-brand/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:bg-black/10"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-md bg-brand-soft/70 dark:bg-black/30"
              style={{ width: `${(city.revenue / maximum) * 100}%` }}
            />
            <span className="relative grid size-7 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-brand shadow-sm dark:bg-[#302b2f]">
              {index + 1}
            </span>
            {/* <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand/10 to-[#ff848f]/10 text-xs font-bold text-brand">
              <MapPinned size={17} />
            </span> */}
            <div className="relative min-w-0 flex-1">
              <strong className="block truncate text-xs">{city.city}</strong>
              <small className="mt-0.5 block text-[9px] text-muted">
                {integer.format(city.customerCount)} client(s) ·{" "}
                {integer.format(city.orderCount)} commande(s)
              </small>
            </div>
            <strong className="relative shrink-0 text-xs">
              {money.format(city.revenue)}
            </strong>
          </button>
        ))}
        {!items.length && (
          <p className="py-8 text-center text-xs text-muted">
            Aucune ville disponible sur cette période.
          </p>
        )}
      </div>
    </article>
  );
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-3">
      <small className="block text-[9px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </small>
      <strong className="mt-1.5 block text-sm">{value}</strong>
    </div>
  );
}

function DashboardInsightModal({
  insight,
  onClose,
}: {
  insight: DashboardInsight;
  onClose: () => void;
}) {
  const isProduct =
    insight.kind === "recent-product" || insight.kind === "top-product";
  const title = isProduct
    ? "Détails du produit"
    : insight.kind === "customer"
      ? "Détails du client"
      : "Détails de la ville";
  const subtitle =
    insight.kind === "recent-product"
      ? insight.context === "purchase"
        ? "Dernière réception fournisseur"
        : "Dernière vente enregistrée"
      : insight.kind === "top-product"
        ? `Performance ${insight.segment === "wholesale" ? "grossiste" : "boutique"}`
        : insight.kind === "customer"
          ? `Classement ${insight.segment === "wholesale" ? "grossiste" : "boutique"}`
          : "Performance commerciale par zone";

  let heading = "";
  let supporting = "";
  let metrics: Array<[string, string]> = [];
  if (insight.kind === "recent-product") {
    const { item } = insight;
    heading = item.name;
    supporting = `${item.brand} · ${item.sku}`;
    metrics = [
      ["Quantité", `${integer.format(item.quantity)} unité(s)`],
      ["Montant", money.format(item.amount)],
      [
        insight.context === "purchase" ? "Fournisseur" : "Client",
        item.partnerName,
      ],
      ["Document", item.documentNumber],
      [
        "Date",
        new Date(item.occurredAt).toLocaleString("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
        }),
      ],
      [
        "Canal",
        item.channel === "PURCHASE"
          ? "Réception fournisseur"
          : item.channel === "RETAIL"
            ? "Boutique"
            : "Vente en gros",
      ],
    ];
  } else if (insight.kind === "top-product") {
    const { item } = insight;
    heading = item.name;
    supporting = `${item.brand} · ${item.sku}`;
    metrics = [
      ["Unités vendues", integer.format(item.unitsSold)],
      ["Chiffre d’affaires", money.format(item.revenue)],
      ["Commandes", integer.format(item.orderCount)],
      [
        "Panier moyen",
        money.format(item.orderCount ? item.revenue / item.orderCount : 0),
      ],
      [
        "Revenu moyen / unité",
        money.format(item.unitsSold ? item.revenue / item.unitsSold : 0),
      ],
      ["Segment", insight.segment === "wholesale" ? "Grossiste" : "Boutique"],
    ];
  } else if (insight.kind === "customer") {
    const { item } = insight;
    heading = item.name;
    supporting = item.city;
    metrics = [
      ["Chiffre d’affaires", money.format(item.revenue)],
      ["Commandes", integer.format(item.orderCount)],
      ["Unités achetées", integer.format(item.unitsBought)],
      [
        "Panier moyen",
        money.format(item.orderCount ? item.revenue / item.orderCount : 0),
      ],
      [
        "Unités / commande",
        (item.orderCount
          ? item.unitsBought / item.orderCount
          : 0
        ).toLocaleString("fr-FR", { maximumFractionDigits: 1 }),
      ],
      ["Segment", insight.segment === "wholesale" ? "Grossiste" : "Boutique"],
    ];
  } else {
    const { item } = insight;
    heading = item.city;
    supporting = "Zone de vente";
    metrics = [
      ["Chiffre d’affaires", money.format(item.revenue)],
      ["Commandes", integer.format(item.orderCount)],
      ["Clients", integer.format(item.customerCount)],
      [
        "Panier moyen",
        money.format(item.orderCount ? item.revenue / item.orderCount : 0),
      ],
      [
        "CA moyen / client",
        money.format(
          item.customerCount ? item.revenue / item.customerCount : 0,
        ),
      ],
    ];
  }

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-linear-to-r from-brand-soft/70 via-surface to-amber-50/60 p-4 dark:via-[#282428] dark:to-[#332c27]">
          {isProduct ? (
            <div className="w-24 shrink-0">
              <ProductImage product={insight.item} />
            </div>
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white text-brand shadow-sm dark:bg-[#352f34]">
              {insight.kind === "customer" ? (
                <UsersRound size={24} />
              ) : (
                <MapPinned size={24} />
              )}
            </span>
          )}
          <div className="min-w-0">
            <p className={ui("overline")}>{supporting}</p>
            <h3 className="mt-1 text-lg font-bold">{heading}</h3>
            <p className="mt-1 text-[10px] text-muted">
              {insight.kind === "recent-product"
                ? "Données du mouvement enregistré dans le stock."
                : "Résumé calculé sur la période active du tableau de bord."}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {metrics.map(([label, metric]) => (
            <InsightMetric key={label} label={label} value={metric} />
          ))}
        </div>
        <div className={ui("modal-actions")}>
          <button
            type="button"
            className={ui("secondary-button")}
            onClick={onClose}
          >
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function DashboardPage({
  onNavigate,
  role,
  reportOpen = false,
  onReportClose = () => undefined,
}: {
  role: UserRole;
  onNavigate: (section: Section, options?: NavigationOptions) => void;
  reportOpen?: boolean;
  onReportClose?: () => void;
}) {
  const canFinance = ["OWNER", "MANAGER", "ACCOUNTANT"].includes(role);
  const [range, setRange] = useState<DashboardAnalyticsRange>("month");
  const [selectedInsight, setSelectedInsight] =
    useState<DashboardInsight | null>(null);
  const analytics = useQuery({
    queryKey: ["dashboard-analytics", range],
    queryFn: () => api.analytics(range),
    refetchInterval: 30_000,
  });
  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: api.dashboard,
    refetchInterval: 30_000,
  });

  if (summary.isError) {
    const message =
      summary.error instanceof ApiRequestError
        ? summary.error.message
        : "Impossible de charger le tableau de bord.";
    return (
      <ErrorState message={message} retry={() => void summary.refetch()} />
    );
  }

  const value = summary.data;
  const periods = analytics.data?.periods ?? [];
  const revenue = periods.reduce((sum, period) => sum + period.revenue, 0);
  const margin = periods.reduce((sum, period) => sum + period.grossMargin, 0);
  const orderCount = periods.reduce(
    (sum, period) => sum + period.orderCount,
    0,
  );
  const unitsSold = periods.reduce((sum, period) => sum + period.unitsSold, 0);
  const discounts = periods.reduce(
    (sum, period) => sum + period.discountTotal,
    0,
  );
  const averageOrder = orderCount ? revenue / orderCount : 0;
  const marginRate = revenue ? (margin / revenue) * 100 : 0;
  const rangeCopy = {
    year: { detail: "12 mois", button: "Année" },
    month: { detail: "30 jours", button: "Mois" },
    week: { detail: "7 jours", button: "Semaine" },
  } satisfies Record<
    DashboardAnalyticsRange,
    { detail: string; button: string }
  >;
  const periodLabel = (period: string) =>
    new Intl.DateTimeFormat(
      "fr-FR",
      analytics.data?.grain === "day"
        ? { day: "2-digit", month: "short", timeZone: "UTC" }
        : { month: "short", year: "2-digit", timeZone: "UTC" },
    ).format(
      new Date(
        `${period}${analytics.data?.grain === "day" ? "" : "-01"}T00:00:00Z`,
      ),
    );
  const productInsights = analytics.data?.products ?? {
    recentPurchases: [],
    recentSales: [],
    topWholesale: [],
    topRetail: [],
  };
  const customerInsights = analytics.data?.customers ?? {
    topWholesale: [],
    topRetail: [],
    topCities: [],
  };
  const cards = [
    {
      label: "Chiffre d’affaires",
      value: analytics.data ? money.format(revenue) : "—",
      icon: TrendingUp,
      detail: `${rangeCopy[range].detail} · ventes confirmées`,
      tone: "ink",
    },
    {
      label: "Marge brute",
      value: analytics.data ? money.format(margin) : "—",
      icon: Scale,
      detail: `${rangeCopy[range].detail} · après coût produits`,
      tone: "green",
    },
    {
      label: "Valeur du stock",
      value: value ? money.format(value.inventoryValue) : "—",
      icon: Boxes,
      detail: value
        ? `${integer.format(value.unitsInStock)} unités · stock actuel`
        : "Chargement…",
      tone: "gold",
    },
    {
      label: "Encaissements reçus",
      value: value ? money.format(value.incomeReceived) : "—",
      icon: CircleDollarSign,
      detail: "Paiements clients réellement encaissés",
      tone: "green",
    },
    {
      label: "Créances clients",
      value: value ? money.format(value.customerReceivables) : "—",
      icon: WalletCards,
      detail: "Solde actuel à recouvrer",
      tone: "rose",
    },
  ];

  return (
    <div className={ui("dashboard-stack")}>
      <section className={ui("metric-grid")}>
        {cards.map(({ label, value: cardValue, icon: Icon, detail, tone }) => (
          <article className={ui(`metric-card metric-${tone}`)} key={label}>
            <div className={ui("metric-top")}>
              <span>{label}</span>
              <i>
                <Icon size={19} />
              </i>
            </div>
            <strong>{cardValue}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </section>

      <section className={ui("dashboard-grid")}>
        <article className={ui("panel performance-panel")}>
          <div className={ui("panel-heading")}>
            <div>
              <p className={ui("overline")}>Performance</p>
              <h2>Chiffre d’affaires &amp; marge</h2>
            </div>
            <div
              className="flex rounded-xl bg-[#f7f7fa] p-1 dark:bg-[#1b191b]"
              aria-label="Période du graphique"
              role="group"
            >
              {(["year", "month", "week"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={range === value}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${range === value ? "bg-white text-ink shadow-sm dark:bg-[#332e32]" : "text-muted hover:text-ink"}`}
                  onClick={() => setRange(value)}
                >
                  {rangeCopy[value].button}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
            <p>
              CA total et marge brute · MAD · le détail par canal reste visible
              au survol.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <i className="size-2.5 rounded-sm bg-[#f66897]" />
                Chiffre d’affaires
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-0.5 w-4 bg-ink" /> Marge brute
              </span>
            </div>
          </div>
          {analytics.isError ? (
            <ErrorState
              message="Impossible de charger les statistiques."
              retry={() => void analytics.refetch()}
            />
          ) : analytics.isLoading ? (
            <p className="py-16 text-center text-muted">
              Chargement des statistiques…
            </p>
          ) : (
            <>
              {!periods.some((period) => period.orderCount > 0) && (
                <p className="rounded-lg bg-brand-soft p-3 text-sm">
                  Aucune vente confirmée sur cette période.
                </p>
              )}
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Commandes", integer.format(orderCount)],
                  ["Unités vendues", integer.format(unitsSold)],
                  ["Panier moyen", money.format(averageOrder)],
                  ["Taux de marge", `${marginRate.toFixed(1)}%`],
                ].map(([label, metric]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-line bg-surface px-3 py-2.5"
                  >
                    <small className="block text-[9px] text-muted">
                      {label}
                    </small>
                    <strong className="mt-1 block text-xs">{metric}</strong>
                  </div>
                ))}
              </div>
              <div className="h-80 min-w-0 text-[10px] [&_.recharts-surface]:outline-none [&_.recharts-surface_*]:outline-none">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={periods}
                    margin={{ top: 12, right: 18, bottom: 8, left: 0 }}
                    accessibilityLayer
                  >
                    <CartesianGrid
                      stroke="var(--color-line)"
                      strokeWidth={1}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="period"
                      tickFormatter={periodLabel}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={22}
                      tick={{ fill: "var(--color-muted)", fontSize: 10 }}
                    />
                    <YAxis
                      domain={[
                        0,
                        (maximum: number) =>
                          Math.max(100, Math.ceil(maximum * 1.2)),
                      ]}
                      tickFormatter={(number) =>
                        new Intl.NumberFormat("fr-FR", {
                          notation: "compact",
                        }).format(Number(number))
                      }
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tick={{ fill: "var(--color-muted)", fontSize: 10 }}
                    />
                    <Tooltip
                      content={<PerformanceTooltip periodLabel={periodLabel} />}
                      cursor={{
                        fill: "var(--color-brand-soft)",
                        fillOpacity: 0.55,
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      name="Chiffre d’affaires"
                      fill="#ff848f"
                      maxBarSize={34}
                      radius={[7, 7, 4, 4]}
                    />
                    <Line
                      type="monotone"
                      dataKey="grossMargin"
                      name="Marge brute"
                      stroke="var(--color-ink)"
                      strokeWidth={2.5}
                      dot={{ r: 0, fill: "var(--color-ink)" }}
                      activeDot={{
                        r: 5,
                        fill: "var(--color-ink)",
                        stroke: "var(--color-surface)",
                        strokeWidth: 2,
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-muted">
                <span>
                  Remises sur la période : <b>{money.format(discounts)}</b>
                </span>
                <span>
                  Survolez une barre pour le détail complet de la période.
                </span>
              </div>
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer font-semibold text-brand">
                  Voir les valeurs détaillées
                </summary>
                <div className={ui("table-wrap")}>
                  <table>
                    <thead>
                      <tr>
                        <th>Période</th>
                        <th>Commandes</th>
                        <th>Unités</th>
                        <th>CA grossiste</th>
                        <th>CA boutique</th>
                        <th>CA total</th>
                        <th>Marge brute</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((period) => (
                        <tr key={period.period}>
                          <td>{periodLabel(period.period)}</td>
                          <td>{period.orderCount}</td>
                          <td>{period.unitsSold}</td>
                          <td>{money.format(period.wholesaleRevenue)}</td>
                          <td>{money.format(period.retailRevenue)}</td>
                          <td>{money.format(period.revenue)}</td>
                          <td>{money.format(period.grossMargin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <p className="mt-3 text-[10px] leading-relaxed text-muted">
                Source : commandes et coûts historiques en base · fuseau
                Casablanca · actualisé{" "}
                {analytics.data &&
                  new Date(analytics.data.generatedAt).toLocaleTimeString(
                    "fr-FR",
                  )}
                . CA avec livraison/taxes ; marge sur produits uniquement.
              </p>
            </>
          )}
        </article>

        <article className={ui("panel alerts-panel")}>
          <div className={ui("panel-heading")}>
            <div>
              <p className={ui("overline")}>Attention requise</p>
              <h2>Alertes</h2>
            </div>
          </div>
          <button
            className={ui("alert-row")}
            onClick={() => onNavigate("inventory", { stock: "low" })}
          >
            <span className={ui("alert-icon warning")}>
              <AlertTriangle size={18} />
            </span>
            <div>
              <strong>Stock faible</strong>
              <small>
                {value?.lowStockCount ?? "—"} références disponibles sous le
                seuil
              </small>
            </div>
            <ArrowRight size={17} />
          </button>
          <button
            className={ui("alert-row")}
            onClick={() => onNavigate("inventory", { stock: "out" })}
          >
            <span className={ui("alert-icon danger")}>
              <PackageX size={18} />
            </span>
            <div>
              <strong>Ruptures de stock</strong>
              <small>
                {value?.outOfStockCount ?? "—"} références indisponibles
              </small>
            </div>
            <ArrowRight size={17} />
          </button>
          <button
            className={ui("alert-row")}
            onClick={() => onNavigate("orders")}
          >
            <span className={ui("alert-icon warning")}>
              <ClipboardList size={18} />
            </span>
            <div>
              <strong>Commandes boutique à traiter</strong>
              <small>
                {value?.ordersToProcess ?? "—"} commandes à préparer ou livrer
              </small>
            </div>
            <ArrowRight size={17} />
          </button>
          <button
            className={ui("alert-row")}
            onClick={() => onNavigate("inventory")}
          >
            <span className={ui("alert-icon blue")}>
              <LockKeyhole size={18} />
            </span>
            <div>
              <strong>Stock réservé</strong>
              <small>
                {value?.reservedUnits ?? "—"} unités affectées aux commandes
              </small>
            </div>
            <ArrowRight size={17} />
          </button>
          {canFinance && (
            <button
              className={ui("alert-row")}
              onClick={() => onNavigate("finance", { financeTab: "checks" })}
            >
              <span className={ui("alert-icon blue")}>
                <Banknote size={18} />
              </span>
              <div>
                <strong>Chèques en attente</strong>
                <small>{value?.pendingChecks ?? "—"} chèques à suivre</small>
              </div>
              <ArrowRight size={17} />
            </button>
          )}
          {canFinance && (
            <button
              className={ui("alert-row")}
              onClick={() => onNavigate("finance", { financeTab: "checks" })}
            >
              <span className={ui("alert-icon danger")}>
                <CalendarClock size={18} />
              </span>
              <div>
                <strong>Chèques arrivés à échéance</strong>
                <small>{value?.dueChecks ?? "—"} chèques à régulariser</small>
              </div>
              <ArrowRight size={17} />
            </button>
          )}
          {canFinance && (
            <button
              className={ui("alert-row")}
              onClick={() =>
                onNavigate("finance", { financeTab: "receivables" })
              }
            >
              <span className={ui("alert-icon warning")}>
                <WalletCards size={18} />
              </span>
              <div>
                <strong>Factures à encaisser</strong>
                <small>
                  {value ? money.format(value.customerReceivables) : "—"} ·
                  solde clients
                </small>
              </div>
              <ArrowRight size={17} />
            </button>
          )}
          {canFinance && (
            <button
              className={ui("alert-row")}
              onClick={() => onNavigate("finance", { financeTab: "payables" })}
            >
              <span className={ui("alert-icon blue")}>
                <Banknote size={18} />
              </span>
              <div>
                <strong>Fournisseurs à régler</strong>
                <small>
                  {value ? money.format(value.supplierPayables) : "—"} · solde
                  fournisseurs
                </small>
              </div>
              <ArrowRight size={17} />
            </button>
          )}
          <button
            className={ui("text-button")}
            onClick={() => onNavigate("inventory")}
          >
            Voir le stock <ArrowRight size={15} />
          </button>
        </article>
      </section>

      <section className="space-y-3.5">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className={ui("overline")}>Mouvements produits</p>
            <h2 className="mt-1 text-base font-bold">
              Ce qui entre, ce qui sort et ce qui performe
            </h2>
          </div>
          <small className="text-[10px] text-muted">
            Classements sur {rangeCopy[range].detail.toLowerCase()} · quantités
            nettes après retours
          </small>
        </div>
        <div className="grid gap-3.5 xl:grid-cols-2">
          <RecentProductsPanel
            eyebrow="Réceptions fournisseurs"
            title="Derniers produits achetés"
            icon={<PackageOpen size={19} />}
            items={productInsights.recentPurchases}
            empty="Aucune réception fournisseur enregistrée."
            onSelect={(item) =>
              setSelectedInsight({
                kind: "recent-product",
                item,
                context: "purchase",
              })
            }
          />
          <RecentProductsPanel
            eyebrow="Sorties de stock"
            title="Derniers produits vendus"
            icon={<ReceiptText size={19} />}
            items={productInsights.recentSales}
            empty="Aucune vente confirmée enregistrée."
            onSelect={(item) =>
              setSelectedInsight({
                kind: "recent-product",
                item,
                context: "sale",
              })
            }
          />
          <TopProductsPanel
            eyebrow={`Top ${rangeCopy[range].detail.toLowerCase()}`}
            title="Produits préférés des grossistes"
            icon={<UsersRound size={19} />}
            items={productInsights.topWholesale}
            empty="Aucune vente grossiste sur cette période."
            onSelect={(item) =>
              setSelectedInsight({
                kind: "top-product",
                item,
                segment: "wholesale",
              })
            }
          />
          <TopProductsPanel
            eyebrow={`Top ${rangeCopy[range].detail.toLowerCase()}`}
            title="Produits préférés en boutique"
            icon={<Store size={19} />}
            items={productInsights.topRetail}
            empty="Aucune vente boutique sur cette période."
            onSelect={(item) =>
              setSelectedInsight({
                kind: "top-product",
                item,
                segment: "retail",
              })
            }
          />
        </div>
      </section>

      <section className="space-y-3.5">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className={ui("overline")}>Performance commerciale</p>
            <h2 className="mt-1 text-base font-bold">
              Meilleurs clients et zones de vente
            </h2>
          </div>
          <small className="text-[10px] text-muted">
            Classement par chiffre d’affaires ·{" "}
            {rangeCopy[range].detail.toLowerCase()}
          </small>
        </div>
        <div className="grid gap-3.5 xl:grid-cols-3">
          <TopCustomersPanel
            eyebrow={`Top ${rangeCopy[range].detail.toLowerCase()}`}
            title="Meilleurs clients grossistes"
            icon={<UsersRound size={19} />}
            items={customerInsights.topWholesale}
            empty="Aucun client grossiste sur cette période."
            onSelect={(item) =>
              setSelectedInsight({
                kind: "customer",
                item,
                segment: "wholesale",
              })
            }
          />
          <TopCustomersPanel
            eyebrow={`Top ${rangeCopy[range].detail.toLowerCase()}`}
            title="Meilleurs clients boutique"
            icon={<Store size={19} />}
            items={customerInsights.topRetail}
            empty="Aucun client boutique sur cette période."
            onSelect={(item) =>
              setSelectedInsight({ kind: "customer", item, segment: "retail" })
            }
          />
          <TopCitiesPanel
            eyebrow={`Top ${rangeCopy[range].detail.toLowerCase()}`}
            items={customerInsights.topCities}
            onSelect={(item) => setSelectedInsight({ kind: "city", item })}
          />
        </div>
      </section>

      {reportOpen && canFinance && (
        <DashboardReportModal onClose={onReportClose} />
      )}
      {selectedInsight && (
        <DashboardInsightModal
          insight={selectedInsight}
          onClose={() => setSelectedInsight(null)}
        />
      )}
    </div>
  );
}

function ReportCalendarMonth({
  month,
  dateFrom,
  dateTo,
  today,
  onSelect,
  previous,
  next,
}: {
  month: string;
  dateFrom: string;
  dateTo: string;
  today: string;
  onSelect: (day: string) => void;
  previous?: () => void;
  next?: () => void;
}) {
  const firstDay = new Date(`${month.slice(0, 8)}01T12:00:00Z`);
  const year = firstDay.getUTCFullYear();
  const monthIndex = firstDay.getUTCMonth();
  const days = new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
  const leading = firstDay.getUTCDay();
  const cells = Array.from({ length: leading + days }, (_, index) => {
    if (index < leading) return null;
    const day = new Date(Date.UTC(year, monthIndex, index - leading + 1, 12));
    return day.toISOString().slice(0, 10);
  });
  const monthLabel = firstDay.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <section className="rounded-xl border border-line bg-surface p-3">
      <header className="mb-3 grid grid-cols-[32px_1fr_32px] items-center">
        {previous ? (
          <button
            type="button"
            aria-label="Mois précédents"
            className="grid size-8 place-items-center rounded-lg border border-line bg-white text-ink transition hover:border-brand hover:text-brand dark:bg-[#302b2f]"
            onClick={previous}
          >
            <ChevronLeft size={16} />
          </button>
        ) : (
          <span />
        )}
        <strong className="text-center text-xs capitalize">{monthLabel}</strong>
        {next ? (
          <button
            type="button"
            aria-label="Mois suivants"
            className="grid size-8 place-items-center rounded-lg border border-line bg-white text-ink transition hover:border-brand hover:text-brand dark:bg-[#302b2f]"
            onClick={next}
          >
            <ChevronRight size={16} />
          </button>
        ) : (
          <span />
        )}
      </header>
      <div className="grid grid-cols-7 text-center text-[9px] font-bold text-muted">
        {["D", "L", "M", "M", "J", "V", "S"].map((day, index) => (
          <span key={`${day}-${index}`} className="py-1">
            {day}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1 text-center">
        {cells.map((day, index) =>
          day ? (
            <button
              key={day}
              type="button"
              aria-label={new Date(`${day}T12:00:00Z`).toLocaleDateString(
                "fr-FR",
                { dateStyle: "long", timeZone: "UTC" },
              )}
              disabled={day > today}
              onClick={() => onSelect(day)}
              className={`mx-auto grid size-8 place-items-center rounded-lg text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-25 ${
                day === dateFrom || day === dateTo
                  ? "bg-brand text-white shadow-sm"
                  : day > dateFrom && day < dateTo
                    ? "bg-brand-soft text-brand"
                    : day === today
                      ? "ring-1 ring-brand/50 text-brand"
                      : "text-ink hover:bg-brand-soft hover:text-brand"
              }`}
            >
              {Number(day.slice(-2))}
            </button>
          ) : (
            <span key={`empty-${index}`} className="size-8" />
          ),
        )}
      </div>
    </section>
  );
}

function DashboardReportModal({ onClose }: { onClose: () => void }) {
  const today = dashboardToday();
  const [dateFrom, setDateFrom] = useState(`${today.slice(0, 8)}01`);
  const [dateTo, setDateTo] = useState(today);
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const month = new Date(`${today.slice(0, 8)}01T12:00:00Z`);
    month.setUTCMonth(month.getUTCMonth() - 1);
    return month.toISOString().slice(0, 10);
  });
  const report = useQuery({
    queryKey: ["dashboard-report", dateFrom, dateTo],
    queryFn: () => api.dashboardReport(dateFrom, dateTo),
    enabled: Boolean(dateFrom && dateTo && dateFrom <= dateTo),
  });
  const value = report.data;
  const kindLabels = { sale: "Vente", purchase: "Achat", expense: "Dépense" };
  const selectedDays =
    Math.max(
      0,
      Math.round(
        (Date.parse(`${dateTo}T12:00:00Z`) -
          Date.parse(`${dateFrom}T12:00:00Z`)) /
          86_400_000,
      ),
    ) + 1;
  const dateAtOffset = (days: number) => {
    const start = new Date(`${today}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() + days);
    return start.toISOString().slice(0, 10);
  };
  const calendarCursor = (from: string, to: string) => {
    const month = new Date(`${from.slice(0, 8)}01T12:00:00Z`);
    if (from.slice(0, 7) === to.slice(0, 7)) {
      month.setUTCMonth(month.getUTCMonth() - 1);
    }
    return month.toISOString().slice(0, 10);
  };
  const selectRange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setCalendarMonth(calendarCursor(from, to));
    setChoosingEnd(false);
  };
  const weekStart = (value: string) => {
    const date = new Date(`${value}T12:00:00Z`);
    const weekday = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - weekday + 1);
    return date.toISOString().slice(0, 10);
  };
  const thisWeek = weekStart(today);
  const lastWeekFrom = (() => {
    const date = new Date(`${thisWeek}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 7);
    return date.toISOString().slice(0, 10);
  })();
  const lastMonth = (() => {
    const end = new Date(`${today.slice(0, 8)}01T12:00:00Z`);
    end.setUTCDate(0);
    const start = new Date(end);
    start.setUTCDate(1);
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
  })();
  const presets: Array<[string, string, string]> = [
    ["Aujourd’hui", today, today],
    ["Hier", dateAtOffset(-1), dateAtOffset(-1)],
    ["Cette semaine", thisWeek, today],
    [
      "Semaine dernière",
      lastWeekFrom,
      dateAtOffset(-(new Date(`${today}T12:00:00Z`).getUTCDay() || 7)),
    ],
    ["7 derniers jours", dateAtOffset(-6), today],
    ["14 derniers jours", dateAtOffset(-13), today],
    ["Ce mois", `${today.slice(0, 8)}01`, today],
    ["30 derniers jours", dateAtOffset(-29), today],
    ["Mois dernier", lastMonth[0]!, lastMonth[1]!],
    ["Cette année", `${today.slice(0, 4)}-01-01`, today],
  ];
  const changeCalendarMonth = (offset: number) => {
    setCalendarMonth((current) => {
      const date = new Date(`${current}T12:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + offset);
      return date.toISOString().slice(0, 10);
    });
  };
  const secondCalendarMonth = (() => {
    const date = new Date(`${calendarMonth}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1);
    return date.toISOString().slice(0, 10);
  })();
  const selectCalendarDay = (day: string) => {
    if (!choosingEnd) {
      setDateFrom(day);
      setDateTo(day);
      setChoosingEnd(true);
      return;
    }
    if (day < dateFrom) {
      setDateTo(dateFrom);
      setDateFrom(day);
    } else {
      setDateTo(day);
    }
    setChoosingEnd(false);
  };
  const chartDate = (period: string) =>
    new Date(
      `${period}${period.length === 7 ? "-01" : ""}T12:00:00Z`,
    ).toLocaleDateString(
      "fr-FR",
      period.length === 7
        ? { month: "short", year: "2-digit" }
        : { day: "2-digit", month: "short" },
    );
  const cashPeriods =
    value?.periods.map((period) => ({
      ...period,
      netCash: period.incomeReceived - period.cashOut,
    })) ?? [];
  const printReport = () => {
    const area = document.querySelector(".report-print-area");
    const popup = window.open("", "_blank", "width=1000,height=800");
    if (!area || !popup) return window.print();
    popup.document.title = "Rapport ONight";
    const style = popup.document.createElement("style");
    style.textContent = `
      @page{size:A4;margin:12mm}:root{--color-line:#eadfe3}*{box-sizing:border-box}body{margin:0;background:#fff;color:#262126;font:11px Arial,sans-serif}
      .report-print-area{max-width:100%;color:#262126}.report-hero{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #f66897;padding-bottom:16px}
      .report-brand{color:#f66897;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase}.report-hero h2{font-size:24px;margin:6px 0}.report-period{align-self:center;border-radius:12px;background:#fff1f5;padding:10px 14px;text-align:right}
      .report-section-title{font-size:15px;margin:22px 0 4px}.report-copy{color:#6e666e;line-height:1.55;margin:0 0 12px}.report-summary{border:1px solid #eadfe3;border-radius:14px;background:#fffafb;padding:14px;margin-top:16px}
      .report-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.report-kpi{break-inside:avoid;border:1px solid #eadfe3;border-radius:10px;padding:10px}.report-kpi small{display:block;color:#786f76;font-size:9px}.report-kpi strong{display:block;font-size:15px;margin-top:5px}.report-kpi em{display:block;color:#786f76;font-size:8px;font-style:normal;margin-top:3px}
      .report-charts{display:grid;grid-template-columns:1fr;gap:12px}.report-chart{break-inside:avoid;border:1px solid #eadfe3;border-radius:12px;padding:12px}.report-chart h4{font-size:12px;margin:0}.report-chart p{color:#786f76;font-size:9px;margin:4px 0 8px}.report-chart svg{max-width:100%}
      .report-table-wrap{break-before:auto}.report-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:8px}.report-table th{background:#302b2f;color:#fff;text-transform:uppercase;letter-spacing:.4px}.report-table th,.report-table td{border-bottom:1px solid #eadfe3;padding:6px;text-align:left}.report-table td:nth-last-child(-n+3),.report-table th:nth-last-child(-n+3){text-align:right}.report-table tr{break-inside:avoid}.report-footer{border-top:1px solid #eadfe3;color:#786f76;margin-top:16px;padding-top:9px;display:flex;justify-content:space-between}
      button{display:none!important}@media print{.report-chart{page-break-inside:avoid}.report-table-wrap{page-break-before:auto}}
    `;
    popup.document.head.append(style);
    popup.document.body.append(area.cloneNode(true));
    popup.document.close();
    window.setTimeout(() => {
      popup.focus();
      popup.print();
    }, 150);
  };
  return (
    <Modal
      title="Rapport complet"
      subtitle="Choisissez une période à afficher et imprimer"
      onClose={onClose}
      size="wide"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm dark:bg-[#282428]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <CalendarClock size={19} />
              </span>
              <div>
                <strong className="block text-sm">Période du rapport</strong>
                <small className="text-[10px] text-muted">
                  {selectedDays} jour{selectedDays > 1 ? "s" : ""} sélectionné
                  {selectedDays > 1 ? "s" : ""}
                </small>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted">
              <span
                className={`size-2 rounded-full ${choosingEnd ? "animate-pulse bg-brand" : "bg-emerald-500"}`}
              />
              {choosingEnd ? "Choisissez la date de fin" : "Période prête"}
            </div>
          </div>
          <div className="grid gap-4 p-4 xl:grid-cols-[310px_1fr]">
            <div className="space-y-4">
              <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto_1fr]">
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-muted">
                    Date de début
                  </span>
                  <input
                    aria-label="Date de début"
                    className="w-full rounded-xl border border-brand/45 bg-white px-3 py-2.5 text-xs font-semibold text-ink outline-none transition focus:border-brand focus:ring-3 focus:ring-brand-soft dark:bg-[#302b2f]"
                    type="date"
                    value={dateFrom}
                    max={dateTo}
                    onChange={(event) =>
                      selectRange(event.target.value, dateTo)
                    }
                  />
                </label>
                <span className="hidden pb-3 text-[10px] font-bold text-muted sm:block">
                  au
                </span>
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-muted">
                    Date de fin
                  </span>
                  <input
                    aria-label="Date de fin"
                    className="w-full rounded-xl border border-brand/45 bg-white px-3 py-2.5 text-xs font-semibold text-ink outline-none transition focus:border-brand focus:ring-3 focus:ring-brand-soft dark:bg-[#302b2f]"
                    type="date"
                    value={dateTo}
                    min={dateFrom}
                    max={today}
                    onChange={(event) =>
                      selectRange(dateFrom, event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 content-start gap-1.5">
                {presets.map(([label, from, to]) => {
                  const active = dateFrom === from && dateTo === to;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`rounded-lg px-3 py-2.5 text-left text-[10px] font-semibold transition ${active ? "bg-brand-soft text-brand" : "text-ink hover:bg-black/4 dark:hover:bg-white/5"}`}
                      onClick={() => selectRange(from, to)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="min-w-0 border-line xl:border-l xl:pl-4">
              <div className="grid gap-3 md:grid-cols-2">
                <ReportCalendarMonth
                  month={calendarMonth}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  today={today}
                  onSelect={selectCalendarDay}
                  previous={() => changeCalendarMonth(-1)}
                />
                <ReportCalendarMonth
                  month={secondCalendarMonth}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  today={today}
                  onSelect={selectCalendarDay}
                  next={() => changeCalendarMonth(1)}
                />
              </div>
            </div>
          </div>
        </div>
        {report.isError && (
          <ErrorState
            message="Impossible de générer ce rapport."
            retry={() => void report.refetch()}
          />
        )}
        {report.isLoading && (
          <p className="py-12 text-center text-sm text-muted">
            Génération du rapport…
          </p>
        )}
        {value && (
          <div className="report-print-area space-y-5 rounded-2xl border border-line bg-white p-4 text-ink dark:bg-[#242124] sm:p-5">
            <header className="report-hero flex flex-wrap items-end justify-between gap-4 border-b-2 border-brand pb-4">
              <div>
                <p className="report-brand text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                  ONight Business
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  Rapport de performance
                </h2>
                <p className="mt-1 text-[10px] text-muted">
                  Synthèse commerciale, financière et opérationnelle
                </p>
              </div>
              <div className="report-period rounded-xl bg-brand-soft px-4 py-2 text-right">
                <small className="block text-[9px] uppercase tracking-wider text-muted">
                  Période analysée
                </small>
                <strong className="mt-1 block text-xs">
                  {new Date(`${value.dateFrom}T12:00:00Z`).toLocaleDateString(
                    "fr-FR",
                  )}{" "}
                  —{" "}
                  {new Date(`${value.dateTo}T12:00:00Z`).toLocaleDateString(
                    "fr-FR",
                  )}
                </strong>
              </div>
            </header>

            <section className="report-summary rounded-xl border border-line bg-brand-soft/40 p-4">
              <h3 className="report-section-title text-sm font-bold">
                Résumé exécutif
              </h3>
              <p className="report-copy mt-1 text-[10px] leading-relaxed text-muted">
                {integer.format(value.salesCount)} vente(s) représentant{" "}
                {money.format(value.salesRevenue)} de chiffre d’affaires et{" "}
                {integer.format(value.unitsSold)} unité(s). La marge brute
                atteint {money.format(value.grossMargin)} (
                {value.salesRevenue
                  ? ((value.grossMargin / value.salesRevenue) * 100).toFixed(1)
                  : "0.0"}
                %). Le flux de trésorerie net de la période est de{" "}
                {money.format(value.netCash)}.
              </p>
            </section>

            <section className="report-kpis grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "Chiffre d’affaires",
                  value.salesRevenue,
                  `${integer.format(value.salesCount)} vente(s)`,
                ],
                [
                  "Marge brute",
                  value.grossMargin,
                  `${value.salesRevenue ? ((value.grossMargin / value.salesRevenue) * 100).toFixed(1) : "0.0"}% du CA`,
                ],
                [
                  "Panier moyen",
                  value.salesCount ? value.salesRevenue / value.salesCount : 0,
                  `${integer.format(value.unitsSold)} unité(s)`,
                ],
                [
                  "Encaissements clients",
                  value.incomeReceived,
                  "Paiements finalisés",
                ],
                [
                  "Remboursements clients",
                  value.customerRefunds,
                  "Retours réellement remboursés",
                ],
                [
                  "Achats fournisseurs",
                  value.purchases,
                  `${integer.format(value.purchaseCount)} réception(s)`,
                ],
                [
                  "Paiements fournisseurs",
                  value.supplierPayments,
                  "Décaissements finalisés",
                ],
                [
                  "Dépenses",
                  value.expenses,
                  `${integer.format(value.expenseCount)} dépense(s)`,
                ],
                [
                  "Flux de trésorerie net",
                  value.netCash,
                  "Encaissements − sorties",
                ],
              ].map(([label, amount, detail]) => (
                <article
                  key={String(label)}
                  className="report-kpi rounded-xl border border-line bg-surface p-3"
                >
                  <small className="text-muted">{label}</small>
                  <strong className="mt-1 block text-base">
                    {money.format(Number(amount))}
                  </strong>
                  <em className="mt-1 block text-[9px] not-italic text-muted">
                    {detail}
                  </em>
                </article>
              ))}
            </section>

            <section>
              <h3 className="report-section-title text-sm font-bold">
                Évolution de la période
              </h3>
              <p className="report-copy mt-1 mb-3 text-[10px] text-muted">
                Les ventes et la marge suivent la date des factures ; les flux
                suivent la date réelle des paiements et dépenses.
              </p>
              <div className="report-charts grid gap-3 xl:grid-cols-2">
                <article className="report-chart overflow-hidden rounded-2xl border border-line bg-surface p-0">
                  <header className="flex items-center justify-between gap-3 border-b border-line bg-linear-to-r from-brand-soft/80 via-white to-amber-50/60 p-3.5 dark:via-[#282428] dark:to-[#332c27]">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-white text-brand shadow-sm dark:bg-[#352f34]">
                        <TrendingUp size={17} />
                      </span>
                      <div>
                        <p className={ui("overline")}>Performance</p>
                        <h4 className="mt-0.5 text-xs font-bold">
                          Ventes et marge brute
                        </h4>
                      </div>
                    </div>
                    <div className="hidden items-center gap-3 text-[9px] text-muted sm:flex">
                      <span className="flex items-center gap-1.5">
                        <i className="size-2 rounded-[3px] bg-[#ff848f]" />
                        Ventes
                      </span>
                      <span className="flex items-center gap-1.5">
                        <i className="h-0.5 w-3 bg-ink" />
                        Marge
                      </span>
                    </div>
                  </header>
                  <div className="h-52 min-w-0 p-3 text-[9px] [&_.recharts-surface]:outline-none [&_.recharts-surface_*]:outline-none">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={value.periods}
                        margin={{ top: 10, right: 8, bottom: 2, left: -12 }}
                      >
                        <CartesianGrid
                          stroke="var(--color-line)"
                          strokeWidth={1}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="period"
                          tickFormatter={chartDate}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={18}
                          tick={{ fill: "var(--color-muted)", fontSize: 9 }}
                        />
                        <YAxis
                          tickFormatter={(number) =>
                            new Intl.NumberFormat("fr-FR", {
                              notation: "compact",
                            }).format(Number(number))
                          }
                          tickLine={false}
                          axisLine={false}
                          width={42}
                          tick={{ fill: "var(--color-muted)", fontSize: 9 }}
                        />
                        <Tooltip
                          formatter={(amount) => money.format(Number(amount))}
                          labelFormatter={(label) => chartDate(String(label))}
                          cursor={{
                            fill: "var(--color-brand-soft)",
                            fillOpacity: 0.55,
                          }}
                          contentStyle={{
                            background: "var(--color-surface)",
                            border: "1px solid var(--color-line)",
                            borderRadius: 12,
                            boxShadow: "0 12px 30px rgba(48,43,47,.12)",
                            color: "var(--color-ink)",
                          }}
                          labelStyle={{
                            color: "var(--color-ink)",
                            fontWeight: 700,
                          }}
                          itemStyle={{ color: "var(--color-muted)" }}
                        />
                        <Bar
                          dataKey="salesRevenue"
                          name="Ventes"
                          fill="#ff848f"
                          maxBarSize={28}
                          radius={[7, 7, 4, 4]}
                        />
                        <Line
                          type="monotone"
                          dataKey="grossMargin"
                          name="Marge brute"
                          stroke="var(--color-ink)"
                          strokeWidth={2.5}
                          dot={{ r: 0, fill: "var(--color-ink)" }}
                          activeDot={{
                            r: 4,
                            fill: "var(--color-ink)",
                            stroke: "var(--color-surface)",
                            strokeWidth: 2,
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </article>
                <article className="report-chart overflow-hidden rounded-2xl border border-line bg-surface p-0">
                  <header className="flex items-center justify-between gap-3 border-b border-line bg-linear-to-r from-brand-soft/80 via-white to-amber-50/60 p-3.5 dark:via-[#282428] dark:to-[#332c27]">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-white text-brand shadow-sm dark:bg-[#352f34]">
                        <WalletCards size={17} />
                      </span>
                      <div>
                        <p className={ui("overline")}>Trésorerie</p>
                        <h4 className="mt-0.5 text-xs font-bold">
                          Flux de trésorerie
                        </h4>
                      </div>
                    </div>
                    <div className="hidden items-center gap-3 text-[9px] text-muted sm:flex">
                      <span className="flex items-center gap-1.5">
                        <i className="size-2 rounded-[3px] bg-[#e3a733]" />
                        Entrées
                      </span>
                      <span className="flex items-center gap-1.5">
                        <i className="size-2 rounded-[3px] bg-[#f66897]" />
                        Sorties
                      </span>
                    </div>
                  </header>
                  <div className="h-52 min-w-0 p-3 text-[9px] [&_.recharts-surface]:outline-none [&_.recharts-surface_*]:outline-none">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={cashPeriods}
                        margin={{ top: 10, right: 8, bottom: 2, left: -12 }}
                      >
                        <CartesianGrid
                          stroke="var(--color-line)"
                          strokeWidth={1}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="period"
                          tickFormatter={chartDate}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={18}
                          tick={{ fill: "var(--color-muted)", fontSize: 9 }}
                        />
                        <YAxis
                          tickFormatter={(number) =>
                            new Intl.NumberFormat("fr-FR", {
                              notation: "compact",
                            }).format(Number(number))
                          }
                          tickLine={false}
                          axisLine={false}
                          width={42}
                          tick={{ fill: "var(--color-muted)", fontSize: 9 }}
                        />
                        <Tooltip
                          formatter={(amount) => money.format(Number(amount))}
                          labelFormatter={(label) => chartDate(String(label))}
                          cursor={{
                            fill: "var(--color-brand-soft)",
                            fillOpacity: 0.55,
                          }}
                          contentStyle={{
                            background: "var(--color-surface)",
                            border: "1px solid var(--color-line)",
                            borderRadius: 12,
                            boxShadow: "0 12px 30px rgba(48,43,47,.12)",
                            color: "var(--color-ink)",
                          }}
                          labelStyle={{
                            color: "var(--color-ink)",
                            fontWeight: 700,
                          }}
                          itemStyle={{ color: "var(--color-muted)" }}
                        />
                        <Bar
                          dataKey="incomeReceived"
                          name="Encaissements"
                          fill="#e3a733"
                          maxBarSize={20}
                          radius={[7, 7, 4, 4]}
                        />
                        <Bar
                          dataKey="cashOut"
                          name="Sorties"
                          fill="#f66897"
                          maxBarSize={20}
                          radius={[7, 7, 4, 4]}
                        />
                        <Line
                          type="monotone"
                          dataKey="netCash"
                          name="Flux net"
                          stroke="var(--color-ink)"
                          strokeWidth={2.5}
                          dot={{ r: 0, fill: "var(--color-ink)" }}
                          activeDot={{
                            r: 4,
                            fill: "var(--color-ink)",
                            stroke: "var(--color-surface)",
                            strokeWidth: 2,
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </div>
            </section>

            <section className="report-table-wrap">
              <h3 className="report-section-title text-sm font-bold">
                Détail des opérations
              </h3>
              <p className="report-copy mt-1 mb-3 text-[10px] text-muted">
                Toutes les factures, réceptions fournisseurs et dépenses
                enregistrées dans la période.
              </p>
              <div className={ui("table-wrap")}>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Document</th>
                      <th>Partenaire / catégorie</th>
                      <th>Statut</th>
                      <th>Total</th>
                      <th>Réglé</th>
                      <th>Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {value.documents.map((document) => (
                      <tr key={`${document.kind}-${document.id}`}>
                        <td>
                          {new Date(
                            `${document.occurredOn}T12:00:00Z`,
                          ).toLocaleDateString("fr-FR")}
                        </td>
                        <td>{kindLabels[document.kind]}</td>
                        <td>{document.number}</td>
                        <td>{document.partner}</td>
                        <td>{document.status}</td>
                        <td>{money.format(document.amount)}</td>
                        <td>{money.format(document.paidAmount)}</td>
                        <td>
                          {money.format(
                            Math.max(0, document.amount - document.paidAmount),
                          )}
                        </td>
                      </tr>
                    ))}
                    {value.documents.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted">
                          Aucune opération sur cette période.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            <footer className="report-footer flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-[9px] text-muted">
              <span>
                Généré le {new Date(value.generatedAt).toLocaleString("fr-FR")}
              </span>
              <span>
                Source : données ONight · Fuseau Casablanca · Montants en MAD
              </span>
            </footer>
          </div>
        )}
        <footer className={ui("modal-actions")}>
          <button
            type="button"
            className={ui("secondary-button")}
            onClick={onClose}
          >
            Fermer
          </button>
          <button
            type="button"
            className={ui("primary-button")}
            disabled={!value}
            onClick={printReport}
          >
            <Printer size={16} /> Imprimer le rapport
          </button>
        </footer>
      </div>
    </Modal>
  );
}
