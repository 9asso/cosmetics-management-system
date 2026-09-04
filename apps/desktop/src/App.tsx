import { ui } from "./lib/ui";
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { DashboardPage } from "./pages/DashboardPage";
import { InventoryPage } from "./pages/InventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { OrdersPage } from "./pages/OrdersPage";
import { InvoicesPage } from './pages/InvoicesPage';
import {
  PartnersPage,
  PurchasesPage,
  WholesaleSalesPage,
} from "./pages/OperationsPages";
import { TeamPage } from "./pages/TeamPage";
import { EditNameModal } from "./components/EditNameModal";
import { ErrorState } from "./components/EmptyState";
import { api, ApiRequestError, hasAccessToken, setAccessToken } from "./lib/api";

type Section =
  | "dashboard"
  | "inventory"
  | "purchases"
  | "sales"
  | "orders"
  | "invoices"
  | "partners"
  | "team";

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
      { id: 'invoices', label: 'Historique des factures', icon: ReceiptText },
    ],
  },
  {
    group: "Gestion",
    items: [
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
  invoices: { eyebrow: 'Documents commerciaux', title: 'Historique des factures', description: 'Retrouvez les achats, ventes, coordonnées et paiements.' },
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

export function App() {
  const cache = useQueryClient();
  const [authenticated, setAuthenticated] = useState(hasAccessToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [active, setActive] = useState<Section>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
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

  useEffect(() => {
    if (me.data) setUser(me.data);
    if (me.error instanceof ApiRequestError && me.error.status === 401) {
      setAccessToken("");
      setAuthenticated(false);
      setUser(null);
    }
  }, [me.data, me.error]);

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

  const navigate = (section: Section) => {
    setActive(section);
    setMobileMenu(false);
  };
  const logout = () => {
    setAccessToken("");
    setAuthenticated(false);
    setUser(null);
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
          cache.setQueryData(['me'], result.user);
          setUser(result.user);
          setAuthenticated(true);
        }}
      />
    );
  }
  if (!user && me.isError) return <div className="grid min-h-screen place-items-center p-6"><ErrorState message="Le serveur est temporairement indisponible. Votre session est conservée." retry={() => void me.refetch()} /></div>;
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
          <button className={ui("store-link")} onClick={openStore} aria-label="Voir la boutique">
            <Store size={18} />
            <span>
              <strong>Voir la boutique</strong>
              <small>Catalogue retail en direct</small>
            </span>
          </button>
          {/* <p className={ui("sidebar-account-label")}>Compte</p> */}
          <div className={ui("profile")}>
            <span className={ui("avatar")}>{initials}</span>
            <div className="min-w-0 flex-1">
              {user.role === "OWNER" ? (
                <button
                  className="flex max-w-full items-center gap-1 text-left hover:text-white/80 text-white"
                  onClick={() => setEditProfile(true)}
                  title="Modifier mon nom"
                  aria-label="Modifier mon nom"
                >
                  <strong className="hover:text-white/80 text-white">{user.displayName}</strong>
                  <Pencil size={11} color="white" className="shrink-0 text-white" />
                </button>
              ) : (
                <strong className="text-white">{user.displayName}</strong>
              )}
              <small className="text-white!">{roleLabels[user.role]}</small>
            </div>
            <button onClick={logout} title="Se déconnecter">
              <LogOut size={26} color="white" className="hover:bg-white/20 p-1 rounded-full transition-all delay-75" />
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
          {active === "dashboard" && <DashboardPage onNavigate={navigate} />}
          {active === "inventory" && (
            <InventoryPage canManage={canManageStock} />
          )}
          {active === "purchases" && <PurchasesPage />}
          {active === "sales" && <WholesaleSalesPage />}
          {active === 'invoices' && <InvoicesPage />}
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
