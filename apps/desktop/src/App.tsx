import { ui } from "./lib/ui";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser, UserRole } from "@cosmetics/contracts";
import {
  Boxes,
  Building2,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Store,
  Pencil,
  Moon,
  Sun,
  Wallet,
} from "lucide-react";
import { DashboardPage } from "./pages/DashboardPage";
import { InventoryPage } from "./pages/InventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { OrdersPage } from "./pages/OrdersPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import {
  PartnersPage,
  PurchasesPage,
  WholesaleSalesPage,
} from "./pages/OperationsPages";
import { TeamPage } from "./pages/TeamPage";
import { EditNameModal } from "./components/EditNameModal";
import { ErrorState } from "./components/EmptyState";
import {
  api,
  ApiRequestError,
  hasAccessToken,
  setAccessToken,
} from "./lib/api";

import { FinancePage } from "./pages/FinancePage";
import {
  sectionFromPath,
  sectionPath,
  type Section,
  type NavigationOptions,
} from "./lib/navigation";

const navigation: Array<{
  group: string;
  items: Array<{
    id: Section;
    label: string;
    icon: typeof Boxes;
    roles?: UserRole[];
  }>;
}> = [
  {
    group: "Menu principal",
    items: [
      { id: "dashboard", label: "Vue d’ensemble", icon: LayoutDashboard },
      { id: "inventory", label: "Produits & stock", icon: Boxes },
    ],
  },
  {
    group: "Opérations",
    items: [
      {
        id: "purchases",
        label: "Achats fournisseurs",
        icon: PackagePlus,
        roles: ["OWNER", "MANAGER", "WAREHOUSE", "ACCOUNTANT"],
      },
      {
        id: "sales",
        label: "Nouvelle vente en gros",
        icon: ShoppingBag,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      { id: "orders", label: "Commandes & livraisons", icon: ReceiptText },
      { id: "invoices", label: "Historique des factures", icon: ReceiptText },
    ],
  },
  {
    group: "Gestion",
    items: [
      {
        id: "finance",
        label: "Finances & dépenses",
        icon: Wallet,
        roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
      },
      { id: "partners", label: "Clients & fournisseurs", icon: Building2 },
      {
        id: "team",
        label: "Équipe & rôles",
        icon: ShieldCheck,
        roles: ["OWNER"],
      },
    ],
  },
];

const pageTitles: Record<
  Section,
  { eyebrow: string; title: string; description: string }
> = {
  finance: {
    eyebrow: "Suivi financier",
    title: "Finances & dépenses",
    description:
      "Encaissez vos factures, suivez vos chèques et maîtrisez vos dépenses.",
  },
  dashboard: {
    eyebrow: "Centre de pilotage",
    title: "Vue d’ensemble",
    description: "Suivez vos ventes et votre stock partagé.",
  },
  inventory: {
    eyebrow: "Catalogue unifié",
    title: "Produits & stock",
    description: "Un seul stock pour le grossiste et la boutique retail.",
  },
  purchases: {
    eyebrow: "Entrées de stock",
    title: "Achats fournisseurs",
    description: "Réceptionnez vos achats auprès des grands fournisseurs.",
  },
  sales: {
    eyebrow: "Canal B2B",
    title: "Vente en gros",
    description:
      "Créez une facture manuelle et déduisez le stock en temps réel.",
  },
  orders: {
    eyebrow: "Tous les canaux",
    title: "Commandes & livraisons",
    description: "Suivez les commandes retail et les ventes grossistes.",
  },
  partners: {
    eyebrow: "Carnet commercial",
    title: "Clients & fournisseurs",
    description: "Centralisez les partenaires de votre activité.",
  },
  invoices: {
    eyebrow: "Documents commerciaux",
    title: "Historique des factures",
    description: "Retrouvez les achats, ventes, coordonnées et paiements.",
  },
  team: {
    eyebrow: "Sécurité",
    title: "Équipe & rôles",
    description: "Contrôlez les accès et responsabilités de chaque membre.",
  },
};

const roleLabels: Record<UserRole, string> = {
  OWNER: "Propriétaire",
  MANAGER: "Manager",
  CASHIER: "Vendeur",
  WAREHOUSE: "Magasinier",
  ACCOUNTANT: "Comptable",
  STAFF: "Employé",
};

const themeStorageKey = "onight-dashboard-theme";

function themeStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function initialDarkMode() {
  if (typeof window === "undefined") return false;
  const saved = themeStorage()?.getItem(themeStorageKey);
  if (saved === "dark") return true;
  if (saved === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function App() {
  const cache = useQueryClient();
  const [authenticated, setAuthenticated] = useState(hasAccessToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [active, setActive] = useState<Section>(() =>
    sectionFromPath(window.location.pathname),
  );
  const [navigationOptions, setNavigationOptions] = useState<NavigationOptions>(
    {},
  );
  const [navigationVersion, setNavigationVersion] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [darkMode, setDarkMode] = useState(initialDarkMode);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled: authenticated && !user,
    retry: false,
  });
  const health = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    retry: 1,
    refetchInterval: 30_000,
  });

  useLayoutEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      authenticated && darkMode,
    );
    themeStorage()?.setItem(themeStorageKey, darkMode ? "dark" : "light");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        authenticated && darkMode ? "#181619" : "#ff848f",
      );
  }, [darkMode, authenticated]);

  useEffect(() => {
    if (me.data) setUser(me.data);
    if (me.error instanceof ApiRequestError && me.error.status === 401) {
      setAccessToken("");
      setAuthenticated(false);
      setUser(null);
    }
  }, [me.data, me.error]);

  useEffect(() => {
    const followBrowserHistory = () => {
      setNavigationOptions({});
      setNavigationVersion((version) => version + 1);
      setActive(sectionFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", followBrowserHistory);
    return () => window.removeEventListener("popstate", followBrowserHistory);
  }, []);

  const visibleNavigation = useMemo(
    () =>
      navigation
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !item.roles || (user && item.roles.includes(user.role)),
          ),
        }))
        .filter((group) => group.items.length),
    [user],
  );

  useEffect(() => {
    if (
      user &&
      !visibleNavigation.some((group) =>
        group.items.some((item) => item.id === active),
      )
    ) {
      setActive("dashboard");
      setNavigationOptions({});
      window.history.replaceState({}, "", sectionPath("dashboard"));
    }
  }, [active, user, visibleNavigation]);

  const navigate = (section: Section, options: NavigationOptions = {}) => {
    if (
      !visibleNavigation.some((group) =>
        group.items.some((item) => item.id === section),
      )
    )
      return;
    setNavigationOptions(options);
    setNavigationVersion((version) => version + 1);
    setActive(section);
    window.history.pushState({}, "", sectionPath(section));
    setMobileMenu(false);
  };
  const logout = () => {
    setAccessToken("");
    setAuthenticated(false);
    setUser(null);
    setActive("dashboard");
    setNavigationOptions({});
    cache.clear();
  };
  const openStore = () => {
    const url = window.location.pathname.startsWith("/admin")
      ? "/"
      : "http://localhost:3000";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!authenticated) {
    return (
      <LoginPage
        onLogin={(result) => {
          setAccessToken(result.accessToken);
          cache.setQueryData(["me"], result.user);
          setUser(result.user);
          setAuthenticated(true);
        }}
      />
    );
  }
  if (!user && me.isError)
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <ErrorState
          message="Le serveur est temporairement indisponible. Votre session est conservée."
          retry={() => void me.refetch()}
        />
      </div>
    );
  if (!user)
    return (
      <div className={ui("app-loading")}>
        <span />
        <strong>Ouverture de votre espace…</strong>
      </div>
    );

  const canManageStock = ["OWNER", "MANAGER", "WAREHOUSE"].includes(user.role);
  const canSell = ["OWNER", "MANAGER", "CASHIER"].includes(user.role);
  const initials = user.displayName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={ui(`app-shell ${collapsed ? "sidebar-collapsed" : ""}`)}>
      {mobileMenu && (
        <button
          className={ui("mobile-backdrop")}
          aria-label="Fermer le menu"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside className={ui(`sidebar ${mobileMenu ? "mobile-open" : ""}`)}>
        <div className={ui("brand")}>
          <img
            className={ui("brand-mark")}
            src={`${import.meta.env.BASE_URL}brand-onight.png`}
            alt=""
          />
          <div>
            <strong>ONight</strong>
            <small>Espace de gestion</small>
          </div>
          <button
            className={ui("collapse-button")}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Agrandir le menu" : "Réduire le menu"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}
          </button>
        </div>
        <nav aria-label="Navigation principale">
          {visibleNavigation.map((group) => (
            <section className={ui("nav-group")} key={group.group}>
              <p className={ui("nav-label")}>{group.group}</p>
              {group.items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  title={collapsed ? label : undefined}
                  className={ui(active === id ? "nav-item active" : "nav-item")}
                  onClick={() => navigate(id)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {active === id && (
                    <ChevronLeft size={14} className={ui("nav-chevron")} />
                  )}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <div className={ui("sidebar-footer")}>
          <button
            className={ui("store-link")}
            onClick={openStore}
            aria-label="Voir la boutique"
          >
            <Store size={18} />
            <span>
              <strong>Voir la boutique</strong>
              <small>Catalogue retail en direct</small>
            </span>
          </button>
          {/* <p className={ui("sidebar-account-label")}>Compte</p> */}
          <div className={ui("profile")}>
            {/* <span className={ui("avatar")}>{initials}</span> */}
            <div className="min-w-0 flex-1">
              {user.role === "OWNER" ? (
                <button
                  className="flex max-w-full items-center gap-1 text-left hover:text-white/80 text-white"
                  onClick={() => setEditProfile(true)}
                  title="Modifier mon nom"
                  aria-label="Modifier mon nom"
                >
                  <strong className="hover:text-white/80 text-white">
                    {user.displayName}
                  </strong>
                  <Pencil
                    size={11}
                    color="white"
                    className="shrink-0 text-white"
                  />
                </button>
              ) : (
                <strong className="text-white">{user.displayName}</strong>
              )}
              <small className="text-white!">{roleLabels[user.role]}</small>
            </div>
            <button onClick={logout} title="Se déconnecter">
              <LogOut
                size={18}
                color="white"
                className="hover:scale-[1.1] transition-all delay-75"
              />
            </button>
          </div>
        </div>
      </aside>

      <main className={ui("main-area")}>
        <header className={ui("topbar")}>
          <button
            className={ui("mobile-menu-button")}
            aria-label="Ouvrir le menu"
            onClick={() => setMobileMenu(true)}
          >
            <Menu size={20} />
          </button>
          <div className={ui("breadcrumb")}>
            <span>ONight</span>
            <ChevronLeft size={13} />
            <strong>{pageTitles[active].title}</strong>
          </div>
          <div className={ui("top-actions")}>
            <button
              className={ui("theme-toggle")}
              type="button"
              aria-label={
                darkMode ? "Activer le mode clair" : "Activer le mode sombre"
              }
              aria-pressed={darkMode}
              title={darkMode ? "Mode clair" : "Mode sombre"}
              onClick={() => setDarkMode((enabled) => !enabled)}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              <span className="max-lg:hidden">
                {darkMode ? "Mode clair" : "Mode sombre"}
              </span>
            </button>
            <button className={ui("secondary-button")} onClick={openStore}>
              <Store size={16} /> Boutique
            </button>
            {canManageStock && (
              <button
                className={ui("secondary-button")}
                onClick={() => navigate("purchases")}
              >
                <PackagePlus size={16} /> Nouvel achat
              </button>
            )}
            {canSell && (
              <button
                className={ui("primary-button")}
                onClick={() => navigate("sales")}
              >
                <ShoppingBag size={16} /> Nouvelle vente
              </button>
            )}
          </div>
        </header>

        <div className={ui("page")}>
          <header className={ui("page-heading")}>
            <div>
              <p>{pageTitles[active].eyebrow}</p>
              <h1>{pageTitles[active].title}</h1>
              <small>{pageTitles[active].description}</small>
            </div>
            <span
              className={ui(`connection ${health.isError ? "offline" : ""}`)}
            >
              <i />
              {health.isError
                ? "Serveur indisponible"
                : health.isSuccess
                  ? "Données synchronisées"
                  : "Connexion…"}
            </span>
          </header>
          {active === "dashboard" && (
            <DashboardPage onNavigate={navigate} role={user.role} />
          )}
          {active === "inventory" && (
            <InventoryPage
              key={navigationVersion}
              canManage={canManageStock}
              initialStock={navigationOptions.stock}
              initialCreate={navigationOptions.createProduct}
            />
          )}
          {active === "finance" &&
            ["OWNER", "MANAGER", "ACCOUNTANT"].includes(user.role) && (
              <FinancePage
                key={navigationVersion}
                initialTab={navigationOptions.financeTab}
              />
            )}
          {active === "purchases" && <PurchasesPage />}
          {active === "sales" && <WholesaleSalesPage />}
          {active === "invoices" && <InvoicesPage />}
          {active === "orders" && (
            <OrdersPage
              canUpdate={["OWNER", "MANAGER", "CASHIER", "WAREHOUSE"].includes(
                user.role,
              )}
            />
          )}
          {active === "partners" && <PartnersPage role={user.role} />}
          {active === "team" && user.role === "OWNER" && (
            <TeamPage
              currentUser={user}
              onUserSaved={(saved) => {
                if (saved.id === user.id) {
                  setUser(saved);
                  cache.setQueryData(["me"], saved);
                }
              }}
            />
          )}
        </div>
      </main>
      {editProfile && user.role === "OWNER" && (
        <EditNameModal
          user={user}
          onClose={() => setEditProfile(false)}
          onSaved={(saved) => {
            setUser(saved);
            cache.setQueryData(["me"], saved);
          }}
        />
      )}
    </div>
  );
}
