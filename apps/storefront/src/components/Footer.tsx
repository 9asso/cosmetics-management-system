"use client";

import { useMemo, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, Heart, MapPin, Truck, Wallet } from "lucide-react";
import { allCategories, categoryMeta, productImages } from "@/lib/catalog";
import { site } from "@/lib/site";
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from "./icons";
import { Reveal } from "./motion";
import { useStore } from "./store-context";

export function BottomSection({ onOpenCart }: { onOpenCart: () => void }) {
  const { products, shop, openInfo, demo, shipping } = useStore();
  const orbit = useMemo(
    () => products.filter((product) => productImages(product).length).slice(-6).map((product) => productImages(product)[0]!),
    [products],
  );
  const categories = allCategories.filter((category) => products.some((product) => product.category === category));

  return (
    <>
      <section className="section closing" aria-labelledby="closing-title">
        <Reveal className="closing-panel" variant="zoom">
          <div className="closing-copy">
            <p className="eyebrow">Une dose de bonne humeur</p>
            <h2 className="closing-title" id="closing-title">
              Votre prochain coup de cœur <em>vous attend.</em>
            </h2>
            <div className="closing-actions">
              <button type="button" className="button button-primary" onClick={() => shop()}>
                Commencer mes achats <ArrowRight size={18} />
              </button>
              <button type="button" className="button button-ghost" onClick={() => openInfo("howto")}>
                Comment commander ?
              </button>
            </div>
            <ol className="closing-steps">
              <li>
                <span>01</span>
                <strong>Choisissez</strong>
                <small>Par besoin, catégorie ou marque.</small>
              </li>
              <li>
                <span>02</span>
                <strong>Commandez</strong>
                <small>Sans carte bancaire, en 1 minute.</small>
              </li>
              <li>
                <span>03</span>
                <strong>Payez à la livraison</strong>
                <small>En espèces, à réception du colis.</small>
              </li>
            </ol>
          </div>
          <div className="closing-orbit" aria-hidden="true">
            <span className="closing-core">
              <img src="/brand-yamoura.png" alt="" />
            </span>
            <div className="closing-ring">
              {orbit.map((src, index) => (
                <span key={src} style={{ "--i": index, "--n": orbit.length } as CSSProperties}>
                  <img src={src} alt="" loading="lazy" />
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="site-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <Link className="brand-logo brand-logo-light" href="/#accueil">
              <span className="brand-logo-mark">
                <img src="/brand-yamoura.png" width={44} height={45} alt="" />
              </span>
              <span className="brand-logo-text">
                <strong>Yamoura</strong>
                <small>{site.tagline}</small>
              </span>
            </Link>
            <p>La beauté joyeuse et accessible : une sélection authentique, choisie avec soin et livrée partout au Maroc.</p>
            <div className="footer-social">
              <a href={site.instagram.url} target="_blank" rel="noreferrer" aria-label="Instagram">
                <InstagramIcon size={19} />
              </a>
              <a href={site.tiktok.url} target="_blank" rel="noreferrer" aria-label="TikTok">
                <TikTokIcon size={18} />
              </a>
              <a href={site.whatsapp.url} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <WhatsAppIcon size={18} />
              </a>
            </div>
          </div>
          <nav className="footer-column" aria-label="Boutique">
            <strong>Boutique</strong>
            {categories.map((category) => (
              <button type="button" key={category} onClick={() => shop({ category })}>
                {categoryMeta[category].name}
              </button>
            ))}
            <button type="button" onClick={() => shop({ saleOnly: true })}>
              Offres du moment
            </button>
            <Link href="/marques">Toutes les marques</Link>
          </nav>
          <nav className="footer-column" aria-label="Aide">
            <strong>Besoin d’aide ?</strong>
            <button type="button" onClick={() => openInfo("delivery")}>Livraison &amp; frais</button>
            <button type="button" onClick={() => openInfo("payment")}>Paiement à la livraison</button>
            <button type="button" onClick={() => openInfo("howto")}>Comment commander</button>
            <button type="button" onClick={onOpenCart}>Mon panier</button>
            <button type="button" onClick={() => shop({ favoritesOnly: true })}>Mes favoris</button>
          </nav>
          <div className="footer-column footer-promise">
            <strong>L’expérience Yamoura</strong>
            <span>
              <MapPin size={16} /> Livraison partout au Maroc
            </span>
            <span>
              <Truck size={16} /> Offerte dès {shipping.freeShippingThreshold} MAD
            </span>
            <span>
              <Wallet size={16} /> Paiement en espèces à réception
            </span>
            <span>
              <Heart size={16} /> Produits 100% authentiques
            </span>
          </div>
        </div>

        <div className="footer-wordmark" aria-hidden="true">
          Yamoura
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Yamoura · Health &amp; Beauty. Tous droits réservés.</span>
          {demo && (
            <button type="button" className="footer-demo" onClick={() => openInfo("demo")}>
              Mode aperçu
            </button>
          )}
          <button
            type="button"
            className="round-button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Revenir en haut"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </footer>
    </>
  );
}
