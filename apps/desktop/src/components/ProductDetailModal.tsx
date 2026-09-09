import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ProductMediaEditor } from "./ProductMediaEditor";
import type { ProductListItem } from "@cosmetics/contracts";
import {
  Barcode,
  Boxes,
  Building2,
  CircleDollarSign,
  Eye,
  EyeOff,
  PackageCheck,
  Tag,
} from "lucide-react";
import { Modal } from "./Modal";
import { money } from "../lib/format";
import { resolveMediaUrl } from "../lib/media";

const categories: Record<ProductListItem["category"], string> = {
  MAKEUP: "Maquillage",
  SKIN_CARE: "Soin de la peau",
  FRAGRANCE: "Parfum",
  ACCESSORIES: "Accessoires",
  HYGIENE: "Hygiène",
  OTHER: "Autre",
};

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3 dark:bg-[#302b2f]">
      <dt className="text-[9px] font-bold uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-1.5 break-words text-xs font-bold text-ink">{value}</dd>
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
              {categories[product.category]}
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
              {money.format(product.retailPrice)}
            </strong>
            <small className="text-[10px] text-muted">
              {product.compareAtPrice === null
                ? "Aucun ancien prix"
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
              label="Prix d’achat"
              value={money.format(product.purchasePrice)}
            />
            <Detail
              label="Prix grossiste"
              value={money.format(product.wholesalePrice)}
            />
            <Detail
              label="Prix boutique"
              value={money.format(product.retailPrice)}
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
                <tr>
                  <th>Lot</th>
                  <th>Stock restant</th>
                  <th>Prix d’achat</th>
                  <th>Prix grossiste</th>
                  <th>Prix boutique</th>
                </tr>
              </thead>
              <tbody>
                {lots.data?.map((lot) => (
                  <tr key={lot.id}>
                    <td>
                      <strong>{lot.source}</strong>
                      <small className="block text-muted">
                        {new Date(lot.receivedOn).toLocaleDateString("fr-FR")} ·
                        reçu {lot.receivedQuantity}
                      </small>
                    </td>
                    <td>{lot.remainingQuantity}</td>
                    <td>{money.format(lot.purchasePrice)}</td>
                    <td>{money.format(lot.wholesalePrice)}</td>
                    <td>{money.format(lot.retailPrice)}</td>
                  </tr>
                ))}
                {lots.isLoading && (
                  <tr>
                    <td colSpan={5} className="py-5 text-center text-muted">
                      Chargement des lots…
                    </td>
                  </tr>
                )}
                {lots.data?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-5 text-center text-muted">
                      Aucun stock disponible.
                    </td>
                  </tr>
                )}
                {lots.isError && (
                  <tr>
                    <td colSpan={5} className="py-5 text-center text-rose-700">
                      Impossible de charger le détail des lots.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
