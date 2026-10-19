"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Heart, Percent, Plus, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import {
  allCategories,
  applyFilter,
  categoryMeta,
  discountPercent,
  emptyFilter,
  sortOptions,
  type CatalogFilter,
} from "@/lib/catalog";
import { Reveal } from "./motion";
import { ProductCard } from "./ProductCard";
import { SelectMenu } from "./SelectMenu";
import { useStore } from "./store-context";

const PAGE = 12;

export function Catalog() {
  const { products, favorites, filter, setFilter } = useStore();
  const [limit, setLimit] = useState(PAGE);
  const shown = useMemo(() => applyFilter(products, filter, favorites), [favorites, filter, products]);
  const signature = JSON.stringify(filter);
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setLimit(PAGE);
  }

  const stocked = useMemo(() => new Set(products.map((product) => product.category)), [products]);
  const subcategories = useMemo(
    () =>
      filter.category === "ALL"
        ? []
        : [...new Set(products.filter((product) => product.category === filter.category).map((product) => product.subcategory).filter(Boolean))],
    [filter.category, products],
  );
  const update = (patch: Partial<CatalogFilter>) => setFilter((current) => ({ ...current, ...patch }));
  const hasFilters = JSON.stringify({ ...filter, sort: "featured" }) !== JSON.stringify(emptyFilter);
  const hasSales = products.some((product) => discountPercent(product) > 0);

  const title = filter.favoritesOnly
    ? "Mes favoris"
    : filter.query
      ? `Résultats pour « ${filter.query} »`
      : filter.brand
        ? filter.brand
        : filter.saleOnly
          ? "Offres du moment"
          : filter.category !== "ALL"
            ? categoryMeta[filter.category].name
            : "Toute la boutique";

  return (
    <section className="section catalog" id="boutique" aria-labelledby="catalog-title">
      <Reveal className="section-head">
        <div>
          <p className="eyebrow">La boutique</p>
          <h2 className="section-title" id="catalog-title">
            {title}
          </h2>
        </div>
      </Reveal>

      <div className="catalog-toolbar">
        <label className="catalog-search">
          <Search size={17} />
          <input
            value={filter.query}
            onChange={(event) => update({ query: event.target.value })}
            placeholder="Rechercher dans la boutique…"
            aria-label="Rechercher dans la boutique"
          />
          {filter.query && (
            <button type="button" onClick={() => update({ query: "" })} aria-label="Effacer la recherche">
              <X size={15} />
            </button>
          )}
        </label>
        <div className="chip-row" role="group" aria-label="Catégories">
          <button
            type="button"
            className={`chip ${filter.category === "ALL" ? "is-active" : ""}`}
            onClick={() => update({ category: "ALL", subcategory: "" })}
          >
            Tout
          </button>
          {allCategories
            .filter((category) => stocked.has(category))
            .map((category) => (
              <button
                type="button"
                key={category}
                className={`chip ${filter.category === category ? "is-active" : ""}`}
                onClick={() => update({ category, subcategory: "" })}
              >
                <i style={{ background: categoryMeta[category].accent }} />
                {categoryMeta[category].name}
              </button>
            ))}
          {hasSales && (
            <button
              type="button"
              className={`chip chip-sale ${filter.saleOnly ? "is-active" : ""}`}
              aria-pressed={filter.saleOnly}
              onClick={() => update({ saleOnly: !filter.saleOnly })}
            >
              <Percent size={13} /> Promos
            </button>
          )}
        </div>
        <SelectMenu
          className="catalog-sort"
          label="Trier"
          icon={<SlidersHorizontal size={16} />}
          value={filter.sort}
          options={sortOptions}
          onChange={(sort) => update({ sort })}
        />
      </div>

      {(subcategories.length > 0 || filter.brand || filter.favoritesOnly || hasFilters) && (
        <div className="catalog-subbar">
          {subcategories.length > 0 && (
            <div className="chip-row chip-row-soft">
              <button type="button" className={`chip chip-soft ${!filter.subcategory ? "is-active" : ""}`} onClick={() => update({ subcategory: "" })}>
                Toutes
              </button>
              {subcategories.map((subcategory) => (
                <button
                  type="button"
                  key={subcategory}
                  className={`chip chip-soft ${filter.subcategory === subcategory ? "is-active" : ""}`}
                  onClick={() => update({ subcategory })}
                >
                  {subcategory}
                </button>
              ))}
            </div>
          )}
          <div className="active-filters">
            {filter.brand && (
              <button type="button" className="chip chip-removable" onClick={() => update({ brand: "" })}>
                Marque : {filter.brand} <X size={13} />
              </button>
            )}
            {filter.favoritesOnly && (
              <button type="button" className="chip chip-removable" onClick={() => update({ favoritesOnly: false })}>
                <Heart size={13} /> Favoris <X size={13} />
              </button>
            )}
            {hasFilters && (
              <button type="button" className="link-button" onClick={() => setFilter(() => emptyFilter)}>
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      )}

      {/* Re-key on filter changes (not keystrokes) so cards replay their entrance. */}
      <div className="catalog-grid" key={JSON.stringify({ ...filter, query: "" })}>
        {shown.slice(0, limit).map((product, index) => (
          <ProductCard
            key={product.variantId}
            product={product}
            index={index % PAGE}
            className="card-enter"
          />
        ))}
        {shown.length === 0 && (
          <div className="catalog-empty">
            {filter.favoritesOnly ? <Heart size={34} /> : <SearchX size={34} />}
            <h3>{filter.favoritesOnly ? "Aucun favori pour le moment" : "Aucun produit trouvé"}</h3>
            <p>
              {filter.favoritesOnly
                ? "Touchez le cœur d’un produit pour le retrouver ici."
                : "Essayez un autre mot-clé ou explorez une autre catégorie."}
            </p>
            <button type="button" className="button button-dark" onClick={() => setFilter(() => emptyFilter)}>
              Voir toute la boutique
            </button>
          </div>
        )}
      </div>

      {shown.length > 0 && (
        <div className="catalog-more">
          <div className="catalog-more-bar" aria-hidden="true">
            <i style={{ "--progress": Math.min(1, limit / shown.length) } as CSSProperties} />
          </div>
          {limit < shown.length && (
            <button type="button" className="button button-outline" onClick={() => setLimit((current) => current + PAGE)}>
              Voir plus de produits <Plus size={17} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
