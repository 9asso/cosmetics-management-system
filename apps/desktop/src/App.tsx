import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser, UserRole } from '@cosmetics/contracts';
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
} from 'lucide-react';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { LoginPage } from './pages/LoginPage';
import { OrdersPage } from './pages/OrdersPage';
import { PartnersPage, PurchasesPage, WholesaleSalesPage } from './pages/OperationsPages';
import { TeamPage } from './pages/TeamPage';
import { api, hasAccessToken, setAccessToken } from './lib/api';

type Section = 'dashboard' | 'inventory' | 'purchases' | 'sales' | 'orders' | 'partners' | 'team';

const navigation: Array<{
  group: string;
  items: Array<{ id: Section; label: string; icon: typeof Boxes; roles?: UserRole[] }>;
}> = [
  { group: 'Pilotage', items: [{ id: 'dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard }] },
  {
    group: 'Stock & catalogue',
    items: [
      { id: 'inventory', label: 'Produits & stock', icon: Boxes },
      { id: 'purchases', label: 'Achats fournisseurs', icon: PackagePlus, roles: ['OWNER', 'MANAGER', 'WAREHOUSE', 'ACCOUNTANT'] },
    ],
  },
  {
    group: 'Ventes',
    items: [
      { id: 'sales', label: 'Nouvelle vente en gros', icon: ShoppingBag, roles: ['OWNER', 'MANAGER', 'CASHIER'] },
      { id: 'orders', label: 'Commandes & livraisons', icon: ReceiptText },
    ],
  },
  {
    group: 'Relations',
    items: [
      { id: 'partners', label: 'Clients & fournisseurs', icon: Building2 },
      { id: 'team', label: 'Équipe & rôles', icon: ShieldCheck, roles: ['OWNER'] },
    ],
  },
];

const pageTitles: Record<Section, { eyebrow: string; title: string; description: string }> = {
  dashboard: { eyebrow: 'Centre de pilotage', title: 'Vue d’ensemble', description: 'Les chiffres essentiels de votre activité aujourd’hui.' },
  inventory: { eyebrow: 'Catalogue unifié', title: 'Produits & stock', description: 'Un seul stock pour le grossiste et la boutique retail.' },
  purchases: { eyebrow: 'Entrées de stock', title: 'Achats fournisseurs', description: 'Réceptionnez vos achats auprès des grands fournisseurs.' },
  sales: { eyebrow: 'Canal B2B', title: 'Vente en gros', description: 'Créez une facture manuelle et déduisez le stock en temps réel.' },
  orders: { eyebrow: 'Tous les canaux', title: 'Commandes & livraisons', description: 'Suivez les commandes retail et les ventes grossistes.' },
  partners: { eyebrow: 'Carnet commercial', title: 'Clients & fournisseurs', description: 'Centralisez les partenaires de votre activité.' },
  team: { eyebrow: 'Sécurité', title: 'Équipe & rôles', description: 'Contrôlez les accès et responsabilités de chaque membre.' },
};

const roleLabels: Record<UserRole, string> = {
  OWNER: 'Propriétaire', MANAGER: 'Manager', CASHIER: 'Vendeur', WAREHOUSE: 'Magasinier', ACCOUNTANT: 'Comptable', STAFF: 'Employé',
};

export function App() {
  const cache = useQueryClient();
  const [authenticated, setAuthenticated] = useState(hasAccessToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [active, setActive] = useState<Section>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, enabled: authenticated && !user, retry: false });
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, retry: 1, refetchInterval: 30_000 });

  useEffect(() => {
    if (me.data) setUser(me.data);
    if (me.isError) {
      setAccessToken('');
      setAuthenticated(false);
      setUser(null);
    }
  }, [me.data, me.isError]);

  const visibleNavigation = useMemo(
    () => navigation.map((group) => ({ ...group, items: group.items.filter((item) => !item.roles || (user && item.roles.includes(user.role))) })).filter((group) => group.items.length),
    [user],
  );

  const navigate = (section: Section) => {
    setActive(section);
    setMobileMenu(false);
  };
  const logout = () => {
    setAccessToken('');
    setAuthenticated(false);
    setUser(null);
    cache.clear();
  };
  const openStore = () => {
    const url = window.location.pathname.startsWith('/admin') ? '/' : 'http://localhost:3000';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!authenticated) {
    return <LoginPage onLogin={(result) => { setAccessToken(result.accessToken); setUser(result.user); setAuthenticated(true); }} />;
  }
  if (!user) return <div className="app-loading"><span /><strong>Ouverture de votre espace…</strong></div>;

  const canManageStock = ['OWNER', 'MANAGER', 'WAREHOUSE'].includes(user.role);
  const canSell = ['OWNER', 'MANAGER', 'CASHIER'].includes(user.role);
  const initials = user.displayName.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {mobileMenu && <button className="mobile-backdrop" aria-label="Fermer le menu" onClick={() => setMobileMenu(false)} />}
      <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
        <div className="brand"><div className="brand-mark">G</div><div><strong>GlowCare</strong><small>Business management</small></div><button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label="Réduire le menu">{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
        <nav aria-label="Navigation principale">
          {visibleNavigation.map((group) => <section className="nav-group" key={group.group}><p className="nav-label">{group.group}</p>{group.items.map(({ id, label, icon: Icon }) => <button key={id} title={collapsed ? label : undefined} className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(id)}><Icon size={18} /><span>{label}</span>{active === id && <ChevronLeft size={14} className="nav-chevron" />}</button>)}</section>)}
        </nav>
        <div className="sidebar-footer">
          <button className="store-link" onClick={openStore}><Store size={18} /><span><strong>Voir la boutique</strong><small>Catalogue retail en direct</small></span></button>
          <div className="profile"><span className="avatar">{initials}</span><div><strong>{user.displayName}</strong><small>{roleLabels[user.role]}</small></div><button onClick={logout} title="Se déconnecter"><LogOut size={16} /></button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button" aria-label="Ouvrir le menu" onClick={() => setMobileMenu(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>GlowCare</span><ChevronLeft size={13} /><strong>{pageTitles[active].title}</strong></div>
          <div className="top-actions">
            <button className="secondary-button" onClick={openStore}><Store size={16} /> Boutique</button>
            {canManageStock && <button className="secondary-button" onClick={() => navigate('purchases')}><PackagePlus size={16} /> Nouvel achat</button>}
            {canSell && <button className="primary-button" onClick={() => navigate('sales')}><ShoppingBag size={16} /> Nouvelle vente</button>}
          </div>
        </header>

        <div className="page">
          <header className="page-heading"><div><p>{pageTitles[active].eyebrow}</p><h1>{pageTitles[active].title}</h1><small>{pageTitles[active].description}</small></div><span className={`connection ${health.isError ? 'offline' : ''}`}><i />{health.isError ? 'Serveur indisponible' : health.isSuccess ? 'Données synchronisées' : 'Connexion…'}</span></header>
          {active === 'dashboard' && <DashboardPage onNavigate={navigate} />}
          {active === 'inventory' && <InventoryPage canManage={canManageStock} />}
          {active === 'purchases' && <PurchasesPage />}
          {active === 'sales' && <WholesaleSalesPage />}
          {active === 'orders' && <OrdersPage canUpdate={['OWNER', 'MANAGER', 'CASHIER', 'WAREHOUSE'].includes(user.role)} />}
          {active === 'partners' && <PartnersPage role={user.role} />}
          {active === 'team' && user.role === 'OWNER' && <TeamPage />}
        </div>
      </main>
    </div>
  );
}
