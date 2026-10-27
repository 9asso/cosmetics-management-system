"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, BadgeCheck, Search, SearchX, Sparkles, Store, Truck, Wallet, X } from "lucide-react";
import { iconicBrands } from "@/lib/brand-directory";
import { brandHref, brandSlug, buildBrandIndex, type BrandEntry } from "@/lib/brands";
import { normalize, productImages } from "@/lib/catalog";
import { partnerWordmarks, type WordmarkStyle } from "@/lib/site";
import { Reveal } from "./motion";
import { Rail } from "./Rail";
import { useStore } from "./store-context";
import { BrandCard, brandTints } from "./TrendingBrands";

type View = "all" | "shop" | "kbeauty";

const views: { id: View; label: string; icon?: typeof Store }[] = [
  { id: "all", label: "Toutes les marques" },
  { id: "shop", label: "En boutique", icon: Store },
  { id: "kbeauty", label: "K-Beauty", icon: Sparkles },
];
const letters = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
const fallbackStyles: WordmarkStyle[] = ["serif", "bold", "wide", "lower", "italic", "serif-caps"];
const letterId = (letter: string) => `lettre-${letter === "#" ? "0-9" : letter}`;
const thumbOf = (brand: BrandEntry) => brand.products.flatMap(productImages)[0];

/** Bolds the part of `name` matching the search, when accents keep indexes aligned. */
function Highlight({ name, needle }: { name: string; needle: string }) {
  const haystack = normalize(name);
  const at = needle ? haystack.indexOf(needle) : -1;
  if (at < 0 || haystack.length !== name.length) return <>{name}</>;
  return (
    <>
      {name.slice(0, at)}
      <mark>{name.slice(at, at + needle.length)}</mark>
      {name.slice(at + needle.length)}
    </>
  );
}

