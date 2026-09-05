import { ui } from "../lib/ui";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProductInput, ProductListItem } from "@cosmetics/contracts";
import {
  ArrowDownToLine,
  PackagePlus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { ErrorState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { StatusPill } from "../components/StatusPill";
import { ProductDetailModal } from '../components/ProductDetailModal';
import { api, ApiRequestError } from "../lib/api";
import { integer, money } from "../lib/format";

const emptyProduct: CreateProductInput = {
  name: "",
  brand: "",
  category: "OTHER",
  description: "",
  imageUrl: "",
  sourceUrl: "",
  sku: "",
  barcode: "",
  reference: "",
  supplierName: "",
  purchasePrice: 0,
  wholesalePrice: 0,
  retailPrice: 0,
  compareAtPrice: undefined,
  initialQuantity: 0,
  lowStockThreshold: 5,
  retailVisible: false,
};

const categoryLabels: Record<string, string> = {
  MAKEUP: "Maquillage",
  SKIN_CARE: "Soin de la peau",
  FRAGRANCE: "Parfum",
  ACCESSORIES: "Accessoires",
  HYGIENE: "Hygiène",
  OTHER: "Autre",
};

function StockStatus({ product }: { product: ProductListItem }) {
  if (product.onHand === 0) return <StatusPill tone="bad">Rupture</StatusPill>;
  if (product.onHand <= product.lowStockThreshold)
    return <StatusPill tone="warn">Stock faible</StatusPill>;
  return <StatusPill tone="good">Disponible</StatusPill>;
}

export function InventoryPage({ canManage = true }: { canManage?: boolean }) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [stock, setStock] = useState<"all" | "low" | "out">("all");
  const [category, setCategory] = useState<CreateProductInput["category"] | "">(
    "",
  );
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductListItem | null>(null);
  const [page, setPage] = useState(1);
  const [imageError, setImageError] = useState('');
  const [imageName, setImageName] = useState('');
  const [imageMime, setImageMime] = useState('image/png');
  const [imageReading, setImageReading] = useState(false);
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: api.suppliers });
  const [adjustProduct, setAdjustProduct] = useState<ProductListItem | null>(
    null,
  );
  const [adjustment, setAdjustment] = useState({
    quantityDelta: 1,
    note: "Correction après comptage physique",
  });
  const [draft, setDraft] = useState<CreateProductInput>(emptyProduct);
  const products = useQuery({
    queryKey: ["products", search, stock, category, page],
    queryFn: () =>
      api.products({
        search,
        stock,
        category: category || undefined,
        page,
        pageSize: 50,
      }),
  });
  const adjust = useMutation({
    mutationFn: () =>
      api.adjustInventory({
        variantId: adjustProduct!.variantId,
        quantityDelta: adjustment.quantityDelta,
        reason: "CORRECTION",
        note: adjustment.note,
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
      setAdjustProduct(null);
      setAdjustment({
        quantityDelta: 1,
        note: "Correction après comptage physique",
      });
    },
  });
  const create = useMutation({
    mutationFn: api.createProduct,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
      setShowCreate(false);
      setDraft(emptyProduct);
      setImageName('');
      setImageError('');
    },
  });

  const counts = useMemo(
    () => ({
      total: products.data?.total ?? 0,
      units:
        products.data?.items.reduce((sum, item) => sum + item.onHand, 0) ?? 0,
      value:
        products.data?.items.reduce(
          (sum, item) => sum + item.onHand * item.purchasePrice,
          0,
        ) ?? 0,
    }),
    [products.data],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(draft);
  };

  async function selectImage(file?: File) {
    if (!file) return;
    setImageError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setImageError('Choisissez une image JPG, PNG ou WebP de 5 Mo maximum.'); return;
    }
    setImageReading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]!); reader.onerror = reject; reader.readAsDataURL(file); });
      setDraft(current => ({ ...current, imageUrl: '', imageUpload: { data } }));
      setImageName(file.name);
      setImageMime(file.type);
    } catch { setImageError('Impossible de lire cette image.'); }
    finally { setImageReading(false); }
  }

  const exportProducts = () => {
    const rows = products.data?.items ?? [];
    const csv = [
      [
        "Produit",
        "Marque",
        "SKU",
        "Catégorie",
        "Stock",
        "Réservé",
        "Prix achat",
        "Prix grossiste",
        "Prix retail",
      ],
      ...rows.map((product) => [
        product.name,
        product.brand,
        product.sku,
        product.category,
        product.onHand,
        product.reserved,
        product.purchasePrice,
        product.wholesalePrice,
        product.retailPrice,
      ]),
    ]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    link.download = `inventaire-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (products.isError) {
    const message =
      products.error instanceof ApiRequestError
        ? products.error.message
        : "Impossible de charger l’inventaire.";
    return (
      <ErrorState message={message} retry={() => void products.refetch()} />
    );
  }

  return (
    <div className={ui("inventory-stack")}>
      <section className={ui("inventory-summary")}>
        <div>
          <small>Références actives</small>
          <strong>{integer.format(counts.total)}</strong>
        </div>
        <div>
          <small>Unités affichées</small>
          <strong>{integer.format(counts.units)}</strong>
        </div>
        <div>
          <small>Valeur affichée</small>
          <strong>{money.format(counts.value)}</strong>
        </div>
        {canManage && (
          <button
            className={ui("primary-button")}
            onClick={() => setShowCreate(true)}
          >
            <PackagePlus size={18} /> Nouveau produit
          </button>
        )}
      </section>

      <section className={ui("panel inventory-panel")}>
        <div className={ui("inventory-toolbar")}>
          <div className={ui("table-search")}>
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Nom, marque, SKU ou code-barres"
            />
          </div>
          <div className={ui("segmented")} aria-label="Filtrer par stock">
            <button
              className={ui(stock === "all" ? "active" : "")}
              onClick={() => { setStock('all'); setPage(1); }}
            >
              Tous
            </button>
            <button
              className={ui(stock === "low" ? "active" : "")}
              onClick={() => { setStock('low'); setPage(1); }}
            >
              Faible
            </button>
            <button
              className={ui(stock === "out" ? "active" : "")}
              onClick={() => { setStock('out'); setPage(1); }}
            >
              Rupture
            </button>
          </div>
          <label className={ui("category-filter")}>
            <SlidersHorizontal size={15} />
            <select
              value={category}
              onChange={(event) => { setCategory(event.target.value as typeof category); setPage(1); }}
            >
              <option value="">Toutes catégories</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className={ui("secondary-button")} onClick={exportProducts}>
            <ArrowDownToLine size={16} /> Exporter
          </button>
        </div>

        <div className={ui("table-wrap")}>
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Référence</th>
                <th>Catégorie</th>
                <th>Stock</th>
                <th>Prix achat</th>
                <th>Prix grossiste</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.isLoading && (
                <tr>
                  <td colSpan={8} className={ui("loading-cell")}>
                    Chargement de l’inventaire…
                  </td>
                </tr>
              )}
              {products.data?.items.map((product) => (
                <tr key={product.variantId} className="cursor-pointer" onClick={() => setSelectedProduct(product)}>
                  <td>
                    <div className={ui("product-cell")}>
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" />
                      ) : (
                        <span>{product.name.slice(0, 1)}</span>
                      )}
                      <div>
                        <button className="text-left hover:underline" onClick={event => { event.stopPropagation(); setSelectedProduct(product); }}><strong title={product.name}>{product.name}</strong></button>
                        <small title={`${product.brand} · ${product.sku}`}>
                          {product.brand} · {product.sku}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={ui("mono")}>
                      {product.reference || "—"}
                    </span>
                    <small className={ui("sub-cell")}>
                      {product.barcode || "Sans code-barres"}
                    </small>
                  </td>
                  <td>{categoryLabels[product.category]}</td>
                  <td>
                    <strong>{integer.format(product.onHand)}</strong>
                    <small className={ui("sub-cell")}>
                      {product.reserved} réservé
                    </small>
                  </td>
                  <td>{money.format(product.purchasePrice)}</td>
                  <td>{money.format(product.wholesalePrice)}</td>
                  <td>
                    <StockStatus product={product} />
                  </td>
                  <td>
                    {canManage ? (
                      <button
                        className={ui("secondary-button compact")}
                        onClick={(event) => { event.stopPropagation(); setAdjustProduct(product); }}
                      >
                        Ajuster
                      </button>
                    ) : (
                      <span>Lecture seule</span>
                    )}
                  </td>
                </tr>
              ))}
              {products.data?.items.length === 0 && (
                <tr>
                  <td colSpan={8} className={ui("loading-cell")}>
                    Aucun produit ne correspond à cette recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className={ui("table-footer")}>
          <span>
            {counts.total} résultat{counts.total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2"><span>Page {page}</span><button className={ui('secondary-button compact')} disabled={page === 1} onClick={() => setPage(page - 1)}>Précédent</button><button className={ui('secondary-button compact')} disabled={page * 50 >= counts.total} onClick={() => setPage(page + 1)}>Suivant</button></div>
        </footer>
      </section>
      {selectedProduct && <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}

      {showCreate && (
        <Modal
          title="Ajouter un produit"
          subtitle="Créez le produit, sa référence et son stock initial en une seule opération."
          onClose={() => setShowCreate(false)}
        >
          <form className={ui("product-form")} onSubmit={submit}>
            <div className={ui("form-grid")}>
              <label>
                <span>Nom du produit</span>
                <input
                  required
                  minLength={2}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Ex. Sérum Éclat Vitamine C"
                />
              </label>
              <label>
                <span>Marque</span>
                <input
                  required
                  value={draft.brand}
                  onChange={(e) =>
                    setDraft({ ...draft, brand: e.target.value })
                  }
                  placeholder="Ex. Lumera"
                />
              </label>
              <label>
                <span>SKU</span>
                <input
                  required
                  value={draft.sku}
                  onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                  placeholder="LUM-SER-C30"
                />
              </label>
              <label>
                <span>Code-barres</span>
                <input
                  value={draft.barcode}
                  onChange={(e) =>
                    setDraft({ ...draft, barcode: e.target.value })
                  }
                  placeholder="6110000000012"
                />
              </label>
              <label>
                <span>Catégorie</span>
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      category: e.target
                        .value as CreateProductInput["category"],
                    })
                  }
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Fournisseur</span>
                <select value={draft.supplierId ?? ''} disabled={suppliers.isLoading || suppliers.isError} onChange={event => setDraft({ ...draft, supplierId: event.target.value || undefined, supplierName: '' })}>
                  <option value="">Aucun fournisseur affecté</option>
                  {suppliers.data?.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
                <small className="text-muted">Liste de Clients & fournisseurs. Ajoutez-y vos fournisseurs d’abord.</small>
                {suppliers.isError && <button type="button" className="text-brand" onClick={() => void suppliers.refetch()}>Réessayer de charger les fournisseurs</button>}
              </label>
              <label>
                <span>Prix d’achat (MAD)</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.purchasePrice}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      purchasePrice: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                <span>Prix grossiste (MAD)</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.wholesalePrice}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      wholesalePrice: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                <span>Prix retail (MAD)</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.retailPrice}
                  onChange={(e) =>
                    setDraft({ ...draft, retailPrice: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                <span>Ancien prix / prix barré</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.compareAtPrice ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      compareAtPrice: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </label>
              <label>
                <span>Stock initial</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={draft.initialQuantity}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      initialQuantity: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                <span>URL de l’image</span>
                <input
                  type="url"
                  value={draft.imageUrl}
                  onChange={(e) =>
                    { setDraft({ ...draft, imageUrl: e.target.value, imageUpload: undefined }); setImageName(''); setImageError(''); }
                  }
                  placeholder="https://…"
                />
              </label>
            </div>
            <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!imageReading && !create.isPending) void selectImage(event.dataTransfer.files[0]); }} className="my-4 rounded-xl border-2 border-dashed border-brand-secondary/50 bg-brand-soft/40 p-4">
              <label className="cursor-pointer"><span className="font-semibold">Glissez une image ici ou choisissez un fichier</span><small className="my-2 block text-muted">JPG, PNG, WebP · 5 Mo maximum · envoi après confirmation du produit</small>
                <input aria-label="Choisir une image du produit" type="file" accept="image/png,image/jpeg,image/webp" disabled={imageReading || create.isPending} onChange={event => { void selectImage(event.target.files?.[0]); event.target.value = ''; }} className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-ink" />
              </label>
              {imageReading && <p className="mt-2 text-xs">Lecture de l’image…</p>}
              {(draft.imageUpload || draft.imageUrl) && <div className="mt-3 flex items-center gap-3"><img src={draft.imageUpload ? `data:${imageMime};base64,${draft.imageUpload.data}` : draft.imageUrl} alt="Aperçu du produit" className="size-20 rounded-lg border border-line bg-white object-contain dark:bg-[#302b2f]" /><span className="min-w-0 break-all text-xs">{imageName || 'Image depuis une URL'}</span><button type="button" className={ui('secondary-button compact')} onClick={() => { setDraft({ ...draft, imageUrl: '', imageUpload: undefined }); setImageName(''); }}>Retirer</button></div>}
              {imageError && <p role="alert" className={ui('form-error')}>{imageError}</p>}
            </div>
            <label className={ui("full-field")}>
              <span>Description</span>
              <textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                placeholder="Description complète du produit…"
              />
            </label>
            <label className={ui("checkbox")}>
              <input
                type="checkbox"
                checked={draft.retailVisible}
                onChange={(e) =>
                  setDraft({ ...draft, retailVisible: e.target.checked })
                }
              />
              <span>Afficher immédiatement dans la boutique retail</span>
            </label>
            {create.isError && (!(create.error instanceof ApiRequestError) || create.error.status !== 499) && (
              <p className={ui("form-error")}>
                {create.error instanceof ApiRequestError
                  ? create.error.message
                  : "Impossible d’ajouter ce produit."}
              </p>
            )}
            <footer className={ui("modal-actions")}>
              <button
                className={ui("secondary-button")}
                type="button"
                onClick={() => setShowCreate(false)}
              >
                Annuler
              </button>
              <button
                className={ui("primary-button")}
                type="submit"
                disabled={create.isPending || imageReading}
              >
                {create.isPending ? "Enregistrement…" : "Ajouter le produit"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {adjustProduct && (
        <Modal
          title={`Ajuster · ${adjustProduct.name}`}
          subtitle={`Stock actuel : ${adjustProduct.onHand} · réservé : ${adjustProduct.reserved}`}
          onClose={() => setAdjustProduct(null)}
        >
          <form
            className={ui("product-form")}
            onSubmit={(event) => {
              event.preventDefault();
              adjust.mutate();
            }}
          >
            <div className={ui("form-grid")}>
              <label>
                <span>Variation de quantité</span>
                <input
                  required
                  type="number"
                  step="1"
                  value={adjustment.quantityDelta}
                  onChange={(event) =>
                    setAdjustment({
                      ...adjustment,
                      quantityDelta: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                <span>Motif</span>
                <input
                  required
                  minLength={3}
                  value={adjustment.note}
                  onChange={(event) =>
                    setAdjustment({ ...adjustment, note: event.target.value })
                  }
                />
              </label>
            </div>
            <p className={ui("form-hint")}>
              Utilisez une valeur positive pour ajouter du stock, négative pour
              le retirer.
            </p>
            {adjust.isError && (!(adjust.error instanceof ApiRequestError) || adjust.error.status !== 499) && (
              <p className={ui("form-error")}>
                {adjust.error instanceof ApiRequestError
                  ? adjust.error.message
                  : "Ajustement impossible."}
              </p>
            )}
            <footer className={ui("modal-actions")}>
              <button
                className={ui("secondary-button")}
                type="button"
                onClick={() => setAdjustProduct(null)}
              >
                Annuler
              </button>
              <button
                className={ui("primary-button")}
                disabled={adjust.isPending}
              >
                {adjust.isPending ? "Validation…" : "Valider l’ajustement"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
