import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ProductMediaEditor } from "./ProductMediaEditor";
import { productTaxonomy, type ProductListItem, type ProductStockLot } from "@cosmetics/contracts";
import {
  Barcode,
  Boxes,
  Building2,
  Check,
  CircleDollarSign,
  Eye,
  EyeOff,
  PackageCheck,
  Pencil,
  Tag,
  X,
} from "lucide-react";
import { Modal } from "./Modal";
import { money } from "../lib/format";
import { resolveMediaUrl } from "../lib/media";

const categories = Object.fromEntries(
  Object.entries(productTaxonomy).map(([key, value]) => [key, value.label]),
) as Record<ProductListItem["category"], string>;

function Detail({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-3 dark:bg-[#302b2f]">
      <dt className="text-[9px] font-bold uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-1.5 break-words text-xs font-bold text-ink">{value}</dd>
      {hint && <p className="mt-1 text-[10px] text-muted">{hint}</p>}
    </div>
  );
}

export function ProductDetailModal({
  product: initialProduct,
  onClose,
  canManage = false,
}: {
  product: ProductListItem;
  onClose: () => void;
  canManage?: boolean;
}) {
  const [product, setProduct] = useState(initialProduct);
  useEffect(() => {
    setProduct(initialProduct);
  }, [initialProduct]);

  const [activeImage, setActiveImage] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const images = product.images ?? (product.imageUrl ? [product.imageUrl] : []);
  const [draft, setDraft] = useState({
    images,
    videoUrl: product.videoUrl ?? "",
  });
  const cache = useQueryClient();
  const lots = useQuery({
    queryKey: ["product-stock-lots", product.id],
    queryFn: () => api.productStockLots(product.id),
  });

  // Calculate weighted average prices across all active lots in stock
  const activeLots = (lots.data ?? []).filter((l) => l.remainingQuantity > 0);
  const totalRemaining = activeLots.reduce((sum, l) => sum + l.remainingQuantity, 0);

  const effectivePurchasePrice =
    totalRemaining > 0
      ? activeLots.reduce((sum, l) => sum + l.purchasePrice * l.remainingQuantity, 0) / totalRemaining
      : (lots.data && lots.data.length > 0
          ? lots.data.reduce((sum, l) => sum + l.purchasePrice, 0) / lots.data.length
          : product.purchasePrice);

  const effectiveWholesalePrice =
    totalRemaining > 0
      ? activeLots.reduce((sum, l) => sum + l.wholesalePrice * l.remainingQuantity, 0) / totalRemaining
      : (lots.data && lots.data.length > 0
          ? lots.data.reduce((sum, l) => sum + l.wholesalePrice, 0) / lots.data.length
          : product.wholesalePrice);

  const effectiveRetailPrice =
    totalRemaining > 0
      ? activeLots.reduce((sum, l) => sum + l.retailPrice * l.remainingQuantity, 0) / totalRemaining
      : (lots.data && lots.data.length > 0
          ? lots.data.reduce((sum, l) => sum + l.retailPrice, 0) / lots.data.length
          : product.retailPrice);

  const minWholesale = activeLots.length > 0 ? Math.min(...activeLots.map((l) => l.wholesalePrice)) : effectiveWholesalePrice;
  const maxWholesale = activeLots.length > 0 ? Math.max(...activeLots.map((l) => l.wholesalePrice)) : effectiveWholesalePrice;
  const minRetail = activeLots.length > 0 ? Math.min(...activeLots.map((l) => l.retailPrice)) : effectiveRetailPrice;
  const maxRetail = activeLots.length > 0 ? Math.max(...activeLots.map((l) => l.retailPrice)) : effectiveRetailPrice;
  const minPurchase = activeLots.length > 0 ? Math.min(...activeLots.map((l) => l.purchasePrice)) : effectivePurchasePrice;
  const maxPurchase = activeLots.length > 0 ? Math.max(...activeLots.map((l) => l.purchasePrice)) : effectivePurchasePrice;

  const wholesaleMargin = effectiveWholesalePrice - effectivePurchasePrice;
  const wholesaleMarginPct =
    effectivePurchasePrice > 0
      ? Math.round((wholesaleMargin / effectivePurchasePrice) * 100)
      : null;

  const retailMargin = effectiveRetailPrice - effectivePurchasePrice;
  const retailMarginPct =
    effectivePurchasePrice > 0
      ? Math.round((retailMargin / effectivePurchasePrice) * 100)
      : null;

  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [lotDraft, setLotDraft] = useState({ wholesalePrice: 0, retailPrice: 0 });
  const [savingLotId, setSavingLotId] = useState<string | null>(null);
  const [lotError, setLotError] = useState<string | null>(null);

  function startEditLot(lot: ProductStockLot) {
    setEditingLotId(lot.id);
    setLotDraft({
      wholesalePrice: lot.wholesalePrice,
      retailPrice: lot.retailPrice,
    });
    setLotError(null);
  }

  function cancelEditLot() {
    setEditingLotId(null);
    setLotError(null);
  }

  async function saveLot(lotId: string) {
    setSavingLotId(lotId);
    setLotError(null);
    try {
      await api.updateStockLot(product.id, lotId, lotDraft);
      setEditingLotId(null);
      setProduct((prev) => ({
        ...prev,
        wholesalePrice: lotDraft.wholesalePrice,
        retailPrice: lotDraft.retailPrice,
      }));
      await cache.invalidateQueries({
        queryKey: ["product-stock-lots", product.id],
      });
      await cache.invalidateQueries({ queryKey: ["products"] });
    } catch (err) {
      setLotError(
        err instanceof Error
          ? err.message
          : "Impossible de modifier les prix du lot.",
      );
    } finally {
      setSavingLotId(null);
    }
  }
  async function saveMedia() {
    setSaving(true);
    setError("");
    try {
      const media = await api.updateProductMedia(product.id, draft);
      setProduct((current) => ({
        ...current,
        ...media,
        imageUrl: media.images[0] ?? "",
      }));
      setActiveImage(0);
      setEditing(false);
      await cache.invalidateQueries({ queryKey: ["products"] });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  }
  const stockTone =
    product.available === 0
      ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
      : product.available <= product.lowStockThreshold
        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  const stockLabel =
    product.available === 0
      ? "Rupture"
      : product.available <= product.lowStockThreshold
        ? "Stock faible"
        : "En stock";

  return (
    <Modal
      title="Fiche produit"
      subtitle={`${product.sku} · catalogue et stock partagé`}
      onClose={() => {
        if (!saving && !uploading) onClose();
      }}
      size="wide"
    >
      <div className="p-5 sm:p-6">
        <section className="grid overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-[260px_1fr]">
          <div className="relative grid min-h-60 place-items-center overflow-hidden bg-linear-to-br from-brand-soft via-white to-pink-50 dark:from-[#392830] dark:via-[#282428] dark:to-[#302630] p-6">
            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-brand shadow-sm dark:bg-[#302b2f]/90">
              {categories[product.category]} · {product.subcategory || "Non classé"}
            </span>
            <div className="w-full pt-6">
              {activeImage === images.length && product.videoUrl ? (
                <video
                  key={product.videoUrl}
                  src={resolveMediaUrl(product.videoUrl)}
                  controls
                  preload="metadata"
                  className="max-h-64 w-full rounded-xl bg-black"
                />
              ) : images[activeImage] ? (
                <img
                  src={resolveMediaUrl(images[activeImage])}
                  alt={product.name}
                  className="h-56 w-full object-contain"
                />
              ) : (
                <span className="grid h-56 place-items-center text-5xl font-bold text-brand">
                  {product.name[0]}
                </span>
              )}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {images.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    aria-label={`Voir l’image ${index + 1}${index === 0 ? ", à la une" : ""}`}
                    aria-pressed={activeImage === index}
                    onClick={() => setActiveImage(index)}
                    className={`size-12 overflow-hidden rounded-lg border-2 bg-white dark:bg-[#302b2f] ${activeImage === index ? "border-brand" : "border-line"}`}
                  >
                    <img
                      src={resolveMediaUrl(url)}
                      alt=""
                      className="size-full object-contain"
                    />
                  </button>
                ))}
                {product.videoUrl && (
                  <button
                    type="button"
                    aria-pressed={activeImage === images.length}
                    onClick={() => setActiveImage(images.length)}
                    className={`rounded-lg border-2 px-2 text-xs ${activeImage === images.length ? "border-brand text-brand" : "border-line"}`}
                  >
                    ▶ Vidéo
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between p-5 sm:p-7">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${stockTone}`}
                >
                  {stockLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold ${product.retailVisible ? "bg-brand-soft text-brand" : "bg-stone-100 dark:bg-[#302b2f] text-muted"}`}
                >
                  {product.retailVisible ? (
                    <Eye size={12} />
                  ) : (
                    <EyeOff size={12} />
                  )}
                  {product.retailVisible
                    ? "Visible en boutique"
                    : "Masqué en boutique"}
                </span>
              </div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-brand">
                {product.brand}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">
                {product.name}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
                {product.description ||
                  "Aucune description renseignée pour ce produit."}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-[10px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Tag size={14} className="text-brand" />
                Réf. {product.reference || "—"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Barcode size={14} className="text-brand" />
                {product.barcode || "Sans code-barres"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Building2 size={14} className="text-brand" />
                {product.supplierName || "Fournisseur non affecté"}
              </span>
            </div>
          </div>
        </section>

        {canManage && (
          <div className="mt-4">
            {!editing ? (
              <button
                type="button"
                className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-brand"
                onClick={() => {
                  setDraft({ images, videoUrl: product.videoUrl ?? "" });
                  setEditing(true);
                  setError("");
                }}
              >
                Gérer la galerie & vidéo
              </button>
            ) : (
              <>
                <ProductMediaEditor
                  value={draft}
                  onChange={setDraft}
                  disabled={saving}
                  onBusyChange={setUploading}
                />
                {error && (
                  <p
                    role="alert"
                    className="mb-3 text-xs text-rose-600 dark:text-rose-300"
                  >
                    {error}
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={saving || uploading}
                    onClick={() => void saveMedia()}
                    className="rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {saving ? "Enregistrement…" : "Enregistrer les médias"}
                  </button>
                  <button
                    type="button"
                    disabled={saving || uploading}
                    onClick={() => setEditing(false)}
                    className="text-xs text-muted"
                  >
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-line bg-white p-4 shadow-sm dark:bg-[#302b2f] dark:shadow-none">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted">
              <Boxes size={16} className="text-brand" />
              Stock physique
            </div>
            <strong className="mt-2 block text-2xl text-ink">
              {product.onHand}
            </strong>
            <small className="text-[10px] text-muted">
              {product.reserved} unité(s) réservée(s)
            </small>
          </article>
          <article
            className={`rounded-2xl border border-line p-4 ${stockTone}`}
          >
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
              <PackageCheck size={16} />
              Disponible
            </div>
            <strong className="mt-2 block text-2xl">{product.available}</strong>
            <small className="text-[10px] opacity-75">
              Alerte à {product.lowStockThreshold} unité(s)
            </small>
          </article>
          <article className="rounded-2xl border border-brand/10 bg-brand-soft/60 p-4 text-brand">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
              <CircleDollarSign size={16} />
              Prix boutique
            </div>
            <strong className="mt-2 block text-2xl">
              {money.format(effectiveRetailPrice)}
            </strong>
            <small className="text-[10px] text-muted">
              {product.compareAtPrice === null
                ? (activeLots.length > 1 && minRetail !== maxRetail
                    ? `De ${money.format(minRetail)} à ${money.format(maxRetail)}`
                    : "Prix unitaire actuel")
                : `Ancien prix ${money.format(product.compareAtPrice)}`}
            </small>
          </article>
        </section>

        <section className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-brand">
                Tarification
              </p>
              <h3 className="mt-1 text-sm font-bold">Prix et marge unitaire</h3>
            </div>
            <CircleDollarSign size={20} className="text-brand" />
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Detail
              label="Prix d'achat"
              value={money.format(effectivePurchasePrice)}
              hint={
                activeLots.length > 1 && minPurchase !== maxPurchase
                  ? `PMP (${money.format(minPurchase)} – ${money.format(maxPurchase)})`
                  : activeLots.length > 1
                    ? `PMP · ${activeLots.length} réceptions en stock`
                    : undefined
              }
            />
            <Detail
              label="Prix grossiste"
              value={money.format(effectiveWholesalePrice)}
              hint={
                activeLots.length > 1 && minWholesale !== maxWholesale
                  ? `Moyenne (${money.format(minWholesale)} – ${money.format(maxWholesale)}) · marge ${wholesaleMarginPct !== null ? `${wholesaleMarginPct >= 0 ? "+" : ""}${wholesaleMarginPct}%` : ""}`
                  : wholesaleMarginPct !== null
                    ? `Marge : ${wholesaleMargin >= 0 ? "+" : ""}${money.format(wholesaleMargin)} (${wholesaleMarginPct >= 0 ? "+" : ""}${wholesaleMarginPct}%)`
                    : undefined
              }
            />
            <Detail
              label="Prix boutique"
              value={money.format(effectiveRetailPrice)}
              hint={
                activeLots.length > 1 && minRetail !== maxRetail
                  ? `Moyenne (${money.format(minRetail)} – ${money.format(maxRetail)}) · marge ${retailMarginPct !== null ? `${retailMarginPct >= 0 ? "+" : ""}${retailMarginPct}%` : ""}`
                  : retailMarginPct !== null
                    ? `Marge : ${retailMargin >= 0 ? "+" : ""}${money.format(retailMargin)} (${retailMarginPct >= 0 ? "+" : ""}${retailMarginPct}%)`
                    : undefined
              }
            />
          </dl>
        </section>

        <section className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="mb-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-brand">
              Lots actuellement en stock
            </p>
            <h3 className="mt-1 text-sm font-bold">
              Stocks et prix par réception
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2.5 font-bold">Lot</th>
                  <th className="py-2.5 font-bold">Stock restant</th>
                  <th className="py-2.5 font-bold">Prix d’achat</th>
                  <th className="py-2.5 font-bold">Prix grossiste</th>
                  <th className="py-2.5 font-bold">Prix boutique</th>
                  {canManage && (
                    <th className="py-2.5 text-right font-bold">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {lots.data?.map((lot) => {
                  const isEditing = editingLotId === lot.id;
                  const isSaving = savingLotId === lot.id;
                  return (
                    <tr
                      key={lot.id}
                      className={
                        isEditing
                          ? "bg-brand-soft/25 dark:bg-[#392e35]"
                          : "hover:bg-black/2 dark:hover:bg-white/2"
                      }
                    >
                      <td className="py-2">
                        <small className="text-[11px] font-semibold block text-muted">
                          {lot.source} ·{" "}
                          {lot.supplierName && `${lot.supplierName}${" · "}`}
                          {new Date(lot.receivedOn).toLocaleDateString("fr-FR")}{" "}
                          · reçu {lot.receivedQuantity}
                        </small>
                      </td>
                      <td className="py-2 font-medium">
                        {lot.remainingQuantity}
                      </td>
                      <td className="py-2">
                        {money.format(lot.purchasePrice)}<br/>
                        <small className="text-muted italic opacity-75">
                          {money.format(lot.purchasePrice * lot.remainingQuantity)}
                        </small>
                      </td>
                      <td className="py-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={isSaving}
                              value={lotDraft.wholesalePrice}
                              onChange={(e) =>
                                setLotDraft((prev) => ({
                                  ...prev,
                                  wholesalePrice: Math.max(
                                    0,
                                    parseFloat(e.target.value) || 0,
                                  ),
                                }))
                              }
                              className="w-24 rounded-lg border border-line bg-white px-2 py-1 text-xs font-bold text-ink shadow-xs focus:border-brand focus:outline-hidden dark:bg-[#282428]"
                              aria-label="Prix grossiste du lot"
                            />
                            <span className="text-[10px] text-muted">MAD</span>
                          </div>
                        ) : (
                          <span className="font-semibold text-ink">
                            {money.format(lot.wholesalePrice)}<br/>
                            <small className="text-muted italic opacity-75">
                              {money.format(lot.wholesalePrice * lot.remainingQuantity)}
                            </small>
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={isSaving}
                              value={lotDraft.retailPrice}
                              onChange={(e) =>
                                setLotDraft((prev) => ({
                                  ...prev,
                                  retailPrice: Math.max(
                                    0,
                                    parseFloat(e.target.value) || 0,
                                  ),
                                }))
                              }
                              className="w-24 rounded-lg border border-line bg-white px-2 py-1 text-xs font-bold text-ink shadow-xs focus:border-brand focus:outline-hidden dark:bg-[#282428]"
                              aria-label="Prix boutique du lot"
                            />
                            <span className="text-[10px] text-muted">MAD</span>
                          </div>
                        ) : (
                          <span className="font-semibold text-ink">
                            {money.format(lot.retailPrice)}<br/>
                            <small className="text-muted italic opacity-75">
                              {money.format(lot.retailPrice * lot.remainingQuantity)}
                            </small>
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="py-2 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => void saveLot(lot.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-brand/90 disabled:opacity-50"
                                title="Enregistrer les prix"
                              >
                                <Check size={13} />
                                <span>{isSaving ? "…" : "Valider"}</span>
                              </button>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={cancelEditLot}
                                className="inline-flex items-center rounded-lg border border-line bg-white p-1 text-xs font-medium text-muted hover:bg-stone-50 dark:bg-[#282428] dark:hover:bg-[#342e34]"
                                title="Annuler"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditLot(lot)}
                              className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-bold text-brand hover:border-brand/40 hover:bg-brand-soft/30 dark:bg-[#282428]"
                              title="Modifier les prix de ce lot"
                            >
                              <Pencil size={11} />
                              <span>Modifier</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {lots.isLoading && (
                  <tr>
                    <td
                      colSpan={canManage ? 7 : 6}
                      className="py-5 text-center text-muted"
                    >
                      Chargement des lots…
                    </td>
                  </tr>
                )}
                {lots.data?.length === 0 && (
                  <tr>
                    <td
                      colSpan={canManage ? 7 : 6}
                      className="py-5 text-center text-muted"
                    >
                      Aucun stock disponible.
                    </td>
                  </tr>
                )}
                {lots.isError && (
                  <tr>
                    <td
                      colSpan={canManage ? 7 : 6}
                      className="py-5 text-center text-rose-700 dark:text-rose-300"
                    >
                      Impossible de charger le détail des lots.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {lotError && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {lotError}
            </p>
          )}
          <p className="mt-3 text-[10px] text-muted">
            Les sorties sont imputées aux lots les plus anciens (FIFO). Chaque
            nouvelle réception conserve ses trois prix.
          </p>
        </section>

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <span className="text-[10px] text-muted">
            Dernières données synchronisées avec le stock partagé.
          </span>
          <button
            type="button"
            className="inline-flex rounded-lg bg-linear-to-r from-brand to-brand-secondary px-5 py-2 text-xs font-bold text-white shadow-sm"
            onClick={onClose}
          >
            Fermer
          </button>
        </footer>
      </div>
    </Modal>
  );
}
