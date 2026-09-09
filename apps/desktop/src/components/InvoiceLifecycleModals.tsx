import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  InvoiceDetail,
  ProductListItem,
  RecordPaymentInput,
} from "@cosmetics/contracts";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiRequestError } from "../lib/api";
import { money } from "../lib/format";
import { createRequestId } from "../lib/request-id";
import { ui } from "../lib/ui";
import { resolveMediaUrl } from "../lib/media";
import { CheckFields, emptyCheck } from "./CheckFields";
import { Modal } from "./Modal";
import { SearchablePopup } from "./SearchablePopup";

const message = (error: unknown) =>
  error instanceof ApiRequestError
    ? error.message
    : "Enregistrement impossible.";

export function InvoicePaymentModal({
  value,
  onClose,
  onSaved,
}: {
  value: InvoiceDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const pending = value.payments
    .filter(
      (payment) =>
        payment.direction === (value.kind === "sale" ? "IN" : "OUT") &&
        payment.status === "PENDING",
    )
    .reduce((sum, payment) => sum + payment.amount, 0);
  const maximum = Math.max(0, value.total - value.amountPaid - pending);
  const [draft, setDraft] = useState<RecordPaymentInput>({
    requestId: createRequestId(),
    amount: maximum,
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
          ? "Ajouter un encaissement"
          : "Ajouter un règlement"
      }
      subtitle={`${value.documentNumber} · reste disponible ${money.format(maximum)}`}
      onClose={onClose}
    >
      <form
        className={ui("product-form")}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <fieldset disabled={mutation.isPending} className="space-y-4">
          <div className={ui("form-grid")}>
            <label>
              <span>Montant (MAD)</span>
              <input
                required
                type="number"
                min="0.01"
                max={maximum}
                step="0.01"
                value={draft.amount}
                onChange={(event) =>
                  setDraft({ ...draft, amount: Number(event.target.value) })
                }
              />
            </label>
            <label>
              <span>Mode de paiement</span>
              <select
                value={draft.method}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    method: event.target.value as RecordPaymentInput["method"],
                  })
                }
              >
                <option value="CASH">Espèces</option>
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
        {mutation.isError && (
          <p role="alert" className={ui("form-error")}>
            {message(mutation.error)}
          </p>
        )}
        <footer className={ui("modal-actions")}>
          <button
            type="button"
            className={ui("secondary-button")}
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            className={ui("primary-button")}
            disabled={mutation.isPending || maximum <= 0}
          >
            {mutation.isPending ? "Enregistrement…" : "Enregistrer ce paiement"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

type EditLine = {
  variantId: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export function InvoiceEditModal({
  value,
  onClose,
  onSaved,
}: {
  value: InvoiceDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const purchase = value.kind === "purchase";
  const [partnerId, setPartnerId] = useState(value.partner?.id ?? "");
  const [lines, setLines] = useState<EditLine[]>(
    value.items.map((item) => ({
      variantId: item.variantId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  );
  const [discountTotal, setDiscountTotal] = useState(value.discountTotal);
  const [shippingTotal, setShippingTotal] = useState(value.shippingTotal);
  const [taxTotal, setTaxTotal] = useState(value.taxTotal);
  const [notes, setNotes] = useState(value.notes);
  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState("");
  const partners = useQuery({
    queryKey: [purchase ? "suppliers" : "customers"],
    queryFn: purchase ? api.suppliers : api.customers,
  });
  const products = useQuery({
    queryKey: ["products", "invoice-edit", productSearch],
    queryFn: () =>
      api.products({
        search: productSearch,
        page: 1,
        pageSize: 100,
        stock: "all",
      }),
  });
  const selectedProduct = products.data?.items.find(
    (product) => product.variantId === productId,
  );
  const subtotal =
    Math.round(
      lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) *
        100,
    ) / 100;
  const total = purchase
    ? subtotal
    : Math.max(0, subtotal - discountTotal + shippingTotal + taxTotal);
  const mutation = useMutation({
    mutationFn: () =>
      api.updateInvoice(value.kind, value.id, {
        partnerId,
        items: lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
        discountTotal: purchase ? 0 : discountTotal,
        shippingTotal: purchase ? 0 : shippingTotal,
        taxTotal: purchase ? 0 : taxTotal,
        notes,
      }),
    onSuccess: onSaved,
  });
  const addProduct = (product: ProductListItem) => {
    if (lines.some((line) => line.variantId === product.variantId)) return;
    setLines([
      ...lines,
      {
        variantId: product.variantId,
        description: `${product.name} · ${product.sku}`,
        quantity: 1,
        unitPrice: purchase ? product.purchasePrice : product.wholesalePrice,
      },
    ]);
    setProductId("");
  };
  return (
    <Modal
      title="Corriger la facture"
      subtitle="Le stock et les totaux seront ajustés automatiquement"
      onClose={onClose}
      size="wide"
    >
      <form
        className={ui("product-form")}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <fieldset disabled={mutation.isPending} className="space-y-4">
          <SearchablePopup
            label={purchase ? "Fournisseur" : "Client grossiste"}
            placeholder="Rechercher un contact"
            items={partners.data ?? []}
            value={partnerId}
            onChange={setPartnerId}
            getId={(partner) => partner.id}
            getLabel={(partner) => partner.name}
            getDetail={(partner) =>
              partner.phone || partner.email || partner.address
            }
          />
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <SearchablePopup
                label="Ajouter un produit"
                placeholder="Nom, marque, SKU ou code-barres"
                items={products.data?.items ?? []}
                value={productId}
                onChange={setProductId}
                getId={(product) => product.variantId}
                getLabel={(product) => product.name}
                getDetail={(product) =>
                  `${product.sku} · ${product.available} disponible(s)`
                }
                getImage={(product) => resolveMediaUrl(product.imageUrl)}
                query={productSearch}
                onQueryChange={setProductSearch}
              />
            </div>
            <button
              type="button"
              className={ui("secondary-button")}
              disabled={!selectedProduct}
              onClick={() => selectedProduct && addProduct(selectedProduct)}
            >
              <Plus size={16} /> Ajouter
            </button>
          </div>
          <div className={ui("table-wrap")}>
            <table>
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Quantité</th>
                  <th>Prix unitaire</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.variantId}>
                    <td className="whitespace-normal!">{line.description}</td>
                    <td>
                      <input
                        aria-label={`Quantité · ${line.description}`}
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(event) =>
                          setLines(
                            lines.map((current) =>
                              current === line
                                ? {
                                    ...current,
                                    quantity: Number(event.target.value),
                                  }
                                : current,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Prix · ${line.description}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(event) =>
                          setLines(
                            lines.map((current) =>
                              current === line
                                ? {
                                    ...current,
                                    unitPrice: Number(event.target.value),
                                  }
                                : current,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>{money.format(line.quantity * line.unitPrice)}</td>
                    <td>
                      <button
                        type="button"
                        className={ui("icon-button")}
                        aria-label={`Retirer ${line.description}`}
                        onClick={() =>
                          setLines(lines.filter((current) => current !== line))
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!purchase && (
            <div className={ui("form-grid")}>
              <label>
                <span>Remise</span>
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  step="0.01"
                  value={discountTotal}
                  onChange={(event) =>
                    setDiscountTotal(Number(event.target.value))
                  }
                />
              </label>
              <label>
                <span>Livraison</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingTotal}
                  onChange={(event) =>
                    setShippingTotal(Number(event.target.value))
                  }
                />
              </label>
              <label>
                <span>Taxes</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={taxTotal}
                  onChange={(event) => setTaxTotal(Number(event.target.value))}
                />
              </label>
            </div>
          )}
          <label>
            <span>Note</span>
            <textarea
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <p className="text-right text-sm">
            Nouveau total : <strong>{money.format(total)}</strong>
          </p>
        </fieldset>
        {mutation.isError && (
          <p role="alert" className={ui("form-error")}>
            {message(mutation.error)}
          </p>
        )}
        <footer className={ui("modal-actions")}>
          <button
            type="button"
            className={ui("secondary-button")}
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            className={ui("primary-button")}
            disabled={mutation.isPending || !partnerId || !lines.length}
          >
            {mutation.isPending ? "Correction…" : "Enregistrer la correction"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export function InvoiceReturnModal({
  value,
  onClose,
  onSaved,
}: {
  value: InvoiceDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const eligible = value.items.filter(
    (item) => item.returnedQuantity < item.quantity,
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [disposition, setDisposition] = useState<
    "RESTOCK" | "DAMAGED" | "DISCARD"
  >("RESTOCK");
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundMethod, setRefundMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [reason, setReason] = useState("");
  const returnValue = useMemo(
    () =>
      eligible.reduce(
        (sum, item) => sum + (quantities[item.id] ?? 0) * item.unitPrice,
        0,
      ),
    [eligible, quantities],
  );
  const minimumRefund = Math.max(
    0,
    value.amountPaid - Math.max(0, value.total - returnValue),
  );
  const maximumRefund = Math.min(value.amountPaid, returnValue);
  const mutation = useMutation({
    mutationFn: () =>
      api.createInvoiceReturn(value.id, {
        items: eligible
          .filter((item) => (quantities[item.id] ?? 0) > 0)
          .map((item) => ({
            invoiceItemId: item.id,
            quantity: quantities[item.id]!,
            disposition,
          })),
        refundAmount,
        refundMethod,
        reason,
      }),
    onSuccess: onSaved,
  });
  return (
    <Modal
      title="Retour / remboursement"
      subtitle={value.documentNumber}
      onClose={onClose}
      size="wide"
    >
      <form
        className={ui("product-form")}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <fieldset disabled={mutation.isPending} className="space-y-4">
          <div className={ui("table-wrap")}>
            <table>
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Déjà retourné</th>
                  <th>Quantité à retourner</th>
                </tr>
              </thead>
              <tbody>
                {eligible.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-normal!">{item.description}</td>
                    <td>
                      {item.returnedQuantity} / {item.quantity}
                    </td>
                    <td>
                      <input
                        aria-label={`Retour · ${item.description}`}
                        type="number"
                        min="0"
                        max={item.quantity - item.returnedQuantity}
                        step="1"
                        value={quantities[item.id] ?? 0}
                        onChange={(event) =>
                          setQuantities({
                            ...quantities,
                            [item.id]: Number(event.target.value),
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={ui("form-grid")}>
            <label>
              <span>État des articles</span>
              <select
                value={disposition}
                onChange={(event) =>
                  setDisposition(event.target.value as typeof disposition)
                }
              >
                <option value="RESTOCK">Remettre en stock</option>
                <option value="DAMAGED">Endommagés</option>
                <option value="DISCARD">Ne pas remettre en stock</option>
              </select>
            </label>
            <label>
              <span>Remboursement client (MAD)</span>
              <input
                type="number"
                min={minimumRefund}
                max={maximumRefund}
                step="0.01"
                value={refundAmount}
                onChange={(event) =>
                  setRefundAmount(Number(event.target.value))
                }
              />
            </label>
            <label>
              <span>Mode de remboursement</span>
              <select
                value={refundMethod}
                onChange={(event) =>
                  setRefundMethod(event.target.value as typeof refundMethod)
                }
              >
                <option value="CASH">Espèces</option>
                <option value="TRANSFER">Virement</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-muted">
            Valeur retournée : {money.format(returnValue)} · remboursement
            autorisé entre {money.format(minimumRefund)} et{" "}
            {money.format(maximumRefund)}.
          </p>
          <label>
            <span>Motif du retour</span>
            <textarea
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </fieldset>
        {mutation.isError && (
          <p role="alert" className={ui("form-error")}>
            {message(mutation.error)}
          </p>
        )}
        <footer className={ui("modal-actions")}>
          <button
            type="button"
            className={ui("secondary-button")}
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            className={ui("primary-button")}
            disabled={
              mutation.isPending ||
              returnValue <= 0 ||
              refundAmount < minimumRefund ||
              refundAmount > maximumRefund
            }
          >
            Valider le retour
          </button>
        </footer>
      </form>
    </Modal>
  );
}
