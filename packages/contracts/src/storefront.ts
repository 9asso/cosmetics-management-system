import { z } from 'zod';
import { moneySchema } from './shared.js';

export const storeCatalogSources = ['LIVE', 'DEMO'] as const;
export const storeProductScopes = ['VISIBLE', 'IN_STOCK'] as const;
export type StoreCatalogSource = (typeof storeCatalogSources)[number];
export type StoreProductScope = (typeof storeProductScopes)[number];

/** Online shop settings, edited by the owner in the desktop app. */
export const storefrontSettingsSchema = z.object({
  /** LIVE shows the real catalogue; DEMO shows sample products with ordering disabled. */
  catalogSource: z.enum(storeCatalogSources),
  /** VISIBLE: products switched "Visible dans la boutique"; IN_STOCK: every product with stock. */
  productScope: z.enum(storeProductScopes),
  freeShippingThreshold: moneySchema,
  shippingFee: moneySchema,
});

export type StorefrontSettings = z.infer<typeof storefrontSettingsSchema>;

export const defaultStorefrontSettings: StorefrontSettings = {
  catalogSource: 'LIVE',
  productScope: 'VISIBLE',
  freeShippingThreshold: 500,
  shippingFee: 35,
};

/** What the public storefront reads from GET /store/settings. */
export type PublicStorefrontSettings = Pick<
  StorefrontSettings,
  'catalogSource' | 'freeShippingThreshold' | 'shippingFee'
>;

export const discountCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,40}$/, 'Le code doit contenir 2 à 40 lettres, chiffres, tirets ou soulignés.'),
    type: z.enum(['PERCENT', 'FIXED']),
    value: z.coerce.number().finite().positive('La valeur doit être supérieure à 0.').max(999_999),
    minSubtotal: moneySchema.default(0),
    /** Last day the code can be used (inclusive), or null for no end date. */
    expiresOn: z.iso.date().nullable().default(null),
    active: z.boolean().default(true),
  })
  .refine((value) => value.type !== 'PERCENT' || value.value <= 100, {
    message: 'Un pourcentage ne peut pas dépasser 100 %.',
    path: ['value'],
  });

export type DiscountCodeInput = z.infer<typeof discountCodeSchema>;

export interface DiscountCodeItem extends DiscountCodeInput {
  id: string;
  /** Web orders placed with this code. */
  usageCount: number;
  createdAt: string;
}
