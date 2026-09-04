import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  PackageX,
  Scale,
  ShoppingCart,
  PackagePlus,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { ErrorState } from '../components/EmptyState';
import { api, ApiRequestError } from '../lib/api';
import { integer, money } from '../lib/format';

const activity = [
  { title: 'Réception fournisseur', detail: 'Atlas Beauty Supply · 48 unités', time: '09:42', tone: 'green' },
  { title: 'Facture réglée', detail: 'FAC-2026-0087 · Salma Cosmétique', time: '09:18', tone: 'gold' },
  { title: 'Ajustement inventaire', detail: 'Glow Serum · +6 unités', time: 'Hier', tone: 'blue' },
];

export function DashboardPage({
  onNavigate,
}: {
  onNavigate: (section: 'inventory' | 'sales' | 'purchases' | 'orders') => void;
}) {
  const summary = useQuery({ queryKey: ['dashboard-summary'], queryFn: api.dashboard });

  if (summary.isError) {
    const message = summary.error instanceof ApiRequestError ? summary.error.message : 'Impossible de charger le tableau de bord.';
    return <ErrorState message={message} retry={() => void summary.refetch()} />;
  }

  const value = summary.data;
  const cards = [
    { label: 'Chiffre d’affaires', value: value ? money.format(value.revenue) : '—', icon: TrendingUp, detail: 'Ventes confirmées', tone: 'ink' },
    { label: 'Marge brute', value: value ? money.format(value.grossMargin) : '—', icon: Scale, detail: 'Après coût des produits', tone: 'green' },
    { label: 'Valeur du stock', value: value ? money.format(value.inventoryValue) : '—', icon: Boxes, detail: value ? `${integer.format(value.unitsInStock)} unités disponibles` : 'Chargement…', tone: 'gold' },
    { label: 'Créances clients', value: value ? money.format(value.customerReceivables) : '—', icon: WalletCards, detail: 'Montants à recouvrer', tone: 'rose' },
  ];

  return (
    <div className="dashboard-stack">
      <section className="metric-grid">
        {cards.map(({ label, value: cardValue, icon: Icon, detail, tone }) => (
          <article className={`metric-card metric-${tone}`} key={label}>
            <div className="metric-top"><span>{label}</span><i><Icon size={19} /></i></div>
            <strong>{cardValue}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel performance-panel">
          <div className="panel-heading">
            <div><p className="overline">Performance</p><h2>Activité commerciale</h2></div>
            <span className="live-label">Vue cumulée</span>
          </div>
          <div className="chart-placeholder">
            <div className="chart-y"><span>75k</span><span>50k</span><span>25k</span><span>0</span></div>
            <div className="chart-bars" aria-label="Aperçu graphique">
              {[42, 58, 47, 72, 63, 86, 78, 92, 68, 84, 76, 96].map((height, index) => (
                <span key={index} style={{ '--height': `${height}%` } as CSSProperties}><i /></span>
              ))}
            </div>
            <div className="chart-x"><span>Jan</span><span>Mar</span><span>Mai</span><span>Juil</span><span>Sep</span><span>Nov</span></div>
          </div>
          <div className="chart-legend"><span><i className="legend-sales" /> Chiffre d’affaires</span><span><i className="legend-margin" /> Marge</span></div>
        </article>

        <article className="panel alerts-panel">
          <div className="panel-heading"><div><p className="overline">Attention requise</p><h2>Alertes</h2></div></div>
          <button className="alert-row" onClick={() => onNavigate('inventory')}>
            <span className="alert-icon warning"><AlertTriangle size={18} /></span>
            <div><strong>Stock faible</strong><small>{value?.lowStockCount ?? '—'} références sous le seuil</small></div>
            <ArrowRight size={17} />
          </button>
          <button className="alert-row" onClick={() => onNavigate('inventory')}>
            <span className="alert-icon danger"><PackageX size={18} /></span>
            <div><strong>Ruptures de stock</strong><small>{value?.outOfStockCount ?? '—'} références indisponibles</small></div>
            <ArrowRight size={17} />
          </button>
          <button className="alert-row" onClick={() => onNavigate('orders')}>
            <span className="alert-icon blue"><Banknote size={18} /></span>
            <div><strong>Chèques en attente</strong><small>{value?.pendingChecks ?? '—'} chèques à suivre</small></div>
            <ArrowRight size={17} />
          </button>
          <button className="text-button" onClick={() => onNavigate('inventory')}>Voir toutes les alertes <ArrowRight size={15} /></button>
        </article>
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="panel quick-panel">
          <div className="panel-heading"><div><p className="overline">Raccourcis</p><h2>Actions rapides</h2></div></div>
          <div className="quick-actions">
            <button onClick={() => onNavigate('sales')}><span><ShoppingCart size={20} /></span><strong>Nouvelle vente</strong><small>Créer une facture grossiste</small></button>
            <button onClick={() => onNavigate('inventory')}><span><Boxes size={20} /></span><strong>Ajouter un produit</strong><small>Enrichir le catalogue</small></button>
            <button onClick={() => onNavigate('purchases')}><span><PackagePlus size={20} /></span><strong>Nouvel achat</strong><small>Réceptionner du stock</small></button>
          </div>
        </article>
        <article className="panel activity-panel">
          <div className="panel-heading"><div><p className="overline">Journal</p><h2>Activité récente</h2></div></div>
          {activity.map((item) => (
            <div className="activity-row" key={item.title}>
              <i className={`activity-dot ${item.tone}`} />
              <div><strong>{item.title}</strong><small>{item.detail}</small></div>
              <time>{item.time}</time>
            </div>
          ))}
        </article>
      </section>
    </div>
  );
}
