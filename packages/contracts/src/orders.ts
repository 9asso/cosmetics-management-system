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
});

export type CreateRetailOrderInput = z.infer<typeof createRetailOrderSchema>;

export interface RetailOrderResult {
  id: string;
  orderNumber: string;
  status: 'ORDERED';
  paymentMethod: 'COD';
  subtotal: number;
  shippingTotal: number;
  grandTotal: number;
  currency: 'MAD';
}
