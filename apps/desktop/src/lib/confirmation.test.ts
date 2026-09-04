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
});
