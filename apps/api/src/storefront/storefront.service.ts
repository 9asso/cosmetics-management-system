import { BadRequestException, Injectable } from '@nestjs/common';
import type { CreateRetailOrderInput, RetailOrderResult } from '@cosmetics/contracts';
import { DEFAULT_LOCATION_ID, DEFAULT_ORGANIZATION_ID } from '../constants.js';
import { DatabaseService } from '../database/database.service.js';

type VariantRow = {
  id: string;
  name: string;
  sku: string;
  retailPrice: string;
  purchasePrice: string;
  onHand: number;
  reserved: number;
};

@Injectable()
export class StorefrontService {
  constructor(private readonly db: DatabaseService) {}

  createOrder(input: CreateRetailOrderInput): Promise<RetailOrderResult> {
    return this.db.withTransaction(async (client) => {
      const requested = new Map<string, number>();
      for (const item of input.items) {
        requested.set(item.variantId, (requested.get(item.variantId) ?? 0) + item.quantity);
      }
      const variantIds = [...requested.keys()];
      const variants = await client.query<VariantRow>(
        `SELECT v.id, p.name, v.sku, v.retail_price AS "retailPrice",
          v.purchase_price AS "purchasePrice", b.on_hand::int AS "onHand",
          b.reserved::int AS reserved
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         JOIN inventory_balances b ON b.variant_id = v.id AND b.location_id = $2
         WHERE p.organization_id = $1 AND p.retail_visible = true
           AND p.active = true AND v.active = true AND v.id = ANY($3::uuid[])
         ORDER BY v.id FOR UPDATE OF b`,
        [DEFAULT_ORGANIZATION_ID, DEFAULT_LOCATION_ID, variantIds],
      );
      if (variants.rowCount !== variantIds.length) {
        throw new BadRequestException('Un ou plusieurs produits ne sont plus disponibles.');
      }

      for (const variant of variants.rows) {
        const quantity = requested.get(variant.id)!;
        if (variant.onHand - variant.reserved < quantity) {
          throw new BadRequestException(`Stock insuffisant pour ${variant.name}.`);
        }
      }

      const customer = await client.query<{ id: string }>(
        `INSERT INTO customers (organization_id, type, name, phone, address)
         VALUES ($1, 'RETAIL', $2, $3, $4)
         RETURNING id`,
        [
          DEFAULT_ORGANIZATION_ID,
          input.customer.name,
          input.customer.phone,
          `${input.customer.address}, ${input.customer.city}`,
        ],
      );
      const subtotal = variants.rows.reduce(
        (sum, variant) => sum + Number(variant.retailPrice) * requested.get(variant.id)!,
        0,
      );
      const shippingTotal = subtotal >= 500 ? 0 : 35;
      const grandTotal = subtotal + shippingTotal;
      const orderNumber = `WEB-${Date.now().toString(36).toUpperCase()}`;
      const order = await client.query<{ id: string }>(
        `INSERT INTO sales_orders
          (organization_id, location_id, customer_id, order_number, channel, status,
           subtotal, shipping_total, grand_total, amount_paid, notes, placed_at)
         VALUES ($1, $2, $3, $4, 'RETAIL_WEB', 'ORDERED', $5, $6, $7, 0, $8, now())
         RETURNING id`,
        [
          DEFAULT_ORGANIZATION_ID,
          DEFAULT_LOCATION_ID,
          customer.rows[0]!.id,
          orderNumber,
          subtotal,
          shippingTotal,
          grandTotal,
          input.customer.notes,
        ],
      );
      const orderId = order.rows[0]!.id;

      for (const variant of variants.rows) {
        const quantity = requested.get(variant.id)!;
        await client.query(
          `INSERT INTO sales_order_items
            (sales_order_id, variant_id, description, quantity, unit_price,
             unit_cost_snapshot, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            orderId,
            variant.id,
            `${variant.name} · ${variant.sku}`,
            quantity,
            variant.retailPrice,
            variant.purchasePrice,
            Number(variant.retailPrice) * quantity,
          ],
        );
        await client.query(
          `UPDATE inventory_balances
           SET reserved = reserved + $3, version = version + 1, updated_at = now()
           WHERE variant_id = $1 AND location_id = $2`,
          [variant.id, DEFAULT_LOCATION_ID, quantity],
        );
      }

      await client.query(
        `INSERT INTO payments
          (organization_id, customer_id, direction, method, status, amount, reference, sales_order_id)
         VALUES ($1, $2, 'IN', 'COD', 'PENDING', $3, $4, $5)`,
        [DEFAULT_ORGANIZATION_ID, customer.rows[0]!.id, grandTotal, orderNumber, orderId],
      );
      await client.query(
        `INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, after_data)
         VALUES ($1, 'RETAIL_ORDER_CREATED', 'sales_order', $2, $3::jsonb)`,
        [DEFAULT_ORGANIZATION_ID, orderId, JSON.stringify({ ...input, grandTotal })],
      );
      await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
         VALUES ('sales_order', $1, 'store.order.placed', $2::jsonb)`,
        [orderId, JSON.stringify({ orderId, orderNumber, paymentMethod: 'COD' })],
      );

      return {
        id: orderId,
        orderNumber,
        status: 'ORDERED',
        paymentMethod: 'COD',
        subtotal,
        shippingTotal,
        grandTotal,
        currency: 'MAD',
      };
    });
  }
}
