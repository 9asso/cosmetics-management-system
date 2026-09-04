import { z } from 'zod';
import { moneySchema, paginationQuerySchema } from './shared.js';

export const productCategories = [
  'MAKEUP',
  'SKIN_CARE',
  'FRAGRANCE',
  'ACCESSORIES',
  'HYGIENE',
  'OTHER',
] as const;

export const productCategorySchema = z.enum(productCategories);

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(160),
  brand: z.string().trim().min(1).max(100),
  category: productCategorySchema.default('OTHER'),
  description: z.string().trim().max(2_000).default(''),
  sku: z.string().trim().min(1).max(80),
  barcode: z.string().trim().max(80).default(''),
  reference: z.string().trim().max(100).default(''),
  supplierName: z.string().trim().max(160).default(''),
  purchasePrice: moneySchema,
  wholesalePrice: moneySchema,
  retailPrice: moneySchema,
  initialQuantity: z.coerce.number().int().min(0).max(999_999).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(999_999).default(5),
  retailVisible: z.boolean().default(false),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const productListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(160).default(''),
  category: productCategorySchema.optional(),
  stock: z.enum(['all', 'low', 'out']).default('all'),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export interface ProductListItem {
  id: string;
  variantId: string;
  name: string;
  brand: string;
  category: (typeof productCategories)[number];
  sku: string;
  barcode: string;
  reference: string;
  supplierName: string;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  retailVisible: boolean;
}
