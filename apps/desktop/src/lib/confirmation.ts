export type Confirmation = { title: string; detail: string; destructive?: boolean };
type ConfirmationHandler = (value: Confirmation) => Promise<boolean>;
const globalKey = Symbol.for('onight.confirmation.handler');
const registry = globalThis as typeof globalThis & { [globalKey]?: ConfirmationHandler };

export function registerConfirmation(next: ConfirmationHandler | undefined) {
  registry[globalKey] = next;
  return () => { if (registry[globalKey] === next) registry[globalKey] = undefined; };
}

// Fail closed if the UI is not mounted: no write may skip confirmation.
export function confirmChange(value: Confirmation): Promise<boolean> {
  return registry[globalKey] ? registry[globalKey]!(value) : Promise.resolve(false);
}

export function mutationConfirmation(path: string, method: string, body?: string): Confirmation {
  const value = body ? JSON.parse(body) as Record<string, unknown> : {};
  if (path.startsWith('/finance/payments/')) return {title: 'Enregistrer ce règlement ?', detail: `${value.amount} MAD · ${value.method}. ${value.method === 'CHECK' ? 'Le chèque restera en attente jusqu’à son règlement bancaire.' : 'Le solde de la facture sera réduit immédiatement.'}`};
  if (path.startsWith('/finance/checks/')) {
    const labels: Record<string,string> = {DEPOSITED:'déposé',CLEARED:'réglé par la banque',BOUNCED:'rejeté',CANCELLED:'annulé'};
    return {title: `Marquer ce chèque comme ${labels[String(value.status)]} ?`, detail: value.status === 'CLEARED' ? 'Confirmez uniquement après vérification du règlement bancaire. Le solde de la facture sera réduit.' : 'Le solde de la facture ne sera pas réduit. Le changement sera conservé dans le journal.', destructive: ['BOUNCED','CANCELLED'].includes(String(value.status))};
  }
  if (path.endsWith('/void')) return {title:'Annuler cette dépense ?',detail:`Motif : ${value.reason}. Elle sera exclue des totaux et conservée dans l’historique.`,destructive:true};
  if (path === '/finance/expenses') return {title:'Enregistrer cette dépense ?',detail:`${value.name} · ${value.amount} MAD · ${value.incurredOn}.`};
  if (path.includes('/lots/')) {
    return {
      title: 'Modifier les prix du lot ?',
      detail: `Prix grossiste : ${value.wholesalePrice} MAD · Prix boutique : ${value.retailPrice} MAD. Les nouveaux prix s’appliqueront à ce lot en stock.`,
    };
  }
  const entity = path.startsWith('/products') ? 'le produit' : path.startsWith('/suppliers') ? 'le fournisseur' : path.startsWith('/customers') ? 'le client' : path.startsWith('/users') ? 'le compte' : 'cette opération';
  if (method === 'DELETE') return { title: `Supprimer ${entity} ?`, detail: 'Ce contact sera retiré des listes actives. Ses factures, paiements et coordonnées historiques seront conservés.', destructive: true };
  if (path.includes('/status')) {
    const names: Record<string, string> = { CONFIRMED: 'confirmer', DELIVERED: 'marquer comme livrée', CANCELED: 'annuler' };
    return { title: `Voulez-vous ${names[String(value.status)] ?? 'modifier'} cette commande ?`, detail: value.status === 'DELIVERED' ? 'La livraison retail déduit le stock réservé et marque le paiement à la livraison comme encaissé. Vérifiez sa réception avant de confirmer.' : value.status === 'CANCELED' ? 'Le stock sera libéré ou réintégré. Cette commande ne pourra plus être modifiée. Les paiements déjà encaissés nécessitent un remboursement séparé.' : 'La commande passera au statut confirmé.', destructive: value.status === 'CANCELED' };
  }
  if (path === '/inventory/adjustments') return { title: 'Valider l’ajustement du stock ?', detail: `Variation : ${value.quantityDelta} unités. Motif : ${value.note}. Le stock partagé sera mis à jour immédiatement.` };
  if (path === '/purchases' || path === '/wholesale-sales') return { title: path === '/purchases' ? 'Valider cette réception ?' : 'Créer cette facture de vente ?', detail: `Le stock partagé sera ${path === '/purchases' ? 'augmenté' : 'diminué'} immédiatement. Montant réglé : ${value.paidAmount} MAD. Vérifiez les produits, quantités et prix saisis.` };
  const changes = [value.name ?? value.displayName, value.role ? `Rôle : ${value.role}` : '', typeof value.active === 'boolean' ? (value.active ? 'Activer le compte' : 'Suspendre le compte') : ''].filter(Boolean).join(' · ');
  return { title: `${method === 'POST' ? 'Créer' : 'Modifier'} ${entity} ?`, detail: `${changes ? `${changes}. ` : ''}Confirmez l’enregistrement des informations saisies.`, destructive: value.active === false };
}
