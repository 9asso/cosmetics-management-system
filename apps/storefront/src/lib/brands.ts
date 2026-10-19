import type { ProductListItem } from "@cosmetics/contracts";
import { directoryBrands } from "./brand-directory";
import { discountPercent, normalize, productImages } from "./catalog";
import { isKoreanBrand } from "./site";

export type BrandEntry = {
  name: string;
  slug: string;
  /** "A"–"Z", or "#" for names starting with a digit or symbol. */
  letter: string;
  korean: boolean;
  products: ProductListItem[];
};

export const brandSlug = (name: string) =>
  normalize(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const brandHref = (name: string) => `/marques/${brandSlug(name)}`;

function letterOf(name: string) {
  const first = normalize(name).charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : "#";
}

/**
 * The full A→Z directory: every catalogue brand (spelled as on its products)
 * plus every directory brand it doesn't already cover.
 */
export function buildBrandIndex(products: ProductListItem[]): BrandEntry[] {
  const bySlug = new Map<string, BrandEntry>();
  const ensure = (name: string) => {
    const slug = brandSlug(name);
    if (!slug) return undefined;
    let entry = bySlug.get(slug);
    if (!entry) {
      entry = { name, slug, letter: letterOf(name), korean: isKoreanBrand(name), products: [] };
      bySlug.set(slug, entry);
    }
    return entry;
  };
  for (const product of products) ensure(product.brand.trim())?.products.push(product);
  for (const name of directoryBrands) ensure(name);
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

export function findBrand(slug: string, products: ProductListItem[]) {
  return buildBrandIndex(products).find((brand) => brand.slug === slug);
}

/** In-stock picks spread across brands (best deals first), for "vous aimerez aussi". */
export function suggestAcrossBrands(products: ProductListItem[], count: number) {
  const queues = new Map<string, ProductListItem[]>();
  for (const product of [...products]
    .filter((item) => item.available > 0 && productImages(item).length)
    .sort((a, b) => discountPercent(b) - discountPercent(a))) {
    const key = brandSlug(product.brand);
    queues.set(key, [...(queues.get(key) ?? []), product]);
  }
  const lists = [...queues.values()];
  const picks: ProductListItem[] = [];
  for (let round = 0; picks.length < count && lists.some((list) => list.length > round); round += 1) {
    for (const list of lists) if (list[round] && picks.length < count) picks.push(list[round]!);
  }
  return picks;
}
