"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ProductListItem, StoreDiscount } from "@cosmetics/contracts";
import { emptyFilter, type CartLine, type CatalogFilter } from "@/lib/catalog";
import type { ShippingSettings } from "@/lib/products";
import { BottomSection } from "./Footer";
import { AnnouncementBar, Header } from "./Header";
import { CartDrawer, CartToast, InfoModal, QuickView, SearchOverlay } from "./Overlays";
import { StoreContext, type InfoTopic, type StoreApi } from "./store-context";
import { WhatsAppButton } from "./WhatsAppButton";

const CART_KEY = "yamoura.cart.v1";
const FAVORITES_KEY = "yamoura.favorites.v1";

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the cart simply won't persist.
  }
}

export function StoreShell({
  products,
  demo,
  shipping,
  children,
}: {
  products: ProductListItem[];
  demo: boolean;
  shipping: ShippingSettings;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickView, setQuickView] = useState<ProductListItem | null>(null);
  const [info, setInfo] = useState<InfoTopic | null>(null);
  const [toast, setToast] = useState<{ product: ProductListItem; id: number } | null>(null);
  const [cartBump, setCartBump] = useState(0);
  const [filter, setFilter] = useState<CatalogFilter>(emptyFilter);
  const [discount, setDiscount] = useState<StoreDiscount | null>(null);

  // Restore the cart against the current catalogue (prices and stock may have changed).
  useEffect(() => {
    const byVariant = new Map(products.map((product) => [product.variantId, product]));
    const saved = readStorage<Array<{ variantId: string; quantity: number }>>(CART_KEY, []);
    setCart(
      saved.flatMap(({ variantId, quantity }) => {
        const product = byVariant.get(variantId);
        return product && product.available > 0
          ? [{ product, quantity: Math.min(Math.max(1, quantity), product.available) }]
          : [];
      }),
    );
    setFavorites(readStorage<string[]>(FAVORITES_KEY, []).filter((id) => byVariant.has(id)));
    setHydrated(true);
  }, [products]);
  useEffect(() => {
    if (hydrated) writeStorage(CART_KEY, cart.map(({ product, quantity }) => ({ variantId: product.variantId, quantity })));
  }, [cart, hydrated]);
  useEffect(() => {
    if (hydrated) writeStorage(FAVORITES_KEY, favorites);
  }, [favorites, hydrated]);

  const anyOverlay = cartOpen || searchOpen || Boolean(quickView) || Boolean(info);
  useEffect(() => {
    if (!anyOverlay) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [anyOverlay]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable=true]");
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        if (quickView) setQuickView(null);
        else if (searchOpen) setSearchOpen(false);
        else if (info) setInfo(null);
        else if (cartOpen) setCartOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen, info, quickView, searchOpen]);

  const add = useCallback((product: ProductListItem, quantity = 1) => {
    if (product.available <= 0) return;
    setCart((current) => {
      const found = current.find((line) => line.product.variantId === product.variantId);
      return found
        ? current.map((line) =>
            line === found ? { ...line, quantity: Math.min(line.quantity + quantity, product.available) } : line,
          )
        : [...current, { product, quantity: Math.min(quantity, product.available) }];
    });
    setCartBump((value) => value + 1);
    setToast({ product, id: Date.now() });
  }, []);

  const setQuantity = useCallback(
    (variantId: string, quantity: number) =>
      setCart((current) =>
        current
          .map((line) => (line.product.variantId === variantId ? { ...line, quantity } : line))
          .filter((line) => line.quantity > 0),
      ),
    [],
  );

  const toggleFavorite = useCallback(
    (variantId: string) =>
      setFavorites((current) =>
        current.includes(variantId) ? current.filter((id) => id !== variantId) : [...current, variantId],
      ),
    [],
  );

  const goTo = useCallback(
    (sectionId: string) => {
      if (pathname === "/") {
        requestAnimationFrame(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
      } else {
        router.push(`/#${sectionId}`);
      }
    },
    [pathname, router],
  );

  const shop = useCallback(
    (next: Partial<CatalogFilter> = {}) => {
      setFilter({ ...emptyFilter, ...next });
      setCartOpen(false);
      goTo("boutique");
    },
    [goTo],
  );

  const api = useMemo<StoreApi>(
    () => ({
      products,
      demo,
      shipping,
      add,
      openProduct: setQuickView,
      favorites,
      toggleFavorite,
      shop,
      goTo,
      filter,
      setFilter,
      openInfo: setInfo,
    }),
    [add, demo, favorites, filter, goTo, products, shipping, shop, toggleFavorite],
  );
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const openCart = useCallback(() => {
    setToast(null);
    setCartOpen(true);
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  return (
    <StoreContext.Provider value={api}>
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <AnnouncementBar />
      <Header cartCount={count} cartBump={cartBump} onOpenCart={openCart} onOpenSearch={() => setSearchOpen(true)} />
      <main id="contenu">{children}</main>
      <BottomSection onOpenCart={openCart} />
      <WhatsAppButton />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        setQuantity={setQuantity}
        discount={discount}
        setDiscount={setDiscount}
        onOrdered={() => {
          setCart([]);
          setDiscount(null);
        }}
      />
      <QuickView product={quickView} onClose={() => setQuickView(null)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <InfoModal topic={info} onClose={() => setInfo(null)} />
      <CartToast toast={toast} onOpenCart={openCart} onDismiss={dismissToast} />
    </StoreContext.Provider>
  );
}
