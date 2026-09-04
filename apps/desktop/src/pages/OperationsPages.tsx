import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BusinessPartner,
  CreateCustomerInput,
  CreateSupplierInput,
} from '@cosmetics/contracts';
import {
  ArrowDownToLine,
  Building2,
  CheckCircle2,
  PackagePlus,
  Plus,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { ErrorState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { api, ApiRequestError } from '../lib/api';
import { integer, money } from '../lib/format';

const paymentOptions = [
  ['CASH', 'Espèces'], ['CHECK', 'Chèque'], ['TRANSFER', 'Virement'], ['CREDIT', 'À crédit'],
] as const;

export function PurchasesPage() {
  const cache = useQueryClient();
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: api.suppliers });
  const products = useQuery({ queryKey: ['products', 'operations'], queryFn: () => api.products({ page: 1, pageSize: 100, stock: 'all' }) });
  const [supplierId, setSupplierId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(12);
  const [unitCost, setUnitCost] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHECK' | 'TRANSFER' | 'CREDIT'>('CREDIT');
  const [notes, setNotes] = useState('');
  const purchase = useMutation({
    mutationFn: api.createPurchase,
    onSuccess: async () => {
      await Promise.all([cache.invalidateQueries({ queryKey: ['products'] }), cache.invalidateQueries({ queryKey: ['dashboard-summary'] })]);
      setQuantity(12); setPaidAmount(0); setNotes('');
    },
  });
  const selected = products.data?.items.find((product) => product.variantId === variantId);
  const total = quantity * unitCost;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    purchase.mutate({ supplierId, items: [{ variantId, quantity, unitCost }], paidAmount, paymentMethod, notes });
  };
  if (suppliers.isError || products.isError) return <ErrorState message="Impossible de charger les données d’approvisionnement." retry={() => { void suppliers.refetch(); void products.refetch(); }} />;
  return (
    <div className="operation-layout">
      <form className="panel operation-form" onSubmit={submit}>
        <div className="section-title"><span className="summary-icon pink"><ArrowDownToLine size={20} /></span><div><p className="eyebrow">Entrée de stock</p><h2>Réception fournisseur</h2><small>Une réception validée augmente immédiatement le stock partagé.</small></div></div>
        <div className="form-grid">
          <label><span>Fournisseur</span><select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Choisir un fournisseur</option>{suppliers.data?.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
          <label><span>Produit</span><select required value={variantId} onChange={(event) => { const id = event.target.value; setVariantId(id); setUnitCost(products.data?.items.find((item) => item.variantId === id)?.purchasePrice ?? 0); }}><option value="">Choisir un produit</option>{products.data?.items.map((product) => <option key={product.variantId} value={product.variantId}>{product.name} · {product.sku}</option>)}</select></label>
          <label><span>Quantité reçue</span><input required min="1" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
          <label><span>Coût unitaire (MAD)</span><input required min="0" step="0.01" type="number" value={unitCost} onChange={(event) => setUnitCost(Number(event.target.value))} /></label>
          <label><span>Montant payé</span><input required min="0" max={total} step="0.01" type="number" value={paidAmount} onChange={(event) => setPaidAmount(Number(event.target.value))} /></label>
          <label><span>Mode de paiement</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}>{paymentOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        </div>
        <label className="full-field"><span>Note</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="N° bon fournisseur, lot, remarque…" /></label>
        {purchase.isError && <p className="form-error">{purchase.error instanceof ApiRequestError ? purchase.error.message : 'Réception impossible.'}</p>}
        {purchase.data && <p className="form-success"><CheckCircle2 size={17} /> {purchase.data.documentNumber} reçue avec succès.</p>}
        <button className="primary-button" disabled={purchase.isPending}>{purchase.isPending ? 'Validation…' : 'Valider la réception'}</button>
      </form>
      <aside className="operation-aside">
        <article className="panel total-card"><p className="eyebrow">Résumé</p><h3>{selected?.name ?? 'Aucun produit'}</h3><div><span>Quantité</span><strong>{integer.format(quantity)}</strong></div><div><span>Coût unitaire</span><strong>{money.format(unitCost)}</strong></div><div className="grand"><span>Total achat</span><strong>{money.format(total)}</strong></div><small>Reste fournisseur : {money.format(Math.max(0, total - paidAmount))}</small></article>
        <article className="process-card"><PackagePlus size={21} /><strong>Impact stock</strong><p>La quantité reçue devient disponible pour la vente grossiste et la boutique.</p></article>
      </aside>
    </div>
  );
}

export function WholesaleSalesPage() {
  const cache = useQueryClient();
  const customers = useQuery({ queryKey: ['customers'], queryFn: api.customers });
  const products = useQuery({ queryKey: ['products', 'sale'], queryFn: () => api.products({ page: 1, pageSize: 100, stock: 'all' }) });
  const [customerId, setCustomerId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(12);
  const [unitPrice, setUnitPrice] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHECK' | 'TRANSFER' | 'CREDIT'>('CASH');
  const [notes, setNotes] = useState('');
  const sale = useMutation({
    mutationFn: api.createWholesaleSale,
    onSuccess: async () => {
      await Promise.all([cache.invalidateQueries({ queryKey: ['products'] }), cache.invalidateQueries({ queryKey: ['orders'] }), cache.invalidateQueries({ queryKey: ['dashboard-summary'] })]);
      setQuantity(12); setPaidAmount(0); setNotes('');
    },
  });
  const selected = products.data?.items.find((product) => product.variantId === variantId);
  const total = quantity * unitPrice;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    sale.mutate({ customerId, items: [{ variantId, quantity, unitPrice }], paidAmount, paymentMethod, notes });
  };
  if (customers.isError || products.isError) return <ErrorState message="Impossible de charger les données de vente." retry={() => { void customers.refetch(); void products.refetch(); }} />;
  return (
    <div className="operation-layout">
      <form className="panel operation-form" onSubmit={submit}>
        <div className="section-title"><span className="summary-icon green"><ShoppingCart size={20} /></span><div><p className="eyebrow">Sortie de stock</p><h2>Nouvelle vente grossiste</h2><small>Le stock est déduit dès validation de la facture.</small></div></div>
        <div className="form-grid">
          <label><span>Client grossiste</span><select required value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Choisir un client</option>{customers.data?.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label><span>Produit</span><select required value={variantId} onChange={(event) => { const id = event.target.value; setVariantId(id); setUnitPrice(products.data?.items.find((item) => item.variantId === id)?.wholesalePrice ?? 0); }}><option value="">Choisir un produit</option>{products.data?.items.filter((product) => product.available > 0).map((product) => <option key={product.variantId} value={product.variantId}>{product.name} · {product.available} disponibles</option>)}</select></label>
          <label><span>Quantité vendue</span><input required min="1" max={selected?.available ?? 999999} type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
          <label><span>Prix unitaire grossiste</span><input required min="0" step="0.01" type="number" value={unitPrice} onChange={(event) => setUnitPrice(Number(event.target.value))} /></label>
          <label><span>Montant encaissé</span><input required min="0" max={total} step="0.01" type="number" value={paidAmount} onChange={(event) => setPaidAmount(Number(event.target.value))} /></label>
          <label><span>Mode de paiement</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}>{paymentOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        </div>
        <label className="full-field"><span>Note de facture</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Conditions, livraison, référence client…" /></label>
        {sale.isError && <p className="form-error">{sale.error instanceof ApiRequestError ? sale.error.message : 'Vente impossible.'}</p>}
        {sale.data && <p className="form-success"><CheckCircle2 size={17} /> Facture {sale.data.documentNumber} créée.</p>}
        <button className="primary-button" disabled={sale.isPending}>{sale.isPending ? 'Validation…' : 'Créer la vente'}</button>
      </form>
      <aside className="operation-aside"><article className="panel total-card"><p className="eyebrow">Résumé</p><h3>{selected?.name ?? 'Aucun produit'}</h3><div><span>Stock disponible</span><strong>{integer.format(selected?.available ?? 0)}</strong></div><div><span>Quantité</span><strong>{integer.format(quantity)}</strong></div><div className="grand"><span>Total vente</span><strong>{money.format(total)}</strong></div><small>Créance client : {money.format(Math.max(0, total - paidAmount))}</small></article><article className="process-card sale"><ShoppingCart size={21} /><strong>Stock commun</strong><p>Cette vente réduit la quantité immédiatement disponible dans la boutique.</p></article></aside>
    </div>
  );
}

const blankSupplier: CreateSupplierInput = { name: '', phone: '', email: '', address: '' };
const blankCustomer: CreateCustomerInput = { ...blankSupplier, creditLimit: 0 };

export function PartnersPage({ role = 'OWNER' }: { role?: 'OWNER' | 'MANAGER' | 'CASHIER' | 'WAREHOUSE' | 'ACCOUNTANT' | 'STAFF' }) {
  const cache = useQueryClient();
  const [tab, setTab] = useState<'customers' | 'suppliers'>('customers');
  const [showCreate, setShowCreate] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState(blankSupplier);
  const [customerDraft, setCustomerDraft] = useState(blankCustomer);
  const customers = useQuery({ queryKey: ['customers'], queryFn: api.customers });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: api.suppliers });
  const create = useMutation({
    mutationFn: () => tab === 'customers' ? api.createCustomer(customerDraft) : api.createSupplier(supplierDraft),
    onSuccess: async () => { await cache.invalidateQueries({ queryKey: [tab] }); setShowCreate(false); setSupplierDraft(blankSupplier); setCustomerDraft(blankCustomer); },
  });
  const list = tab === 'customers' ? customers.data : suppliers.data;
  const canCreate = ['OWNER', 'MANAGER'].includes(role) || (tab === 'customers' && role === 'CASHIER') || (tab === 'suppliers' && role === 'WAREHOUSE');
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate(); };
  return <div className="page-stack">
    <section className="panel data-panel"><div className="data-toolbar"><div className="segmented"><button className={tab === 'customers' ? 'active' : ''} onClick={() => setTab('customers')}><Users size={15} /> Clients</button><button className={tab === 'suppliers' ? 'active' : ''} onClick={() => setTab('suppliers')}><Building2 size={15} /> Fournisseurs</button></div>{canCreate && <button className="primary-button push-right" onClick={() => setShowCreate(true)}><Plus size={17} /> Ajouter</button>}</div>
    <div className="partner-grid">{list?.map((partner: BusinessPartner) => <article className="partner-card" key={partner.id}><span>{tab === 'customers' ? <Users size={19} /> : <Building2 size={19} />}</span><div><strong>{partner.name}</strong><small>{partner.phone || 'Téléphone non renseigné'}</small><small>{partner.email || partner.address || 'Coordonnées à compléter'}</small>{partner.creditLimit !== undefined && <em>Crédit autorisé : {money.format(partner.creditLimit)}</em>}</div></article>)}</div></section>
    {showCreate && <Modal title={tab === 'customers' ? 'Nouveau client grossiste' : 'Nouveau fournisseur'} onClose={() => setShowCreate(false)}><form className="product-form" onSubmit={submit}><div className="form-grid"><label><span>Nom</span><input required value={tab === 'customers' ? customerDraft.name : supplierDraft.name} onChange={(e) => tab === 'customers' ? setCustomerDraft({ ...customerDraft, name: e.target.value }) : setSupplierDraft({ ...supplierDraft, name: e.target.value })} /></label><label><span>Téléphone</span><input value={tab === 'customers' ? customerDraft.phone : supplierDraft.phone} onChange={(e) => tab === 'customers' ? setCustomerDraft({ ...customerDraft, phone: e.target.value }) : setSupplierDraft({ ...supplierDraft, phone: e.target.value })} /></label><label><span>Email</span><input type="email" value={tab === 'customers' ? customerDraft.email : supplierDraft.email} onChange={(e) => tab === 'customers' ? setCustomerDraft({ ...customerDraft, email: e.target.value }) : setSupplierDraft({ ...supplierDraft, email: e.target.value })} /></label><label><span>Adresse</span><input value={tab === 'customers' ? customerDraft.address : supplierDraft.address} onChange={(e) => tab === 'customers' ? setCustomerDraft({ ...customerDraft, address: e.target.value }) : setSupplierDraft({ ...supplierDraft, address: e.target.value })} /></label>{tab === 'customers' && <label><span>Plafond de crédit</span><input min="0" type="number" value={customerDraft.creditLimit} onChange={(e) => setCustomerDraft({ ...customerDraft, creditLimit: Number(e.target.value) })} /></label>}</div>{create.isError && <p className="form-error">Création impossible.</p>}<footer className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Annuler</button><button className="primary-button" disabled={create.isPending}>{create.isPending ? 'Ajout…' : 'Enregistrer'}</button></footer></form></Modal>}
  </div>;
}
