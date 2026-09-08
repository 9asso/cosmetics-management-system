import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  History,
  Mail,
  MapPin,
  PackageOpen,
  Pencil,
  Phone,
  ReceiptText,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Modal } from "./Modal";
import { ErrorState } from "./EmptyState";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { ui } from "../lib/ui";
import {
  InvoiceEditModal,
  InvoicePaymentModal,
  InvoiceReturnModal,
} from "./InvoiceLifecycleModals";

export const documentStatuses: Record<string, string> = {
  ORDERED: "Commandée",
  CONFIRMED: "Confirmée",
  PAID: "Payée",
  PARTIALLY_PAID: "Partiellement payée",
  DELIVERED: "Livrée",
  FULFILLED: "Livrée",
  CANCELED: "Annulée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
  RECEIVED: "Reçue",
  PARTIALLY_RECEIVED: "Partiellement reçue",
  DRAFT: "Brouillon",
};

const paymentMethods: Record<string, string> = {
  CASH: "Espèces",
  CHECK: "Chèque",
  CARD: "Carte",
  TRANSFER: "Virement",
  CREDIT: "Crédit",
  COD: "Paiement à la livraison",
  OTHER: "Autre",
};
const paymentStatuses: Record<string, string> = {
  COMPLETED: "Encaissé",
  PENDING: "En attente",
  CANCELLED: "Annulé",
  FAILED: "Échoué",
};

function statusStyle(status: string) {
  if (["PAID", "DELIVERED", "FULFILLED", "RECEIVED"].includes(status))
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (["CANCELED", "CANCELLED", "REFUNDED"].includes(status))
    return "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  if (["CONFIRMED"].includes(status))
    return "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300";
  return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
}

