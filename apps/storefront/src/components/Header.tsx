"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, Heart, Menu, Search, ShoppingBag, X } from "lucide-react";
import { allCategories, categoryMeta, discountPercent } from "@/lib/catalog";
import { site } from "@/lib/site";
import { InstagramIcon, TikTokIcon } from "./icons";
import { useStore } from "./store-context";

export function AnnouncementBar() {
  const { shipping } = useStore();
  const announcements = [`Livraison offerte dès ${shipping.freeShippingThreshold} MAD d’achats`, ...site.announcements];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % announcements.length),
      4200,
    );
    return () => window.clearInterval(timer);
  }, [announcements.length]);
  return (
    <div className="announcement" role="region" aria-label="Annonces">
      <div className="announcement-inner">
        <div className="announcement-track" aria-live="polite">
          {announcements.map((message, position) => (
            <p key={message} className={position === index ? "is-active" : position === (index + announcements.length - 1) % announcements.length ? "is-leaving" : ""}>
              <span className="announcement-dot" aria-hidden="true" />
              {message}
            </p>
          ))}
        </div>
        <div className="announcement-social">
          <a href={site.instagram.url} target="_blank" rel="noreferrer" aria-label="Instagram">
            <InstagramIcon size={15} />
          </a>
          <a href={site.tiktok.url} target="_blank" rel="noreferrer" aria-label="TikTok">
            <TikTokIcon size={15} />
          </a>
        </div>
      </div>
    </div>
  );
}

