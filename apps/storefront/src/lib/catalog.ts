import { productCategories, type ProductListItem } from "@cosmetics/contracts";

export type Category = ProductListItem["category"];
export type CartLine = { product: ProductListItem; quantity: number };

export type CatalogFilter = {
  category: Category | "ALL";
  subcategory: string;
  brand: string;
  query: string;
  saleOnly: boolean;
  favoritesOnly: boolean;
  sort: "featured" | "price-asc" | "price-desc" | "discount" | "name";
};

export const sortOptions: { value: CatalogFilter["sort"]; label: string }[] = [
  { value: "featured", label: "Sélection Yamoura" },
  { value: "price-asc", label: "Prix croissant" },
  { value: "price-desc", label: "Prix décroissant" },
  { value: "discount", label: "Meilleures remises" },
  { value: "name", label: "Nom A → Z" },
];

export const emptyFilter: CatalogFilter = {
  category: "ALL",
  subcategory: "",
  brand: "",
  query: "",
  saleOnly: false,
  favoritesOnly: false,
  sort: "featured",
};

export const categoryMeta: Record<
  Category,
  { name: string; subtitle: string; tint: string; accent: string }
> = {
  SKIN_CARE: {
    name: "Skin care",
    subtitle: "Sérums, crèmes & soins visage",
    tint: "#f3e4d3",
    accent: "#79532d",
  },
  MAKEUP: {
    name: "Maquillage",
    subtitle: "Teint, yeux, lèvres & accessoires",
    tint: "#ead2d1",
    accent: "#71383e",
  },
  FRAGRANCE: {
    name: "Parfums",
    subtitle: "Eaux de parfum, brumes & coffrets",
    tint: "#efe1d2",
    accent: "#815a36",
  },
  HAIR: {
    name: "Cheveux",
    subtitle: "Soins, huiles & coiffage",
    tint: "#f2e5cb",
    accent: "#8c632d",
  },
  BATH_BODY: {
    name: "Bath & Body",
    subtitle: "Douche, gommages & hydratation",
    tint: "#f5e9df",
    accent: "#85545b",
  },
  SUPPLEMENTS: {
    name: "Compléments",
    subtitle: "Vitamines, collagène & bien-être",
    tint: "#e9ddce",
    accent: "#785b3b",
  },
  HYGIENE: {
    name: "Hygiène",
    subtitle: "Déodorants & hygiène intime",
    tint: "#f1e7df",
    accent: "#70454a",
  },
  ORAL_CARE: {
    name: "Soin dentaire",
    subtitle: "Dentifrices & blanchiment",
    tint: "#e8d7c3",
    accent: "#79542c",
  },
};

export const allCategories = productCategories as readonly Category[];

const money = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
  maximumFractionDigits: 2,
});
export const formatPrice = (value: number) => money.format(value);

export const discountPercent = (product: ProductListItem) =>
  product.compareAtPrice && product.compareAtPrice > product.retailPrice
    ? Math.round((1 - product.retailPrice / product.compareAtPrice) * 100)
    : 0;

export const productImages = (product: ProductListItem) =>
  product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : [];

export const normalize = (value: string) =>
  value
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function matchesQuery(product: ProductListItem, query: string) {
  const needle = normalize(query.trim());
  if (!needle) return true;
  const haystack = normalize(
    `${product.name} ${product.brand} ${product.sku} ${product.subcategory}`,
  );
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

export function applyFilter(
  products: ProductListItem[],
  filter: CatalogFilter,
  favorites: string[] = [],
) {
  const brand = filter.brand.toLocaleLowerCase("fr");
  const shown = products.filter(
    (product) =>
      (filter.category === "ALL" || product.category === filter.category) &&
      (!filter.subcategory || product.subcategory === filter.subcategory) &&
      (!brand || product.brand.toLocaleLowerCase("fr") === brand) &&
      (!filter.saleOnly || discountPercent(product) > 0) &&
      (!filter.favoritesOnly || favorites.includes(product.variantId)) &&
      matchesQuery(product, filter.query),
  );
  const sorters: Record<CatalogFilter["sort"], ((a: ProductListItem, b: ProductListItem) => number) | null> = {
    featured: null,
    "price-asc": (a, b) => a.retailPrice - b.retailPrice,
    "price-desc": (a, b) => b.retailPrice - a.retailPrice,
    discount: (a, b) => discountPercent(b) - discountPercent(a),
    name: (a, b) => a.name.localeCompare(b.name, "fr"),
  };
  const sorter = sorters[filter.sort];
  return sorter ? [...shown].sort(sorter) : shown;
}

/** Brands ordered by how many products they have, display-cased as in the catalogue. */
export function rankBrands(products: ProductListItem[]) {
  const counts = new Map<string, { name: string; count: number; products: ProductListItem[] }>();
  for (const product of products) {
    const name = product.brand.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase("fr");
    const entry = counts.get(key) ?? { name, count: 0, products: [] };
    entry.count += 1;
    entry.products.push(product);
    counts.set(key, entry);
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"),
  );
}
