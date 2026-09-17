"use client";

import { ProductGallery } from "./ProductGallery";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { productTaxonomy, type ProductListItem, type RetailOrderResult } from "@cosmetics/contracts";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Gift,
  Grid2X2,
  Headphones,
  Heart,
  Leaf,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  Quote,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const price = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
});

type CartLine = { product: ProductListItem; quantity: number };
type Category = ProductListItem["category"] | "ALL";

const categoryCards: Array<{
  id: Category;
  name: string;
  subtitle: string;
  className: string;
}> = [
  {
    id: "BATH_BODY",
    name: "Bath & Body",
    subtitle: "Corps, douche & hydratation",
    className: "body",
  },
  {
    id: "HAIR",
    name: "Cheveux",
    subtitle: "Soins, traitements & coiffage",
    className: "hair",
  },
  {
    id: "SUPPLEMENTS",
    name: "Compléments alimentaires",
    subtitle: "Vitamines, minéraux & bien-être",
    className: "wellness",
  },
  {
    id: "SKIN_CARE",
    name: "Skin care",
    subtitle: "Visage, sérums & crèmes",
    className: "skin",
  },
  {
    id: "MAKEUP",
    name: "Maquillage",
    subtitle: "Couleur & éclat",
    className: "makeup",
  },
  {
    id: "FRAGRANCE",
    name: "Parfum",
    subtitle: "Senteurs sélectionnées",
    className: "wellness",
  },
  {
    id: "HYGIENE",
    name: "Hygiène",
    subtitle: "Déodorants & hygiène intime",
    className: "body",
  },
  {
    id: "ORAL_CARE",
    name: "Soin dentaire",
    subtitle: "Dentifrices & blanchiment",
    className: "skin",
  },
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
  const [subcategory, setSubcategory] = useState("");
  const [selectedProduct, setSelectedProduct] =
    useState<ProductListItem | null>(null);
  const [catalogLimit, setCatalogLimit] = useState(10);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [information, setInformation] = useState<{
    title: string;
    copy: string;
  } | null>(null);
  const [saleOnly, setSaleOnly] = useState(false);
  const [brandsPaused, setBrandsPaused] = useState(false);
  const [allBrandsOpen, setAllBrandsOpen] = useState(false);

  useEffect(() => {
    if (!cartOpen && !selectedProduct && !information) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCartOpen(false);
        setSelectedProduct(null);
        setInformation(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [cartOpen, selectedProduct, information]);

  const shownProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory =
          category === "ALL" || product.category === category;
        const matchesSubcategory =
          !subcategory || product.subcategory === subcategory;
        const text =
          `${product.name} ${product.brand} ${product.sku}`.toLocaleLowerCase(
            "fr",
          );
        const matchesOffer =
          !saleOnly ||
          (product.compareAtPrice !== null &&
            product.compareAtPrice > product.retailPrice);
        return (
          matchesCategory &&
          matchesSubcategory &&
          matchesOffer &&
          text.includes(search.trim().toLocaleLowerCase("fr"))
        );
      }),
    [category, products, search, saleOnly, subcategory],
  );
  const brands = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((product) => product.brand.trim().toLocaleUpperCase("fr"))
            .filter(Boolean),
        ),
      ).sort(),
    [products],
  );
  const maximumDiscount = Math.max(
    0,
    ...products.map((product) =>
      product.compareAtPrice && product.compareAtPrice > product.retailPrice
        ? Math.round((1 - product.retailPrice / product.compareAtPrice) * 100)
        : 0,
    ),
  );
  const newArrivals = products.slice(0, 8);
  const collectionStories = [
    {
      category: "SKIN_CARE" as Category,
      kicker: "Rituel quotidien",
      title: "La peau lumineuse commence ici",
      copy: "Des actifs ciblés et des textures sensorielles pour une routine qui vous ressemble.",
      product: products.find((item) => item.category === "SKIN_CARE"),
    },
    {
      category: "MAKEUP" as Category,
      kicker: "Couleur & caractère",
      title: "Le maquillage qui change l’humeur",
      copy: "Teintes fraîches, finis éclatants et essentiels faciles à porter chaque jour.",
      product: products.find((item) => item.category === "MAKEUP"),
    },
    {
      category: "FRAGRANCE" as Category,
      kicker: "Signature parfumée",
      title: "Une trace rien qu’à vous",
      copy: "Brumes et parfums choisis pour accompagner chaque moment de la journée.",
      product: products.find((item) => item.category === "FRAGRANCE"),
    },
  ];
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce(
    (sum, line) => sum + line.product.retailPrice * line.quantity,
    0,
  );
  const shipping = subtotal >= 500 ? 0 : 35;

  const scrollToCatalog = (nextCategory: Category = "ALL") => {
    setCategory(nextCategory);
    setSubcategory("");
    setSearch("");
    setSaleOnly(false);
    setCatalogLimit(10);
    document
      .querySelector("#catalogue")
      ?.scrollIntoView({ behavior: "smooth" });
  };
  const setQuantity = (variantId: string, quantity: number) =>
    setCart((current) =>
      current
        .map((line) =>
          line.product.variantId === variantId ? { ...line, quantity } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  const add = (product: ProductListItem) => {
    setOrder(null);
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
    setCartOpen(true);
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
      <header className="store-header">
        <a className="store-logo" href="#accueil" aria-label="ONight accueil">
          <span>
            <img src="/brand-onight.png" width={46} height={46} alt="" />
          </span>
          <strong className="text-brand!">ONight Store</strong>
          <small>Health &amp; Beauty</small>
        </a>
        <button
          className="mobile-nav-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          <Grid2X2 size={20} />
        </button>
        <nav
          className={mobileOpen ? "open" : ""}
          onClick={() => setMobileOpen(false)}
        >
          <a href="#accueil">Accueil</a>
          <a href="#categories">Catégories</a>
          <a href="#marques">Marques</a>
          <a href="#nouveautes">Nouveautés</a>
          <a href="#offres">Offres</a>
        </nav>
        <div className="header-search">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCatalogLimit(10);
            }}
            onFocus={() =>
              document
                .querySelector("#catalogue")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            placeholder="Rechercher un produit…"
            aria-label="Rechercher un produit"
          />
          <Search size={18} />
        </div>
        <div className="header-actions">
          <a href="#comment-commander" aria-label="Comment commander">
            <Headphones size={20} />
          </a>
          <button
            aria-label="Panier"
            onClick={() => {
              setOrder(null);
              setCartOpen(true);
            }}
          >
            <ShoppingCart size={20} />
            <sup>{count}</sup>
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="accueil">
          <div className="hero-copy">
            <div className="hero-kicker">
              <Sparkles size={15} /> Rayonnez de confiance chaque jour
            </div>
            <h1>
              Beauté &amp; bien-être
              <br />
              pour <em>révéler votre éclat</em>
            </h1>
            <p>
              Découvrez des produits de beauté authentiques, choisis pour
              prendre soin de votre peau, vos cheveux et votre corps.
            </p>
            <div className="hero-buttons">
              <button onClick={() => scrollToCatalog("ALL")}>
                Acheter maintenant <ArrowRight size={18} />
              </button>
              <a href="#categories">
                Explorer les catégories <Grid2X2 size={18} />
              </a>
            </div>
          </div>
          <div className="original-badge">
            <Leaf size={24} />
            <strong>100%</strong>
            <span>Produits originaux</span>
          </div>
        </section>

        <section className="trust-strip" aria-label="Nos engagements">
          <div>
            <ShieldCheck />
            <span>
              <strong>100% authentiques</strong>
              <small>Marques vérifiées</small>
            </span>
          </div>
          <div>
            <UserRound />
            <span>
              <strong>Sélection experte</strong>
              <small>Produits testés</small>
            </span>
          </div>
          <div>
            <Truck />
            <span>
              <strong>Livraison rapide</strong>
              <small>Partout au Maroc</small>
            </span>
          </div>
          <div>
            <RotateCcw />
            <span>
              <strong>Retour facile</strong>
              <small>Conditions simples</small>
            </span>
          </div>
        </section>

        <section className="categories-section" id="categories">
          <div className="store-section-title">
            <h2>Acheter par catégorie</h2>
            <button onClick={() => scrollToCatalog("ALL")}>
              Voir toutes les catégories <ArrowRight size={16} />
            </button>
          </div>
          <div className="category-grid">
            {categoryCards.map((card) => {
              const available = products.filter(
                (product) => product.category === card.id,
              ).length;
              return (
                <button
                  className={`category-card ${card.className}`}
                  key={card.id}
                  onClick={() => scrollToCatalog(card.id)}
                >
                  <span className="category-art" aria-hidden="true">
                    <i />
                    <b />
                    <em />
                  </span>
                  <strong>{card.name}</strong>
                  <small>
                    {available} produit{available === 1 ? "" : "s"} ·{" "}
                    {card.subtitle}
                  </small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="beauty-edit" aria-label="Sélections ONight">
          <div className="edit-intro">
            <p>Le ONight edit</p>
            <h2>
              Une beauté qui suit
              <br />
              votre rythme.
            </h2>
            <span>
              Explorez nos univers du moment, pensés comme de petites
              parenthèses de soin.
            </span>
            <i>
              <Sparkles size={16} /> Vos prochains coups de cœur
            </i>
          </div>
          <div className="edit-grid">
            {collectionStories.map((story, index) => (
              <button
                className={`edit-card edit-${index + 1}`}
                key={story.title}
                onClick={() => scrollToCatalog(story.category)}
              >
                <span className="edit-image">
                  {story.product?.imageUrl ? (
                    <img src={story.product.imageUrl} alt="" />
                  ) : (
                    <Sparkles />
                  )}
                </span>
                <span className="edit-copy">
                  <small>{story.kicker}</small>
                  <strong>{story.title}</strong>
                  <em>{story.copy}</em>
                  <b>
                    Découvrir <ChevronRight size={15} />
                  </b>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="arrivals-section" id="nouveautes">
          <div className="store-section-title">
            <div>
              <span className="section-kicker">Fraîchement arrivés</span>
              <h2>Nouveautés à ne pas manquer</h2>
              <p>Les derniers essentiels ajoutés au catalogue ONight.</p>
            </div>
            <button onClick={() => scrollToCatalog("ALL")}>
              Tout découvrir <ArrowRight size={16} />
            </button>
          </div>
          <div className="arrival-rail">
            {newArrivals.map((product, index) => (
              <article
                className="arrival-card"
                key={product.variantId}
                style={{ "--delay": `${index * 45}ms` } as CSSProperties}
              >
                <button
                  className="arrival-image"
                  onClick={() => setSelectedProduct(product)}
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      loading="lazy"
                    />
                  ) : (
                    <span>{product.brand.slice(0, 1)}</span>
                  )}
                  <i>Nouveau</i>
                </button>
                <div>
                  <small>{product.brand}</small>
                  <button onClick={() => setSelectedProduct(product)}>
                    {product.name}
                  </button>
                  <span>
                    <strong>{price.format(product.retailPrice)}</strong>
                    <button
                      disabled={product.available <= 0}
                      onClick={() => add(product)}
                      aria-label={`Ajouter ${product.name}`}
                    >
                      <Plus size={16} />
                    </button>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="offer-banner" id="offres">
          <div className="offer-products" aria-hidden="true">
            <i />
            <b />
            <span />
          </div>
          <div>
            <p>
              <Sparkles size={15} /> Les offres du moment
            </p>
            <h2>
              {maximumDiscount > 0
                ? `Jusqu’à ${maximumDiscount}% de réduction`
                : "Des essentiels à découvrir"}
            </h2>
            <span>Sur une sélection beauté &amp; bien-être</span>
            <button
              onClick={() => {
                scrollToCatalog("ALL");
                setSaleOnly(maximumDiscount > 0);
              }}
            >
              Voir la sélection <ArrowRight size={17} />
            </button>
          </div>
        </section>

        <section className="brands-section" id="marques">
          <div className="brands-heading">
            <div>
              <span className="section-kicker">
                Les signatures que vous aimez
              </span>
              <h2>Nos marques</h2>
            </div>
            <p>
              Des maisons iconiques aux pépites qui font le buzz, retrouvez une
              sélection authentique disponible au Maroc.
            </p>
          </div>
          <div className="brand-marquee">
            <div className={`brand-track ${brandsPaused ? "paused" : ""}`}>
              {[...brands, ...brands].map((brand, index) => (
                <button
                  key={`${brand}-${index}`}
                  tabIndex={index >= brands.length ? -1 : 0}
                  aria-hidden={index >= brands.length || undefined}
                  onClick={() => {
                    setSearch(brand);
                    setCategory("ALL");
                    setSaleOnly(false);
                    setCatalogLimit(10);
                    document
                      .querySelector("#catalogue")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <span>{brand.slice(0, 1)}</span>
                  {brand}
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className="brand-controls">
            <button
              onClick={() => setBrandsPaused(!brandsPaused)}
              aria-pressed={brandsPaused}
            >
              {brandsPaused ? "Reprendre le défilement" : "Mettre en pause"}
            </button>
            <button
              onClick={() => setAllBrandsOpen(!allBrandsOpen)}
              aria-expanded={allBrandsOpen}
              aria-controls="brand-directory"
            >
              {allBrandsOpen
                ? "Masquer les marques"
                : `Voir les ${brands.length} marques`}{" "}
              <Plus size={14} />
            </button>
          </div>
          {allBrandsOpen && (
            <div className="brand-directory" id="brand-directory">
              {brands.map((brand) => (
                <button
                  key={brand}
                  onClick={() => {
                    scrollToCatalog("ALL");
                    setSearch(brand);
                  }}
                >
                  {brand}
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
          )}
          <div className="brand-note">
            <BadgeCheck size={19} />
            <span>
              <strong>Authenticité contrôlée</strong>
              <small>
                Chaque référence est sélectionnée auprès de partenaires
                vérifiés.
              </small>
            </span>
            <button onClick={() => scrollToCatalog("ALL")}>
              Explorer le catalogue
            </button>
          </div>
        </section>

        <section className="catalog" id="catalogue">
          <div className="store-section-title">
            <div>
              <h2>
                {search
                  ? `Résultats pour « ${search} »`
                  : saleOnly
                    ? "Offres du moment"
                    : category === "ALL"
                      ? "La sélection ONight"
                      : categoryCards.find((item) => item.id === category)
                          ?.name}
              </h2>
              <p>Votre sélection beauté, avec le stock disponible en direct.</p>
            </div>
            {(search || category !== "ALL" || saleOnly) && (
              <button onClick={() => scrollToCatalog("ALL")}>
                Effacer les filtres <X size={15} />
              </button>
            )}
          </div>
          {category !== "ALL" && (
            <div className="mb-5 flex flex-wrap gap-2">
              <button onClick={() => setSubcategory("")} aria-pressed={!subcategory}>
                Toutes
              </button>
              {productTaxonomy[category].subcategories.map((value) => (
                <button key={value} onClick={() => setSubcategory(value)} aria-pressed={subcategory === value}>
                  {value}
                </button>
              ))}
            </div>
          )}
          <div className="product-grid">
            {shownProducts.slice(0, catalogLimit).map((product, index) => (
              <article className="store-product" key={product.variantId}>
                <div className={`product-visual shade-${index % 5}`}>
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      loading="lazy"
                    />
                  ) : (
                    <span className={`cosmetic-shape shape-${index % 4}`}>
                      <i>{product.brand.slice(0, 1)}</i>
                    </span>
                  )}
                  <button
                    className="heart"
                    aria-label={`Ajouter ${product.name} aux favoris`}
                    aria-pressed={favorites.includes(product.variantId)}
                    onClick={() =>
                      setFavorites((current) =>
                        current.includes(product.variantId)
                          ? current.filter((id) => id !== product.variantId)
                          : [...current, product.variantId],
                      )
                    }
                  >
                    <Heart
                      size={17}
                      fill={
                        favorites.includes(product.variantId)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                  <button
                    className="detail-trigger"
                    onClick={() => setSelectedProduct(product)}
                  >
                    Voir les détails
                  </button>
                  {product.available <= 0 && <b>Épuisé</b>}
                  {product.available > 0 &&
                    product.available <= product.lowStockThreshold && (
                      <b>Dernières pièces</b>
                    )}
                </div>
                <p>{product.brand}</p>
                <button
                  className="product-title"
                  onClick={() => setSelectedProduct(product)}
                >
                  <h3>{product.name}</h3>
                </button>
                <small>{product.sku}</small>
                <div className="product-stock">
                  <BadgeCheck size={13} />
                  <small>
                    {product.available > 0
                      ? `${product.available} pièces disponibles`
                      : "Bientôt de retour"}
                  </small>
                </div>
                <div className="product-buy">
                  <span>
                    <strong>{price.format(product.retailPrice)}</strong>
                    {product.compareAtPrice &&
                    product.compareAtPrice > product.retailPrice ? (
                      <del>{price.format(product.compareAtPrice)}</del>
                    ) : null}
                  </span>
                  <button
                    disabled={product.available <= 0}
                    onClick={() => add(product)}
                  >
                    <ShoppingCart size={15} /> Ajouter
                  </button>
                </div>
              </article>
            ))}
            {shownProducts.length === 0 && (
              <div className="catalog-empty">
                <Search size={30} />
                <h3>Aucun produit trouvé</h3>
                <p>
                  Modifiez votre recherche ou choisissez une autre catégorie.
                </p>
                <button onClick={() => scrollToCatalog("ALL")}>
                  Afficher tout le catalogue
                </button>
              </div>
            )}
          </div>
          {shownProducts.length > 0 && (
            <div className="catalog-pagination">
              <small>
                {Math.min(catalogLimit, shownProducts.length)} sur{" "}
                {shownProducts.length} produits
              </small>
              {catalogLimit < shownProducts.length && (
                <button
                  onClick={() => setCatalogLimit((current) => current + 10)}
                >
                  Voir plus de produits <Plus size={16} />
                </button>
              )}
            </div>
          )}
        </section>

        <section className="beauty-promise" id="comment-commander">
          <div className="promise-quote">
            <Quote size={28} />
            <p>Prendre soin de soi ne devrait jamais être compliqué.</p>
            <span>
              ONight rassemble les bons produits, les conseils simples et une
              livraison pensée pour votre quotidien.
            </span>
          </div>
          <div className="promise-steps">
            <article>
              <span>01</span>
              <div>
                <strong>Choisissez votre rituel</strong>
                <small>Parcourez par besoin, catégorie ou marque.</small>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <strong>Commandez sans stress</strong>
                <small>Aucun paiement en ligne n’est nécessaire.</small>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <strong>Rayonnez à votre façon</strong>
                <small>Payez en espèces lors de la livraison.</small>
              </div>
            </article>
          </div>
        </section>

        <section className="service-strip">
          <div>
            <PackageCheck />
            <span>
              <strong>Paiement à la livraison</strong>
              <small>Payez en espèces à réception</small>
            </span>
          </div>
          <div>
            <Gift />
            <span>
              <strong>Offres exclusives</strong>
              <small>Des économies sur vos marques</small>
            </span>
          </div>
          <div>
            <Headphones />
            <span>
              <strong>Assistance 7j/7</strong>
              <small>Une équipe à votre écoute</small>
            </span>
          </div>
          <div>
            <Star />
            <span>
              <strong>Qualité récompensée</strong>
              <small>Une sélection exigeante</small>
            </span>
          </div>
        </section>

        <section className="newsletter">
          <div>
            <span>
              <Sparkles size={20} />
            </span>
            <p>Une dose de bonne humeur</p>
            <h2>
              Votre prochain coup de cœur
              <br />
              vous attend par ici.
            </h2>
          </div>
          <div className="discovery-actions">
            <a href="#nouveautes">
              Explorer les nouveautés <ArrowRight size={17} />
            </a>
            <a href="#marques">
              Retrouver ma marque favorite <Heart size={16} />
            </a>
            <small>
              Un peu de soin, beaucoup de vous. Le tout, livré à domicile.
            </small>
          </div>
        </section>
      </main>

      <footer className="store-footer" id="apropos">
        <div className="footer-main">
          <div className="footer-about">
            <a className="store-logo" href="#accueil">
              <span>
                <img src="/brand-icon.svg" width={32} height={32} alt="" />
              </span>
              <strong>ONight</strong>
              <small>Health &amp; Beauty</small>
            </a>
            <p>
              La beauté joyeuse et accessible. Une sélection choisie avec soin,
              livrée partout au Maroc.
            </p>
            <span className="footer-signature">
              <Heart size={15} /> Votre beauté, votre rythme.
            </span>
          </div>
          <div className="footer-links">
            <div>
              <strong>Découvrir</strong>
              <a href="#nouveautes">Nouveautés</a>
              <a href="#categories">Catégories</a>
              <a href="#marques">Marques</a>
              <a href="#offres">Offres</a>
            </div>
            <div>
              <strong>Besoin d’aide ?</strong>
              <button
                onClick={() =>
                  setInformation({
                    title: "Livraison",
                    copy: "La livraison est facturée 35 MAD et offerte dès 500 MAD d’achats. Le montant exact apparaît dans votre panier avant confirmation. Saisissez une adresse complète et un numéro de téléphone joignable.",
                  })
                }
              >
                Frais de livraison
              </button>
              <a href="#comment-commander">Comment commander</a>
              <button
                onClick={() =>
                  setInformation({
                    title: "Paiement à la livraison",
                    copy: "Aucune carte bancaire ni passerelle de paiement n’est nécessaire. Votre commande est enregistrée avec une référence, puis vous réglez le montant total en espèces au livreur à réception.",
                  })
                }
              >
                Paiement en espèces
              </button>
              <button
                onClick={() => {
                  setOrder(null);
                  setCartOpen(true);
                }}
              >
                Voir mon panier
              </button>
            </div>
            <div>
              <strong>L’expérience ONight</strong>
              <span>
                <MapPin size={15} /> Livraison partout au Maroc
              </span>
              <span>
                <PackageCheck size={15} /> Un stock partagé, à jour
              </span>
              <span>
                <ShoppingCart size={15} /> Achat à la pièce, en toute simplicité
              </span>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 ONight. Tous droits réservés.</span>
          <div>
            <button
              onClick={() =>
                setInformation({
                  title: "À propos de cette démonstration",
                  copy: "Cette boutique utilise un catalogue de démonstration. Les noms, images et descriptions de produits importés sont présentés à des fins de test. N’utilisez pas de données personnelles réelles pour vos commandes de test.",
                })
              }
            >
              À propos de la démo
            </button>
          </div>
          <strong>
            <Truck size={16} /> Paiement à la livraison
          </strong>
        </div>
      </footer>

      {information && (
        <div
          className="product-modal-backdrop"
          onMouseDown={() => setInformation(null)}
        >
          <section
            className="information-modal"
            role="dialog"
            aria-modal="true"
            aria-label={information.title}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="product-modal-close"
              onClick={() => setInformation(null)}
              aria-label="Fermer les informations"
            >
              <X size={20} />
            </button>
            <Leaf size={27} />
            <h2>{information.title}</h2>
            <p>{information.copy}</p>
            <button className="modal-add" onClick={() => setInformation(null)}>
              C’est compris
            </button>
          </section>
        </div>
      )}

      {selectedProduct && (
        <div
          className="product-modal-backdrop"
          onMouseDown={() => setSelectedProduct(null)}
        >
          <section
            className="product-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="product-modal-close"
              onClick={() => setSelectedProduct(null)}
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
            <ProductGallery key={selectedProduct.id} product={selectedProduct} />
            <div className="product-modal-copy">
              <p>{selectedProduct.brand}</p>
              <h2>{selectedProduct.name}</h2>
              <div className="rating">
                <span>
                  {[0, 1, 2, 3, 4].map((star) => (
                    <Star key={star} size={14} fill="currentColor" />
                  ))}
                </span>
                <small>Produit authentique</small>
              </div>
              <div className="modal-price">
                <strong>{price.format(selectedProduct.retailPrice)}</strong>
                {selectedProduct.compareAtPrice &&
                selectedProduct.compareAtPrice > selectedProduct.retailPrice ? (
                  <del>{price.format(selectedProduct.compareAtPrice)}</del>
                ) : null}
              </div>
              <p className="product-description">
                {selectedProduct.description ||
                  "Produit cosmétique sélectionné avec soin par ONight."}
              </p>
              <small className="product-reference">
                Référence : {selectedProduct.sku} · {selectedProduct.available}{" "}
                en stock
              </small>
              <button
                className="modal-add"
                disabled={selectedProduct.available <= 0}
                onClick={() => {
                  add(selectedProduct);
                  setSelectedProduct(null);
                }}
              >
                <ShoppingCart size={17} /> Ajouter au panier
              </button>
            </div>
          </section>
        </div>
      )}

      {cartOpen && (
        <div className="cart-backdrop" onMouseDown={() => setCartOpen(false)}>
          <aside
            className="cart-drawer"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="cart-title">
              <div>
                <p>Votre sélection</p>
                <h2>Panier · {count}</h2>
              </div>
              <button onClick={() => setCartOpen(false)} aria-label="Fermer">
                <X size={20} />
              </button>
            </div>
            {order ? (
              <div className="order-success">
                <CheckCircle2 size={46} />
                <h3>Commande enregistrée</h3>
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
                    setCartOpen(false);
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
                        aria-label={`Retirer ${product.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                {cart.length === 0 ? (
                  <div className="empty-cart">
                    <ShoppingCart size={30} />
                    <p>Votre panier est vide.</p>
                    <button onClick={() => setCartOpen(false)}>
                      Découvrir les produits
                    </button>
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
                      <Truck size={19} />
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
                        ? "Enregistrement…"
                        : `Commander · ${price.format(subtotal + shipping)}`}
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
