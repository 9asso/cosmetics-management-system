import { afterEach, describe, expect, it } from 'vitest';
import { confirmChange, mutationConfirmation, registerConfirmation } from './confirmation';
afterEach(() => { registerConfirmation(undefined); });
describe('mutation confirmations', () => {
  it('fails closed without a mounted confirmation UI', async () => {
    expect(await confirmChange({ title: 'Save?', detail: '' })).toBe(false);
  });
  it('waits for a decision and preserves cancellation', async () => {
    registerConfirmation(async () => false);
    expect(await confirmChange({ title: 'Save?', detail: '' })).toBe(false);
    registerConfirmation(async () => true);
    expect(await confirmChange({ title: 'Save?', detail: '' })).toBe(true);
  });
  it('never includes passwords or uploaded image bytes in the confirmation', () => {
    const result = mutationConfirmation('/users', 'POST', JSON.stringify({ displayName: 'Salma', role: 'STAFF', password: 'SECRET_VALUE' }));
    expect(result.detail).toContain('Salma');
    expect(JSON.stringify(result)).not.toContain('SECRET_VALUE');
  });
  it('explains archive and delivery effects', () => {
    expect(mutationConfirmation('/customers/test', 'DELETE').detail).toContain('conservés');
    expect(mutationConfirmation('/orders/test/status', 'PATCH', '{"status":"DELIVERED"}').detail).toContain('encaissé');
  });
  it('describes storefront settings and discount code changes', () => {
    const live = mutationConfirmation('/settings/storefront', 'PATCH', JSON.stringify({ catalogSource: 'LIVE', productScope: 'IN_STOCK', freeShippingThreshold: 1000, shippingFee: 35 }));
    expect(live.detail).toContain('tous les produits en stock');
    expect(live.detail).toContain('1000 MAD');
    expect(mutationConfirmation('/settings/storefront', 'PATCH', JSON.stringify({ catalogSource: 'DEMO' })).destructive).toBe(true);
    expect(mutationConfirmation('/settings/discount-codes', 'POST', JSON.stringify({ code: 'ete25', type: 'PERCENT', value: 25, minSubtotal: 300, active: true })).title).toBe('Créer le code ETE25 ?');
    expect(mutationConfirmation('/settings/discount-codes/id', 'DELETE').title).toBe('Supprimer ce code de réduction ?');
  });
});
