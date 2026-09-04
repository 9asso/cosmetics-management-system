"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { ProductListItem, RetailOrderResult } from "@cosmetics/contracts";
import {
  CheckCircle2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const price = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
});

type CartLine = { product: ProductListItem; quantity: number };

export function StoreShell({
  products,
  children,
}: {
  products: ProductListItem[];
  children: ReactNode;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<RetailOrderResult | null>(null);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce(
    (sum, line) => sum + line.product.retailPrice * line.quantity,
    0,
  );
  const shipping = subtotal >= 500 ? 0 : 35;

  const setQuantity = (variantId: string, quantity: number) => {
    setCart((current) =>
      current
        .map((line) =>
          line.product.variantId === variantId ? { ...line, quantity } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };
  const add = (product: ProductListItem) => {
    setCart((current) => {
      const found = current.find(
        (line) => line.product.variantId === product.variantId,
      );
      return found
        ? current.map((line) =>
            line === found
              ? {
                  ...line,
                  quantity: Math.min(line.quantity + 1, product.available),
                }
              : line,
          )
        : [...current, { product, quantity: 1 }];
    });
    setOpen(true);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
          items: cart.map((line) => ({
            variantId: line.product.variantId,
            quantity: line.quantity,
          })),
          paymentMethod: "COD",
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? "Impossible de confirmer la commande.");
      }
      setOrder((await response.json()) as RetailOrderResult);
      setCart([]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Impossible de confirmer la commande.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="announcement">
        Livraison offerte à Casablanca dès 500 MAD
      </div>
      <header className="store-header">
        <a className="store-logo" href="#">
          MAISON <i>ÉLAN</i>
        </a>
        <nav>
          <a href="#nouveautes">Nouveautés</a>
          <a href="#catalogue">Visage</a>
          <a href="#catalogue">Parfums</a>
          <a href="#catalogue">Corps</a>
        </nav>
        <div className="header-actions">
          <button aria-label="Rechercher">
            <Search size={19} />
          </button>
          <button aria-label="Panier" onClick={() => setOpen(true)}>
            <ShoppingBag size={19} />
            <sup>{count}</sup>
          </button>
        </div>
      </header>
      {children}
      <section className="catalog" id="catalogue">
        <div className="section-title">
          <div>
            <p>Nos essentiels</p>
            <h2>La sélection du moment</h2>
          </div>
          <a href="#catalogue">Voir tout</a>
        </div>
        <div className="product-grid">
          {products.map((product, index) => (
            <article className="store-product" key={product.variantId}>
              <div className={`product-visual shade-${index % 4}`}>
                <span>{product.brand.slice(0, 1)}</span>
                {product.onHand <= 0 && <b>Épuisé</b>}
              </div>
              <p>{product.brand}</p>
              <h3>{product.name}</h3>
              <div>
                <strong>{price.format(product.retailPrice)}</strong>
                <button
                  disabled={product.available <= 0}
                  onClick={() => add(product)}
                  aria-label={`Ajouter ${product.name} au panier`}
                >
                  <ShoppingBag size={16} />
                </button>
              </div>
            </article>
          ))}
          {products.length === 0 && (
            <div className="catalog-empty">
              <h3>La collection arrive bientôt</h3>
              <p>
                Les produits publiés depuis l’application de gestion
                apparaîtront automatiquement ici.
              </p>
            </div>
          )}
        </div>
      </section>
      <footer>
        <a className="store-logo" href="#">
          MAISON <i>ÉLAN</i>
        </a>
        <p>Beauté authentique. Sélection marocaine.</p>
        <small>© 2026 Maison Élan</small>
      </footer>

      {open && (
        <div className="cart-backdrop" onMouseDown={() => setOpen(false)}>
          <aside
            className="cart-drawer"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cart-title">
              <div>
                <p>Votre sélection</p>
                <h2>Panier · {count}</h2>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fermer">
                <X size={20} />
              </button>
            </div>
            {order ? (
              <div className="order-success">
                <CheckCircle2 size={42} />
                <h3>Commande confirmée</h3>
                <p>
                  Référence <strong>{order.orderNumber}</strong>
                </p>
                <span>
                  Vous paierez <strong>{price.format(order.grandTotal)}</strong>{" "}
                  en espèces au livreur lors de la livraison.
                </span>
                <button
                  onClick={() => {
                    setOrder(null);
                    setOpen(false);
                  }}
                >
                  Continuer mes achats
                </button>
              </div>
            ) : (
              <>
                <div className="cart-lines">
                  {cart.map(({ product, quantity }) => (
                    <div className="cart-line" key={product.variantId}>
                      <span>{product.brand.slice(0, 1)}</span>
                      <div>
                        <strong>{product.name}</strong>
                        <small>{price.format(product.retailPrice)}</small>
                        <div className="quantity">
                          <button
                            onClick={() =>
                              setQuantity(product.variantId, quantity - 1)
                            }
                          >
                            <Minus size={12} />
                          </button>
                          <b>{quantity}</b>
                          <button
                            disabled={quantity >= product.available}
                            onClick={() =>
                              setQuantity(product.variantId, quantity + 1)
                            }
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                      <button
                        className="remove"
                        onClick={() => setQuantity(product.variantId, 0)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                {cart.length === 0 ? (
                  <div className="empty-cart">
                    <ShoppingBag size={28} />
                    <p>Votre panier est vide.</p>
                  </div>
                ) : (
                  <form className="checkout" onSubmit={submit}>
                    <div className="order-totals">
                      <p>
                        <span>Sous-total</span>
                        <b>{price.format(subtotal)}</b>
                      </p>
                      <p>
                        <span>Livraison</span>
                        <b>{shipping ? price.format(shipping) : "Offerte"}</b>
                      </p>
                      <p>
                        <span>Total à payer</span>
                        <strong>{price.format(subtotal + shipping)}</strong>
                      </p>
                    </div>
                    <div className="cod-note">
                      <ShoppingBag size={18} />
                      <div>
                        <strong>Paiement à la livraison</strong>
                        <span>
                          Aucun paiement en ligne. Payez le livreur en espèces à
                          la réception.
                        </span>
                      </div>
                    </div>
                    <div className="checkout-grid">
                      <label>
                        <span>Nom complet</span>
                        <input name="name" required minLength={2} />
                      </label>
                      <label>
                        <span>Téléphone</span>
                        <input name="phone" required minLength={8} />
                      </label>
                      <label>
                        <span>Ville</span>
                        <input name="city" required minLength={2} />
                      </label>
                      <label className="wide">
                        <span>Adresse de livraison</span>
                        <input name="address" required minLength={8} />
                      </label>
                      <label className="wide">
                        <span>Note (facultatif)</span>
                        <input name="notes" />
                      </label>
                    </div>
                    {error && <p className="checkout-error">{error}</p>}
                    <button className="confirm-order" disabled={sending}>
                      {sending
                        ? "Confirmation…"
                        : `Confirmer · ${price.format(subtotal + shipping)}`}
                    </button>
                  </form>
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
