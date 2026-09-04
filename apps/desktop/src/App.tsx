import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileText,
  HandCoins,
  Landmark,
  PackagePlus,
  PanelLeftClose,
  ReceiptText,
  Search,
  Settings,
  ShoppingBag,
  Store,
  Users,
} from 'lucide-react';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { api } from './lib/api';

type Section = 'dashboard' | 'inventory' | 'sales' | 'purchases' | 'customers' | 'checks' | 'expenses' | 'invoices' | 'store';

const navigation = [
  { id: 'dashboard', label: 'Vue d’ensemble', icon: BarChart3 },
  { id: 'inventory', label: 'Inventaire', icon: Boxes },
  { id: 'sales', label: 'Ventes en gros', icon: ShoppingBag },
  { id: 'purchases', label: 'Achats', icon: PackagePlus },
  { id: 'customers', label: 'Clients & crédits', icon: Users },
  { id: 'checks', label: 'Chèques', icon: Landmark },
  { id: 'expenses', label: 'Dépenses', icon: CircleDollarSign },
  { id: 'invoices', label: 'Factures', icon: ReceiptText },
  { id: 'store', label: 'Boutique en ligne', icon: Store, badge: 'Bientôt' },
] satisfies { id: Section; label: string; icon: typeof BarChart3; badge?: string }[];

const pageTitles: Record<Section, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: '', title: 'Bonjour, Youssef' },
  inventory: { eyebrow: 'Catalogue & stock', title: 'Inventaire' },
  sales: { eyebrow: 'Canal grossiste', title: 'Ventes en gros' },
  purchases: { eyebrow: 'Approvisionnement', title: 'Achats fournisseurs' },
  customers: { eyebrow: 'Relations commerciales', title: 'Clients & crédits' },
  checks: { eyebrow: 'Suivi des encaissements', title: 'Chèques' },
  expenses: { eyebrow: 'Comptabilité opérationnelle', title: 'Dépenses' },
  invoices: { eyebrow: 'Documents commerciaux', title: 'Factures' },
  store: { eyebrow: 'Canal retail', title: 'Boutique en ligne' },
};

function Placeholder({ section }: { section: Section }) {
  const content: Record<Exclude<Section, 'dashboard' | 'inventory'>, string> = {
    sales: 'Le point de vente grossiste, les paniers multi-produits et les paiements seront construits dans le prochain module.',
    purchases: 'Les bons de commande, réceptions partielles et crédits fournisseurs sont prêts dans le modèle de données.',
    customers: 'Les fiches clients, plafonds de crédit et allocations de paiement arrivent dans le prochain module.',
    checks: 'Le suivi des échéances, dépôts, encaissements et chèques impayés sera centralisé ici.',
    expenses: 'Les dépenses, salaires et rapports de rentabilité seront regroupés dans cet espace.',
    invoices: 'Les factures PDF, avoirs et exports seront générés depuis les documents commerciaux.',
    store: 'Le catalogue public Next.js utilisera les mêmes produits, prix retail et stocks disponibles.',
  };
  if (section === 'dashboard' || section === 'inventory') return null;
  const Icon = section === 'store' ? Store : ClipboardList;
  return (
    <div className="placeholder-card">
      <span><Icon size={28} /></span>
      <p className="overline">Module planifié</p>
      <h2>{pageTitles[section].title}</h2>
      <p>{content[section]}</p>
    </div>
  );
}

export function App() {
  const [active, setActive] = useState<Section>('dashboard');
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, retry: 1, refetchInterval: 30_000 });
  const todayLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">M<span>É</span></div>
          <div><strong>Maison Élan</strong><small>Gestion commerciale</small></div>
        </div>
        <nav aria-label="Navigation principale">
          <p className="nav-label">Espace de travail</p>
          {navigation.map(({ id, label, icon: Icon, badge }) => (
            <button key={id} className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => setActive(id)}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {badge && <em>{badge}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item"><Settings size={18} /><span>Paramètres</span></button>
          <div className="profile">
            <span className="avatar">YB</span>
            <div><strong>Youssef B.</strong><small>Administrateur</small></div>
            <ChevronDown size={16} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button" aria-label="Réduire le menu"><PanelLeftClose size={19} /></button>
          <div className="global-search"><Search size={17} /><input placeholder="Rechercher un produit, client, facture…" /><kbd>⌘ K</kbd></div>
          <button className="ghost-button"><FileText size={17} /> Nouveau document</button>
          <button className="primary-button" onClick={() => setActive('sales')}><HandCoins size={17} /> Nouvelle vente</button>
        </header>

        <div className="page">
          <header className="page-heading">
            <div><p>{active === 'dashboard' ? todayLabel : pageTitles[active].eyebrow}</p><h1>{pageTitles[active].title}</h1></div>
            <span className={`connection ${health.isError ? 'offline' : ''}`}>
              <i /> {health.isError ? 'Mode hors connexion' : health.isSuccess ? 'Données synchronisées' : 'Connexion…'}
            </span>
          </header>
          {active === 'dashboard' && <DashboardPage onOpenInventory={() => setActive('inventory')} />}
          {active === 'inventory' && <InventoryPage />}
          <Placeholder section={active} />
        </div>
      </main>
    </div>
  );
}
