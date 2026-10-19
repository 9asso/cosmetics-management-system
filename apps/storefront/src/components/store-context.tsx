"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { ProductListItem } from "@cosmetics/contracts";
import type { CatalogFilter } from "@/lib/catalog";
import type { ShippingSettings } from "@/lib/products";

export type StoreApi = {
  products: ProductListItem[];
  demo: boolean;
  /** Free-delivery threshold and fee, set in the desktop app. */
  shipping: ShippingSettings;
  add: (product: ProductListItem, quantity?: number) => void;
  openProduct: (product: ProductListItem) => void;
  favorites: string[];
  toggleFavorite: (variantId: string) => void;
  /** Applies filters to the "Toute la boutique" section and scrolls to it (from any page). */
  shop: (filter?: Partial<CatalogFilter>) => void;
  /** Scrolls to a homepage section, navigating home first when needed. */
  goTo: (sectionId: string) => void;
  filter: CatalogFilter;
  setFilter: Dispatch<SetStateAction<CatalogFilter>>;
  openInfo: (topic: InfoTopic) => void;
};

export type InfoTopic = "delivery" | "payment" | "howto" | "demo";

export const StoreContext = createContext<StoreApi | null>(null);

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside <StoreShell>.");
  return value;
}
