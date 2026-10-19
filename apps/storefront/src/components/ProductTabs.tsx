"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ProductListItem } from "@cosmetics/contracts";
import { ArrowRight } from "lucide-react";
import type { CatalogFilter } from "@/lib/catalog";
import { isKoreanBrand } from "@/lib/site";
import { Reveal } from "./motion";
import { ProductCard } from "./ProductCard";
import { Rail } from "./Rail";
import { useStore } from "./store-context";

type Tab = { id: string; label: string; items: ProductListItem[]; filter: Partial<CatalogFilter> };

export function ProductTabs() {
  const { products, shop } = useStore();
  const tabs = useMemo<Tab[]>(() => {
    const inCategory = (category: ProductListItem["category"]) =>
      products.filter((product) => product.category === category);
    const list: Tab[] = [
      { id: "new", label: "Nouveautés", items: products.slice(0, 12), filter: {} },
      { id: "makeup", label: "Makeup", items: inCategory("MAKEUP"), filter: { category: "MAKEUP" } },
      {
        id: "kbeauty",
        label: "K-Beauty",
        items: products.filter((product) => isKoreanBrand(product.brand)),
        filter: { category: "SKIN_CARE" },
      },
      { id: "skin", label: "Skin care", items: inCategory("SKIN_CARE"), filter: { category: "SKIN_CARE" } },
      { id: "fragrance", label: "Parfums", items: inCategory("FRAGRANCE"), filter: { category: "FRAGRANCE" } },
      { id: "hair", label: "Cheveux", items: inCategory("HAIR"), filter: { category: "HAIR" } },
    ];
    return list
      .filter((tab) => tab.items.length >= 3)
      .map((tab) => ({ ...tab, items: tab.items.filter((product) => product.available > 0).concat(tab.items.filter((product) => product.available <= 0)).slice(0, 12) }));
  }, [products]);

  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const node = active && tabRefs.current.get(active.id);
      if (node) setIndicator({ left: node.offsetLeft, width: node.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);

  if (!active) return null;

  return (
    <section className="section product-tabs" id="selections" aria-labelledby="selections-title">
      <Reveal className="section-head">
        <div>
          <p className="eyebrow">Nos sélections</p>
          <h2 className="section-title" id="selections-title">
            Le meilleur <em>de la beauté</em>
          </h2>
        </div>
        <button type="button" className="link-button" onClick={() => shop(active.filter)}>
          Voir tout · {active.label} <ArrowRight size={16} />
        </button>
      </Reveal>

      <Reveal className="tabs-wrap" delay={80}>
        <div className="tabs" role="tablist" aria-label="Sélections">
          <span className="tabs-indicator" style={{ "--left": `${indicator.left}px`, "--width": `${indicator.width}px` } as CSSProperties} />
          {tabs.map((tab) => (
            <button
              type="button"
              role="tab"
              key={tab.id}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.id, node);
              }}
              aria-selected={tab.id === active.id}
              className={tab.id === active.id ? "is-active" : ""}
              onClick={() => setActiveId(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Reveal>

      <div className="tab-panel" key={active.id} role="tabpanel">
        <Rail label={active.label}>
          {active.items.map((product, index) => (
            <ProductCard key={product.variantId} product={product} index={index} className="rail-card card-enter" />
          ))}
        </Rail>
      </div>
    </section>
  );
}
