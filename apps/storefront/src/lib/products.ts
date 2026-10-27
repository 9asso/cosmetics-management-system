import { cache } from "react";
import {
  defaultStorefrontSettings,
  defaultFeaturedSections,
  type Paginated,
  type ProductListItem,
  type PublicStorefrontSettings,
} from "@cosmetics/contracts";
import { demoCatalog } from "./demo-catalog";

const apiUrl = process.env.API_URL ?? "http://localhost:4000/api/v1";
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export type ShippingSettings = Pick<PublicStorefrontSettings, "freeShippingThreshold" | "shippingFee">;

/** Shop settings from the desktop app; defaults for an API that predates them, null when unreachable. */
async function getSettings(): Promise<PublicStorefrontSettings | null> {
  try {
    const response = await fetch(`${apiUrl}/store/settings`, { cache: "no-store" });
    if (response.status === 404) return defaultStorefrontSettings;
    if (!response.ok) return null;
    return (await response.json()) as PublicStorefrontSettings;
  } catch {
    return null;
  }
}

async function getProductPage(page: number) {
  const response = await fetch(`${apiUrl}/store/products?page=${page}&pageSize=${PAGE_SIZE}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Products page ${page}: ${response.status}`);
  return (await response.json()) as Paginated<ProductListItem>;
}

/** Every product the API lets the shop show, or null when the catalogue can't be read. */
async function getAllProducts(): Promise<ProductListItem[] | null> {
  try {
    const first = await getProductPage(1);
    const pages = Math.min(MAX_PAGES, Math.ceil(first.total / PAGE_SIZE));
    const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => getProductPage(index + 2)));
    return [first, ...rest].flatMap((page) => page.items);
  } catch {
    return null;
  }
}

/** The storefront catalogue, fetched once per request and shared by layout, pages and metadata. */
export const getStoreCatalog = cache(async () => {
  const settings = await getSettings();
  const live = settings && settings.catalogSource === "LIVE" ? await getAllProducts() : null;
  const shipping: ShippingSettings = {
    freeShippingThreshold: settings?.freeShippingThreshold ?? defaultStorefrontSettings.freeShippingThreshold,
    shippingFee: settings?.shippingFee ?? defaultStorefrontSettings.shippingFee,
  };
  const featured = settings?.featured ?? defaultFeaturedSections;
  if (live) return { products: live, demo: false, shipping, featured };
  // Demo products (ordering disabled) when chosen in the desktop app, or when the
  // API is unreachable unless STORE_DEMO_FALLBACK=false.
  const demo = settings?.catalogSource === "DEMO" || process.env.STORE_DEMO_FALLBACK !== "false";
  return { products: demo ? demoCatalog : [], demo, shipping, featured };
});
