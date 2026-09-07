import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateExpenseInput,
  ExpenseItem,
  FinanceBalance,
  FinanceCheck,
  RecordPaymentInput,
} from "@cosmetics/contracts";
import {
  ArrowDownToLine,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Plus,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { api, ApiRequestError } from "../lib/api";
import { money } from "../lib/format";
import { ui } from "../lib/ui";
import { allPages, downloadCsv } from "../lib/csv";
import { ErrorState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { StatusPill } from "../components/StatusPill";
import { CheckFields, emptyCheck } from "../components/CheckFields";
import { InvoiceDetailModal } from "../components/InvoiceDetailModal";

export type FinanceTab = "receivables" | "payables" | "checks" | "expenses";
const tabs: Record<FinanceTab, string> = {
  receivables: "Créances clients",
  payables: "Dettes fournisseurs",
  checks: "Chèques",
  expenses: "Dépenses",
};
const categories: Record<string, string> = {
  RENT: "Loyer",
  SALARIES: "Salaires",
  TRANSPORT: "Transport",
  UTILITIES: "Eau, électricité & internet",
  MARKETING: "Marketing",
  SUPPLIES: "Fournitures",
  OTHER: "Autre",
};
const categoryLabel = (category: string) =>
  category === "DELIVERY" ? "Livraison" : (categories[category] ?? category);
const checkLabels: Record<string, string> = {
  PENDING: "En attente",
  DEPOSITED: "Déposé",
  CLEARED: "Réglé",
  BOUNCED: "Rejeté",
  CANCELLED: "Annulé",
};
const date = (value: string) =>
  new Date(value.slice(0, 10) + "T12:00:00Z").toLocaleDateString("fr-FR");
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Casablanca" }).format(
    new Date(),
  );
function errorMessage(error: unknown) {
  return error instanceof ApiRequestError
    ? error.message
    : "Enregistrement impossible. Réessayez.";
}

export function FinancePage({
  initialTab = "receivables",
}: {
  initialTab?: FinanceTab;
}) {
  const cache = useQueryClient();
  const [tab, setTab] = useState<FinanceTab>(initialTab);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [payment, setPayment] = useState<FinanceBalance | null>(null);
  const [expense, setExpense] = useState(false);
  const [voiding, setVoiding] = useState<ExpenseItem | null>(null);
  const [invoice, setInvoice] = useState<{
    kind: "sale" | "purchase";
    id: string;
  } | null>(null);
  const query = {
    search,
    page,
    pageSize: 25,
    kind: tab === "payables" ? ("purchase" as const) : ("sale" as const),
    status: pendingOnly ? ("pending" as const) : ("all" as const),
  };
  const summary = useQuery({
    queryKey: ["finance", "summary"],
    queryFn: api.financeSummary,
    refetchInterval: 30_000,
  });
  const balances = useQuery({
    queryKey: ["finance", "balances", query],
    queryFn: () => api.financeBalances(query),
    enabled: tab === "receivables" || tab === "payables",
  });
  const checks = useQuery({
    queryKey: ["finance", "checks", query],
    queryFn: () => api.financeChecks(query),
    enabled: tab === "checks",
  });
  const expenses = useQuery({
    queryKey: ["finance", "expenses", query],
    queryFn: () => api.expenses(query),
    enabled: tab === "expenses",
  });
  const active =
    tab === "checks" ? checks : tab === "expenses" ? expenses : balances;
  const refresh = async () => {
    await Promise.all(
      [
        "finance",
        "dashboard-summary",
        "dashboard-analytics",
        "invoices",
        "invoice-detail",
        "orders",
      ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
    );
  };
  const saved = async (message: string) => {
    setPayment(null);
    setExpense(false);
    setVoiding(null);
    setNotice(message);
    await refresh();
  };
  const updateCheck = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "DEPOSITED" | "CLEARED" | "BOUNCED" | "CANCELLED";
    }) => api.updateCheck(id, { status }),
    onSuccess: () => saved("Le statut du chèque a été mis à jour."),
  });
  const switchTab = (next: FinanceTab) => {
    setTab(next);
    setSearch("");
    setPage(1);
    setNotice("");
    setExportError("");
    updateCheck.reset();
  };
  async function exportRows() {
    setExporting(true);
    setExportError("");
    try {
      let rows: (string | number | null)[][];
      if (tab === "checks") {
        const items = await allPages((page) =>
          api.financeChecks({ ...query, page, pageSize: 100 }),
        );
        rows = [
          [
            "Document",
            "Contact",
            "Sens",
            "Montant MAD",
            "Banque",
            "Numéro",
            "Échéance",
            "Statut",
          ],
          ...items.map((r) => [
            r.documentNumber,
            r.partnerName,
            r.direction === "IN" ? "Reçu" : "Émis",
            r.amount,
            r.bankName,
            r.checkNumber,
            r.dueDate,
            checkLabels[r.status] ?? r.status,
          ]),
        ];
      } else if (tab === "expenses") {
        const items = await allPages((page) =>
          api.expenses({ ...query, page, pageSize: 100 }),
        );
        rows = [
          [
            "Date",
            "Libellé",
            "Catégorie",
            "Montant MAD",
            "Notes",
            "Statut",
            "Motif annulation",
          ],
          ...items.map((r) => [
            r.incurredOn,
            r.name,
            categoryLabel(r.category),
            r.amount,
            r.notes,
            r.voidedAt ? "Annulée" : "Active",
            r.voidReason,
          ]),
        ];
      } else {
        const items = await allPages((page) =>
          api.financeBalances({ ...query, page, pageSize: 100 }),
        );
        rows = [
          [
            "Document",
            "Contact",
            "Téléphone",
            "Date",
            "Ancienneté jours",
            "Total MAD",
            "Réglé MAD",
            "Solde MAD",
            "Chèques en attente MAD",
            "Disponible à régler MAD",
          ],
          ...items.map((r) => [
            r.documentNumber,
            r.partnerName,
            r.phone,
            r.issuedAt,
            r.ageDays,
            r.total,
            r.amountPaid,
            r.balance,
            r.pendingAmount,
            r.availableToPay,
          ]),
        ];
      }
      downloadCsv(`finances-${tab}-${today()}.csv`, rows);
    } catch (error) {
      setExportError(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }
  const totals = summary.data;
  return (
    <div className="space-y-5">
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
        >
          {notice}
        </p>
      )}
      {summary.isError && (
        <ErrorState
          message="Les indicateurs financiers sont indisponibles."
          retry={() => void summary.refetch()}
        />
      )}
      <section className={ui("metric-grid")}>
        {[
          {
            label: "À encaisser",
            value: totals?.receivables,
            detail: "Factures clients · solde total",
            icon: ArrowDownLeft,
            target: "receivables" as const,
          },
          {
            label: "À payer",
            value: totals?.payables,
            detail: "Achats reçus · solde fournisseur",
            icon: ArrowUpRight,
            target: "payables" as const,
          },
          {
            label: "Chèques en attente",
            value: totals?.pendingCheckAmount,
            detail: totals
              ? `${totals.pendingChecks} chèque(s) · ${totals.dueChecks} arrivé(s) à échéance`
              : "Chargement…",
            icon: Banknote,
            target: "checks" as const,
          },
          {
            label: "Dépenses du mois",
            value: totals?.monthExpenses,
            detail: "Mois en cours · hors annulations",
            icon: Wallet,
            target: "expenses" as const,
          },
        ].map(({ label, value, detail, icon: Icon, target }) => (
          <button
            key={label}
            className={ui("metric-card metric-rose") + " text-left"}
            onClick={() => switchTab(target)}
          >
            <div className={ui("metric-top")}>
              <span>{label}</span>
              <i>
                <Icon size={18} />
              </i>
            </div>
            <strong>{value === undefined ? "—" : money.format(value)}</strong>
            <small>{detail}</small>
          </button>
        ))}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 text-xs dark:bg-[#282428]">
        <p>
          <strong>Règlements du mois :</strong> reçus{" "}
          {totals ? money.format(totals.monthIncoming) : "—"} · versés aux
          fournisseurs {totals ? money.format(totals.monthOutgoing) : "—"}.
        </p>
        <p className="text-muted">
          Chèques non réglés exclus · dépenses présentées séparément ·
          Casablanca
        </p>
      </div>
      <section className={ui("panel inventory-panel")}>
        <div
          className="flex flex-wrap gap-1 border-b border-line p-3"
          role="tablist"
          aria-label="Finances"
        >
          {Object.entries(tabs).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={ui(
                tab === key ? "primary-button" : "secondary-button",
              )}
              onClick={() => switchTab(key as FinanceTab)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={ui("inventory-toolbar")}>
          <div className={ui("table-search")}>
            <Search size={16} />
            <input
              aria-label="Rechercher dans les finances"
              placeholder={
                tab === "expenses"
                  ? "Libellé ou catégorie"
                  : "Document, contact ou numéro de chèque"
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {tab === "checks" && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={(e) => {
                  setPendingOnly(e.target.checked);
                  setPage(1);
                }}
              />
              En attente uniquement
            </label>
          )}
          <button
            className={ui("secondary-button")}
            disabled={active.isFetching}
            onClick={() => void refresh()}
          >
            <RefreshCw size={15} />
            Actualiser
          </button>
          <button
            className={ui("secondary-button")}
            disabled={exporting || active.isLoading || active.isError}
            onClick={() => void exportRows()}
          >
            <ArrowDownToLine size={15} />
            {exporting ? "Export…" : "Exporter les résultats"}
          </button>
          {tab === "expenses" && (
            <button
              className={ui("primary-button")}
              onClick={() => setExpense(true)}
            >
              <Plus size={16} />
              Nouvelle dépense
            </button>
          )}
        </div>
        {(tab === "receivables" || tab === "payables") && (
          <p className="border-b border-line px-4 py-3 text-xs text-muted">
            Les chèques en attente restent dans le solde et sont déduits du
            montant disponible à régler. L’ancienneté est calculée depuis
            l’émission ; elle ne représente pas une échéance contractuelle.
          </p>
        )}
        {exportError && (
          <p role="alert" className={ui("form-error")}>
            {exportError}
          </p>
        )}
        {updateCheck.isError && errorMessage(updateCheck.error) && (
          <p role="alert" className={ui("form-error")}>
            {errorMessage(updateCheck.error)}
          </p>
        )}
        {active.isError ? (
          <ErrorState
            message="Impossible de charger ces opérations."
            retry={() => void active.refetch()}
          />
        ) : active.isLoading ? (
          <p className="p-12 text-center text-sm text-muted">Chargement…</p>
        ) : (
          <div className={ui("table-wrap")}>
            {(tab === "receivables" || tab === "payables") && (
              <table>
                <thead>
                  <tr>
                    <th>Document / contact</th>
                    <th>Ancienneté</th>
                    <th>Total</th>
                    <th>Réglé</th>
                    <th>Solde</th>
                    <th>Chèques en attente</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {balances.data?.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <button
                          className="font-semibold text-brand hover:underline"
                          onClick={() =>
                            setInvoice({ kind: row.kind, id: row.id })
                          }
                        >
                          {row.documentNumber}
                        </button>
                        <small className={ui("sub-cell")}>
                          {row.partnerName}
                        </small>
                        {row.phone && (
                          <a
                            className="text-xs text-muted"
                            href={`tel:${row.phone}`}
                          >
                            {row.phone}
                          </a>
                        )}
                      </td>
                      <td>
                        <StatusPill
                          tone={row.ageDays >= 30 ? "warn" : "neutral"}
                        >
                          {row.ageDays} jours
                        </StatusPill>
                        <small className={ui("sub-cell")}>
                          {date(row.issuedAt)}
                        </small>
                      </td>
                      <td>{money.format(row.total)}</td>
                      <td>{money.format(row.amountPaid)}</td>
                      <td>
                        <strong>{money.format(row.balance)}</strong>
                      </td>
                      <td>{money.format(row.pendingAmount)}</td>
                      <td>
                        <button
                          className={ui("secondary-button compact")}
                          disabled={row.availableToPay <= 0}
                          onClick={() => setPayment(row)}
                        >
                          {row.availableToPay <= 0
                            ? "Chèque à suivre"
                            : tab === "payables"
                              ? "Régler"
                              : "Encaisser"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === "checks" && (
              <table>
                <thead>
                  <tr>
                    <th>Chèque / facture</th>
                    <th>Contact</th>
                    <th>Montant</th>
                    <th>Échéance</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.data?.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>
                          {row.checkNumber || "Numéro non renseigné"}
                        </strong>
                        <small className={ui("sub-cell")}>
                          {row.bankName || "Banque non renseignée"}
                        </small>
                        {row.kind && row.documentId ? (
                          <button
                            className="text-xs text-brand hover:underline"
                            onClick={() =>
                              setInvoice({
                                kind: row.kind!,
                                id: row.documentId!,
                              })
                            }
                          >
                            {row.documentNumber}
                          </button>
                        ) : (
                          <small>{row.documentNumber}</small>
                        )}
                      </td>
                      <td>
                        {row.partnerName}
                        <small className={ui("sub-cell")}>
                          {row.direction === "IN"
                            ? "Chèque reçu"
                            : "Chèque émis"}
                        </small>
                      </td>
                      <td>
                        <strong>{money.format(row.amount)}</strong>
                      </td>
                      <td>
                        {row.dueDate ? date(row.dueDate) : "Non renseignée"}
                        {row.dueDate &&
                          row.dueDate <= today() &&
                          ["PENDING", "DEPOSITED"].includes(row.status) && (
                            <small className="block text-amber-700">
                              À traiter
                            </small>
                          )}
                      </td>
                      <td>
                        <StatusPill
                          tone={
                            row.status === "CLEARED"
                              ? "good"
                              : ["BOUNCED", "CANCELLED"].includes(row.status)
                                ? "bad"
                                : "warn"
                          }
                        >
                          {checkLabels[row.status] ?? row.status}
                        </StatusPill>
                      </td>
                      <td>
                        <CheckActions
                          row={row}
                          pending={updateCheck.isPending}
                          update={(status) =>
                            updateCheck.mutate({ id: row.id, status })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === "expenses" && (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Dépense</th>
                    <th>Catégorie</th>
                    <th>Montant</th>
                    <th>État</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {expenses.data?.items.map((row) => (
                    <tr key={row.id}>
                      <td>{date(row.incurredOn)}</td>
                      <td>
                        <strong>{row.name}</strong>
                        <small
                          className={
                            ui("sub-cell") + " max-w-80 whitespace-normal"
                          }
                        >
                          {row.notes}
                        </small>
                        {row.voidReason && (
                          <small className="block max-w-80 whitespace-normal text-rose-700">
                            Motif : {row.voidReason}
                          </small>
                        )}
                      </td>
                      <td>{categoryLabel(row.category)}</td>
                      <td>{money.format(row.amount)}</td>
                      <td>
                        <StatusPill tone={row.voidedAt ? "bad" : "good"}>
                          {row.voidedAt ? "Annulée" : "Enregistrée"}
                        </StatusPill>
                      </td>
                      <td>
                        {!row.voidedAt && (
                          <button
                            className={ui("secondary-button compact")}
                            onClick={() => setVoiding(row)}
                          >
                            Annuler
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {active.data?.items.length === 0 && (
              <p className="p-12 text-center text-sm text-muted">
                {search
                  ? "Aucun résultat pour cette recherche."
                  : tab === "checks"
                    ? "Aucun chèque à afficher."
                    : tab === "expenses"
                      ? "Aucune dépense enregistrée."
                      : "Aucun solde restant à régler."}
              </p>
            )}
          </div>
        )}
        <footer className={ui("table-footer")}>
          <span>{active.data?.total ?? 0} résultat(s)</span>
          <div className="flex items-center gap-2">
            <span>Page {page}</span>
            <button
              className={ui("secondary-button compact")}
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Précédent
            </button>
            <button
              className={ui("secondary-button compact")}
              disabled={page * 25 >= (active.data?.total ?? 0)}
              onClick={() => setPage(page + 1)}
            >
              Suivant
            </button>
          </div>
        </footer>
      </section>
      {payment && (
        <PaymentModal
          value={payment}
          onClose={() => setPayment(null)}
          onSaved={() => void saved("Le règlement a été enregistré.")}
        />
      )}
      {expense && (
        <ExpenseModal
          onClose={() => setExpense(false)}
          onSaved={() => void saved("La dépense a été enregistrée.")}
        />
      )}
      {voiding && (
        <VoidExpenseModal
          value={voiding}
          onClose={() => setVoiding(null)}
          onSaved={() =>
            void saved(
              "La dépense a été annulée et conservée dans l’historique.",
            )
          }
        />
      )}
      {invoice && (
        <InvoiceDetailModal {...invoice} onClose={() => setInvoice(null)} />
      )}
    </div>
  );
}
function CheckActions({
  row,
  pending,
  update,
}: {
  row: FinanceCheck;
  pending: boolean;
  update: (status: "DEPOSITED" | "CLEARED" | "BOUNCED" | "CANCELLED") => void;
}) {
  if (!["PENDING", "DEPOSITED"].includes(row.status))
    return <span className="text-muted">Traité</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {row.status === "PENDING" && row.dueDate && (
        <button
          className={ui("secondary-button compact")}
          disabled={pending}
          onClick={() => update("DEPOSITED")}
        >
          Déposer
        </button>
      )}
      {row.documentId &&
        !["CANCELED", "CANCELLED", "REFUNDED"].includes(
          row.documentStatus ?? "",
        ) && (
          <button
            className={ui("secondary-button compact")}
            disabled={pending}
            onClick={() => update("CLEARED")}
          >
            Réglé en banque
          </button>
        )}
      <button
        className={ui("secondary-button compact")}
        disabled={pending}
        onClick={() => update("BOUNCED")}
      >
        Rejeté
      </button>
      <button
        className={ui("secondary-button compact")}
        disabled={pending}
        onClick={() => update("CANCELLED")}
      >
        Annuler
      </button>
    </div>
  );
}
function PaymentModal({
  value,
  onClose,
  onSaved,
}: {
  value: FinanceBalance;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<RecordPaymentInput>({
    requestId: crypto.randomUUID(),
    amount: value.availableToPay,
    method: "CASH",
    check: emptyCheck,
  });
  const mutation = useMutation({
    mutationFn: () =>
      api.recordPayment(value.kind, value.id, {
        ...draft,
        check: draft.method === "CHECK" ? draft.check : undefined,
      }),
    onSuccess: onSaved,
  });
  return (
    <Modal
      title={
        value.kind === "sale"
          ? "Encaisser un règlement"
          : "Régler un fournisseur"
      }
      subtitle={`${value.documentNumber} · ${value.partnerName}`}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <form
        className={ui("product-form")}
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <p className="text-sm">
          Disponible à régler :{" "}
          <strong>{money.format(value.availableToPay)}</strong>
        </p>
        <fieldset disabled={mutation.isPending} className="space-y-4">
          <div className={ui("form-grid")}>
            <label>
              <span>Montant du règlement (MAD)</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                max={value.availableToPay}
                value={draft.amount}
                onChange={(e) =>
                  setDraft({ ...draft, amount: Number(e.target.value) })
                }
              />
            </label>
            <label>
              <span>Mode de règlement</span>
              <select
                value={draft.method}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    method: e.target.value as RecordPaymentInput["method"],
                  })
                }
              >
                <option value="CASH">Espèces</option>
                <option value="TRANSFER">Virement</option>
                <option value="CHECK">Chèque</option>
              </select>
            </label>
          </div>
          {draft.method === "CHECK" && (
            <CheckFields
              value={draft.check ?? emptyCheck}
              onChange={(check) => setDraft({ ...draft, check })}
            />
          )}
        </fieldset>
        {mutation.isError && errorMessage(mutation.error) && (
          <p role="alert" className={ui("form-error")}>
            {errorMessage(mutation.error)}
          </p>
        )}
        <footer className={ui("modal-actions")}>
          <button
            type="button"
            className={ui("secondary-button")}
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            className={ui("primary-button")}
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "Enregistrement…"
              : "Enregistrer le règlement"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function ExpenseModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<CreateExpenseInput>({
    requestId: crypto.randomUUID(),
    name: "",
    category: "OTHER",
    amount: 0,
    incurredOn: today(),
    notes: "",
  });
  const mutation = useMutation({
    mutationFn: () => api.createExpense(draft),
    onSuccess: onSaved,
  });
  return (
    <Modal
      title="Nouvelle dépense"
      subtitle="Frais de fonctionnement de votre activité"
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <form
        className={ui("product-form")}
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <fieldset disabled={mutation.isPending} className={ui("form-grid")}>
          <label>
            <span>Libellé</span>
            <input
              required
              minLength={2}
              maxLength={160}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            <span>Catégorie</span>
            <select
              value={draft.category}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  category: e.target.value as CreateExpenseInput["category"],
                })
              }
            >
              {Object.entries(categories).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Montant de la dépense (MAD)</span>
            <input
              required
              type="number"
              min="0.01"
              max="999999999"
              step="0.01"
              value={draft.amount}
              onChange={(e) =>
                setDraft({ ...draft, amount: Number(e.target.value) })
              }
            />
          </label>
          <label>
            <span>Date de la dépense</span>
            <input
              required
              type="date"
              value={draft.incurredOn}
              onChange={(e) =>
                setDraft({ ...draft, incurredOn: e.target.value })
              }
            />
          </label>
          <label className="col-span-full">
            <span>Note / référence du justificatif</span>
            <textarea
              maxLength={1000}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
        </fieldset>
        {mutation.isError && errorMessage(mutation.error) && (
          <p role="alert" className={ui("form-error")}>
            {errorMessage(mutation.error)}
          </p>
        )}
        <footer className={ui("modal-actions")}>
          <button
            type="button"
            className={ui("secondary-button")}
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            className={ui("primary-button")}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Enregistrement…" : "Enregistrer la dépense"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function VoidExpenseModal({
  value,
  onClose,
  onSaved,
}: {
  value: ExpenseItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.voidExpense(value.id, reason),
    onSuccess: onSaved,
  });
  return (
    <Modal
      title="Annuler une dépense"
      subtitle={`${value.name} · ${money.format(value.amount)}`}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <form
        className={ui("product-form")}
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label>
          <span>Motif d’annulation</span>
          <textarea
            required
            minLength={3}
            maxLength={500}
            disabled={mutation.isPending}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <p className="text-xs text-muted">
          La dépense restera visible dans l’historique et sera exclue des
          totaux.
        </p>
        {mutation.isError && errorMessage(mutation.error) && (
          <p role="alert" className={ui("form-error")}>
            {errorMessage(mutation.error)}
          </p>
        )}
        <footer className={ui("modal-actions")}>
          <button
            type="button"
            className={ui("secondary-button")}
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Fermer
          </button>
          <button
            className={ui("primary-button")}
            disabled={mutation.isPending}
          >
            Valider l’annulation
          </button>
        </footer>
      </form>
    </Modal>
  );
}
