'use client';
import { useState } from 'react';
import type { ProductListItem } from '@cosmetics/contracts';

export function ProductGallery({ product }: { product: ProductListItem }) {
  const images = product.images ?? (product.imageUrl ? [product.imageUrl] : []);
  const [active, setActive] = useState(0);
  return <div className="product-gallery">
    <div className="product-modal-image">
      {active === images.length && product.videoUrl ? <video src={product.videoUrl} controls preload="metadata" />
        : images[active] ? <img src={images[active]} alt={product.name} />
        : <span className="cosmetic-shape"><i>{product.brand.slice(0, 1)}</i></span>}
    </div>
    {(images.length > 1 || product.videoUrl) && <div className="product-gallery-thumbnails">
      {images.map((url, index) => <button key={url} type="button" aria-label={`Image ${index + 1}`} aria-pressed={active === index} onClick={() => setActive(index)}><img src={url} alt="" /></button>)}
      {product.videoUrl && <button type="button" aria-pressed={active === images.length} onClick={() => setActive(images.length)}>▶ Vidéo</button>}
    </div>}
  </div>;
}
