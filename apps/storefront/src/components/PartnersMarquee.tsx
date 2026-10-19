"use client";

import { useMemo, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { brandHref } from "@/lib/brands";
import { rankBrands } from "@/lib/catalog";
import { partnerWordmarks, type WordmarkStyle } from "@/lib/site";
import { Reveal } from "./motion";
import { useStore } from "./store-context";

const fallbackStyles: WordmarkStyle[] = ["serif", "bold", "wide", "lower", "italic", "serif-caps"];

export function PartnersMarquee() {
  const { products } = useStore();
  const partners = useMemo(
    () =>
      rankBrands(products)
        .slice(0, 28)
        .map((brand, index) => {
          const config = partnerWordmarks[brand.name.toLocaleLowerCase("fr")];
          return {
            name: brand.name,
            style: config?.style ?? fallbackStyles[index % fallbackStyles.length]!,
            logo: config?.logo,
          };
        }),
    [products],
  );
  if (partners.length === 0) return null;

  // Two identical halves make the -50% translate loop seamless.
  const loop = [...partners, ...partners];
  return (
    <section className="partners" id="partenaires" aria-label="Nos partenaires">
      <Reveal className="partners-head">
        <div>
          <p className="eyebrow">Nos partenaires</p>
          <h2 className="partners-title">
            Les marques que vous aimez, <em>en version originale</em>
          </h2>
        </div>
        <div className="partners-aside">
          <p className="partners-note">
            <BadgeCheck size={18} />
            Maisons sélectionnées, 100% authentiques
          </p>
          <Link className="link-button" href="/marques">
            Toutes les marques <ArrowRight size={16} />
          </Link>
        </div>
      </Reveal>
      <div className="marquee" style={{ "--marquee-duration": `${Math.max(28, partners.length * 3.2)}s` } as CSSProperties}>
        <div className="marquee-track">
          {loop.map((partner, index) => (
            <Link
              key={`${partner.name}-${index}`}
              href={brandHref(partner.name)}
              className={`partner-logo wordmark-${partner.style}`}
              tabIndex={index >= partners.length ? -1 : 0}
              aria-hidden={index >= partners.length || undefined}
              title={partner.name}
            >
              {partner.logo ? <img src={partner.logo} alt={partner.name} /> : <span>{partner.name}</span>}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
