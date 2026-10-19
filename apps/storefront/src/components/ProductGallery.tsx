"use client";

import { useState } from "react";
import type { ProductListItem } from "@cosmetics/contracts";
import { Play } from "lucide-react";
import { productImages } from "@/lib/catalog";

export function ProductGallery({ product }: { product: ProductListItem }) {
  const images = productImages(product);
  const [active, setActive] = useState(0);
  const showingVideo = active === images.length && Boolean(product.videoUrl);
  return (
    <div className="gallery">
      <div className="gallery-stage">
        {showingVideo ? (
          <video src={product.videoUrl} controls autoPlay playsInline preload="metadata" />
        ) : images[active] ? (
          <img key={images[active]} src={images[active]} alt={product.name} />
        ) : (
          <span className="product-card-monogram">{product.brand.slice(0, 1)}</span>
        )}
      </div>
      {(images.length > 1 || product.videoUrl) && (
        <div className="gallery-thumbs">
          {images.map((url, index) => (
            <button
              type="button"
              key={url}
              aria-label={`Image ${index + 1}`}
              aria-pressed={active === index}
              onClick={() => setActive(index)}
            >
              <img src={url} alt="" />
            </button>
          ))}
          {product.videoUrl && (
            <button type="button" aria-label="Vidéo" aria-pressed={showingVideo} onClick={() => setActive(images.length)}>
              <Play size={16} fill="currentColor" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
