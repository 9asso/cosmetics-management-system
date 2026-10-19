"use client";

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ProductListItem } from "@cosmetics/contracts";
import { ArrowLeft, ArrowRight, BadgeCheck, Sparkles, Truck } from "lucide-react";
import { categoryMeta, discountPercent, formatPrice, productImages, type Category } from "@/lib/catalog";
import { isKoreanBrand } from "@/lib/site";
import { useStore } from "./store-context";

type Slide = {
  id: string;
  label: string;
  theme: "photo" | "peach" | "rose" | "lilac" | "honey" | "night";
  kicker: string;
  title: ReactNode;
  copy: string;
  cta: string;
  onCta: () => void;
  products?: ProductListItem[];
};

const SLIDE_DURATION = 7000;

function pick(products: ProductListItem[], category: Category, prefer?: (product: ProductListItem) => boolean) {
  const withImage = products.filter((product) => product.category === category && productImages(product).length);
  const preferred = prefer ? withImage.filter(prefer) : [];
  return [...preferred, ...withImage.filter((product) => !preferred.includes(product))].slice(0, 3);
}

export function HeroCarousel() {
  const { products, shop, openProduct } = useStore();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  const slides = useMemo<Slide[]>(() => {
    const bestDiscount = Math.max(0, ...products.map(discountPercent));
    const deals = [...products]
      .filter((product) => discountPercent(product) > 0 && productImages(product).length)
      .sort((a, b) => discountPercent(b) - discountPercent(a))
      .slice(0, 3);
    const list: Slide[] = [
      {
        id: "eclat",
        label: "Éclat",
        theme: "photo",
        kicker: "Nouvelle saison beauté",
        title: (
          <>
            Révélez votre <em>éclat naturel</em>
          </>
        ),
        copy: "Soins, maquillage et parfums authentiques, sélectionnés avec exigence et livrés partout au Maroc.",
        cta: "Découvrir la boutique",
        onCta: () => shop(),
      },
      {
        id: "skin",
        label: categoryMeta.SKIN_CARE.name,
        theme: "peach",
        kicker: "K-Beauty & skin care",
        title: (
          <>
            Le glow coréen, <em>en quelques gestes</em>
          </>
        ),
        copy: "Sérums, boosters et crèmes ciblés pour une peau lumineuse, rebondie et apaisée.",
        cta: "Explorer le skin care",
        onCta: () => shop({ category: "SKIN_CARE" }),
        products: pick(products, "SKIN_CARE", (product) => isKoreanBrand(product.brand)),
      },
      {
        id: "offers",
        label: "Offres",
        theme: "night",
        kicker: "Les offres du moment",
        title: (
          <>
            Jusqu’à <em>-{bestDiscount}%</em> sur vos essentiels
          </>
        ),
        copy: "Une sélection de coffrets et de best-sellers à prix doux, dans la limite des stocks disponibles.",
        cta: "Voir les offres",
        onCta: () => shop({ saleOnly: true }),
        products: deals,
      },
      {
        id: "makeup",
        label: categoryMeta.MAKEUP.name,
        theme: "rose",
        kicker: "Couleur & caractère",
        title: (
          <>
            Le maqui.. qui <em>change l’humeur</em>
          </>
        ),
        copy: "Blush, palettes et lèvres glossy : les teintes du moment pour sublimer chaque look.",
        cta: "Shopper le maquillage",
        onCta: () => shop({ category: "MAKEUP" }),
        products: pick(products, "MAKEUP"),
      },
      {
        id: "fragrance",
        label: categoryMeta.FRAGRANCE.name,
        theme: "lilac",
        kicker: "Signature parfumée",
        title: (
          <>
            Une trace <em>rien qu’à vous</em>
          </>
        ),
        copy: "Eaux de parfum, brumes et coffrets pour accompagner chaque moment de la journée.",
        cta: "Trouver mon parfum",
        onCta: () => shop({ category: "FRAGRANCE" }),
        products: pick(products, "FRAGRANCE"),
      },
      {
        id: "hair",
        label: categoryMeta.HAIR.name,
        theme: "honey",
        kicker: "Rituel cheveux",
        title: (
          <>
            Des cheveux <em>qui brillent</em>
          </>
        ),
        copy: "Huiles, masques et brosses démêlantes pour des longueurs nourries et soyeuses.",
        cta: "Prendre soin de mes cheveux",
        onCta: () => shop({ category: "HAIR" }),
        products: pick(products, "HAIR"),
      },
    ];
    return list
      .filter((slide) => slide.theme === "photo" || (slide.products?.length ?? 0) >= 2)
      .filter((slide) => slide.id !== "offers" || bestDiscount > 0)
      .slice(0, 5);
  }, [products, shop]);

  const count = slides.length;
  const go = (index: number) => setActive(((index % count) + count) % count);

  return (
    <section className="hero" id="accueil" aria-roledescription="carrousel" aria-label="À la une">
      <div
        className={`hero-stage ${paused ? "is-paused" : ""} ${slides[active]?.theme === "night" ? "is-dark" : ""}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") go(active + 1);
          if (event.key === "ArrowLeft") go(active - 1);
        }}
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return;
          const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
          if (Math.abs(delta) > 48) go(active + (delta < 0 ? 1 : -1));
          touchStart.current = null;
        }}
      >
        {slides.map((slide, index) => (
          <article
            key={slide.id}
            className={`hero-slide theme-${slide.theme} ${index === active ? "is-active" : ""}`}
            aria-roledescription="diapositive"
            aria-label={`${index + 1} sur ${count}`}
            aria-hidden={index !== active}
          >
            <div className="hero-backdrop" aria-hidden="true">
              {slide.theme === "photo" ? (
                <img src="/images/beauty-hero.png" alt="" fetchPriority={index === 0 ? "high" : "auto"} />
              ) : (
                <>
                  <span className="hero-orb orb-a" />
                  <span className="hero-orb orb-b" />
                  <span className="hero-ring" />
                </>
              )}
            </div>

            <div className="hero-copy">
              <p className="hero-kicker">
                <Sparkles size={14} /> {slide.kicker}
              </p>
              <h1 className="hero-title">{slide.title}</h1>
              <p className="hero-text">{slide.copy}</p>
              <div className="hero-actions">
                <button type="button" className="button button-primary" tabIndex={index === active ? 0 : -1} onClick={slide.onCta}>
                  {slide.cta} <ArrowRight size={18} />
                </button>
                {slide.theme === "photo" && (
                  <a className="button button-ghost" href="#categories" tabIndex={index === active ? 0 : -1}>
                    Explorer les catégories
                  </a>
                )}
              </div>
              {/* {slide.theme === "photo" && (
                <ul className="hero-proofs">
                  <li>
                    <BadgeCheck size={16} /> 100% authentiques
                  </li>
                  <li>
                    <Truck size={16} /> Paiement à la livraison
                  </li>
                </ul>
              )} */}
            </div>

            {slide.products && slide.products.length > 0 && (
              <div className="hero-visual">
                {slide.products.map((product, position) => (
                  <button
                    type="button"
                    key={product.variantId}
                    className={`hero-product hero-product-${position}`}
                    style={{ "--i": position } as CSSProperties}
                    tabIndex={index === active ? 0 : -1}
                    onClick={() => openProduct(product)}
                    aria-label={`Voir ${product.name}`}
                  >
                    <span className="hero-product-float">
                      <img src={productImages(product)[0]} alt="" />
                      {slide.theme === "night" && discountPercent(product) > 0 && (
                        <span className="hero-product-badge">-{discountPercent(product)}%</span>
                      )}
                    </span>
                    {position === 0 && (
                      <span className="hero-product-tag">
                        <small>{product.brand}</small>
                        <strong>{formatPrice(product.retailPrice)}</strong>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}

        <div className="hero-controls">
          <div className="hero-progress" role="tablist" aria-label="Choisir une diapositive">
            {slides.map((slide, index) => (
              <button
                type="button"
                key={slide.id}
                role="tab"
                aria-selected={index === active}
                className={index === active ? "is-active" : index < active ? "is-done" : ""}
                onClick={() => go(index)}
              >
                <span className="hero-progress-label">{slide.label}</span>
                <span className="hero-progress-bar">
                  <i
                    style={{ "--duration": `${SLIDE_DURATION}ms` } as CSSProperties}
                    onAnimationEnd={() => index === active && go(active + 1)}
                  />
                </span>
              </button>
            ))}
          </div>
          <div className="hero-arrows">
            <span className="hero-counter">
              <b>{String(active + 1).padStart(2, "0")}</b> / {String(count).padStart(2, "0")}
            </span>
            <button type="button" className="round-button" onClick={() => go(active - 1)} aria-label="Diapositive précédente">
              <ArrowLeft size={18} />
            </button>
            <button type="button" className="round-button" onClick={() => go(active + 1)} aria-label="Diapositive suivante">
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
