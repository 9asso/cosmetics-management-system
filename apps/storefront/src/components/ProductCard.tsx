"use client";

import type { CSSProperties } from "react";
import type { ProductListItem } from "@cosmetics/contracts";
import { Eye, Heart, Plus, ShoppingBag } from "lucide-react";
import { discountPercent, formatPrice, productImages } from "@/lib/catalog";
import { useStore } from "./store-context";

export function ProductCard({
  product,
  index = 0,
  className = "",
}: {
  product: ProductListItem;
  index?: number;
  className?: string;
}) {
  const { add, openProduct, favorites, toggleFavorite } = useStore();
  const images = productImages(product);
  const discount = discountPercent(product);
  const soldOut = product.available <= 0;
  const lowStock = !soldOut && product.available <= product.lowStockThreshold;
  const favorite = favorites.includes(product.variantId);

  return (
    <article
      className={`product-card ${soldOut ? "is-sold-out" : ""} ${className}`}
      style={{ "--i": index } as CSSProperties}
    >
      <div className="product-card-media">
        <button
          type="button"
          className="product-card-image"
          onClick={() => openProduct(product)}
          aria-label={`Voir ${product.name}`}
        >
          {images[0] ? (
            <>
              <img src={images[0]} alt="" loading="lazy" decoding="async" />
              {images[1] && (
                <img className="alt" src={images[1]} alt="" loading="lazy" decoding="async" />
              )}
            </>
          ) : (
            <span className="product-card-monogram">{product.brand.slice(0, 1)}</span>
          )}
        </button>
        <div className="product-card-badges">
          {discount > 0 && <span className="badge badge-sale">-{discount}%</span>}
          {lowStock && <span className="badge badge-low">Dernières pièces</span>}
          {soldOut && <span className="badge badge-out">Épuisé</span>}
        </div>
        <button
          type="button"
          className={`product-card-fav ${favorite ? "is-on" : ""}`}
          aria-label={favorite ? `Retirer ${product.name} des favoris` : `Ajouter ${product.name} aux favoris`}
          aria-pressed={favorite}
          onClick={() => toggleFavorite(product.variantId)}
        >
          <Heart size={16} fill={favorite ? "currentColor" : "none"} />
        </button>
        <div className="product-card-actions">
          <button type="button" className="product-card-add" disabled={soldOut} onClick={() => add(product)}>
            <ShoppingBag size={16} />
            {soldOut ? "Bientôt de retour" : "Ajouter au panier"}
          </button>
          <button
            type="button"
            className="product-card-peek"
            onClick={() => openProduct(product)}
            aria-label={`Aperçu rapide de ${product.name}`}
          >
            <Eye size={16} />
          </button>
        </div>
        <button
          type="button"
          className="product-card-quick"
          disabled={soldOut}
          onClick={() => add(product)}
          aria-label={`Ajouter ${product.name} au panier`}
        >
          <Plus size={18} />
        </button>
      </div>
      <div className="product-card-body">
        <small>{product.brand}</small>
        <button type="button" className="product-card-name" onClick={() => openProduct(product)}>
          {product.name}
        </button>
        <div className="product-card-price">
          <strong className={discount ? "is-sale" : ""}>{formatPrice(product.retailPrice)}</strong>
          {discount > 0 && product.compareAtPrice && <del>{formatPrice(product.compareAtPrice)}</del>}
        </div>
      </div>
    </article>
  );
}
