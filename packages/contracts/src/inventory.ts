import { z } from 'zod';
import { uuidSchema } from './shared.js';

export const inventoryReasons = [
  'OPENING_BALANCE',
  'PURCHASE_RECEIPT',
  'WHOLESALE_SALE',
  'RETAIL_SALE',
  'CUSTOMER_RETURN',
  'SUPPLIER_RETURN',
  'DAMAGE',
  'EXPIRY',
  'CORRECTION',
] as const;

export const adjustInventorySchema = z.object({
  variantId: uuidSchema,
  locationId: uuidSchema.optional(),
  quantityDelta: z.coerce.number().int().min(-999_999).max(999_999).refine((v) => v !== 0),
  reason: z.enum(inventoryReasons),
  note: z.string().trim().min(3).max(500),
});

export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;

export interface InventoryAdjustmentResult {
  movementId: string;
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
}
