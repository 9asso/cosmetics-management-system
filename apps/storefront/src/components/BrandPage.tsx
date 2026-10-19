"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ChevronRight, Clock, PackageSearch, Plus, SlidersHorizontal, Sparkles, Store } from "lucide-react";
import { brandSlug, buildBrandIndex, suggestAcrossBrands } from "@/lib/brands";
import {
  allCategories,
  applyFilter,
  categoryMeta,
  emptyFilter,
  productImages,
  sortOptions,
  type CatalogFilter,
} from "@/lib/catalog";
import { brandStories, isKoreanBrand, whatsappLink } from "@/lib/site";
import { WhatsAppIcon } from "./icons";
import { Reveal } from "./motion";
import { ProductCard } from "./ProductCard";
import { Rail } from "./Rail";
import { SelectMenu } from "./SelectMenu";
import { useStore } from "./store-context";
import { BrandCard, brandTints } from "./TrendingBrands";

const PAGE = 12;

export function BrandPage({ slug, name }: { slug: string; name: string }) {
  const { products } = useStore();
  const index = useMemo(() => buildBrandIndex(products), [products]);
  const items = useMemo(() => index.find((brand) => brand.slug === slug)?.products ?? [], [index, slug]);
  const [category, setCategory] = useState<CatalogFilter["category"]>("ALL");
  const [sort, setSort] = useState<CatalogFilter["sort"]>("featured");
  const [limit, setLimit] = useState(PAGE);

  const shown = useMemo(() => applyFilter(items, { ...emptyFilter, category, sort }), [category, items, sort]);
  const categories = allCategories.filter((entry) => items.some((product) => product.category === entry));
  const suggestions = useMemo(
    () => suggestAcrossBrands(products.filter((product) => brandSlug(product.brand) !== slug), 8),
    [products, slug],
  );
  const otherBrands = useMemo(
    () => index.filter((brand) => brand.slug !== slug && brand.products.some((product) => productImages(product).length)).slice(0, 10),
    [index, slug],
  );

  const korean = isKoreanBrand(name);
  const stocked = items.length > 0;
  const shots = items.flatMap((product) => productImages(product).slice(0, 1)).slice(0, 3);
  const tint = brandTints[[...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0) % brandTints.length];
  const story =
    brandStories[name.toLocaleLowerCase("fr")] ??
    (stocked ? "Une sélection authentique, choisie avec soin pour vous." : "Une maison que nous suivons de près chez Yamoura.");

  return (
    <>
      <nav className="breadcrumbs" aria-label="Fil d’Ariane">
        <Link href="/">Accueil</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link href="/marques">Marques</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{name}</span>
      </nav>

      <section className="brand-hero" style={{ "--tint": tint } as CSSProperties} aria-labelledby="brand-title">
        <div className="brand-hero-copy">
          <p className="eyebrow">{korean ? "K-Beauty" : "La maison"}</p>
          <h1 className="brand-hero-name" id="brand-title">
            {name}
          </h1>
          <p className="brand-hero-story">{story}</p>
          <div className="brand-hero-badges">
            <span className="is-authentic">
              <BadgeCheck size={15} /> 100% authentique
            </span>
            {stocked ? (
              <span>
                <Store size={15} /> Disponible en boutique
              </span>
            ) : (
              <span>
                <Clock size={15} /> Bientôt chez Yamoura
              </span>
            )}
            {korean && (
              <span className="is-korean">
                <Sparkles size={15} /> K-Beauty
              </span>
            )}
          </div>
        </div>
        <div className="brand-hero-art" aria-hidden="true">
          <span className="brand-hero-initial">{name.charAt(0)}</span>
          {shots.length > 0 ? (
            <span className="brand-hero-shots">
              {shots.map((src) => (
                <img key={src} src={src} alt="" />
              ))}
            </span>
          ) : (
            <span className="brand-hero-seal">
              <span>{name}</span>
            </span>
          )}
        </div>
      </section>

      {stocked ? (
        <section className="section brand-products" aria-label={`Produits ${name}`}>
          <div className="brand-toolbar">
            <div className="chip-row" role="group" aria-label="Catégories">
              <button
                type="button"
                className={`chip ${category === "ALL" ? "is-active" : ""}`}
                onClick={() => {
                  setCategory("ALL");
                  setLimit(PAGE);
                }}
              >
                Tout
              </button>
              {categories.length > 1 &&
                categories.map((entry) => (
                  <button
                    type="button"
                    key={entry}
                    className={`chip ${category === entry ? "is-active" : ""}`}
                    onClick={() => {
                      setCategory(entry);
                      setLimit(PAGE);
                    }}
                  >
                    <i style={{ background: categoryMeta[entry].accent }} />
                    {categoryMeta[entry].name}
                  </button>
                ))}
            </div>
            <SelectMenu
              className="catalog-sort"
              label="Trier"
              icon={<SlidersHorizontal size={16} />}
              value={sort}
              options={sortOptions}
              onChange={setSort}
            />
          </div>
          <div className="catalog-grid" key={`${category}-${sort}`}>
            {shown.slice(0, limit).map((product, position) => (
              <ProductCard key={product.variantId} product={product} index={position % PAGE} className="card-enter" />
            ))}
          </div>
          {limit < shown.length && (
            <div className="catalog-more">
              <button type="button" className="button button-outline" onClick={() => setLimit((current) => current + PAGE)}>
                Voir plus de produits <Plus size={17} />
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="section brand-empty" aria-labelledby="brand-empty-title">
          <Reveal className="brand-empty-panel" variant="zoom">
            <span className="brand-empty-icon">
              <PackageSearch size={28} />
            </span>
            <div>
              <h2 id="brand-empty-title">{name} arrive bientôt chez Yamoura</h2>
              <p>
                Nous n’avons pas encore de produits {name} en boutique. Dites-nous ce que vous cherchez : notre équipe peut vous
                le trouver.
              </p>
            </div>
            <div className="brand-empty-actions">
              <a
                className="button button-whatsapp"
                href={whatsappLink(`Bonjour Yamoura, je cherche des produits ${name}.`)}
                target="_blank"
                rel="noreferrer"
              >
                <WhatsAppIcon size={18} /> Demander sur WhatsApp
              </a>
              <Link className="button button-ghost" href="/marques">
                Toutes les marques
              </Link>
            </div>
          </Reveal>

          {suggestions.length > 0 && (
            <>
              <Reveal className="section-head brand-suggestions-head">
                <div>
                  <p className="eyebrow">Nos suggestions</p>
                  <h2 className="section-title">
                    En attendant, <em>vous aimerez</em>
                  </h2>
                </div>
                <p className="section-lede">Des best-sellers d’autres maisons, disponibles tout de suite.</p>
              </Reveal>
              <div className="catalog-grid">
                {suggestions.map((product, position) => (
                  <ProductCard key={product.variantId} product={product} index={position} className="card-enter" />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {otherBrands.length >= 3 && (
        <section className="section brand-others" aria-labelledby="other-brands-title">
          <Reveal className="section-head">
            <div>
              <p className="eyebrow">À découvrir</p>
              <h2 className="section-title" id="other-brands-title">
                D’autres maisons <em>à aimer</em>
              </h2>
            </div>
            <Link className="link-button" href="/marques">
              Toutes les marques <ArrowRight size={16} />
            </Link>
          </Reveal>
          <Rail label="Autres marques">
            {otherBrands.map((brand, position) => (
              <BrandCard key={brand.slug} name={brand.name} products={brand.products} index={position} />
            ))}
          </Rail>
        </section>
      )}
    </>
  );
}
