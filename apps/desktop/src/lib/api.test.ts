// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { registerConfirmation } from './confirmation';
Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() } });
const { api } = await import('./api');
beforeEach(() => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'test' }) })); });
afterEach(() => { registerConfirmation(undefined); vi.unstubAllGlobals(); });
describe('API write gate', () => {
  it('does not send a request when a mutation is canceled', async () => {
    registerConfirmation(async () => false);
    await expect(api.deleteCustomer('test')).rejects.toMatchObject({ status: 499 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('sends a confirmed mutation exactly once', async () => {
    registerConfirmation(async () => true);
    await api.updateUser('test', { role: 'MANAGER' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not require confirmation for reads or authentication', async () => {
    await api.me();
    await api.login({ email: 'test@example.test', password: 'not-a-real-password' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
