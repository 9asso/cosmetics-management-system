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

// Only render safe public media addresses; no executable or inline data URLs.
export const mediaUrlSchema = z.string().trim().max(2000).refine(value => {
  if (/^\/(?!\/)[^\\\s]*$/.test(value)) return true;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}, 'Adresse de média invalide.');
export const productMediaSchema = z.object({
  images: z.array(mediaUrlSchema).max(10).refine(items => new Set(items).size === items.length, 'Images dupliquées.'),
  videoUrl: z.union([z.literal(''), mediaUrlSchema]).default(''),
});
export type ProductMediaInput = z.infer<typeof productMediaSchema>;

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(160),
  brand: z.string().trim().min(1).max(100),
  category: productCategorySchema.default('OTHER'),
  description: z.string().trim().max(2_000).default(''),
  imageUrl: z.union([z.literal(''), mediaUrlSchema]).default(''),
  sourceUrl: z.string().trim().max(2_000).default(''),
  sku: z.string().trim().min(1).max(80),
  barcode: z.string().trim().max(80).default(''),
  reference: z.string().trim().max(100).default(''),
  supplierName: z.string().trim().max(160).default(''),
  supplierId: z.string().uuid().optional(),
  media: productMediaSchema.optional(),
  imageUpload: z.object({ data: z.string().min(4).max(7_000_000) }).optional(),
  purchasePrice: moneySchema,
  wholesalePrice: moneySchema,
  retailPrice: moneySchema,
  compareAtPrice: moneySchema.optional(),
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
  description: string;
  imageUrl: string;
  images?: string[];
  videoUrl?: string;
  sourceUrl: string;
  sku: string;
  barcode: string;
  reference: string;
  supplierName: string;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  compareAtPrice: number | null;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  retailVisible: boolean;
}
