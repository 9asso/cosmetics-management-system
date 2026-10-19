import { z } from 'zod';
import { uuidSchema } from './shared.js';

export const createRetailOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(160),
    phone: z.string().trim().min(8).max(40),
    city: z.string().trim().min(2).max(100),
    address: z.string().trim().min(8).max(500),
    notes: z.string().trim().max(500).default(''),
  }),
  items: z.array(z.object({
    variantId: uuidSchema,
    quantity: z.coerce.number().int().min(1).max(50),
  })).min(1).max(30),
  paymentMethod: z.literal('COD').default('COD'),
  discountCode: z.string().trim().toUpperCase().max(40).optional(),
});

export type CreateRetailOrderInput = z.infer<typeof createRetailOrderSchema>;

export interface RetailOrderResult {
  id: string;
  orderNumber: string;
  status: 'ORDERED';
  paymentMethod: 'COD';
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  grandTotal: number;
  currency: 'MAD';
}

/** A storefront discount code, as returned by GET /store/discount-codes/:code. */
export interface StoreDiscount {
  code: string;
  type: 'PERCENT' | 'FIXED';
  /** Percentage (0-100) for PERCENT, amount in MAD for FIXED. */
  value: number;
  /** Cart subtotal (MAD) required before the code applies. */
  minSubtotal: number;
}

/** Amount taken off `subtotal`; shared so the cart and the API always agree. */
export function computeDiscount(discount: StoreDiscount, subtotal: number) {
  if (subtotal < discount.minSubtotal) return 0;
  const amount = discount.type === 'PERCENT' ? (subtotal * discount.value) / 100 : discount.value;
  return Math.round(Math.min(amount, subtotal) * 100) / 100;
}
