"use client";

import { useMemo, type CSSProperties } from "react";
import Link from "next/link";
import type { ProductListItem } from "@cosmetics/contracts";
import { ArrowRight, Flame, Heart, Sparkles, Star } from "lucide-react";
import { brandHref } from "@/lib/brands";
import { productImages, rankBrands } from "@/lib/catalog";
import { brandStories, isKoreanBrand } from "@/lib/site";
import { Reveal } from "./motion";
import { Rail } from "./Rail";
import { useStore } from "./store-context";

export const brandTints = ["#f6e4e2", "#f6ecda", "#ebe6f5", "#e1f0e8", "#f8e8de", "#e5ecf5"];
const badges = [
  { label: "Tendance", icon: Flame },
  { label: "On adore", icon: Heart },
  { label: "Coup de cœur", icon: Star },
];

/** Tall brand card with a product collage, linking to the brand page. */
export function BrandCard({ name, products, index }: { name: string; products: ProductListItem[]; index: number }) {
  const korean = isKoreanBrand(name);
  const badge = korean ? { label: "K-Beauty", icon: Sparkles } : badges[index % badges.length]!;
  const BadgeIcon = badge.icon;
  const shots = products.flatMap((product) => productImages(product).slice(0, 1)).slice(0, 3);
  return (
    <Reveal className="brand-card-wrap" delay={Math.min(index, 4) * 80} variant="left">
      <Link
        href={brandHref(name)}
        className="brand-card"
        style={{ "--tint": brandTints[index % brandTints.length] } as CSSProperties}
      >
        <span className={`brand-card-badge ${korean ? "is-korean" : ""}`}>
          <BadgeIcon size={13} /> {badge.label}
        </span>
        <span className="brand-card-shots" aria-hidden="true">
          {shots.map((src, position) => (
            <img key={src} src={src} alt="" loading="lazy" style={{ "--p": position } as CSSProperties} />
          ))}
        </span>
        <span className="brand-card-copy">
          <strong>{name}</strong>
          <em>{brandStories[name.toLocaleLowerCase("fr")] ?? "Une sélection authentique, choisie avec soin pour vous."}</em>
          <span className="brand-card-cta">
            Shop now <ArrowRight size={15} />
          </span>
        </span>
      </Link>
    </Reveal>
  );
}

export function TrendingBrands() {
  const { products } = useStore();
  const brands = useMemo(
    () => rankBrands(products).filter((brand) => brand.products.some((product) => productImages(product).length)).slice(0, 10),
    [products],
  );
  if (brands.length < 3) return null;

  return (
    <section className="section trending" aria-labelledby="trending-title">
      <Reveal className="section-head">
        <div>
          <p className="eyebrow">Tendances du moment</p>
          <h2 className="section-title" id="trending-title">
            Les marques qui font <em>le buzz</em>
          </h2>
        </div>
        <div className="section-head-aside">
          <p className="section-lede">Nos maisons préférées et les pépites coréennes que tout le monde s’arrache.</p>
          <Link className="link-button" href="/marques">
            Toutes les marques <ArrowRight size={16} />
          </Link>
        </div>
      </Reveal>

      <Rail label="Marques tendance">
        {brands.map((brand, index) => (
          <BrandCard key={brand.name} name={brand.name} products={brand.products} index={index} />
        ))}
      </Rail>
    </section>
  );
}
