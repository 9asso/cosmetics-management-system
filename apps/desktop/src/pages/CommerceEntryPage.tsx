import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProductListItem } from "@cosmetics/contracts";
import {
  CheckCircle2,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { api, ApiRequestError } from "../lib/api";
import { money } from "../lib/format";
import { ui } from "../lib/ui";
import { ErrorState } from "../components/EmptyState";
import { CheckFields, emptyCheck } from "../components/CheckFields";
import { InvoiceDetailModal } from "../components/InvoiceDetailModal";

type CartLine = { product: ProductListItem; quantity: number; price: number };
export function CommerceEntryPage({ kind }: { kind: "sale" | "purchase" }) {
  const purchase = kind === "purchase";
  const cache = useQueryClient();
  const [partnerId, setPartnerId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [productId, setProductId] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "TRANSFER" | "CHECK" | "CREDIT"
  >(purchase ? "CREDIT" : "CASH");
  const [check, setCheck] = useState(emptyCheck);
  const [notes, setNotes] = useState("");
  const [showInvoice, setShowInvoice] = useState(false);
  const partners = useQuery({
    queryKey: [purchase ? "suppliers" : "customers"],
    queryFn: purchase ? api.suppliers : api.customers,
  });
  const products = useQuery({
    queryKey: ["products", "entry", search, page],
    queryFn: () => api.products({ search, page, pageSize: 25, stock: "all" }),
  });
  const total =
    lines.reduce(
      (sum, line) => sum + Math.round(line.price * 100) * line.quantity,
      0,
    ) / 100;
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const chosen = products.data?.items.find(
    (product) => product.variantId === productId,
  );
  const mutation = useMutation({
    mutationFn: () => {
      const payment = {
        paidAmount,
        paymentMethod,
        check: paymentMethod === "CHECK" && paidAmount > 0 ? check : undefined,
        notes,
      };
      return purchase
        ? api.createPurchase({
            supplierId: partnerId,
            items: lines.map((line) => ({
              variantId: line.product.variantId,
              quantity: line.quantity,
              unitCost: line.price,
            })),
            ...payment,
          })
        : api.createWholesaleSale({
            customerId: partnerId,
            items: lines.map((line) => ({
              variantId: line.product.variantId,
              quantity: line.quantity,
              unitPrice: line.price,
            })),
            ...payment,
          });
    },
    onSuccess: async () => {
      setLines([]);
      setPaidAmount(0);
      setNotes("");
      setCheck(emptyCheck);
      setProductId("");
      await Promise.all(
        [
          "products",
          "orders",
          "finance",
          "dashboard-summary",
          "dashboard-analytics",
          "invoices",
        ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
  function addLine() {
    if (!chosen || (!purchase && chosen.available <= 0)) return;
    const existing = lines.find(
      (line) => line.product.variantId === chosen.variantId,
    );
    if (existing) {
      setLines(
        lines.map((line) =>
          line === existing
            ? {
                ...line,
                quantity: Math.min(
                  line.quantity + 1,
                  purchase ? 999999 : chosen.available,
                ),
                product: chosen,
              }
            : line,
        ),
      );
    } else if (lines.length < 100)
      setLines([
        ...lines,
        {
          product: chosen,
          quantity: 1,
          price: purchase ? chosen.purchasePrice : chosen.wholesalePrice,
        },
      ]);
    setProductId("");
  }
  function changeLine(id: string, patch: Partial<CartLine>) {
    setLines((current) =>
      current.map((line) =>
        line.product.variantId === id ? { ...line, ...patch } : line,
      ),
    );
  }
  if (partners.isError)
    return (
      <ErrorState
        message="Impossible de charger les contacts."
        retry={() => void partners.refetch()}
      />
    );
  const Icon = purchase ? PackagePlus : ShoppingCart;
  return (
    <div className={ui("operation-layout")}>
      <form
        className={ui("panel operation-form")}
        onSubmit={(event) => {
          event.preventDefault();
          if (lines.length) mutation.mutate();
        }}
      >
        <div className={ui("section-title")}>
          <span className={ui("summary-icon green")}>
            <Icon size={20} />
          </span>
          <div>
            <p className={ui("eyebrow")}>
              {purchase ? "Entrée de stock" : "Sortie de stock"}
            </p>
            <h2>
              {purchase ? "Réception fournisseur" : "Nouvelle vente grossiste"}
            </h2>
            <small>Regroupez vos articles sur un seul document.</small>
          </div>
        </div>
        {mutation.data && (
          <div role="status" className={ui("form-success")}>
            <CheckCircle2 size={17} />
            <span>
              {mutation.data.documentNumber} ·{" "}
              {money.format(mutation.data.total)} enregistré.
            </span>
            <button
              type="button"
              className="ml-auto underline"
              onClick={() => setShowInvoice(true)}
            >
              Voir la facture
            </button>
          </div>
        )}
        <fieldset disabled={mutation.isPending} className="min-w-0 space-y-5">
          <label>
            <span>{purchase ? "Fournisseur" : "Client grossiste"}</span>
            <select
              required
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
            >
              <option value="">
                Choisir un {purchase ? "fournisseur" : "client"}
              </option>
              {partners.data?.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>
          </label>
          {partners.data?.length === 0 && (
            <p className="text-xs text-muted">
              Ajoutez d’abord un contact dans Clients &amp; fournisseurs.
            </p>
          )}
          <section className="space-y-3 rounded-xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Search size={15} />
              Ajouter des produits · catalogue complet
            </div>
            <label>
              <span>Rechercher un produit</span>
              <input
                value={search}
                placeholder="Nom, marque, SKU ou code-barres"
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                  setProductId("");
                }}
              />
            </label>
            {products.isError ? (
              <ErrorState
                message="Catalogue indisponible. Votre panier est conservé."
                retry={() => void products.refetch()}
              />
            ) : (
              <>
                <div className="flex items-end gap-2">
                  <label className="flex-1">
                    <span>Produit à ajouter</span>
                    <select
                      value={productId}
                      disabled={products.isLoading}
                      onChange={(e) => setProductId(e.target.value)}
                    >
                      <option value="">
                        {products.isLoading
                          ? "Chargement…"
                          : "Choisir un produit"}
                      </option>
                      {products.data?.items.map((product) => (
                        <option
                          key={product.variantId}
                          value={product.variantId}
                          disabled={!purchase && product.available <= 0}
                        >
                          {product.name} · {product.sku} · {product.available}{" "}
                          disponible(s)
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={ui("secondary-button")}
                    disabled={
                      !chosen ||
                      lines.length >= 100 ||
                      (!purchase && chosen.available <= 0)
                    }
                    onClick={addLine}
                  >
                    <Plus size={16} />
                    Ajouter la ligne
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {products.data?.total ?? 0} produit(s) · page {page}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={ui("secondary-button compact")}
                      disabled={page === 1 || products.isFetching}
                      onClick={() => {
                        setPage(page - 1);
                        setProductId("");
                      }}
                    >
                      Précédent
                    </button>
                    <button
                      type="button"
                      className={ui("secondary-button compact")}
                      disabled={
                        page * 25 >= (products.data?.total ?? 0) ||
                        products.isFetching
                      }
                      onClick={() => {
                        setPage(page + 1);
                        setProductId("");
                      }}
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
          <div className={ui("table-wrap")}>
            <table>
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Quantité</th>
                  <th>{purchase ? "Coût unitaire" : "Prix unitaire"}</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.product.variantId}>
                    <td>
                      <strong className="block max-w-56 whitespace-normal">
                        {line.product.name}
                      </strong>
                      <small className={ui("sub-cell")}>
                        {line.product.sku} · {line.product.available}{" "}
                        disponible(s)
                      </small>
                    </td>
                    <td>
                      <input
                        aria-label={`Quantité · ${line.product.sku}`}
                        className="min-w-18"
                        required
                        type="number"
                        min="1"
                        max={purchase ? 999999 : line.product.available}
                        step="1"
                        value={line.quantity}
                        onChange={(e) =>
                          changeLine(line.product.variantId, {
                            quantity: Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Prix · ${line.product.sku}`}
                        className="min-w-24"
                        required
                        type="number"
                        min="0"
                        max="999999999"
                        step="0.01"
                        value={line.price}
                        onChange={(e) =>
                          changeLine(line.product.variantId, {
                            price: Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td>
                      {money.format(
                        (Math.round(line.price * 100) * line.quantity) / 100,
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={ui("icon-button")}
                        aria-label={`Retirer ${line.product.name}`}
                        onClick={() =>
                          setLines(lines.filter((item) => item !== line))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!lines.length && (
              <p className="p-6 text-center text-xs text-muted">
                Ajoutez un ou plusieurs produits pour commencer.
              </p>
            )}
          </div>
          <div className={ui("form-grid")}>
            <label>
              <span>Mode de paiement</span>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as typeof paymentMethod);
                  if (e.target.value === "CREDIT") setPaidAmount(0);
                }}
              >
                <option value="CASH">Espèces</option>
                <option value="TRANSFER">Virement</option>
                <option value="CHECK">Chèque</option>
                <option value="CREDIT">À crédit</option>
              </select>
            </label>
            <label>
              <span>
                {paymentMethod === "CHECK"
                  ? "Montant du chèque"
                  : purchase
                    ? "Montant payé"
                    : "Montant encaissé"}
              </span>
              <input
                required
                type="number"
                min="0"
                max={total}
                step="0.01"
                disabled={paymentMethod === "CREDIT"}
                value={paidAmount}
                onChange={(e) => setPaidAmount(Number(e.target.value))}
              />
            </label>
          </div>
          {paymentMethod === "CHECK" && paidAmount > 0 && (
            <CheckFields value={check} onChange={setCheck} />
          )}
          <label>
            <span>Note du document</span>
            <textarea
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Référence, conditions, remarque…"
            />
          </label>
        </fieldset>
        {mutation.isError &&
          (!(mutation.error instanceof ApiRequestError) ||
            mutation.error.status !== 499) && (
            <p role="alert" className={ui("form-error")}>
              {mutation.error instanceof ApiRequestError
                ? mutation.error.message
                : "Enregistrement impossible."}
            </p>
          )}
        <button
          className={ui("primary-button")}
          disabled={!lines.length || mutation.isPending || partners.isLoading}
        >
          {mutation.isPending
            ? "Validation…"
            : purchase
              ? "Valider la réception"
              : "Créer la vente"}
        </button>
      </form>
      <aside className={ui("operation-aside")}>
        <article className={ui("panel total-card")}>
          <p className={ui("eyebrow")}>Résumé du document</p>
          <h3>{lines.length} article(s)</h3>
          <div>
            <span>Unités</span>
            <strong>{quantity}</strong>
          </div>
          <div className={ui("grand")}>
            <span>{purchase ? "Total achat" : "Total vente"}</span>
            <strong>{money.format(total)}</strong>
          </div>
          <small>
            {purchase ? "Solde fournisseur" : "Créance client"} :{" "}
            {money.format(
              Math.max(0, total - (paymentMethod === "CHECK" ? 0 : paidAmount)),
            )}
          </small>
          {paymentMethod === "CHECK" && paidAmount > 0 && (
            <small>Chèque en attente : {money.format(paidAmount)}</small>
          )}
        </article>
        <article className={ui("process-card sale")}>
          <Icon size={21} />
          <strong>{purchase ? "Réception du stock" : "Stock partagé"}</strong>
          <p>
            {purchase
              ? "Tous les articles seront ajoutés au stock à la validation."
              : "Les quantités seront déduites du stock disponible à la validation."}{" "}
            Le serveur vérifie chaque ligne avant l’enregistrement.
          </p>
        </article>
      </aside>
      {showInvoice && mutation.data && (
        <InvoiceDetailModal
          kind={kind}
          id={mutation.data.id}
          onClose={() => setShowInvoice(false)}
        />
      )}
    </div>
  );
}