export function Header({
  cartCount,
  cartBump,
  onOpenCart,
  onOpenSearch,
}: {
  cartCount: number;
  cartBump: number;
  onOpenCart: () => void;
  onOpenSearch: () => void;
}) {
  const { products, shop, goTo, favorites, shipping } = useStore();
  const onBrandsPage = usePathname().startsWith("/marques");
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 12);
      if (Math.abs(y - last) > 6) {
        setHidden(y > last && y > 520);
        last = y;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const menu = useMemo(
    () =>
      allCategories
        .map((category) => {
          const inCategory = products.filter((product) => product.category === category);
          const subcategories = [...new Set(inCategory.map((product) => product.subcategory).filter(Boolean))];
          return { category, count: inCategory.length, subcategories: subcategories.slice(0, 5) };
        })
        .filter((entry) => entry.count > 0),
    [products],
  );
  const bestDiscount = Math.max(0, ...products.map(discountPercent));

  const go = (action: () => void) => {
    setMenuOpen(false);
    setMegaOpen(false);
    action();
  };

  return (
    <>
      <header className={`site-header ${scrolled ? "is-scrolled" : ""} ${hidden && !megaOpen ? "is-hidden" : ""}`}>
        <div className="site-header-inner">
          <button type="button" className="icon-button header-menu" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu">
            <Menu size={21} />
          </button>
          <Link className="brand-logo" href="/#accueil" aria-label="Yamoura, retour à l’accueil">
            <span className="brand-logo-mark">
              <img src="/brand-yamoura.png" width={44} height={45} alt="" />
            </span>
            <span className="brand-logo-text">
              <strong>Yamoura</strong>
              <small>{site.tagline}</small>
            </span>
          </Link>

          <nav className="main-nav" aria-label="Navigation principale">
            <div
              className={`nav-item has-mega ${megaOpen ? "is-open" : ""}`}
              onMouseEnter={() => setMegaOpen(true)}
              onMouseLeave={() => setMegaOpen(false)}
            >
              <button type="button" aria-expanded={megaOpen} onClick={() => setMegaOpen((open) => !open)}>
                Boutique <ChevronDown size={15} />
              </button>
              <div className="mega-menu" role="menu">
                <div className="mega-grid">
                  {menu.map(({ category, subcategories }, position) => (
                    <div key={category} className="mega-column" style={{ "--i": position } as CSSProperties}>
                      <button type="button" className="mega-title" onClick={() => go(() => shop({ category }))}>
                        <span className="mega-swatch" style={{ background: categoryMeta[category].tint, color: categoryMeta[category].accent }} />
                        {categoryMeta[category].name}
                      </button>
                      {subcategories.map((subcategory) => (
                        <button type="button" key={subcategory} onClick={() => go(() => shop({ category, subcategory }))}>
                          {subcategory}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <button type="button" className="mega-promo" onClick={() => go(() => shop({ saleOnly: bestDiscount > 0 }))}>
                  <small>Offres du moment</small>
                  <strong>{bestDiscount > 0 ? `Jusqu’à -${bestDiscount}%` : `Livraison offerte dès ${shipping.freeShippingThreshold} MAD`}</strong>
                  <span>
                    Découvrir <ArrowRight size={15} />
                  </span>
                </button>
              </div>
            </div>
            <button type="button" className="nav-item" onClick={() => goTo("categories")}>Catégories</button>
            <Link className={`nav-item ${onBrandsPage ? "is-current" : ""}`} href="/marques" aria-current={onBrandsPage ? "page" : undefined}>
              Marques
            </Link>
            <button type="button" className="nav-item" onClick={() => goTo("selections")}>Sélections</button>
            <button type="button" className="nav-item nav-sale" onClick={() => shop({ saleOnly: true })}>Offres</button>
          </nav>

          <button type="button" className="header-search" onClick={onOpenSearch}>
            <Search size={17} />
            <span>Rechercher un produit, une marque…</span>
            <kbd>⌘K</kbd>
          </button>

          <div className="header-actions">
            <button type="button" className="icon-button header-search-mobile" onClick={onOpenSearch} aria-label="Rechercher">
              <Search size={20} />
            </button>
            <button
              type="button"
              className="icon-button header-fav"
              onClick={() => shop({ favoritesOnly: true })}
              aria-label={`Mes favoris (${favorites.length})`}
            >
              <Heart size={20} />
              {favorites.length > 0 && <span className="count-badge">{favorites.length}</span>}
            </button>
            <button type="button" className="icon-button header-cart" onClick={onOpenCart} aria-label={`Panier (${cartCount})`}>
              <ShoppingBag size={20} />
              <span key={cartBump} className={`count-badge ${cartBump ? "is-bumping" : ""}`}>{cartCount}</span>
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-menu ${menuOpen ? "is-open" : ""}`} aria-hidden={!menuOpen}>
        <div className="mobile-menu-backdrop" onClick={() => setMenuOpen(false)} />
        <aside className="mobile-menu-panel" aria-label="Menu">
          <div className="mobile-menu-head">
            <Link className="brand-logo" href="/#accueil" onClick={() => setMenuOpen(false)}>
              <span className="brand-logo-mark">
                <img src="/brand-yamoura.png" width={40} height={41} alt="" />
              </span>
              <span className="brand-logo-text">
                <strong>Yamoura</strong>
                <small>{site.tagline}</small>
              </span>
            </Link>
            <button type="button" className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu">
              <X size={21} />
            </button>
          </div>
          <div className="mobile-menu-links">
            {menu.map(({ category }, position) => (
              <button
                type="button"
                key={category}
                style={{ "--i": position } as CSSProperties}
                onClick={() => go(() => shop({ category }))}
              >
                <span className="mega-swatch" style={{ background: categoryMeta[category].tint }} />
                {categoryMeta[category].name}
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          <div className="mobile-menu-secondary">
            <button type="button" onClick={() => go(() => shop({ saleOnly: true }))}>Offres du moment</button>
            <Link href="/marques" onClick={() => setMenuOpen(false)}>
              Nos marques
            </Link>
            <button type="button" onClick={() => go(() => goTo("instagram"))}>Instagram &amp; TikTok</button>
          </div>
          <div className="mobile-menu-social">
            <a href={site.instagram.url} target="_blank" rel="noreferrer">
              <InstagramIcon size={18} /> @{site.instagram.handle}
            </a>
            <a href={site.tiktok.url} target="_blank" rel="noreferrer">
              <TikTokIcon size={18} /> @{site.tiktok.handle}
            </a>
          </div>
        </aside>
      </div>
    </>
  );
}
