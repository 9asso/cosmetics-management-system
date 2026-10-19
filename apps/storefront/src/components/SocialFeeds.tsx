"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ProductListItem } from "@cosmetics/contracts";
import { ArrowUpRight, Play, X } from "lucide-react";
import { allCategories, categoryMeta, formatPrice, productImages } from "@/lib/catalog";
import type { InstagramPost } from "@/lib/instagram";
import { site, type TikTokVideo } from "@/lib/site";
import { InstagramIcon, TikTokIcon } from "./icons";
import { Reveal } from "./motion";
import { Rail } from "./Rail";
import { useStore } from "./store-context";

/** One product per category first, then the rest, so curated grids feel varied. */
function varied(products: ProductListItem[], count: number) {
  const withImages = products.filter((product) => productImages(product).length);
  const firsts = allCategories
    .map((category) => withImages.find((product) => product.category === category))
    .filter(Boolean) as ProductListItem[];
  const rest = withImages.filter((product) => !firsts.includes(product));
  return [...firsts, ...rest].slice(0, count);
}

export function InstagramFeed({ posts }: { posts: InstagramPost[] }) {
  const tiles = posts.slice(0, 5);
  return (
    <section className="section instagram" id="instagram" aria-labelledby="instagram-title">
      <Reveal className="social-head">
        <span className="social-avatar social-avatar-ig rounded-2xl">
          <img src="/brand-yamoura.png" alt="" className="rounded-2xl" />
        </span>
        <div>
          <p className="eyebrow">Instagram</p>
          <h2 className="section-title" id="instagram-title">
            Rejoignez-nous <em>@{site.instagram.handle}</em>
          </h2>
          <p className="section-lede">Nouveautés, routines et coulisses : la beauté Yamoura au quotidien.</p>
        </div>
        <a className="button button-instagram" href={site.instagram.url} target="_blank" rel="noreferrer">
          <InstagramIcon size={18} /> Suivre sur Instagram
        </a>
      </Reveal>

      {tiles.length > 0 ? (
        <div
          className={`instagram-grid ${tiles.length < 5 ? "is-few" : ""}`}
          style={{ "--tiles": tiles.length } as CSSProperties}
        >
          {tiles.map((post, index) => (
            <Reveal
              key={post.id}
              className={`ig-tile ${index === 0 && tiles.length >= 5 ? "is-feature" : ""}`}
              delay={index * 80}
              variant="zoom"
            >
              <a href={post.permalink} target="_blank" rel="noreferrer" aria-label={post.caption.slice(0, 90) || "Publication Instagram"}>
                <img src={post.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                {post.isVideo && (
                  <span className="ig-video" aria-hidden="true">
                    <Play size={14} fill="currentColor" />
                  </span>
                )}
                <span className="ig-overlay">
                  <InstagramIcon size={24} />
                  <span dir="auto">{post.caption.slice(0, 120)}</span>
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      ) : (
        // Instagram sometimes refuses server requests; its own embed still loads in the visitor's browser.
        <Reveal className="ig-embed" variant="zoom">
          <iframe
            src={`https://www.instagram.com/${site.instagram.handle}/embed/`}
            title={`Publications Instagram de @${site.instagram.handle}`}
            loading="lazy"
          />
        </Reveal>
      )}
    </section>
  );
}

export function TikTokFeed() {
  const { products, openProduct } = useStore();
  const [playing, setPlaying] = useState<TikTokVideo | null>(null);
  const bySku = useMemo(() => new Map(products.map((product) => [product.sku, product])), [products]);
  const showcase = useMemo(() => varied([...products].reverse(), 8), [products]);
  const videos = site.tiktokVideos;

  useEffect(() => {
    if (!playing) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setPlaying(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [playing]);

  if (videos.length === 0 && showcase.length < 4) return null;

  return (
    <section className="tiktok" id="tiktok" aria-labelledby="tiktok-title">
      <div className="tiktok-glow" aria-hidden="true">
        <span />
        <span />
      </div>
      <Reveal className="social-head social-head-dark">
        <span className="social-avatar social-avatar-tt">
          <TikTokIcon size={26} />
        </span>
        <div>
          <p className="eyebrow eyebrow-light">TikTok</p>
          <h2 className="section-title section-title-light" id="tiktok-title">
            Trending <em>on TikTok</em>
          </h2>
          <p className="section-lede section-lede-light">Les produits qui font le buzz, en vidéo sur @{site.tiktok.handle}.</p>
        </div>
        <a className="button button-tiktok" href={site.tiktok.url} target="_blank" rel="noreferrer">
          <TikTokIcon size={17} /> Suivre @{site.tiktok.handle}
        </a>
      </Reveal>

      <Rail label="Vidéos TikTok" dark>
        {videos.length > 0
          ? videos.map((video, index) => {
              const product = video.productSku ? bySku.get(video.productSku) : undefined;
              const cover = video.cover ?? (product ? productImages(product)[0] : undefined);
              return (
                <Reveal key={video.id} className="tt-card-wrap" delay={Math.min(index, 5) * 70} variant="up">
                  <div className="tt-card">
                    <button type="button" className="tt-cover" onClick={() => setPlaying(video)} aria-label={`Lire la vidéo : ${video.caption}`}>
                      {cover && <img src={cover} alt="" loading="lazy" />}
                      <span className="tt-play">
                        <Play size={22} fill="currentColor" />
                      </span>
                      <span className="tt-caption">{video.caption}</span>
                    </button>
                    {product && (
                      <button type="button" className="tt-product" onClick={() => openProduct(product)}>
                        <img src={productImages(product)[0]} alt="" />
                        <span>
                          <small>{product.name}</small>
                          <strong>{formatPrice(product.retailPrice)}</strong>
                        </span>
                      </button>
                    )}
                  </div>
                </Reveal>
              );
            })
          : showcase.map((product, index) => (
              <Reveal key={product.variantId} className="tt-card-wrap" delay={Math.min(index, 5) * 70} variant="up">
                <div className="tt-card is-showcase" style={{ "--tint": categoryMeta[product.category].accent } as CSSProperties}>
                  <a className="tt-cover" href={site.tiktok.url} target="_blank" rel="noreferrer" aria-label={`${product.name} sur TikTok`}>
                    <span className="tt-handle">
                      <TikTokIcon size={13} /> @{site.tiktok.handle}
                    </span>
                    <img src={productImages(product)[0]} alt="" loading="lazy" />
                    <span className="tt-play">
                      <Play size={22} fill="currentColor" />
                    </span>
                    <span className="tt-caption">
                      {product.brand}
                      <ArrowUpRight size={14} />
                    </span>
                  </a>
                  <button type="button" className="tt-product" onClick={() => openProduct(product)}>
                    <img src={productImages(product)[0]} alt="" />
                    <span>
                      <small>{product.name}</small>
                      <strong>{formatPrice(product.retailPrice)}</strong>
                    </span>
                  </button>
                </div>
              </Reveal>
            ))}
      </Rail>

      {playing && (
        <div className="video-modal" role="dialog" aria-modal="true" aria-label={playing.caption} onClick={() => setPlaying(null)}>
          <div className="video-modal-frame" onClick={(event) => event.stopPropagation()}>
            <iframe
              src={`https://www.tiktok.com/player/v1/${playing.id}?autoplay=1&loop=1&rel=0`}
              title={playing.caption}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
            <button type="button" className="round-button video-modal-close" onClick={() => setPlaying(null)} aria-label="Fermer la vidéo">
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
