import { ui } from "../lib/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { DashboardAnalyticsRange, UserRole } from "@cosmetics/contracts";
import {
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceDot,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  PackageX,
  Scale,
  ShoppingCart,
  PackagePlus,
  TrendingUp,
  WalletCards,
  CircleDollarSign,
  FileText,
  Printer,
} from "lucide-react";
import { ErrorState } from "../components/EmptyState";
import { api, ApiRequestError } from "../lib/api";
import type { Section, NavigationOptions } from "../lib/navigation";
import { integer, money } from "../lib/format";
import { Modal } from "../components/Modal";

const dashboardToday = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Casablanca" }).format(
    new Date(),
  );

export function DashboardPage({
  onNavigate,
  role,
}: {
  role: UserRole;
  onNavigate: (section: Section, options?: NavigationOptions) => void;
}) {
  const canFinance = ["OWNER", "MANAGER", "ACCOUNTANT"].includes(role);
  const canStock = ["OWNER", "MANAGER", "WAREHOUSE"].includes(role);
  const canSell = ["OWNER", "MANAGER", "CASHIER"].includes(role);
  const canPurchase = ["OWNER", "MANAGER", "WAREHOUSE", "ACCOUNTANT"].includes(
    role,
  );
  const [range, setRange] = useState<DashboardAnalyticsRange>("year");
  const [showReport, setShowReport] = useState(false);
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
  const highlightIndex = periods.reduce(
    (best, period, index) =>
      period.revenue > (periods[best]?.revenue ?? -1) ? index : best,
    0,
  );
  const highlighted = periods[highlightIndex];
  const previousRevenue = periods[highlightIndex - 1]?.revenue ?? 0;
  const changeLabel =
    highlighted && previousRevenue > 0
      ? `${highlighted.revenue >= previousRevenue ? "+" : ""}${Math.round(((highlighted.revenue - previousRevenue) / previousRevenue) * 100)}%`
      : highlighted?.revenue
        ? "Pic"
        : "";
  const bandStart = periods[Math.max(0, highlightIndex - 1)]?.period;
  const bandEnd =
    periods[Math.min(periods.length - 1, highlightIndex + 1)]?.period;
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
      {canFinance && (
        <div className="flex justify-end">
          <button
            type="button"
            className={ui("secondary-button")}
            onClick={() => setShowReport(true)}
          >
            <FileText size={16} /> Rapport complet par période
          </button>
        </div>
      )}
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
              MAD · période actuelle incomplète · hors annulations et
              remboursements.
            </p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-full bg-[#302d33] dark:bg-white" />
                CA
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-full bg-brand-secondary/45" />
                Marge
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
              <div className="h-72 min-w-0 text-[10px] [&_.recharts-surface]:outline-none [&_.recharts-surface_*]:outline-none">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={periods}
                    margin={{ top: 58, right: 18, bottom: 8, left: 0 }}
                    accessibilityLayer
                  >
                    <CartesianGrid
                      stroke="var(--color-line)"
                      strokeWidth={1}
                      vertical={false}
                    />
                    {highlighted && bandStart && bandEnd && (
                      <ReferenceArea
                        x1={bandStart}
                        x2={bandEnd}
                        fill="var(--color-brand-soft)"
                        fillOpacity={0.72}
                        stroke="none"
                      />
                    )}
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
                      labelFormatter={(period) => periodLabel(String(period))}
                      formatter={(number, name) => [
                        money.format(Number(number)),
                        name,
                      ]}
                      contentStyle={{
                        border: "1px solid var(--color-line)",
                        borderRadius: 12,
                        background: "var(--color-surface)",
                        color: "var(--color-ink)",
                        boxShadow: "0 12px 30px rgba(0,0,0,.14)",
                        fontSize: 11,
                      }}
                      cursor={{
                        stroke: "var(--color-muted)",
                        strokeDasharray: "4 4",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="grossMargin"
                      name="Marge produits"
                      stroke="#efc6d4"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{
                        r: 4,
                        fill: "#f66897",
                        stroke: "#fff",
                        strokeWidth: 2,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Chiffre d’affaires"
                      stroke="var(--color-ink)"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: "var(--color-ink)",
                        stroke: "var(--color-surface)",
                        strokeWidth: 3,
                      }}
                    />
                    {highlighted && changeLabel && (
                      <ReferenceDot
                        x={highlighted.period}
                        y={highlighted.revenue}
                        r={0}
                        shape={(props) => {
                          const cx = Number(props.cx ?? 0);
                          const cy = Number(props.cy ?? 0);
                          return (
                            <g aria-hidden="true">
                              <rect
                                x={cx - 35}
                                y={cy - 53}
                                width={70}
                                height={35}
                                rx={13}
                                fill="#343b4f"
                              />
                              <path
                                d={`M ${cx - 5} ${cy - 18} L ${cx} ${cy - 12} L ${cx + 5} ${cy - 18} Z`}
                                fill="#343b4f"
                              />
                              <text
                                x={cx}
                                y={cy - 31}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="white"
                                fontSize="12"
                                fontWeight="700"
                              >
                                {changeLabel}
                              </text>
                              <circle cx={cx} cy={cy} r="8" fill="#e5e7ed" />
                              <circle
                                cx={cx}
                                cy={cy}
                                r="4"
                                fill="#5f6575"
                                stroke="white"
                                strokeWidth="1.5"
                              />
                            </g>
                          );
                        }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
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
                        <th>Ventes</th>
                        <th>CA</th>
                        <th>Marge produits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((period) => (
                        <tr key={period.period}>
                          <td>{periodLabel(period.period)}</td>
                          <td>{period.orderCount}</td>
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

      <section className={ui("dashboard-grid lower-grid")}>
        <article className={ui("panel quick-panel")}>
          <div className={ui("panel-heading")}>
            <div>
              <p className={ui("overline")}>Raccourcis</p>
              <h2>Actions rapides</h2>
            </div>
          </div>
          <div className={ui("quick-actions")}>
            {canSell && (
              <button onClick={() => onNavigate("sales")}>
                <span>
                  <ShoppingCart size={20} />
                </span>
                <strong>Nouvelle vente</strong>
                <small>Créer une facture grossiste</small>
              </button>
            )}
            {canStock && (
              <button
                onClick={() => onNavigate("inventory", { createProduct: true })}
              >
                <span>
                  <Boxes size={20} />
                </span>
                <strong>Ajouter un produit</strong>
                <small>Enrichir le catalogue</small>
              </button>
            )}
            {canPurchase && (
              <button onClick={() => onNavigate("purchases")}>
                <span>
                  <PackagePlus size={20} />
                </span>
                <strong>Nouvel achat</strong>
                <small>Réceptionner du stock</small>
              </button>
            )}
            {canFinance && (
              <button
                onClick={() =>
                  onNavigate("finance", { financeTab: "expenses" })
                }
              >
                <span>
                  <Banknote size={20} />
                </span>
                <strong>Gérer les dépenses</strong>
                <small>Suivre les frais de fonctionnement</small>
              </button>
            )}
            {!canSell && !canStock && !canPurchase && !canFinance && (
              <button onClick={() => onNavigate("orders")}>
                <span>
                  <ShoppingCart size={20} />
                </span>
                <strong>Suivre les commandes</strong>
                <small>Consulter les ventes et livraisons</small>
              </button>
            )}
          </div>
        </article>
        <article className={ui("panel activity-panel")}>
          <div className={ui("panel-heading")}>
            <div>
              <p className={ui("overline")}>Journal</p>
              <h2>Activité récente</h2>
            </div>
          </div>
          {analytics.data?.activity.map((item) => (
            <div className={ui("activity-row")} key={item.id}>
              <i className={ui("activity-dot pink")} />
              <div>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </div>
              <time>
                {new Date(item.occurredAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                })}
              </time>
            </div>
          ))}
          {analytics.data?.activity.length === 0 && (
            <p className="text-xs text-muted">Aucune activité enregistrée.</p>
          )}
        </article>
      </section>
      {showReport && (
        <DashboardReportModal onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}

function DashboardReportModal({ onClose }: { onClose: () => void }) {
  const today = dashboardToday();
  const [dateFrom, setDateFrom] = useState(`${today.slice(0, 8)}01`);
  const [dateTo, setDateTo] = useState(today);
  const report = useQuery({
    queryKey: ["dashboard-report", dateFrom, dateTo],
    queryFn: () => api.dashboardReport(dateFrom, dateTo),
    enabled: Boolean(dateFrom && dateTo && dateFrom <= dateTo),
  });
  const value = report.data;
  const kindLabels = { sale: "Vente", purchase: "Achat", expense: "Dépense" };
  const printReport = () => {
    const area = document.querySelector(".report-print-area");
    const popup = window.open("", "_blank", "width=1000,height=800");
    if (!area || !popup) return window.print();
    popup.document.title = "Rapport ONight";
    const style = popup.document.createElement("style");
    style.textContent =
      "body{font-family:Arial,sans-serif;color:#222;padding:28px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}section{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}article{border:1px solid #ddd;padding:10px;border-radius:8px}small,strong{display:block}button{display:none}";
    popup.document.head.append(style);
    popup.document.body.append(area.cloneNode(true));
    popup.focus();
    popup.print();
  };
  return (
    <Modal
      title="Rapport complet"
      subtitle="Choisissez une période à afficher et imprimer"
      onClose={onClose}
      size="wide"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <div className={ui("form-grid")}>
          <label>
            <span>Du</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label>
            <span>Au</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={today}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
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
          <div className="report-print-area space-y-5">
            <header className="border-b border-line pb-4">
              <p className={ui("eyebrow")}>ONight · Rapport financier</p>
              <h2 className="mt-1 text-xl font-bold">
                Du{" "}
                {new Date(`${value.dateFrom}T12:00:00Z`).toLocaleDateString(
                  "fr-FR",
                )}{" "}
                au{" "}
                {new Date(`${value.dateTo}T12:00:00Z`).toLocaleDateString(
                  "fr-FR",
                )}
              </h2>
            </header>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Ventes", value.salesRevenue],
                ["Marge brute", value.grossMargin],
                ["Encaissements clients", value.incomeReceived],
                ["Remboursements clients", value.customerRefunds],
                ["Achats", value.purchases],
                ["Paiements fournisseurs", value.supplierPayments],
                ["Dépenses", value.expenses],
                ["Flux net", value.netCash],
              ].map(([label, amount]) => (
                <article
                  key={String(label)}
                  className="rounded-xl border border-line bg-surface p-3"
                >
                  <small className="text-muted">{label}</small>
                  <strong className="mt-1 block text-base">
                    {money.format(Number(amount))}
                  </strong>
                </article>
              ))}
            </section>
            <div className={ui("table-wrap")}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Document</th>
                    <th>Partenaire / catégorie</th>
                    <th>Montant</th>
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
                      <td>{money.format(document.amount)}</td>
                    </tr>
                  ))}
                  {value.documents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted">
                        Aucune opération sur cette période.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <small className="block text-muted">
              Généré le {new Date(value.generatedAt).toLocaleString("fr-FR")} ·
              Fuseau Casablanca
            </small>
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
