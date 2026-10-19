"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { ProductListItem } from "@cosmetics/contracts";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { formatPrice, normalize, productImages } from "@/lib/catalog";
import { Reveal } from "./motion";
import { useStore } from "./store-context";

const steps = [
  {
    id: "cleanse",
    title: "Nettoyer",
    copy: "Une base nette pour que les actifs pénètrent mieux.",
    subcategories: ["Nettoyants", "Exfoliants"],
    keywords: /cleans|nettoy|wash|mousse|gel-to-cream|peeling/,
  },
  {
    id: "treat",
    title: "Traiter",
    copy: "Sérums et boosters ciblent éclat, taches ou imperfections.",
    subcategories: ["Sérums & traitements", "Toners & essences", "Masques"],
    keywords: /serum|booster|shot|ampoule|essence|toner|mask|masque/,
  },
  {
    id: "hydrate",
    title: "Hydrater",
    copy: "Une crème adaptée scelle l’hydratation toute la journée.",
    subcategories: ["Hydratants", "Contour des yeux", "Anti-âge"],
    keywords: /cream|creme|moistur|hydrat|baume|balm/,
  },
  {
    id: "protect",
    title: "Protéger",
    copy: "L’indispensable SPF contre les UV, même par temps couvert.",
    subcategories: ["Protection solaire"],
    keywords: /spf|sun|solaire|soleil/,
  },
];

export function RoutineBuilder() {
  const { products, add, openProduct, shop } = useStore();
  const routine = useMemo(() => {
    const skin = products.filter((product) => product.category === "SKIN_CARE" && productImages(product).length);
    const used = new Set<string>();
    return steps.map((step) => {
      const matches = skin.filter(
        (product) =>
          !used.has(product.variantId) &&
          (step.subcategories.includes(product.subcategory) || step.keywords.test(normalize(product.name))),
      );
      const ordered = [...matches.filter((product) => product.available > 0), ...matches.filter((product) => product.available <= 0)];
      ordered.slice(0, 3).forEach((product) => used.add(product.variantId));
      return { ...step, items: ordered.slice(0, 3) };
    });
  }, [products]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [choice, setChoice] = useState<Record<string, number>>({});

  const filled = routine.filter((step) => step.items.length > 0);
  if (filled.length < 3) return null;

  const step = routine[activeIndex]!.items.length ? routine[activeIndex]! : filled[0]!;
  const selected: ProductListItem = step.items[choice[step.id] ?? 0] ?? step.items[0]!;
  const picks = routine.map((entry) => entry.items[choice[entry.id] ?? 0]).filter(Boolean) as ProductListItem[];
  const total = picks.reduce((sum, product) => sum + product.retailPrice, 0);

  return (
    <section className="section routine" aria-labelledby="routine-title">
      <div className="routine-panel">
        <Reveal className="routine-intro">
          <p className="eyebrow">Routine skin care</p>
          <h2 className="section-title" id="routine-title">
            Votre routine <em>en 4 étapes</em>
          </h2>
          <p className="section-lede">Composez une routine complète en quelques clics : on vous propose le meilleur produit à chaque étape.</p>
          <ol className="routine-steps">
            {routine.map((entry, index) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`${entry.id === step.id ? "is-active" : ""} ${entry.items.length ? "" : "is-empty"}`}
                  disabled={!entry.items.length}
                  onClick={() => setActiveIndex(index)}
                >
                  <span className="routine-step-number">0{index + 1}</span>
                  <span>
                    <strong>{entry.title}</strong>
                    <small>{entry.copy}</small>
                  </span>
                  {entry.items[choice[entry.id] ?? 0] && (
                    <img src={productImages(entry.items[choice[entry.id] ?? 0]!)[0]} alt="" />
                  )}
                </button>
              </li>
            ))}
          </ol>
          <div className="routine-total">
            <span>
              Routine complète · <strong>{formatPrice(total)}</strong>
            </span>
            <button
              type="button"
              className="button button-primary"
              onClick={() => picks.filter((product) => product.available > 0).forEach((product) => add(product))}
            >
              <ShoppingBag size={17} /> Ajouter la routine
            </button>
          </div>
        </Reveal>

        <Reveal className="routine-stage" delay={120} variant="zoom">
          <div className="routine-spotlight" key={`${step.id}-${selected.variantId}`}>
            <span className="routine-big-number" aria-hidden="true">
              0{routine.indexOf(step) + 1}
            </span>
            <button type="button" className="routine-image" onClick={() => openProduct(selected)} aria-label={`Voir ${selected.name}`}>
              <img src={productImages(selected)[0]} alt="" />
            </button>
            <div className="routine-product">
              <small>
                Étape {routine.indexOf(step) + 1} · {step.title}
              </small>
              <strong>{selected.name}</strong>
              <span>
                {selected.brand} · {formatPrice(selected.retailPrice)}
              </span>
              <div className="routine-product-actions">
                <button type="button" className="button button-dark" disabled={selected.available <= 0} onClick={() => add(selected)}>
                  <ShoppingBag size={16} /> Ajouter
                </button>
                <button type="button" className="link-button" onClick={() => openProduct(selected)}>
                  Détails <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
          {step.items.length > 1 && (
            <div className="routine-alternatives" aria-label="Alternatives">
              {step.items.map((product, index) => (
                <button
                  type="button"
                  key={product.variantId}
                  style={{ "--i": index } as CSSProperties}
                  className={product.variantId === selected.variantId ? "is-active" : ""}
                  onClick={() => setChoice((current) => ({ ...current, [step.id]: index }))}
                  aria-label={product.name}
                >
                  <img src={productImages(product)[0]} alt="" />
                </button>
              ))}
              <button type="button" className="routine-more" onClick={() => shop({ category: "SKIN_CARE" })}>
                + de choix
              </button>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
