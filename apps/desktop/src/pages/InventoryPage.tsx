import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProductInput, ProductListItem } from '@cosmetics/contracts';
import { ArrowDownToLine, ChevronLeft, ChevronRight, MoreHorizontal, PackagePlus, Search, SlidersHorizontal } from 'lucide-react';
import { ErrorState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { StatusPill } from '../components/StatusPill';
import { api, ApiRequestError } from '../lib/api';
import { integer, money } from '../lib/format';

const emptyProduct: CreateProductInput = {
  name: '', brand: '', category: 'OTHER', description: '', sku: '', barcode: '',
  reference: '', supplierName: '', purchasePrice: 0, wholesalePrice: 0,
  retailPrice: 0, initialQuantity: 0, lowStockThreshold: 5, retailVisible: false,
};

const categoryLabels: Record<string, string> = {
  MAKEUP: 'Maquillage', SKIN_CARE: 'Soin de la peau', FRAGRANCE: 'Parfum',
  ACCESSORIES: 'Accessoires', HYGIENE: 'Hygiène', OTHER: 'Autre',
};

function StockStatus({ product }: { product: ProductListItem }) {
  if (product.onHand === 0) return <StatusPill tone="bad">Rupture</StatusPill>;
  if (product.onHand <= product.lowStockThreshold) return <StatusPill tone="warn">Stock faible</StatusPill>;
  return <StatusPill tone="good">Disponible</StatusPill>;
}

export function InventoryPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [stock, setStock] = useState<'all' | 'low' | 'out'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<CreateProductInput>(emptyProduct);
  const products = useQuery({
    queryKey: ['products', search, stock],
    queryFn: () => api.products({ search, stock, page: 1, pageSize: 50 }),
  });
  const create = useMutation({
    mutationFn: api.createProduct,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['products'] }),
        client.invalidateQueries({ queryKey: ['dashboard-summary'] }),
      ]);
      setShowCreate(false);
      setDraft(emptyProduct);
    },
  });

  const counts = useMemo(() => ({
    total: products.data?.total ?? 0,
    units: products.data?.items.reduce((sum, item) => sum + item.onHand, 0) ?? 0,
    value: products.data?.items.reduce((sum, item) => sum + item.onHand * item.purchasePrice, 0) ?? 0,
  }), [products.data]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(draft);
  };

  if (products.isError) {
    const message = products.error instanceof ApiRequestError ? products.error.message : 'Impossible de charger l’inventaire.';
    return <ErrorState message={message} retry={() => void products.refetch()} />;
  }

  return (
    <div className="inventory-stack">
      <section className="inventory-summary">
        <div><small>Références actives</small><strong>{integer.format(counts.total)}</strong></div>
        <div><small>Unités affichées</small><strong>{integer.format(counts.units)}</strong></div>
        <div><small>Valeur affichée</small><strong>{money.format(counts.value)}</strong></div>
        <button className="primary-button" onClick={() => setShowCreate(true)}><PackagePlus size={18} /> Nouveau produit</button>
      </section>

      <section className="panel inventory-panel">
        <div className="inventory-toolbar">
          <div className="table-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, marque, SKU ou code-barres" /></div>
          <div className="segmented" aria-label="Filtrer par stock">
            <button className={stock === 'all' ? 'active' : ''} onClick={() => setStock('all')}>Tous</button>
            <button className={stock === 'low' ? 'active' : ''} onClick={() => setStock('low')}>Faible</button>
            <button className={stock === 'out' ? 'active' : ''} onClick={() => setStock('out')}>Rupture</button>
          </div>
          <button className="secondary-button"><SlidersHorizontal size={16} /> Filtres</button>
          <button className="secondary-button"><ArrowDownToLine size={16} /> Exporter</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Produit</th><th>Référence</th><th>Catégorie</th><th>Stock</th><th>Prix achat</th><th>Prix grossiste</th><th>État</th><th /></tr></thead>
            <tbody>
              {products.isLoading && <tr><td colSpan={8} className="loading-cell">Chargement de l’inventaire…</td></tr>}
              {products.data?.items.map((product) => (
                <tr key={product.variantId}>
                  <td><div className="product-cell"><span>{product.name.slice(0, 1)}</span><div><strong>{product.name}</strong><small>{product.brand} · {product.sku}</small></div></div></td>
                  <td><span className="mono">{product.reference || '—'}</span><small className="sub-cell">{product.barcode || 'Sans code-barres'}</small></td>
                  <td>{categoryLabels[product.category]}</td>
                  <td><strong>{integer.format(product.onHand)}</strong><small className="sub-cell">{product.reserved} réservé</small></td>
                  <td>{money.format(product.purchasePrice)}</td>
                  <td>{money.format(product.wholesalePrice)}</td>
                  <td><StockStatus product={product} /></td>
                  <td><button className="icon-button"><MoreHorizontal size={18} /></button></td>
                </tr>
              ))}
              {products.data?.items.length === 0 && <tr><td colSpan={8} className="loading-cell">Aucun produit ne correspond à cette recherche.</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="table-footer"><span>{counts.total} résultat{counts.total === 1 ? '' : 's'}</span><div><button disabled><ChevronLeft size={16} /></button><b>1</b><button disabled><ChevronRight size={16} /></button></div></footer>
      </section>

      {showCreate && (
        <Modal title="Ajouter un produit" subtitle="Créez le produit, sa référence et son stock initial en une seule opération." onClose={() => setShowCreate(false)}>
          <form className="product-form" onSubmit={submit}>
            <div className="form-grid">
              <label><span>Nom du produit</span><input required minLength={2} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex. Sérum Éclat Vitamine C" /></label>
              <label><span>Marque</span><input required value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} placeholder="Ex. Lumera" /></label>
              <label><span>SKU</span><input required value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} placeholder="LUM-SER-C30" /></label>
              <label><span>Code-barres</span><input value={draft.barcode} onChange={(e) => setDraft({ ...draft, barcode: e.target.value })} placeholder="6110000000012" /></label>
              <label><span>Catégorie</span><select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as CreateProductInput['category'] })}>{Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label><span>Fournisseur</span><input value={draft.supplierName} onChange={(e) => setDraft({ ...draft, supplierName: e.target.value })} placeholder="Nom du fournisseur" /></label>
              <label><span>Prix d’achat (MAD)</span><input required type="number" min="0" step="0.01" value={draft.purchasePrice} onChange={(e) => setDraft({ ...draft, purchasePrice: Number(e.target.value) })} /></label>
              <label><span>Prix grossiste (MAD)</span><input required type="number" min="0" step="0.01" value={draft.wholesalePrice} onChange={(e) => setDraft({ ...draft, wholesalePrice: Number(e.target.value) })} /></label>
              <label><span>Prix retail (MAD)</span><input required type="number" min="0" step="0.01" value={draft.retailPrice} onChange={(e) => setDraft({ ...draft, retailPrice: Number(e.target.value) })} /></label>
              <label><span>Stock initial</span><input required type="number" min="0" step="1" value={draft.initialQuantity} onChange={(e) => setDraft({ ...draft, initialQuantity: Number(e.target.value) })} /></label>
            </div>
            <label className="checkbox"><input type="checkbox" checked={draft.retailVisible} onChange={(e) => setDraft({ ...draft, retailVisible: e.target.checked })} /><span>Publier plus tard dans la boutique retail</span></label>
            {create.isError && <p className="form-error">{create.error instanceof ApiRequestError ? create.error.message : 'Impossible d’ajouter ce produit.'}</p>}
            <footer className="modal-actions"><button className="secondary-button" type="button" onClick={() => setShowCreate(false)}>Annuler</button><button className="primary-button" type="submit" disabled={create.isPending}>{create.isPending ? 'Enregistrement…' : 'Ajouter le produit'}</button></footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