export function InvoiceDetailModal({
  kind,
  id,
  onClose,
  surface = "invoice",
}: {
  kind: "sale" | "purchase";
  id: string;
  onClose: () => void;
  surface?: "order" | "invoice";
}) {
  const cache = useQueryClient();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [action, setAction] = useState<"payment" | "edit" | "return" | null>(
    null,
  );
  const refreshed = async () => {
    setAction(null);
    await Promise.all(
      [
        "invoice-detail",
        "invoices",
        "finance",
        "dashboard-summary",
        "dashboard-analytics",
        "products",
        "orders",
      ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
    );
  };
  async function downloadPdf() {
    if (!detail.data) return;
    setDownloading(true);
    setDownloadError("");
    try {
      await api.recordInvoicePrint(kind, id);
      const { downloadInvoicePdf } = await import("../lib/invoice-pdf");
      await downloadInvoicePdf(detail.data);
      await detail.refetch();
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Téléchargement impossible.",
      );
    } finally {
      setDownloading(false);
    }
  }
  const detail = useQuery({
    queryKey: ["invoice-detail", kind, id],
    queryFn: () => api.invoice(kind, id),
  });
  const value = detail.data;
  const isCancelled = value
    ? ["CANCELED", "CANCELLED", "REFUNDED"].includes(value.status)
    : false;
  const balance = value ? Math.max(0, value.total - value.amountPaid) : 0;
  const paidProgress =
    value && value.total > 0
      ? Math.min(100, Math.round((value.amountPaid / value.total) * 100))
      : 0;
  return (
    <Modal
      title={
        surface === "order" ? "Détails de la commande" : "Détails de la facture"
      }
      subtitle={value?.documentNumber ?? "Chargement du document…"}
      onClose={onClose}
      size="wide"
    >
      {detail.isLoading && (
        <p className="py-12 text-center text-muted">Chargement…</p>
      )}
      {detail.isError && (
        <ErrorState
          message="Document indisponible."
          retry={() => void detail.refetch()}
        />
      )}
      {value && (
        <div className="space-y-5 p-5 sm:p-6">
          <section className="overflow-hidden rounded-2xl border border-line bg-white dark:bg-[#282428]">
            <div className="flex flex-wrap items-start justify-between gap-4 bg-linear-to-r from-brand-soft/80 via-white to-pink-50 dark:from-[#392830] dark:via-[#282428] dark:to-[#302630] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-linear-to-br from-brand to-brand-secondary text-white shadow-sm">
                  <ReceiptText size={21} />
                </span>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[.18em] text-brand">
                    {kind === "sale"
                      ? surface === "order"
                        ? "Commande client"
                        : "Facture de vente"
                      : "Facture fournisseur"}
                  </p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">
                    {value.documentNumber}
                  </h2>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold ${statusStyle(value.status)}`}
                >
                  <i className="size-1.5 rounded-full bg-current" />
                  {documentStatuses[value.status] ?? value.status}
                </span>
                <p className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted">
                  <CalendarDays size={13} />
                  {new Date(value.issuedAt).toLocaleString("fr-FR", {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>
            <div className="grid border-t border-line md:grid-cols-[1.1fr_.9fr]">
              <div className="p-5 sm:p-6 md:border-r md:border-line">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
                  {kind === "sale" ? "Client" : "Fournisseur"} · coordonnées
                  enregistrées à l’émission
                </p>
                <div className="mt-4 flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    {kind === "sale" ? (
                      <UserRound size={18} />
                    ) : (
                      <Building2 size={18} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-ink">
                      {value.partnerName}
                    </h3>
                    <div className="mt-3 grid gap-2 text-[11px] text-muted">
                      <p className="flex items-start gap-2">
                        <Phone
                          size={14}
                          className="mt-0.5 shrink-0 text-brand"
                        />
                        <span>
                          {value.partner?.phone || "Téléphone non renseigné"}
                        </span>
                      </p>
                      <p className="flex items-start gap-2">
                        <Mail
                          size={14}
                          className="mt-0.5 shrink-0 text-brand"
                        />
                        <span className="break-all">
                          {value.partner?.email || "Email non renseigné"}
                        </span>
                      </p>
                      <p className="flex items-start gap-2">
                        <MapPin
                          size={14}
                          className="mt-0.5 shrink-0 text-brand"
                        />
                        <span className="whitespace-pre-wrap">
                          {value.partner?.address || "Adresse non renseignée"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-surface p-5 sm:p-6">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
                  Canal &amp; règlement
                </p>
                <p className="mt-4 flex items-center gap-2 text-xs font-bold text-ink">
                  <PackageOpen size={16} className="text-brand" />
                  {value.channel === "RETAIL_WEB"
                    ? "Boutique · paiement à la livraison"
                    : kind === "purchase"
                      ? "Achat fournisseur"
                      : "Vente en gros"}
                </p>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <small className="text-[9px] text-muted">
                      Montant réglé
                    </small>
                    <strong className="mt-1 block text-lg text-ink">
                      {money.format(value.amountPaid)}
                    </strong>
                  </div>
                  <span className="text-[10px] font-bold text-brand">
                    {paidProgress}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white dark:bg-[#171518]">
                  <i
                    className="block h-full rounded-full bg-linear-to-r from-brand to-brand-secondary transition-all"
                    style={{ width: `${paidProgress}%` }}
                  />
                </div>
                {!isCancelled && (
                  <p className="mt-3 text-[10px] text-muted">
                    Reste à régler :{" "}
                    <strong className="text-ink">
                      {money.format(balance)}
                    </strong>
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-line bg-white dark:bg-[#282428]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-brand">
                  Contenu
                </p>
                <h3 className="mt-1 text-sm font-bold">Articles du document</h3>
              </div>
              <span className="rounded-lg bg-brand-soft px-2.5 py-1 text-[10px] font-bold text-brand">
                {value.items.length} ligne(s)
              </span>
            </div>
            <div className={ui("table-wrap")}>
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Quantité</th>
                    <th>Prix unitaire</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {value.items.map((item) => (
                    <tr key={item.id}>
                      <td className="whitespace-normal! font-semibold text-ink">
                        {item.description}
                        {item.returnedQuantity > 0 && (
                          <small className="block text-rose-700">
                            {item.returnedQuantity} retourné(s)
                          </small>
                        )}
                      </td>
                      <td>
                        {item.quantity}
                        {item.unitMultiplier > 1 && ` × ${item.unitMultiplier}`}
                      </td>
                      <td>{money.format(item.unitPrice)}</td>
                      <td>
                        <strong>{money.format(item.lineTotal)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-[1fr_340px]">
            <div>
              {value.notes ? (
                <div className="rounded-2xl border border-brand/10 bg-brand-soft/55 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-brand">
                    Note interne
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-ink">
                    {value.notes}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-line p-4 text-xs text-muted">
                  Aucune note ajoutée à ce document.
                </div>
              )}
            </div>
            <dl className="rounded-2xl border border-line bg-surface p-4 text-xs [&>div]:flex [&>div]:justify-between [&>div]:gap-4 [&>div]:py-1.5 [&_dt]:text-muted [&_dd]:font-semibold [&_dd]:text-ink">
              <div>
                <dt>Sous-total</dt>
                <dd>{money.format(value.subtotal)}</dd>
              </div>
              <div>
                <dt>Remise</dt>
                <dd>- {money.format(value.discountTotal)}</dd>
              </div>
              <div>
                <dt>Livraison</dt>
                <dd>{money.format(value.shippingTotal)}</dd>
              </div>
              <div>
                <dt>Taxes</dt>
                <dd>{money.format(value.taxTotal)}</dd>
              </div>
              <div className="mt-2 border-t border-line pt-3! text-sm">
                <dt className="font-bold text-ink!">Total</dt>
                <dd className="text-base text-brand!">
                  {money.format(value.total)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="overflow-hidden rounded-2xl border border-line bg-white dark:bg-[#282428]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-brand">
                  Règlements
                </p>
                <h3 className="mt-1 text-sm font-bold">
                  Historique des paiements
                </h3>
              </div>
              <CreditCard size={19} className="text-brand" />
            </div>
            {value.payments.length === 0 ? (
              <div className="flex items-center gap-3 p-5 text-xs text-muted">
                <span className="grid size-9 place-items-center rounded-xl bg-stone-100 dark:bg-[#302b2f]">
                  <CreditCard size={16} />
                </span>
                Aucun paiement enregistré.
              </div>
            ) : (
              <div className="divide-y divide-line">
                {value.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="grid items-center gap-3 px-4 py-3 text-xs sm:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <span className="flex items-center gap-2 text-ink">
                      <CalendarDays size={14} className="text-brand" />
                      {new Date(payment.paidAt).toLocaleDateString("fr-FR")}
                    </span>
                    <span>
                      {paymentMethods[payment.method] ?? payment.method}
                    </span>
                    <span
                      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold ${payment.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : payment.status === "PENDING" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"}`}
                    >
                      <CheckCircle2 size={11} />
                      {paymentStatuses[payment.status] ?? payment.status}
                    </span>
                    <strong
                      className={`text-right ${payment.direction === "OUT" ? "text-rose-700" : "text-ink"}`}
                    >
                      {payment.direction === "OUT" ? "- " : ""}
                      {money.format(payment.amount)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          {value.returns.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-line bg-white dark:bg-[#282428]">
              <div className="border-b border-line px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-brand">
                  Retours
                </p>
                <h3 className="mt-1 text-sm font-bold">
                  Retours et remboursements
                </h3>
              </div>
              <div className="divide-y divide-line">
                {value.returns.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[1fr_1fr_2fr_auto]"
                  >
                    <strong>{item.returnNumber}</strong>
                    <span>{item.quantity} pièce(s)</span>
                    <span>{item.reason}</span>
                    <strong>{money.format(item.refundTotal)}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-line bg-white dark:bg-[#282428]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-brand">
                  Traçabilité
                </p>
                <h3 className="mt-1 text-sm font-bold">
                  Historique des versions
                </h3>
              </div>
              <History size={19} className="text-brand" />
            </div>
            {value.history.length === 0 ? (
              <p className="p-5 text-xs text-muted">
                L’historique commencera à la prochaine action sur cette facture.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {value.history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs"
                  >
                    <span className="min-w-40 font-semibold">
                      {{
                        CREATED: "Facture créée",
                        INITIAL_STATE: "État initial conservé",
                        UPDATED: "Facture corrigée",
                        PAYMENT_RECORDED: "Paiement ajouté",
                        CHECK_STATUS_CHANGED: "Statut du chèque modifié",
                        STATUS_CHANGED: "Statut de la facture modifié",
                        RETURNED: "Retour enregistré",
                        PRINTED: "Facture imprimée",
                      }[entry.eventType] ?? entry.eventType}
                    </span>
                    <span className="text-muted">
                      {entry.actorName} ·{" "}
                      {new Date(entry.occurredAt).toLocaleString("fr-FR")}
                    </span>
                    <button
                      type="button"
                      className="ml-auto text-brand hover:underline"
                      onClick={async () => {
                        const { downloadInvoicePdf } =
                          await import("../lib/invoice-pdf");
                        await downloadInvoicePdf(entry.snapshot);
                      }}
                    >
                      Imprimer cette version
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <footer className="flex flex-wrap justify-end gap-2 border-t border-line pt-5">
            {downloadError && (
              <p role="alert" className="w-full text-xs text-rose-700">
                {downloadError}
              </p>
            )}
            {!isCancelled && balance > 0 && (
              <button
                type="button"
                className={ui("secondary-button")}
                onClick={() => setAction("payment")}
              >
                <CreditCard size={15} /> Ajouter un paiement
              </button>
            )}
            {!isCancelled && surface === "invoice" && (
              <button
                type="button"
                className={ui("secondary-button")}
                onClick={() => setAction("edit")}
              >
                <Pencil size={15} /> Corriger
              </button>
            )}
            {kind === "sale" &&
              !isCancelled &&
              value.items.some(
                (item) => item.returnedQuantity < item.quantity,
              ) && (
                <button
                  type="button"
                  className={ui("secondary-button")}
                  onClick={() => setAction("return")}
                >
                  <RotateCcw size={15} /> Retour / remboursement
                </button>
              )}
            <button
              type="button"
              className={ui("secondary-button")}
              disabled={downloading}
              onClick={() => void downloadPdf()}
            >
              {downloading ? "Création du PDF…" : "Télécharger le PDF"}
            </button>
            <button
              type="button"
              className="rounded-lg bg-linear-to-r from-brand to-brand-secondary px-5 py-2 text-xs font-bold text-white shadow-sm"
              onClick={onClose}
            >
              Fermer
            </button>
          </footer>
        </div>
      )}
      {value && action === "payment" && (
        <InvoicePaymentModal
          value={value}
          onClose={() => setAction(null)}
          onSaved={() => void refreshed()}
        />
      )}
      {value && action === "edit" && (
        <InvoiceEditModal
          value={value}
          onClose={() => setAction(null)}
          onSaved={() => void refreshed()}
        />
      )}
      {value && action === "return" && (
        <InvoiceReturnModal
          value={value}
          onClose={() => setAction(null)}
          onSaved={() => void refreshed()}
        />
      )}
    </Modal>
  );
}
