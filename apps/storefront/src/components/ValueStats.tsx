"use client";

import { useMemo } from "react";
import { BadgeCheck, Headphones, RotateCcw, Truck, Wallet } from "lucide-react";
import { allCategories, rankBrands } from "@/lib/catalog";
import { CountUp, Reveal } from "./motion";
import { useStore } from "./store-context";

export function ValueStats() {
  const { products, shipping } = useStore();
  const stats = useMemo(
    () => [
      { value: products.length, label: "références en boutique" },
      { value: rankBrands(products).length, label: "marques authentiques" },
      { value: allCategories.filter((category) => products.some((product) => product.category === category)).length, label: "univers beauté" },
      { value: shipping.freeShippingThreshold, suffix: " MAD", label: "pour la livraison offerte" },
    ],
    [products, shipping.freeShippingThreshold],
  );
  return (
    <section className="stats" aria-label="Pourquoi Yamoura">
      <div className="stats-glow" aria-hidden="true">
        <span />
        <span />
      </div>
      <Reveal className="stats-head">
        <p className="eyebrow eyebrow-light">Pourquoi Yamoura</p>
        <h2 className="section-title section-title-light">
          Des cosmétiques authentiques, <em>une expérience sans stress</em>
        </h2>
      </Reveal>
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <Reveal key={stat.label} className="stat" delay={index * 90}>
            <strong>
              <CountUp value={stat.value} suffix={stat.suffix} />
            </strong>
            <span>{stat.label}</span>
          </Reveal>
        ))}
      </div>
      <div className="guarantees">
        {[
          { icon: BadgeCheck, title: "100% authentiques", copy: "Marques vérifiées, achetées auprès de partenaires de confiance." },
          { icon: Wallet, title: "Paiement à la livraison", copy: "Aucune carte requise : vous payez en espèces à réception." },
          { icon: Truck, title: "Partout au Maroc", copy: `Livraison ${shipping.shippingFee} MAD, offerte dès ${shipping.freeShippingThreshold} MAD.` },
          { icon: RotateCcw, title: "Retour facile", copy: "Des conditions simples si un produit ne vous convient pas." },
          { icon: Headphones, title: "Assistance 7j/7", copy: "Une équipe à l’écoute pour vous conseiller." },
        ].map(({ icon: Icon, title, copy }, index) => (
          <Reveal key={title} className="guarantee" delay={index * 70}>
            <span className="guarantee-icon">
              <Icon size={20} />
            </span>
            <strong>{title}</strong>
            <small>{copy}</small>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