export function BrandDirectory() {
  const { products } = useStore();
  const index = useMemo(() => buildBrandIndex(products), [products]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("all");
  const [activeLetter, setActiveLetter] = useState("");
  const sections = useRef(new Map<string, HTMLElement>());

  const stocked = useMemo(
    () => index.filter((brand) => brand.products.length > 0).sort((a, b) => b.products.length - a.products.length),
    [index],
  );
  const spotlight = useMemo(() => stocked.filter((brand) => thumbOf(brand)).slice(0, 10), [stocked]);
  const iconic = useMemo(() => {
    const bySlug = new Map(index.map((brand) => [brand.slug, brand]));
    const picks = [...iconicBrands.map((name) => bySlug.get(brandSlug(name))), ...stocked].filter(Boolean) as BrandEntry[];
    return [...new Map(picks.map((brand) => [brand.slug, brand])).values()].slice(0, 16);
  }, [index, stocked]);
  const heroShots = useMemo(() => spotlight.map(thumbOf).filter(Boolean).slice(0, 4) as string[], [spotlight]);

  const needle = normalize(query.trim());
  const groups = useMemo(() => {
    const visible = index.filter(
      (brand) =>
        (view === "all" || (view === "shop" ? brand.products.length > 0 : brand.korean)) &&
        (!needle || normalize(brand.name).includes(needle)),
    );
    return letters
      .map((letter) => ({ letter, brands: visible.filter((brand) => brand.letter === letter) }))
      .filter((group) => group.brands.length > 0);
  }, [index, needle, view]);
  const present = new Set(groups.map((group) => group.letter));
  const browsing = !needle && view === "all";

  // Highlight the letter whose group crosses the upper part of the viewport.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting);
        if (hit) setActiveLetter((hit.target as HTMLElement).dataset.letter ?? "");
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    sections.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [groups]);

  const jump = (letter: string) =>
    document.getElementById(letterId(letter))?.scrollIntoView({ behavior: "smooth", block: "start" });
  const reset = () => {
    setQuery("");
    setView("all");
  };

  return (
    <>
      <section className="brands-hero" aria-labelledby="brands-title">
        <div className="brands-hero-glow" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="brands-hero-copy">
          <p className="eyebrow">Marques de A à Z</p>
          <h1 className="brands-title" id="brands-title">
            Toutes vos marques, <em>une seule adresse</em>
          </h1>
          <p className="brands-lede">
            Des grandes maisons de luxe aux pépites coréennes : trouvez votre marque et découvrez ce qu’elle vous réserve chez
            Yamoura.
          </p>
          <label className="brands-search">
            <Search size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une marque…"
              aria-label="Rechercher une marque"
              type="search"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche">
                <X size={16} />
              </button>
            )}
          </label>
          <div className="chip-row chip-row-wrap" role="group" aria-label="Filtrer les marques">
            {views.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                className={`chip ${view === id ? "is-active" : ""}`}
                aria-pressed={view === id}
                onClick={() => setView(id)}
              >
                {Icon && <Icon size={14} />} {label}
              </button>
            ))}
          </div>
          <ul className="brands-promises">
            <li>
              <BadgeCheck size={16} /> 100% authentiques
            </li>
            <li>
              <Wallet size={16} /> Paiement à la livraison
            </li>
            <li>
              <Truck size={16} /> Partout au Maroc
            </li>
          </ul>
        </div>

        <div className="brands-hero-art" aria-hidden="true">
          <span className="brands-hero-letters">
            A<em>z</em>
          </span>
          {heroShots.map((src, position) => (
            <span key={src} className={`brands-bubble brands-bubble-${position}`} style={{ "--i": position } as CSSProperties}>
              <img src={src} alt="" />
            </span>
          ))}
          {iconic.slice(0, 4).map((brand, position) => (
            <span key={brand.slug} className={`brands-sticker brands-sticker-${position}`}>
              {brand.name}
            </span>
          ))}
        </div>
      </section>

      {browsing && spotlight.length >= 3 && (
        <section className="section brands-spotlight" aria-labelledby="spotlight-title">
          <Reveal className="section-head">
            <div>
              <p className="eyebrow">En boutique</p>
              <h2 className="section-title" id="spotlight-title">
                Les maisons <em>à l’honneur</em>
              </h2>
            </div>
            <p className="section-lede">Nos marques disponibles tout de suite, livrées chez vous avec paiement à la livraison.</p>
          </Reveal>
          <Rail label="Marques en boutique">
            {spotlight.map((brand, position) => (
              <BrandCard key={brand.slug} name={brand.name} products={brand.products} index={position} />
            ))}
          </Rail>
        </section>
      )}

      {browsing && (
        <section className="section brands-iconic" aria-labelledby="iconic-title">
          <Reveal className="section-head">
            <div>
              <p className="eyebrow">Les incontournables</p>
              <h2 className="section-title" id="iconic-title">
                Des maisons <em>iconiques</em>
              </h2>
            </div>
            <button type="button" className="link-button" onClick={() => jump(groups[0]?.letter ?? "A")}>
              Parcourir de A à Z <ArrowDown size={16} />
            </button>
          </Reveal>
          <div className="brand-wall">
            {iconic.map((brand, position) => {
              const wordmark = partnerWordmarks[brand.name.toLocaleLowerCase("fr")];
              const style = wordmark?.style ?? fallbackStyles[position % fallbackStyles.length]!;
              return (
                <Reveal key={brand.slug} className="brand-wall-item" delay={(position % 4) * 70} variant="zoom">
                  <Link
                    href={brandHref(brand.name)}
                    className={`brand-tile wordmark-${style}`}
                    style={{ "--tint": brandTints[position % brandTints.length] } as CSSProperties}
                  >
                    {wordmark?.logo ? <img className="brand-tile-wordmark" src={wordmark.logo} alt={brand.name} /> : <span>{brand.name}</span>}
                    {brand.products.length > 0 && (
                      <small className="brand-tile-tag">
                        <Store size={12} /> En boutique
                      </small>
                    )}
                    <ArrowUpRight size={18} className="brand-tile-arrow" />
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      <section className="section brands-az" aria-labelledby="az-title">
        <div className="az-head">
          <div>
            <p className="eyebrow">L’annuaire</p>
            <h2 className="section-title" id="az-title">
              {needle ? (
                <>
                  Résultats pour <em>« {query.trim()} »</em>
                </>
              ) : view === "shop" ? (
                <>
                  Disponibles <em>en boutique</em>
                </>
              ) : view === "kbeauty" ? (
                <>
                  Le meilleur de la <em>K-Beauty</em>
                </>
              ) : (
                <>
                  Marques de <em>A à Z</em>
                </>
              )}
            </h2>
          </div>
          {!browsing && (
            <button type="button" className="link-button" onClick={reset}>
              Réinitialiser
            </button>
          )}
        </div>

        <nav className="az-bar" aria-label="Aller à la lettre">
          {letters.map((letter) => (
            <button
              type="button"
              key={letter}
              disabled={!present.has(letter)}
              className={activeLetter === letter && present.has(letter) ? "is-active" : ""}
              onClick={() => jump(letter)}
              aria-label={letter === "#" ? "Chiffres et symboles" : `Lettre ${letter}`}
            >
              {letter}
            </button>
          ))}
        </nav>

        {groups.length === 0 ? (
          <div className="catalog-empty">
            <SearchX size={34} />
            <h3>Aucune marque trouvée</h3>
            <p>Essayez une autre orthographe ou un autre filtre.</p>
            <button type="button" className="button button-dark" onClick={reset}>
              Voir toutes les marques
            </button>
          </div>
        ) : (
          <div className="az-groups">
            {groups.map(({ letter, brands }) => (
              <section
                key={letter}
                id={letterId(letter)}
                data-letter={letter}
                className="az-group"
                aria-label={letter === "#" ? "Chiffres et symboles" : `Lettre ${letter}`}
                ref={(node) => {
                  if (node) sections.current.set(letter, node);
                  else sections.current.delete(letter);
                }}
              >
                <span className="az-letter" aria-hidden="true">
                  {letter}
                </span>
                <ul className="az-list">
                  {brands.map((brand) => {
                    const thumb = thumbOf(brand);
                    return (
                      <li key={brand.slug}>
                        <Link href={brandHref(brand.name)} className={`az-brand ${brand.products.length ? "is-stocked" : ""}`}>
                          {thumb && (
                            <span className="az-brand-thumb">
                              <img src={thumb} alt="" loading="lazy" />
                            </span>
                          )}
                          <span className="az-brand-name">
                            <Highlight name={brand.name} needle={needle} />
                          </span>
                          {brand.korean && <small className="az-tag">K-Beauty</small>}
                          <ArrowUpRight size={14} className="az-arrow" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
