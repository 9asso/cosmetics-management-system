import { ui } from "../lib/ui";
import { resolveMediaUrl } from "../lib/media";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  productTaxonomy,
  type CreateProductInput,
  type ProductListItem,
} from "@cosmetics/contracts";
import {
  ArrowDownToLine,
  Eye,
  PackagePlus,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { ErrorState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { StatusPill } from "../components/StatusPill";
import { ProductMediaEditor } from "../components/ProductMediaEditor";
import { ProductDetailModal } from "../components/ProductDetailModal";
import { SearchablePopup } from "../components/SearchablePopup";
import { api, ApiRequestError } from "../lib/api";
import { allPages, downloadCsv } from "../lib/csv";
import { integer, money } from "../lib/format";

const emptyProduct: CreateProductInput = {
  name: "",
  brand: "",
  category: "SKIN_CARE",
  subcategory: "Autres soins visage",
  description: "",
  imageUrl: "",
  media: { images: [], videoUrl: "" },
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

const categoryLabels = Object.fromEntries(
  Object.entries(productTaxonomy).map(([key, value]) => [key, value.label]),
) as Record<CreateProductInput["category"], string>;

function skuSuffix() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto
        .randomUUID()
        .replaceAll("-", "")
        .slice(0, 6)
        .toUpperCase()
    : Math.random().toString(36).slice(2, 8).toUpperCase();
}

function productSku(name: string, suffix: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return slug ? `${slug}-${suffix}` : suffix;
}

function StockStatus({ product }: { product: ProductListItem }) {
  if (product.onHand - product.reserved === 0)
    return <StatusPill tone="bad">Rupture</StatusPill>;
  if (product.onHand - product.reserved <= product.lowStockThreshold)
    return <StatusPill tone="warn">Stock faible</StatusPill>;
  return <StatusPill tone="good">Disponible</StatusPill>;
}

export function InventoryPage({
  canManage = true,
  canDelete = false,
  canViewPurchasePrice = true,
  initialStock = "all",
  initialCreate = false,
}: {
  canManage?: boolean;
  canDelete?: boolean;
  canViewPurchasePrice?: boolean;
  initialStock?: "all" | "low" | "out";
  initialCreate?: boolean;
}) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [stock, setStock] = useState<"all" | "low" | "out">(initialStock);
  const [category, setCategory] = useState<CreateProductInput["category"] | "">(
    "",
  );
  const [subcategory, setSubcategory] = useState("");
  const [showCreate, setShowCreate] = useState(initialCreate && canManage);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [selectedProduct, setSelectedProduct] =
    useState<ProductListItem | null>(null);
  const [selectedProductStartsEditing, setSelectedProductStartsEditing] =
    useState(false);
  const [returnToCreateAfterProduct, setReturnToCreateAfterProduct] =
    useState(false);
  const [deletingProduct, setDeletingProduct] =
    useState<ProductListItem | null>(null);
  const [returnToCreateAfterDelete, setReturnToCreateAfterDelete] =
    useState(false);
  const [duplicateProducts, setDuplicateProducts] = useState<ProductListItem[]>(
    [],
  );
  const [duplicateLookupPending, setDuplicateLookupPending] = useState(false);
  const [page, setPage] = useState(1);
  const [imageReading, setImageReading] = useState(false);
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: api.suppliers,
    enabled: canManage,
  });
  const [adjustProduct, setAdjustProduct] = useState<ProductListItem | null>(
    null,
  );
  const [adjustment, setAdjustment] = useState({
    quantityDelta: 1,
    note: "Correction après comptage physique",
  });
  const [draft, setDraft] = useState<CreateProductInput>(emptyProduct);
  const [skuToken, setSkuToken] = useState(skuSuffix);
  const products = useQuery({
    queryKey: ["products", search, stock, category, subcategory, page],
    queryFn: () =>
      api.products({
        search,
        stock,
        category: category || undefined,
        subcategory: subcategory || undefined,
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
  const loadProductConflicts = async (
    input: CreateProductInput,
    error?: unknown,
  ) => {
    setDuplicateLookupPending(true);
    try {
      const details =
        error instanceof ApiRequestError &&
        error.details &&
        typeof error.details === "object"
          ? (error.details as { conflicts?: ProductListItem[] })
          : undefined;
      const conflicts = Array.isArray(details?.conflicts)
        ? details.conflicts
        : await api.productConflicts(input.sku, input.barcode);
      setDuplicateProducts(conflicts);
    } catch {
      setDuplicateProducts([]);
    } finally {
      setDuplicateLookupPending(false);
    }
  };
  const create = useMutation({
    mutationFn: api.createProduct,
    onMutate: () => {
      setDuplicateProducts([]);
      setDuplicateLookupPending(false);
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
      setShowCreate(false);
      setDraft(emptyProduct);
      setSkuToken(skuSuffix());
      setDuplicateProducts([]);
    },
    onError: async (error, input) => {
      if (error instanceof ApiRequestError && error.status === 409) {
        await loadProductConflicts(input, error);
      }
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteProduct(deletingProduct!.id),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        client.invalidateQueries({ queryKey: ["dashboard-analytics"] }),
      ]);
      if (selectedProduct?.id === deletingProduct?.id) {
        setSelectedProduct(null);
      }
      setDuplicateProducts((current) =>
        current.filter((product) => product.id !== deletingProduct?.id),
      );
      setDeletingProduct(null);
      if (returnToCreateAfterDelete) {
        setReturnToCreateAfterDelete(false);
        create.reset();
        setShowCreate(true);
      }
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

  const openProduct = (
    product: ProductListItem,
    options: { edit?: boolean; returnToCreate?: boolean } = {},
  ) => {
    setSelectedProductStartsEditing(Boolean(options.edit));
    setReturnToCreateAfterProduct(Boolean(options.returnToCreate));
    if (options.returnToCreate) setShowCreate(false);
    setSelectedProduct(product);
  };

  const openDelete = (product: ProductListItem, returnToCreate = false) => {
    remove.reset();
    setReturnToCreateAfterDelete(returnToCreate);
    if (returnToCreate) setShowCreate(false);
    setDeletingProduct(product);
  };

  const exportProducts = async () => {
    setExporting(true);
    setExportError("");
    try {
      const rows = await allPages((page) =>
        api.products({
          search,
          stock,
          category: category || undefined,
          subcategory: subcategory || undefined,
          page,
          pageSize: 100,
        }),
      );
      await downloadCsv(
        `inventaire-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          [
            "Produit",
            "Marque",
            "SKU",
            "Catégorie",
            "Sous-catégorie",
            "Stock",
            "Réservé",
            "Disponible",
            "Seuil alerte",
            ...(canViewPurchasePrice ? ["Prix achat"] : []),
            "Prix grossiste",
            "Prix retail",
            "Fournisseur",
          ],
          ...rows.map((product) => [
            product.name,
            product.brand,
            product.sku,
            categoryLabels[product.category] ?? product.category,
            product.subcategory,
            product.onHand,
            product.reserved,
            product.onHand - product.reserved,
            product.lowStockThreshold,
            ...(canViewPurchasePrice ? [product.purchasePrice] : []),
            product.wholesalePrice,
            product.retailPrice,
            product.supplierName,
          ]),
        ],
      );
    } catch (error) {
      setExportError(
        error instanceof ApiRequestError
          ? error.message
          : "Export impossible. Réessayez.",
      );
    } finally {
      setExporting(false);
    }
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
        {canViewPurchasePrice && (
          <div>
            <small>Valeur affichée</small>
            <strong>{money.format(counts.value)}</strong>
          </div>
        )}
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
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Nom, marque, SKU ou code-barres"
            />
          </div>
          <div className={ui("segmented")} aria-label="Filtrer par stock">
            <button
              className={ui(stock === "all" ? "active" : "")}
              aria-pressed={stock === "all"}
              onClick={() => {
                setStock("all");
                setPage(1);
              }}
            >
              Tous
            </button>
            <button
              className={ui(stock === "low" ? "active" : "")}
              aria-pressed={stock === "low"}
              onClick={() => {
                setStock("low");
                setPage(1);
              }}
            >
              Faible
            </button>
            <button
              className={ui(stock === "out" ? "active" : "")}
              aria-pressed={stock === "out"}
              onClick={() => {
                setStock("out");
                setPage(1);
              }}
            >
              Rupture
            </button>
          </div>
          <label className={ui("category-filter")}>
            <SlidersHorizontal size={15} />
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as typeof category);
                setSubcategory("");
                setPage(1);
              }}
            >
              <option value="">Toutes catégories</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={ui("category-filter")}>
            <select
              value={subcategory}
              disabled={!category}
              onChange={(event) => {
                setSubcategory(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Toutes sous-catégories</option>
              {category &&
                productTaxonomy[category].subcategories.map((value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                ))}
            </select>
          </label>
          <button
            className={ui("secondary-button")}
            disabled={exporting || products.isLoading}
            onClick={() => void exportProducts()}
          >
            <ArrowDownToLine size={16} /> {exporting ? "Export…" : "Exporter"}
          </button>
        </div>

        {exportError && (
          <p role="alert" className={ui("form-error")}>
            {exportError}
          </p>
        )}
        <div className={ui("table-wrap")}>
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Référence</th>
                <th>Catégorie</th>
                <th>Stock</th>
                {canViewPurchasePrice && <th>Prix achat</th>}
                <th>Prix grossiste</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.isLoading && (
                <tr>
                  <td
                    colSpan={canViewPurchasePrice ? 8 : 7}
                    className={ui("loading-cell")}
                  >
                    Chargement de l’inventaire…
                  </td>
                </tr>
              )}
              {products.data?.items.map((product) => (
                <tr
                  key={product.variantId}
                  className="cursor-pointer"
                  onClick={() => openProduct(product)}
                >
                  <td>
                    <div className={ui("product-cell")}>
                      {product.imageUrl ? (
                        <img src={resolveMediaUrl(product.imageUrl)} alt="" />
                      ) : (
                        <span>{product.name.slice(0, 1)}</span>
                      )}
                      <div>
                        <button
                          className="text-left hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            openProduct(product);
                          }}
                        >
                          <strong title={product.name}>{product.name}</strong>
                        </button>
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
                  <td>
                    {categoryLabels[product.category]}
                    <small className={ui("sub-cell")}>
                      {product.subcategory || "—"}
                    </small>
                  </td>
                  <td>
                    <strong>{integer.format(product.onHand)}</strong>
                    <small className={ui("sub-cell")}>
                      {product.reserved} réservé ·{" "}
                      {product.onHand - product.reserved} disponible
                    </small>
                  </td>
                  {canViewPurchasePrice && (
                    <td>{money.format(product.purchasePrice)}</td>
                  )}
                  <td>{money.format(product.wholesalePrice)}</td>
                  <td>
                    <StockStatus product={product} />
                  </td>
                  <td>
                    {canManage || canDelete ? (
                      <div className="flex flex-wrap gap-1.5">
                        {canManage && (
                          <button
                            className={ui("secondary-button compact")}
                            onClick={(event) => {
                              event.stopPropagation();
                              setAdjustProduct(product);
                            }}
                          >
                            Ajuster
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className={
                              ui("secondary-button compact") +
                              " border-rose-200 text-rose-700 hover:border-rose-400 dark:text-rose-300"
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              openDelete(product);
                            }}
                          >
                            <Trash2 size={14} /> Supprimer
                          </button>
                        )}
                      </div>
                    ) : (
                      <span>Lecture seule</span>
                    )}
                  </td>
                </tr>
              ))}
              {products.data?.items.length === 0 && (
                <tr>
                  <td
                    colSpan={canViewPurchasePrice ? 8 : 7}
                    className={ui("loading-cell")}
                  >
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
              disabled={page * 50 >= counts.total}
              onClick={() => setPage(page + 1)}
            >
              Suivant
            </button>
          </div>
        </footer>
      </section>
      {selectedProduct && (
        <ProductDetailModal
          canManage={canManage}
          canViewPurchasePrice={canViewPurchasePrice}
          initialEditing={selectedProductStartsEditing}
          product={
            products.data?.items.find((p) => p.id === selectedProduct.id) ??
            selectedProduct
          }
          onClose={() => {
            setSelectedProduct(null);
            setSelectedProductStartsEditing(false);
            if (returnToCreateAfterProduct) {
              setReturnToCreateAfterProduct(false);
              setShowCreate(true);
              void loadProductConflicts(draft);
            }
          }}
        />
      )}

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
                  onChange={(e) =>
                    (() => {
                      create.reset();
                      setDuplicateProducts([]);
                      setDraft({
                        ...draft,
                        name: e.target.value,
                        sku: productSku(e.target.value, skuToken),
                      });
                    })()
                  }
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
                  readOnly
                  placeholder="Généré depuis le nom"
                />
              </label>
              <label>
                <span>Code-barres</span>
                <input
                  value={draft.barcode}
                  onChange={(e) =>
                    (() => {
                      create.reset();
                      setDuplicateProducts([]);
                      setDraft({ ...draft, barcode: e.target.value });
                    })()
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
                      subcategory:
                        productTaxonomy[
                          e.target.value as CreateProductInput["category"]
                        ].subcategories[0],
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
                <span>Sous-catégorie</span>
                <select
                  value={draft.subcategory}
                  onChange={(e) =>
                    setDraft({ ...draft, subcategory: e.target.value })
                  }
                >
                  {productTaxonomy[draft.category].subcategories.map(
                    (value) => (
                      <option value={value} key={value}>
                        {value}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <div>
                <SearchablePopup
                  label="Fournisseur"
                  placeholder="Rechercher un fournisseur"
                  items={suppliers.data ?? []}
                  value={draft.supplierId ?? ""}
                  onChange={(supplierId) =>
                    setDraft({
                      ...draft,
                      supplierId: supplierId || undefined,
                      supplierName: "",
                    })
                  }
                  getId={(supplier) => supplier.id}
                  getLabel={(supplier) => supplier.name}
                  getDetail={(supplier) =>
                    supplier.phone || supplier.email || supplier.address
                  }
                  disabled={suppliers.isLoading || suppliers.isError}
                  emptyLabel="Aucun fournisseur trouvé."
                />
                {suppliers.isError && (
                  <button
                    type="button"
                    className="text-brand"
                    onClick={() => void suppliers.refetch()}
                  >
                    Réessayer de charger les fournisseurs
                  </button>
                )}
              </div>
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
            </div>
            <ProductMediaEditor
              value={draft.media ?? { images: [], videoUrl: "" }}
              onChange={(media) =>
                setDraft((current) => ({ ...current, media }))
              }
              disabled={create.isPending}
              onBusyChange={setImageReading}
            />
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
            {create.isError &&
              (!(create.error instanceof ApiRequestError) ||
                create.error.status !== 499) && (
                <div className="space-y-3">
                  <p role="alert" className={ui("form-error")}>
                    {create.error instanceof ApiRequestError &&
                    create.error.status === 409
                      ? "SKU ou code-barres déjà utilisé."
                      : create.error instanceof ApiRequestError
                        ? create.error.message
                        : "Impossible d’ajouter ce produit."}
                  </p>
                  {create.error instanceof ApiRequestError &&
                    create.error.status === 409 && (
                      <section
                        aria-label="Produits en conflit"
                        className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-700/60 dark:bg-amber-950/20"
                      >
                        <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          Produits utilisant déjà ces identifiants
                        </h3>
                        {duplicateLookupPending && (
                          <p className="text-xs text-muted">
                            Recherche du produit existant…
                          </p>
                        )}
                        {!duplicateLookupPending &&
                          duplicateProducts.length === 0 && (
                            <p className="text-xs text-muted">
                              Aucun produit actif correspondant n’a été trouvé.
                            </p>
                          )}
                        {duplicateProducts.map((product) => (
                          <article
                            key={product.id}
                            className="flex flex-col gap-3 rounded-xl border border-line bg-white p-3 dark:bg-[#302b2f] sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              {product.imageUrl ? (
                                <img
                                  className="size-12 rounded-lg object-cover"
                                  src={resolveMediaUrl(product.imageUrl)}
                                  alt=""
                                />
                              ) : (
                                <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-brand-soft font-bold text-brand">
                                  {product.name.slice(0, 1)}
                                </span>
                              )}
                              <div className="min-w-0">
                                <strong className="block truncate text-sm">
                                  {product.name}
                                </strong>
                                <p className="truncate text-xs text-muted">
                                  {product.brand} · {product.sku}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {product.sku === draft.sku.trim() && (
                                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                      Même SKU
                                    </span>
                                  )}
                                  {draft.barcode.trim() !== "" &&
                                    product.barcode ===
                                      draft.barcode.trim() && (
                                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                        Même code-barres
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                className={ui("secondary-button compact")}
                                aria-label={`Voir ${product.name}`}
                                onClick={() =>
                                  openProduct(product, { returnToCreate: true })
                                }
                              >
                                <Eye size={14} /> Voir
                              </button>
                              {canManage && (
                                <button
                                  type="button"
                                  className={ui("secondary-button compact")}
                                  aria-label={`Modifier ${product.name}`}
                                  onClick={() =>
                                    openProduct(product, {
                                      edit: true,
                                      returnToCreate: true,
                                    })
                                  }
                                >
                                  <Pencil size={14} /> Modifier
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  className={
                                    ui("secondary-button compact") +
                                    " border-rose-200 text-rose-700 dark:text-rose-300"
                                  }
                                  aria-label={`Supprimer ${product.name}`}
                                  onClick={() => openDelete(product, true)}
                                >
                                  <Trash2 size={14} /> Supprimer
                                </button>
                              )}
                            </div>
                          </article>
                        ))}
                      </section>
                    )}
                </div>
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
            {adjust.isError &&
              (!(adjust.error instanceof ApiRequestError) ||
                adjust.error.status !== 499) && (
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
      {deletingProduct && (
        <Modal
          title="Supprimer le produit"
          subtitle="Cette action nécessite votre confirmation."
          onClose={() => {
            if (remove.isPending) return;
            setDeletingProduct(null);
            if (returnToCreateAfterDelete) {
              setReturnToCreateAfterDelete(false);
              setShowCreate(true);
            }
          }}
        >
          <div className="space-y-4 p-5 sm:p-6">
            <p className="text-sm leading-relaxed">
              Confirmez la suppression de{" "}
              <strong>{deletingProduct.name}</strong>. Le produit disparaîtra du
              catalogue et du stock, mais son historique restera conservé dans
              les anciennes opérations.
            </p>
            {remove.isError && (
              <p role="alert" className={ui("form-error")}>
                {remove.error instanceof ApiRequestError
                  ? remove.error.message
                  : "Suppression impossible. Réessayez."}
              </p>
            )}
            <footer className={ui("modal-actions")}>
              <button
                type="button"
                className={ui("secondary-button")}
                disabled={remove.isPending}
                onClick={() => {
                  setDeletingProduct(null);
                  if (returnToCreateAfterDelete) {
                    setReturnToCreateAfterDelete(false);
                    setShowCreate(true);
                  }
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                className={ui("primary-button") + " bg-rose-700"}
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                <Trash2 size={15} />
                {remove.isPending ? "Suppression…" : "Confirmer la suppression"}
              </button>
            </footer>
          </div>
        </Modal>
      )}
    </div>
  );
}
