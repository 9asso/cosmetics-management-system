import type { ProductListItem } from '@cosmetics/contracts';
import { Barcode, Boxes, Building2, CircleDollarSign, Eye, EyeOff, PackageCheck, Tag } from 'lucide-react';
import { Modal } from './Modal';
import { money } from '../lib/format';

const categories: Record<ProductListItem['category'], string> = {
  MAKEUP: 'Maquillage',
  SKIN_CARE: 'Soin de la peau',
  FRAGRANCE: 'Parfum',
  ACCESSORIES: 'Accessoires',
  HYGIENE: 'Hygiène',
  OTHER: 'Autre',
};

function Detail({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-line bg-white p-3">
    <dt className="text-[9px] font-bold uppercase tracking-wider text-muted">{label}</dt>
    <dd className="mt-1.5 break-words text-xs font-bold text-ink">{value}</dd>
  </div>;
}

export function ProductDetailModal({ product, onClose }: { product: ProductListItem; onClose: () => void }) {
  const stockTone = product.available === 0
    ? 'bg-rose-50 text-rose-700'
    : product.available <= product.lowStockThreshold
      ? 'bg-amber-50 text-amber-700'
      : 'bg-emerald-50 text-emerald-700';
  const stockLabel = product.available === 0 ? 'Rupture' : product.available <= product.lowStockThreshold ? 'Stock faible' : 'En stock';

  return <Modal title="Fiche produit" subtitle={`${product.sku} · catalogue et stock partagé`} onClose={onClose} size="wide">
    <div className="p-5 sm:p-6">
      <section className="grid overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-[260px_1fr]">
        <div className="relative grid min-h-60 place-items-center overflow-hidden bg-linear-to-br from-brand-soft via-white to-pink-50 p-6">
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-brand shadow-sm">{categories[product.category]}</span>
          {product.imageUrl
            ? <img src={product.imageUrl} alt={product.name} className="max-h-56 w-full object-contain drop-shadow-[0_18px_28px_rgba(60,28,41,.12)]" />
            : <span className="grid size-28 place-items-center rounded-3xl bg-white text-5xl font-bold text-brand shadow-sm">{product.name[0]}</span>}
        </div>
        <div className="flex flex-col justify-between p-5 sm:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${stockTone}`}>{stockLabel}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold ${product.retailVisible ? 'bg-brand-soft text-brand' : 'bg-stone-100 text-muted'}`}>
                {product.retailVisible ? <Eye size={12} /> : <EyeOff size={12} />}{product.retailVisible ? 'Visible en boutique' : 'Masqué en boutique'}
              </span>
            </div>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-brand">{product.brand}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">{product.name}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{product.description || 'Aucune description renseignée pour ce produit.'}</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-[10px] text-muted">
            <span className="inline-flex items-center gap-1.5"><Tag size={14} className="text-brand" />Réf. {product.reference || '—'}</span>
            <span className="inline-flex items-center gap-1.5"><Barcode size={14} className="text-brand" />{product.barcode || 'Sans code-barres'}</span>
            <span className="inline-flex items-center gap-1.5"><Building2 size={14} className="text-brand" />{product.supplierName || 'Fournisseur non affecté'}</span>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted"><Boxes size={16} className="text-brand" />Stock physique</div>
          <strong className="mt-2 block text-2xl text-ink">{product.onHand}</strong>
          <small className="text-[10px] text-muted">{product.reserved} unité(s) réservée(s)</small>
        </article>
        <article className={`rounded-2xl border border-line p-4 ${stockTone}`}>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"><PackageCheck size={16} />Disponible</div>
          <strong className="mt-2 block text-2xl">{product.available}</strong>
          <small className="text-[10px] opacity-75">Alerte à {product.lowStockThreshold} unité(s)</small>
        </article>
        <article className="rounded-2xl border border-brand/10 bg-brand-soft/60 p-4 text-brand">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"><CircleDollarSign size={16} />Prix boutique</div>
          <strong className="mt-2 block text-2xl">{money.format(product.retailPrice)}</strong>
          <small className="text-[10px] text-muted">{product.compareAtPrice === null ? 'Aucun ancien prix' : `Ancien prix ${money.format(product.compareAtPrice)}`}</small>
        </article>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-widest text-brand">Tarification</p><h3 className="mt-1 text-sm font-bold">Prix et marge unitaire</h3></div><CircleDollarSign size={20} className="text-brand" /></div>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Detail label="Prix d’achat" value={money.format(product.purchasePrice)} />
          <Detail label="Prix grossiste" value={money.format(product.wholesalePrice)} />
          <Detail label="Prix boutique" value={money.format(product.retailPrice)} />
        </dl>
      </section>

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        {/^https?:\/\//.test(product.sourceUrl)
          ? <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-brand hover:underline">Voir la source du produit ↗</a>
          : <span className="text-[10px] text-muted">Dernières données synchronisées avec le stock partagé.</span>}
        <button type="button" className="inline-flex rounded-lg bg-linear-to-r from-brand to-brand-secondary px-5 py-2 text-xs font-bold text-white shadow-sm" onClick={onClose}>Fermer</button>
      </footer>
    </div>
  </Modal>;
}
