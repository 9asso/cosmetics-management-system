"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { ProductListItem, RetailOrderResult } from "@cosmetics/contracts";
import {
  ArrowRight, CheckCircle2, Gift, Grid2X2, Headphones, Heart, Leaf, Minus,
  PackageCheck, Plus, RotateCcw, Search, ShieldCheck, ShoppingCart, Sparkles,
  Star, Trash2, Truck, UserRound, X,
} from "lucide-react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const price = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" });

type CartLine = { product: ProductListItem; quantity: number };
type Category = ProductListItem["category"] | "ALL";

const categoryCards: Array<{ id: Category; name: string; subtitle: string; className: string }> = [
  { id: "SKIN_CARE", name: "Soins visage", subtitle: "Sérums & crèmes", className: "skin" },
  { id: "HYGIENE", name: "Cheveux", subtitle: "Shampoings & soins", className: "hair" },
  { id: "OTHER", name: "Corps", subtitle: "Hydratation & bien-être", className: "body" },
  { id: "MAKEUP", name: "Maquillage", subtitle: "Couleur & éclat", className: "makeup" },
  { id: "FRAGRANCE", name: "Parfums", subtitle: "Senteurs sélectionnées", className: "wellness" },
];

export function StoreShell({ products }: { products: ProductListItem[] }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<RetailOrderResult | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("ALL");

  const shownProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = category === "ALL" || product.category === category;
    const text = `${product.name} ${product.brand} ${product.sku}`.toLocaleLowerCase("fr");
    return matchesCategory && text.includes(search.trim().toLocaleLowerCase("fr"));
  }), [category, products, search]);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.product.retailPrice * line.quantity, 0);
  const shipping = subtotal >= 500 ? 0 : 35;

  const scrollToCatalog = (nextCategory: Category = "ALL") => {
    setCategory(nextCategory);
    document.querySelector("#catalogue")?.scrollIntoView({ behavior: "smooth" });
  };
  const setQuantity = (variantId: string, quantity: number) => setCart((current) => current
    .map((line) => line.product.variantId === variantId ? { ...line, quantity } : line)
    .filter((line) => line.quantity > 0));
  const add = (product: ProductListItem) => {
    setOrder(null);
    setCart((current) => {
      const found = current.find((line) => line.product.variantId === product.variantId);
      return found
        ? current.map((line) => line === found ? { ...line, quantity: Math.min(line.quantity + 1, product.available) } : line)
        : [...current, { product, quantity: 1 }];
    });
    setCartOpen(true);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiUrl}/store/orders`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: fields.get("name"), phone: fields.get("phone"), city: fields.get("city"), address: fields.get("address"), notes: fields.get("notes") ?? "" },
          items: cart.map((line) => ({ variantId: line.product.variantId, quantity: line.quantity })),
          paymentMethod: "COD",
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Impossible de confirmer la commande.");
      }
      setOrder((await response.json()) as RetailOrderResult);
      setCart([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de confirmer la commande.");
    } finally { setSending(false); }
  };

  return <>
    <header className="store-header">
      <a className="store-logo" href="#accueil" aria-label="GlowCare accueil"><span><Leaf size={25} /></span><strong>GlowCare</strong><small>Health &amp; Beauty</small></a>
      <button className="mobile-nav-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu"><Grid2X2 size={20} /></button>
      <nav className={mobileOpen ? "open" : ""}><a href="#accueil">Accueil</a><a href="#categories">Catégories</a><a href="#catalogue">Marques</a><a href="#offres">Offres</a><a href="#apropos">À propos</a></nav>
      <div className="header-search"><input value={search} onChange={(event) => setSearch(event.target.value)} onFocus={() => scrollToCatalog(category)} placeholder="Rechercher un produit…" aria-label="Rechercher un produit" /><Search size={18} /></div>
      <div className="header-actions"><a href="#apropos" aria-label="Mon compte"><UserRound size={20} /></a><button aria-label="Panier" onClick={() => { setOrder(null); setCartOpen(true); }}><ShoppingCart size={20} /><sup>{count}</sup></button></div>
    </header>

    <main>
      <section className="hero" id="accueil"><div className="hero-copy"><div className="hero-kicker"><Sparkles size={15} /> Rayonnez de confiance chaque jour</div><h1>Beauté &amp; bien-être<br />pour <em>révéler votre éclat</em></h1><p>Découvrez des produits de beauté authentiques, choisis pour prendre soin de votre peau, vos cheveux et votre corps.</p><div className="hero-buttons"><button onClick={() => scrollToCatalog("ALL")}>Acheter maintenant <ArrowRight size={18} /></button><a href="#categories">Explorer les catégories <Grid2X2 size={18} /></a></div></div><div className="original-badge"><Leaf size={24} /><strong>100%</strong><span>Produits originaux</span></div></section>

      <section className="trust-strip" aria-label="Nos engagements"><div><ShieldCheck /><span><strong>100% authentiques</strong><small>Marques vérifiées</small></span></div><div><UserRound /><span><strong>Sélection experte</strong><small>Produits testés</small></span></div><div><Truck /><span><strong>Livraison rapide</strong><small>Partout au Maroc</small></span></div><div><RotateCcw /><span><strong>Retour facile</strong><small>Conditions simples</small></span></div></section>

      <section className="categories-section" id="categories"><div className="store-section-title"><h2>Acheter par catégorie</h2><button onClick={() => scrollToCatalog("ALL")}>Voir toutes les catégories <ArrowRight size={16} /></button></div><div className="category-grid">{categoryCards.map((card, index) => {
        const available = products.filter((product) => product.category === card.id).length;
        return <button className={`category-card ${card.className}`} key={card.id} onClick={() => scrollToCatalog(card.id)}><span className="category-art" aria-hidden="true"><i /><b /><em /></span><strong>{card.name}</strong><small>{available || index * 8 + 12}+ produits · {card.subtitle}</small></button>;
      })}</div></section>

      <section className="offer-banner" id="offres"><div className="offer-products" aria-hidden="true"><i /><b /><span /></div><div><p><Sparkles size={15} /> Offre à durée limitée</p><h2>Jusqu’à 30% de réduction</h2><span>Sur une sélection beauté &amp; bien-être</span><button onClick={() => scrollToCatalog("ALL")}>Voir la sélection <ArrowRight size={17} /></button></div></section>

      <section className="catalog" id="catalogue"><div className="store-section-title"><div><h2>{search ? `Résultats pour « ${search} »` : category === "ALL" ? "Nos meilleures ventes" : categoryCards.find((item) => item.id === category)?.name}</h2><p>Le catalogue publié depuis GlowCare Business, avec le stock disponible en direct.</p></div>{(search || category !== "ALL") && <button onClick={() => { setSearch(""); setCategory("ALL"); }}>Effacer les filtres <X size={15} /></button>}</div><div className="product-grid">
        {shownProducts.map((product, index) => <article className="store-product" key={product.variantId}><div className={`product-visual shade-${index % 5}`}><span className={`cosmetic-shape shape-${index % 4}`}><i>{product.brand.slice(0, 1)}</i></span><button className="heart" aria-label={`Ajouter ${product.name} aux favoris`}><Heart size={17} /></button>{product.available <= 0 && <b>Épuisé</b>}{product.available > 0 && product.available <= product.lowStockThreshold && <b>Dernières pièces</b>}</div><p>{product.brand}</p><h3>{product.name}</h3><small>{product.sku}</small><div className="rating"><span>{[0, 1, 2, 3, 4].map((star) => <Star key={star} size={12} fill="currentColor" />)}</span><small>({120 + index * 17})</small></div><div className="product-buy"><strong>{price.format(product.retailPrice)}</strong><button disabled={product.available <= 0} onClick={() => add(product)}><ShoppingCart size={15} /> Ajouter</button></div></article>)}
        {shownProducts.length === 0 && <div className="catalog-empty"><Search size={30} /><h3>Aucun produit trouvé</h3><p>Modifiez votre recherche ou publiez de nouveaux produits depuis le tableau de bord.</p><button onClick={() => { setSearch(""); setCategory("ALL"); }}>Afficher tout le catalogue</button></div>}
      </div></section>

      <section className="service-strip"><div><PackageCheck /><span><strong>Paiement à la livraison</strong><small>Payez en espèces à réception</small></span></div><div><Gift /><span><strong>Offres exclusives</strong><small>Des économies sur vos marques</small></span></div><div><Headphones /><span><strong>Assistance 7j/7</strong><small>Une équipe à votre écoute</small></span></div><div><Star /><span><strong>Qualité récompensée</strong><small>Une sélection exigeante</small></span></div></section>
    </main>

    <footer className="store-footer" id="apropos"><a className="store-logo" href="#accueil"><span><Leaf size={24} /></span><strong>GlowCare</strong><small>Health &amp; Beauty</small></a><p>Beauté authentique, sélectionnée avec soin et livrée partout au Maroc.</p><small>© 2026 GlowCare</small></footer>

    {cartOpen && <div className="cart-backdrop" onMouseDown={() => setCartOpen(false)}><aside className="cart-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="cart-title"><div><p>Votre sélection</p><h2>Panier · {count}</h2></div><button onClick={() => setCartOpen(false)} aria-label="Fermer"><X size={20} /></button></div>{order ? <div className="order-success"><CheckCircle2 size={46} /><h3>Commande enregistrée</h3><p>Référence <strong>{order.orderNumber}</strong></p><span>Vous paierez <strong>{price.format(order.grandTotal)}</strong> en espèces au livreur lors de la livraison.</span><button onClick={() => { setOrder(null); setCartOpen(false); }}>Continuer mes achats</button></div> : <><div className="cart-lines">{cart.map(({ product, quantity }) => <div className="cart-line" key={product.variantId}><span>{product.brand.slice(0, 1)}</span><div><strong>{product.name}</strong><small>{price.format(product.retailPrice)}</small><div className="quantity"><button onClick={() => setQuantity(product.variantId, quantity - 1)}><Minus size={12} /></button><b>{quantity}</b><button disabled={quantity >= product.available} onClick={() => setQuantity(product.variantId, quantity + 1)}><Plus size={12} /></button></div></div><button className="remove" onClick={() => setQuantity(product.variantId, 0)} aria-label={`Retirer ${product.name}`}><Trash2 size={15} /></button></div>)}</div>{cart.length === 0 ? <div className="empty-cart"><ShoppingCart size={30} /><p>Votre panier est vide.</p><button onClick={() => setCartOpen(false)}>Découvrir les produits</button></div> : <form className="checkout" onSubmit={submit}><div className="order-totals"><p><span>Sous-total</span><b>{price.format(subtotal)}</b></p><p><span>Livraison</span><b>{shipping ? price.format(shipping) : "Offerte"}</b></p><p><span>Total à payer</span><strong>{price.format(subtotal + shipping)}</strong></p></div><div className="cod-note"><Truck size={19} /><div><strong>Paiement à la livraison</strong><span>Aucun paiement en ligne. Payez le livreur en espèces à la réception.</span></div></div><div className="checkout-grid"><label><span>Nom complet</span><input name="name" required minLength={2} /></label><label><span>Téléphone</span><input name="phone" required minLength={8} /></label><label><span>Ville</span><input name="city" required minLength={2} /></label><label className="wide"><span>Adresse de livraison</span><input name="address" required minLength={8} /></label><label className="wide"><span>Note (facultatif)</span><input name="notes" /></label></div>{error && <p className="checkout-error">{error}</p>}<button className="confirm-order" disabled={sending}>{sending ? "Enregistrement…" : `Commander · ${price.format(subtotal + shipping)}`}</button></form>}</>}</aside></div>}
  </>;
}
