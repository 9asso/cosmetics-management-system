"use client";

import { useMemo, type CSSProperties } from "react";
import { ArrowRight, Truck } from "lucide-react";
import { discountPercent, formatPrice, productImages } from "@/lib/catalog";
import { CountUp, Reveal } from "./motion";
import { useStore } from "./store-context";

export function PromoBanner() {
  const { products, shop, openProduct, shipping } = useStore();
  const deals = useMemo(
    () =>
      products
        .filter((product) => discountPercent(product) > 0 && productImages(product).length)
        .sort((a, b) => discountPercent(b) - discountPercent(a))
        .slice(0, 6),
    [products],
  );
  const best = deals[0] ? discountPercent(deals[0]) : 0;

  return (
    <section className="section promo" id="offres" aria-labelledby="promo-title">
      <Reveal className="promo-panel" variant="zoom">
        <div className="promo-glow" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="promo-copy">
          <p className="eyebrow eyebrow-light">Les offres du moment</p>
          {best > 0 ? (
            <h2 className="promo-title" id="promo-title">
              Jusqu’à
              <span className="promo-number">
                -<CountUp value={best} />%
              </span>
              <em>sur une sélection beauté</em>
            </h2>
          ) : (
            <h2 className="promo-title" id="promo-title">
              Livraison offerte
              <em>dès {shipping.freeShippingThreshold} MAD d’achats</em>
            </h2>
          )}
          <p className="promo-text">
            <Truck size={17} /> Livraison offerte dès {shipping.freeShippingThreshold} MAD · Paiement à la livraison
          </p>
          <button type="button" className="button button-light" onClick={() => shop({ saleOnly: best > 0 })}>
            {best > 0 ? "Voir les offres" : "Découvrir la boutique"}
            <ArrowRight size={18} />
          </button>
        </div>
        {deals.length > 0 && (
          <div className="promo-deals">
            {deals.slice(0, 4).map((product, index) => (
              <button
                type="button"
                key={product.variantId}
                className="promo-deal"
                style={{ "--i": index } as CSSProperties}
                onClick={() => openProduct(product)}
              >
                <span className="promo-deal-image">
                  <img src={productImages(product)[0]} alt="" loading="lazy" />
                  <b>-{discountPercent(product)}%</b>
                </span>
                <span className="promo-deal-copy">
                  <small>{product.brand}</small>
                  <span>{product.name}</span>
                  <strong>
                    {formatPrice(product.retailPrice)}
                    {product.compareAtPrice && <del>{formatPrice(product.compareAtPrice)}</del>}
                  </strong>
                </span>
              </button>
            ))}
          </div>
        )}
      </Reveal>
    </section>
  );
}
