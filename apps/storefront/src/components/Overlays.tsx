"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type FormEvent, type SetStateAction } from "react";
import Link from "next/link";
import { computeDiscount, type ProductListItem, type RetailOrderResult, type StoreDiscount } from "@cosmetics/contracts";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  Check,
  CircleAlert,
  CircleDollarSign,
  Heart,
  Info,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  TicketPercent,
  Trash2,
  Truck,
  Undo2,
  X,
} from "lucide-react";
import {
  allCategories,
  categoryMeta,
  discountPercent,
  formatPrice,
  matchesQuery,
  normalize,
  productImages,
  rankBrands,
  type CartLine,
} from "@/lib/catalog";
import { brandHref } from "@/lib/brands";
import type { ShippingSettings } from "@/lib/products";
import { HundredIcon } from "./icons";
import { ProductGallery } from "./ProductGallery";
import { useStore, type InfoTopic } from "./store-context";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

/** Keeps an element mounted long enough to play its exit transition. */
export function usePresence(open: boolean, duration = 360) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), duration);
    return () => window.clearTimeout(timer);
  }, [duration, open]);
  return { mounted, visible };
}

/* ---------------------------------- Cart --------------------------------- */

export function CartDrawer({
  open,
  onClose,
  cart,
  setQuantity,
  discount,
  setDiscount,
  onOrdered,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartLine[];
  setQuantity: (variantId: string, quantity: number) => void;
  discount: StoreDiscount | null;
  setDiscount: Dispatch<SetStateAction<StoreDiscount | null>>;
  onOrdered: () => void;
}) {
  const { products, add, demo, openProduct, shipping: rules } = useStore();
  const { mounted, visible } = usePresence(open);
  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<RetailOrderResult | null>(null);

  useEffect(() => {
    if (!open) {
      const timer = window.setTimeout(() => {
        setStep("cart");
        setError("");
        setOrder(null);
      }, 400);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.product.retailPrice * line.quantity, 0);
  const shipping = subtotal >= rules.freeShippingThreshold || subtotal === 0 ? 0 : rules.shippingFee;
  const remaining = Math.max(0, rules.freeShippingThreshold - subtotal);
  // Mirrors StorefrontService.createOrder: free shipping is earned before the code applies.
  const reduction = discount ? computeDiscount(discount, subtotal) : 0;
  const total = subtotal - reduction + shipping;
  const suggestions = useMemo(
    () =>
      products
        .filter((product) => product.available > 0 && !cart.some((line) => line.product.variantId === product.variantId))
        .sort((a, b) => discountPercent(b) - discountPercent(a))
        .slice(0, 3),
    [cart, products],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (demo) return;
    setSending(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiUrl}/store/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            name: fields.get("name"),
            phone: fields.get("phone"),
            city: fields.get("city"),
            address: fields.get("address"),
            notes: fields.get("notes") ?? "",
          },
          items: cart.map((line) => ({ variantId: line.product.variantId, quantity: line.quantity })),
          paymentMethod: "COD",
          // A code below its minimum is kept in the cart but not sent, so the order still goes through.
          discountCode: reduction > 0 ? discount?.code : undefined,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(body.message) ? body.message[0] : body.message;
        throw new Error(message ?? "Impossible de confirmer la commande.");
      }
      setOrder((await response.json()) as RetailOrderResult);
      onOrdered();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de confirmer la commande.");
    } finally {
      setSending(false);
    }
  };

  if (!mounted) return null;
  return (
    <div className={`overlay overlay-drawer ${visible ? "is-visible" : ""}`}>
      <div className="overlay-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Panier">
        <header className="drawer-head">
          {step === "checkout" && !order ? (
            <button type="button" className="icon-button" onClick={() => setStep("cart")} aria-label="Retour au panier">
              <ArrowLeft size={20} />
            </button>
          ) : null}
          <div>
            <small>{order ? "Merci !" : step === "checkout" ? "Livraison" : "Votre sélection"}</small>
            <h2>{order ? "Commande confirmée" : step === "checkout" ? "Finaliser la commande" : `Panier · ${count}`}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer le panier">
            <X size={20} />
          </button>
        </header>

        {order ? (
          <div className="order-success">
            <svg className="success-check" viewBox="0 0 52 52" aria-hidden="true">
              <circle cx="26" cy="26" r="24" />
              <path d="M15 27 l7 7 l15 -16" />
            </svg>
            <h3>Commande enregistrée</h3>
            <p>
              Référence <strong>{order.orderNumber}</strong>
            </p>
            <span>
              Vous paierez <strong>{formatPrice(order.grandTotal)}</strong> en espèces au livreur à la réception.
            </span>
            <button type="button" className="button button-primary" onClick={onClose}>
              Continuer mes achats
            </button>
          </div>
        ) : cart.length === 0 ? (
          <div className="cart-empty">
            <span className="cart-empty-icon">
              <ShoppingBag size={30} />
            </span>
            <h3>Votre panier est vide</h3>
            <p>Laissez-vous tenter par nos coups de cœur du moment.</p>
            <div className="cart-suggestions">
              {suggestions.map((product) => (
                <div key={product.variantId} className="cart-suggestion">
                  <button type="button" onClick={() => openProduct(product)}>
                    <img src={productImages(product)[0]} alt="" />
                    <span>
                      <small>{product.brand}</small>
                      {product.name}
                    </span>
                  </button>
                  <button type="button" className="round-button round-small" onClick={() => add(product)} aria-label={`Ajouter ${product.name}`}>
                    <Plus size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`drawer-steps step-${step}`}>
            <div className="drawer-step">
              <div className="shipping-meter">
                <p>
                  <Truck size={16} />
                  {remaining > 0 ? (
                    <>
                      Plus que <strong>{formatPrice(remaining)}</strong> pour la livraison offerte
                    </>
                  ) : (
                    <>
                      <strong>Livraison offerte</strong> sur votre commande 🎉
                    </>
                  )}
                </p>
                <span>
                  <i style={{ transform: `scaleX(${rules.freeShippingThreshold > 0 ? Math.min(1, subtotal / rules.freeShippingThreshold) : 1})` }} />
                </span>
              </div>
              <ul className="cart-lines">
                {cart.map(({ product, quantity }) => (
                  <li key={product.variantId} className="cart-line">
                    <button type="button" className="cart-line-image" onClick={() => openProduct(product)}>
                      {productImages(product)[0] ? <img src={productImages(product)[0]} alt="" /> : <span>{product.brand.slice(0, 1)}</span>}
                    </button>
                    <div className="cart-line-copy">
                      <small>{product.brand}</small>
                      <strong>{product.name}</strong>
                      <div className="cart-line-row">
                        <div className="stepper">
                          <button type="button" onClick={() => setQuantity(product.variantId, quantity - 1)} aria-label="Retirer un">
                            <Minus size={13} />
                          </button>
                          <b>{quantity}</b>
                          <button
                            type="button"
                            disabled={quantity >= product.available}
                            onClick={() => setQuantity(product.variantId, quantity + 1)}
                            aria-label="Ajouter un"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <span>{formatPrice(product.retailPrice * quantity)}</span>
                      </div>
                    </div>
                    <button type="button" className="cart-line-remove" onClick={() => setQuantity(product.variantId, 0)} aria-label={`Retirer ${product.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="drawer-foot">
                <DiscountCodeField discount={discount} setDiscount={setDiscount} subtotal={subtotal} />
                <dl className="totals">
                  <div>
                    <dt>Sous-total</dt>
                    <dd>{formatPrice(subtotal)}</dd>
                  </div>
                  {reduction > 0 && discount && (
                    <div className="totals-discount">
                      <dt>Réduction · {discount.code}</dt>
                      <dd>-{formatPrice(reduction)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Livraison</dt>
                    <dd>{shipping ? formatPrice(shipping) : "Offerte"}</dd>
                  </div>
                  <div className="totals-grand">
                    <dt>Total</dt>
                    <dd>{formatPrice(total)}</dd>
                  </div>
                </dl>
                <button type="button" className="button button-primary button-block" onClick={() => setStep("checkout")}>
                  Passer commande <ArrowRight size={18} />
                </button>
                <p className="drawer-note">
                  <BadgeCheck size={15} /> Paiement en espèces à la livraison, aucune carte requise.
                </p>
              </div>
            </div>

            <form className="drawer-step checkout" onSubmit={submit}>
              <div className="cod-note">
                <Truck size={20} />
                <div>
                  <strong>Paiement à la livraison</strong>
                  <span>Vous réglez {formatPrice(total)} en espèces à la réception.</span>
                </div>
              </div>
              <div className="field-grid">
                <label className="field">
                  <input name="name" required minLength={2} placeholder=" " autoComplete="name" />
                  <span>Nom complet</span>
                </label>
                <label className="field">
                  <input name="phone" type="tel" required minLength={8} placeholder=" " autoComplete="tel" />
                  <span>Téléphone</span>
                </label>
                <label className="field">
                  <input name="city" required minLength={2} placeholder=" " autoComplete="address-level2" />
                  <span>Ville</span>
                </label>
                <label className="field field-wide">
                  <input name="address" required minLength={8} placeholder=" " autoComplete="street-address" />
                  <span>Adresse de livraison</span>
                </label>
                <label className="field field-wide">
                  <input name="notes" placeholder=" " />
                  <span>Note pour le livreur (facultatif)</span>
                </label>
              </div>
              {demo && (
                <p className="checkout-demo">
                  <Info size={16} /> Boutique en mode aperçu : les commandes seront ouvertes dès la mise en ligne du catalogue.
                </p>
              )}
              {error && <p className="checkout-error">{error}</p>}
              <button className="button button-primary button-block" disabled={sending || demo}>
                {sending ? <span className="spinner" aria-hidden="true" /> : null}
                {sending ? "Enregistrement…" : `Confirmer · ${formatPrice(total)}`}
              </button>
            </form>
          </div>
        )}
      </aside>
    </div>
  );
}

function DiscountCodeField({
  discount,
  setDiscount,
  subtotal,
}: {
  discount: StoreDiscount | null;
  setDiscount: Dispatch<SetStateAction<StoreDiscount | null>>;
  subtotal: number;
}) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const apply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const wanted = code.trim().toUpperCase();
    if (!wanted) return;
    setChecking(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/store/discount-codes/${encodeURIComponent(wanted)}`);
      if (response.ok) {
        setDiscount((await response.json()) as StoreDiscount);
        setCode("");
      } else {
        setError(response.status === 404 ? "Ce code n’est pas valide ou a expiré." : "Impossible de vérifier le code pour le moment.");
      }
    } catch {
      setError("Impossible de vérifier le code pour le moment.");
    } finally {
      setChecking(false);
    }
  };

  if (discount) {
    const missing = discount.minSubtotal - subtotal;
    const saving = computeDiscount(discount, subtotal);
    return (
      <div className={`coupon is-applied ${missing > 0 ? "is-pending" : ""}`} key={discount.code}>
        <span className="coupon-stub" aria-hidden="true">
          {discount.type === "PERCENT" ? (
            <>
              <b>-{discount.value}%</b>
            </>
          ) : (
            <>
              <b>-{discount.value}</b>
              <small>MAD</small>
            </>
          )}
        </span>
        <span className="coupon-body">
          <span className="coupon-copy">
            <strong>
              {missing <= 0 && <Check size={14} />}
              {discount.code}
            </strong>
            <small>
              {missing > 0 ? (
                <>
                  Encore <b>{formatPrice(missing)}</b> d’achats pour l’activer
                </>
              ) : (
                <>
                  Vous économisez <b>{formatPrice(saving)}</b>
                </>
              )}
            </small>
          </span>
          <button type="button" className="coupon-remove" onClick={() => setDiscount(null)} aria-label={`Retirer le code ${discount.code}`}>
            <X size={15} />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="coupon-wrap">
      <form className={`coupon ${error ? "has-error" : ""}`} onSubmit={apply} key={error}>
        <span className="coupon-stub" aria-hidden="true">
          <TicketPercent size={22} />
          <small>Promo</small>
        </span>
        <label className="coupon-body">
          <input
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              setError("");
            }}
            placeholder="Code de réduction"
            aria-label="Code de réduction"
            aria-invalid={Boolean(error)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
          />
          <button type="submit" className="coupon-apply" disabled={!code.trim() || checking}>
            {checking ? <span className="spinner" aria-hidden="true" /> : "Appliquer"}
          </button>
        </label>
      </form>
      {error && (
        <p className="coupon-error" role="alert">
          <CircleAlert size={14} /> {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------- Quick view ------------------------------- */

export function QuickView({ product, onClose }: { product: ProductListItem | null; onClose: () => void }) {
  const { add, favorites, toggleFavorite, shipping } = useStore();
  // Keep showing the last product while the exit transition plays.
  const [shown, setShown] = useState(product);
  const { mounted, visible } = usePresence(Boolean(product));
  const [quantity, setQuantity] = useState(1);
  const [expanded, setExpanded] = useState(false);
  if (product && product !== shown) {
    setShown(product);
    setQuantity(1);
    setExpanded(false);
  }

  if (!mounted || !shown) return null;
  const discount = discountPercent(shown);
  const favorite = favorites.includes(shown.variantId);
  return (
    <div className={`overlay overlay-modal ${visible ? "is-visible" : ""}`}>
      <div className="overlay-backdrop" onClick={onClose} />
      <section className="quickview" role="dialog" aria-modal="true" aria-label={shown.name}>
        <button type="button" className="icon-button quickview-close" onClick={onClose} aria-label="Fermer">
          <X size={20} />
        </button>
        <ProductGallery key={shown.variantId} product={shown} />
        <div className="quickview-copy">
          <Link className="eyebrow quickview-brand" href={brandHref(shown.brand)} onClick={onClose}>
            {shown.brand}
          </Link>
          <h2>{shown.name}</h2>
          <div className="quickview-meta">
            <span className="quickview-category">{categoryMeta[shown.category].name}</span>
            {shown.subcategory && <span>{shown.subcategory}</span>}
            <span className="quickview-authentic">
              <BadgeCheck size={14} /> Authentique
            </span>
          </div>
          <div className="quickview-price">
            <strong>{formatPrice(shown.retailPrice)}</strong>
            {discount > 0 && shown.compareAtPrice && (
              <>
                <del>{formatPrice(shown.compareAtPrice)}</del>
                <span className="badge badge-sale">-{discount}%</span>
              </>
            )}
          </div>
          <p className={`quickview-description ${expanded ? "is-expanded" : ""}`}>
            {shown.description || "Produit cosmétique authentique, sélectionné avec soin par Yamoura."}
          </p>
          {shown.description.length > 220 && (
            <button type="button" className="link-button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? "Réduire" : "Lire la suite"}
            </button>
          )}
          <p className={`quickview-stock ${shown.available <= 0 ? "is-out" : shown.available <= shown.lowStockThreshold ? "is-low" : ""}`}>
            <i />
            {shown.available <= 0
              ? "Bientôt de retour"
              : shown.available <= shown.lowStockThreshold
                ? "Dernières pièces disponibles"
                : "En stock, prêt à être expédié"}
          </p>
          <div className="quickview-buy">
            <div className="stepper stepper-large">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Diminuer la quantité">
                <Minus size={15} />
              </button>
              <b>{quantity}</b>
              <button
                type="button"
                disabled={quantity >= shown.available}
                onClick={() => setQuantity((value) => Math.min(shown.available, value + 1))}
                aria-label="Augmenter la quantité"
              >
                <Plus size={15} />
              </button>
            </div>
            <button
              type="button"
              className="button button-primary"
              disabled={shown.available <= 0}
              onClick={() => {
                add(shown, quantity);
                onClose();
              }}
            >
              <ShoppingBag size={18} /> Ajouter · {formatPrice(shown.retailPrice * quantity)}
            </button>
            <button
              type="button"
              className={`round-button quickview-fav ${favorite ? "is-on" : ""}`}
              aria-pressed={favorite}
              onClick={() => toggleFavorite(shown.variantId)}
              aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            >
              <Heart size={18} fill={favorite ? "currentColor" : "none"} />
            </button>
          </div>
          <small className="quickview-ref">Réf. {shown.sku}</small>
          <ul className="quickview-assurances">
            <li>
              <HundredIcon size={22} /> Produits 100% authentiques
            </li>
            <li>
              <Truck size={21} /> Livraison rapide partout au Maroc en 24h
            </li>
            <li>
              <CircleDollarSign size={21} /> Livraison gratuite à partir de {shipping.freeShippingThreshold}Dh
            </li>
            <li>
              <Undo2 size={21} /> Politique de retour et remboursement
            </li>
            <li>
              <Award size={21} /> Satisfaction garantie
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

/* --------------------------------- Search --------------------------------- */

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { products, shop, openProduct } = useStore();
  const { mounted, visible } = usePresence(open);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) input.current?.focus();
  }, [visible]);

  const results = useMemo(() => (query.trim() ? products.filter((product) => matchesQuery(product, query)).slice(0, 8) : []), [products, query]);
  const brands = useMemo(() => rankBrands(products), [products]);
  const brandHits = query.trim() ? brands.filter((brand) => normalize(brand.name).includes(normalize(query.trim()))).slice(0, 6) : brands.slice(0, 8);
  const categories = allCategories.filter((category) => products.some((product) => product.category === category));

  const close = () => {
    onClose();
    window.setTimeout(() => setQuery(""), 400);
  };
  if (!mounted) return null;
  return (
    <div className={`overlay overlay-search ${visible ? "is-visible" : ""}`}>
      <div className="overlay-backdrop" onClick={close} />
      <div className="search-panel" role="dialog" aria-modal="true" aria-label="Recherche">
        <form
          className="search-field"
          onSubmit={(event) => {
            event.preventDefault();
            shop({ query });
            close();
          }}
        >
          <Search size={22} />
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sérum, mascara, Rare Beauty…"
            aria-label="Rechercher"
          />
          <button type="button" className="icon-button" onClick={close} aria-label="Fermer la recherche">
            <X size={20} />
          </button>
        </form>

        <div className="search-body">
          {query.trim() && results.length === 0 && brandHits.length === 0 && (
            <p className="search-empty">Aucun résultat pour « {query} ». Essayez une marque ou une catégorie.</p>
          )}
          {results.length > 0 && (
            <div className="search-group">
              <h3>Produits</h3>
              <ul className="search-results">
                {results.map((product, index) => (
                  <li key={product.variantId} style={{ "--i": index } as CSSProperties}>
                    <button
                      type="button"
                      onClick={() => {
                        openProduct(product);
                        close();
                      }}
                    >
                      <span className="search-thumb">{productImages(product)[0] && <img src={productImages(product)[0]} alt="" />}</span>
                      <span className="search-copy">
                        <small>{product.brand}</small>
                        {product.name}
                      </span>
                      <strong>{formatPrice(product.retailPrice)}</strong>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  shop({ query });
                  close();
                }}
              >
                Voir tous les résultats <ArrowRight size={15} />
              </button>
            </div>
          )}
          {brandHits.length > 0 && (
            <div className="search-group">
              <h3>{query.trim() ? "Marques" : "Marques populaires"}</h3>
              <div className="chip-row chip-row-wrap">
                {brandHits.map((brand) => (
                  <Link key={brand.name} className="chip" href={brandHref(brand.name)} onClick={close}>
                    {brand.name}
                  </Link>
                ))}
                {!query.trim() && (
                  <Link className="chip chip-soft" href="/marques" onClick={close}>
                    Toutes les marques <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            </div>
          )}
          {!query.trim() && (
            <div className="search-group">
              <h3>Catégories</h3>
              <div className="search-categories">
                {categories.map((category) => (
                  <button
                    type="button"
                    key={category}
                    style={{ background: categoryMeta[category].tint, color: categoryMeta[category].accent }}
                    onClick={() => {
                      shop({ category });
                      close();
                    }}
                  >
                    {categoryMeta[category].name}
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Info ---------------------------------- */

const infoCopy = (shipping: ShippingSettings): Record<InfoTopic, { title: string; body: string }> => ({
  delivery: {
    title: "Livraison",
    body: `La livraison est facturée ${shipping.shippingFee} MAD et offerte dès ${shipping.freeShippingThreshold} MAD d’achats. Le montant exact apparaît dans votre panier avant confirmation. Indiquez une adresse complète et un numéro de téléphone joignable.`,
  },
  payment: {
    title: "Paiement à la livraison",
    body: "Aucune carte bancaire ni paiement en ligne n’est nécessaire. Votre commande est enregistrée avec une référence, puis vous réglez le montant total en espèces au livreur à la réception.",
  },
  howto: {
    title: "Comment commander",
    body: "1. Ajoutez vos produits au panier. 2. Renseignez votre nom, téléphone et adresse. 3. Confirmez : nous vous appelons si besoin, puis vous payez en espèces à la livraison.",
  },
  demo: {
    title: "Mode aperçu",
    body: "La boutique affiche actuellement un catalogue de démonstration en attendant la publication du catalogue en ligne. Les commandes sont désactivées dans ce mode.",
  },
});

export function InfoModal({ topic, onClose }: { topic: InfoTopic | null; onClose: () => void }) {
  const [shown, setShown] = useState(topic);
  if (topic && topic !== shown) setShown(topic);
  const { mounted, visible } = usePresence(Boolean(topic));
  const { shipping } = useStore();
  if (!mounted || !shown) return null;
  const copy = infoCopy(shipping)[shown];
  return (
    <div className={`overlay overlay-modal ${visible ? "is-visible" : ""}`}>
      <div className="overlay-backdrop" onClick={onClose} />
      <section className="info-modal" role="dialog" aria-modal="true" aria-label={copy.title}>
        <button type="button" className="icon-button quickview-close" onClick={onClose} aria-label="Fermer">
          <X size={20} />
        </button>
        <span className="info-icon">
          <Info size={24} />
        </span>
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
        <button type="button" className="button button-dark" onClick={onClose}>
          C’est compris
        </button>
      </section>
    </div>
  );
}

/* ---------------------------------- Toast --------------------------------- */

export function CartToast({
  toast,
  onOpenCart,
  onDismiss,
}: {
  toast: { product: ProductListItem; id: number } | null;
  onOpenCart: () => void;
  onDismiss: () => void;
}) {
  const [shown, setShown] = useState(toast);
  if (toast && toast !== shown) setShown(toast);
  const { mounted, visible } = usePresence(Boolean(toast), 300);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 3400);
    return () => window.clearTimeout(timer);
  }, [onDismiss, toast]);
  if (!mounted || !shown) return null;
  return (
    <div className={`toast ${visible ? "is-visible" : ""}`} role="status">
      <span className="toast-thumb">
        {productImages(shown.product)[0] && <img src={productImages(shown.product)[0]} alt="" />}
        <i>
          <BadgeCheck size={14} />
        </i>
      </span>
      <span className="toast-copy">
        <strong>Ajouté au panier</strong>
        <small>{shown.product.name}</small>
      </span>
      <button
        type="button"
        className="button button-dark button-small"
        onClick={() => {
          onDismiss();
          onOpenCart();
        }}
      >
        Voir le panier
      </button>
    </div>
  );
}
