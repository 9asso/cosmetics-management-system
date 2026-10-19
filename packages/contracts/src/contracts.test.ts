import { describe, expect, it } from 'vitest';
import {
  adjustInventorySchema,
  computeDiscount,
  createProductSchema,
  createRetailOrderSchema,
  defaultStorefrontSettings,
  discountCodeSchema,
  storefrontSettingsSchema,
} from './index.js';

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
    expect(value.category).toBe('SKIN_CARE');
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

  it('normalizes discount codes to upper case', () => {
    const base = {
      customer: { name: 'Sara Amrani', phone: '0612345678', city: 'Casablanca', address: '12 rue des Fleurs' },
      items: [{ variantId: '4f7f6d2f-7ba2-4a3e-9a03-0a9d9324bca1', quantity: 1 }],
    };
    expect(createRetailOrderSchema.parse({ ...base, discountCode: ' bienvenue10 ' }).discountCode).toBe('BIENVENUE10');
    expect(createRetailOrderSchema.parse(base).discountCode).toBeUndefined();
  });

  it('computes discounts within the subtotal and minimum', () => {
    const percent = { code: 'P10', type: 'PERCENT', value: 10, minSubtotal: 0 } as const;
    const fixed = { code: 'F50', type: 'FIXED', value: 50, minSubtotal: 300 } as const;
    expect(computeDiscount(percent, 249.9)).toBe(24.99);
    expect(computeDiscount(fixed, 299)).toBe(0);
    expect(computeDiscount(fixed, 300)).toBe(50);
    expect(computeDiscount({ ...fixed, minSubtotal: 0 }, 20)).toBe(20);
  });
});

describe('storefront contracts', () => {
  it('normalizes discount codes and rejects impossible percentages', () => {
    const parsed = discountCodeSchema.parse({ code: ' ete25 ', type: 'PERCENT', value: '25' });
    expect(parsed).toEqual({ code: 'ETE25', type: 'PERCENT', value: 25, minSubtotal: 0, expiresOn: null, active: true });
    expect(discountCodeSchema.safeParse({ code: 'TROP', type: 'PERCENT', value: 120 }).success).toBe(false);
    expect(discountCodeSchema.safeParse({ code: 'BAD CODE', type: 'FIXED', value: 10 }).success).toBe(false);
    expect(discountCodeSchema.parse({ code: 'MAD50', type: 'FIXED', value: 150 }).value).toBe(150);
  });

  it('accepts storefront settings with non-negative money', () => {
    expect(storefrontSettingsSchema.parse({ ...defaultStorefrontSettings, freeShippingThreshold: '1000' }).freeShippingThreshold).toBe(1000);
    expect(storefrontSettingsSchema.safeParse({ ...defaultStorefrontSettings, shippingFee: -1 }).success).toBe(false);
    expect(storefrontSettingsSchema.safeParse({ ...defaultStorefrontSettings, productScope: 'ALL' }).success).toBe(false);
  });
});
