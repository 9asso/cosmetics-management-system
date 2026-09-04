import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdjustInventoryInput, InventoryAdjustmentResult } from '@cosmetics/contracts';
import { DEFAULT_LOCATION_ID, DEFAULT_ORGANIZATION_ID } from '../constants.js';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService) {}

  adjust(input: AdjustInventoryInput): Promise<InventoryAdjustmentResult> {
    const locationId = input.locationId ?? DEFAULT_LOCATION_ID;
    return this.db.withTransaction(async (client) => {
      const current = await client.query<{ onHand: number; reserved: number }>(
        `SELECT on_hand::int AS "onHand", reserved::int AS reserved
         FROM inventory_balances
         WHERE variant_id = $1 AND location_id = $2
         FOR UPDATE`,
        [input.variantId, locationId],
      );
      if (!current.rowCount) throw new NotFoundException('Inventory balance not found');

      const nextOnHand = current.rows[0]!.onHand + input.quantityDelta;
      if (nextOnHand < current.rows[0]!.reserved || nextOnHand < 0) {
        throw new BadRequestException('Adjustment would make available inventory negative');
      }

      const movement = await client.query<{ id: string }>(
        `INSERT INTO inventory_movements
          (organization_id, variant_id, location_id, quantity_delta, reason, note)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          DEFAULT_ORGANIZATION_ID,
          input.variantId,
          locationId,
          input.quantityDelta,
          input.reason,
          input.note,
        ],
      );
      const balance = await client.query<{ onHand: number; reserved: number; available: number }>(
        `UPDATE inventory_balances
         SET on_hand = $3, version = version + 1, updated_at = now()
         WHERE variant_id = $1 AND location_id = $2
         RETURNING on_hand::int AS "onHand", reserved::int AS reserved,
           (on_hand - reserved)::int AS available`,
        [input.variantId, locationId, nextOnHand],
      );
      await client.query(
        `INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, after_data)
         VALUES ($1, 'INVENTORY_ADJUSTED', 'product_variant', $2, $3::jsonb)`,
        [DEFAULT_ORGANIZATION_ID, input.variantId, JSON.stringify(input)],
      );

      return {
        movementId: movement.rows[0]!.id,
        variantId: input.variantId,
        ...balance.rows[0]!,
      };
    });
  }
}
