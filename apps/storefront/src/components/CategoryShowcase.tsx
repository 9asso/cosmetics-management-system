"use client";

import { useMemo, type CSSProperties } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { allCategories, categoryMeta, productImages } from "@/lib/catalog";
import { Reveal } from "./motion";
import { useStore } from "./store-context";

/** Column spans for the tiles after the 2×2 feature tile, so every row is full. */
function trailingSpans(count: number) {
  const spans: number[] = [];
  for (let start = 0; start < count; start += 4) {
    const row = Math.min(4, count - start);
    spans.push(...({ 1: [4], 2: [2, 2], 3: [2, 1, 1], 4: [1, 1, 1, 1] } as Record<number, number[]>)[row]!);
  }
  return spans;
}

export function CategoryShowcase() {
  const { products, shop, featured } = useStore();
  const tiles = useMemo(() => {
    const entries = allCategories.map((category) => {
      const items = products.filter((product) => product.category === category);
      return {
        category,
        count: items.length,
        images: items.flatMap((product) => productImages(product).slice(0, 1)).slice(0, 3),
        subcategories: [...new Set(items.map((product) => product.subcategory).filter(Boolean))].slice(0, 4),
      };
    });
    if (featured.categories.length) {
      return featured.categories.flatMap((category) => {
        const entry = entries.find((item) => item.category === category);
        return entry ? [entry] : [];
      });
    }
    const stocked = entries.filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count);
    return stocked.length ? stocked : entries;
  }, [featured.categories, products]);

  const featureLayout = tiles.length >= 5;
  const spans = featureLayout ? [0, 1, 1, 1, 1, ...trailingSpans(tiles.length - 5)] : [];
  const mobileOddTail = (tiles.length - 1) % 2 === 1;

  return (
    <section className="section categories" id="categories">
      <Reveal className="section-head">
        <div>
          <p className="eyebrow">Shop by category</p>
          <h2 className="section-title">
            Acheter par <em>catégorie</em>
          </h2>
        </div>
        <button type="button" className="link-button" onClick={() => shop()}>
          Tout le catalogue <ArrowRight size={16} />
        </button>
      </Reveal>

      <div className={`category-grid ${featureLayout ? "is-bento" : ""}`} style={{ "--tiles": tiles.length } as CSSProperties}>
        {tiles.map((tile, index) => {
          const meta = categoryMeta[tile.category];
          const span = spans[index] ?? 1;
          const classes = [
            "category-tile",
            featureLayout && index === 0 ? "is-feature" : "",
            span === 2 ? "span-2" : span === 4 ? "span-4" : "",
            mobileOddTail && index === tiles.length - 1 ? "m-span-2" : "",
          ].join(" ");
          return (
            <Reveal key={tile.category} className={classes} delay={index * 70} variant="zoom">
              <button
                type="button"
                className="category-tile-button"
                style={{ "--tint": meta.tint, "--accent": meta.accent } as CSSProperties}
                onClick={() => shop({ category: tile.category })}
              >
                <span className="category-tile-copy">
                  <small>{tile.count > 0 ? "Découvrir" : "Bientôt disponible"}</small>
                  <strong>{meta.name}</strong>
                  <em>{meta.subtitle}</em>
                  {index === 0 && featureLayout && tile.subcategories.length > 0 && (
                    <span className="category-tile-chips">
                      {tile.subcategories.map((subcategory) => (
                        <span key={subcategory}>{subcategory}</span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="category-tile-art" aria-hidden="true">
                  {tile.images.length > 0 ? (
                    tile.images.map((src, position) => (
                      <img key={src} src={src} alt="" loading="lazy" style={{ "--p": position } as CSSProperties} />
                    ))
                  ) : (
                    <span className="category-tile-monogram">{meta.name.slice(0, 1)}</span>
                  )}
                </span>
                <span className="category-tile-arrow" aria-hidden="true">
                  <ArrowUpRight size={20} />
                </span>
              </button>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
