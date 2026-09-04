import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { InvoiceListItem } from '@cosmetics/contracts';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { ui } from '../lib/ui';
import { money } from '../lib/format';
import { ErrorState } from '../components/EmptyState';
import { InvoiceDetailModal, documentStatuses } from '../components/InvoiceDetailModal';

export function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'all' | 'sale' | 'purchase'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<InvoiceListItem | null>(null);
  const invoices = useQuery({ queryKey: ['invoices', search, kind, page], queryFn: () => api.invoices({ search, kind, page }) });
  if (invoices.isError) return <ErrorState message="Impossible de charger les factures." retry={() => void invoices.refetch()} />;
  return <div className={ui('page-stack')}>
    <p className="text-xs leading-relaxed text-muted">Ventes confirmées, achats reçus et documents annulés. Les commandes non confirmées restent dans Commandes & livraisons. Les coordonnées sont conservées au moment de l’émission.</p>
    <section className={ui('panel data-panel')}>
      <div className={ui('data-toolbar')}><label className={ui('table-search')}><Search size={16} /><input aria-label="Rechercher une facture" placeholder="N° facture, client ou fournisseur" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
        <select aria-label="Type de facture" value={kind} onChange={event => { setKind(event.target.value as typeof kind); setPage(1); }}><option value="all">Tous les documents</option><option value="sale">Ventes</option><option value="purchase">Achats fournisseurs</option></select>
      </div>
      <div className={ui('table-wrap')}><table><thead><tr><th>Document</th><th>Partenaire</th><th>Date</th><th>État</th><th>Total</th><th>Réglé</th><th /></tr></thead><tbody>
        {invoices.data?.items.map(invoice => <tr key={`${invoice.kind}-${invoice.id}`} className="cursor-pointer" onClick={() => setSelected(invoice)}><td><button className="text-left font-bold text-brand" onClick={event => { event.stopPropagation(); setSelected(invoice); }}>{invoice.documentNumber}</button><small className={ui('sub-cell')}>{invoice.kind === 'sale' ? 'Vente' : 'Achat'}</small></td><td>{invoice.partnerName}</td><td>{new Date(invoice.issuedAt).toLocaleDateString('fr-FR')}</td><td>{documentStatuses[invoice.status] ?? invoice.status}</td><td>{money.format(invoice.total)}</td><td>{money.format(invoice.amountPaid)}</td><td>Voir →</td></tr>)}
        {(invoices.isLoading || invoices.data?.items.length === 0) && <tr><td colSpan={7} className={ui('loading-cell')}>{invoices.isLoading ? 'Chargement…' : 'Aucun document trouvé.'}</td></tr>}
      </tbody></table></div>
      <footer className={ui('table-footer')}><span>{invoices.data?.total ?? 0} documents · page {page}</span><div className="flex gap-2"><button className={ui('secondary-button compact')} disabled={page === 1} onClick={() => setPage(page - 1)}>Précédent</button><button className={ui('secondary-button compact')} disabled={page * 25 >= (invoices.data?.total ?? 0)} onClick={() => setPage(page + 1)}>Suivant</button></div></footer>
    </section>
    {selected && <InvoiceDetailModal kind={selected.kind} id={selected.id} onClose={() => setSelected(null)} />}
  </div>;
}
