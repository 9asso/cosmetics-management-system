import { describe, expect, it } from 'vitest';
import { adjustInventorySchema, createProductSchema, createRetailOrderSchema } from './index.js';

describe('shared API contracts', () => {
  it('normalizes numeric product fields', () => {
    const value = createProductSchema.parse({
      name: 'Glow Serum',
      brand: 'ONight',
      sku: 'SERUM-001',
      purchasePrice: '40',
      wholesalePrice: '55',
      retailPrice: '70',
    });

    expect(value.purchasePrice).toBe(40);
    expect(value.category).toBe('OTHER');
  });

  it('rejects zero-value inventory adjustments', () => {
    const result = adjustInventorySchema.safeParse({
      variantId: '4f7f6d2f-7ba2-4a3e-9a03-0a9d9324bca1',
      quantityDelta: 0,
      reason: 'CORRECTION',
      note: 'Cycle count',
    });

    expect(result.success).toBe(false);
  });

  it('allows only cash on delivery for retail orders', () => {
    const base = {
      customer: { name: 'Sara Amrani', phone: '0612345678', city: 'Casablanca', address: '12 rue des Fleurs' },
      items: [{ variantId: '4f7f6d2f-7ba2-4a3e-9a03-0a9d9324bca1', quantity: 2 }],
    };
    expect(createRetailOrderSchema.parse(base).paymentMethod).toBe('COD');
    expect(createRetailOrderSchema.safeParse({ ...base, paymentMethod: 'CARD' }).success).toBe(false);
  });
});
