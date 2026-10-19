import { BadRequestException, Injectable } from '@nestjs/common';
import { computeDiscount, type CreateRetailOrderInput, type RetailOrderResult } from '@cosmetics/contracts';
import { storefrontScopeFilter } from '../catalog/catalog.service.js';
import { DEFAULT_LOCATION_ID, DEFAULT_ORGANIZATION_ID } from '../constants.js';
import { DatabaseService } from '../database/database.service.js';
import { StoreSettingsService } from './store-settings.service.js';

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
  constructor(
    private readonly db: DatabaseService,
    private readonly settings: StoreSettingsService,
  ) {}

  async createOrder(input: CreateRetailOrderInput): Promise<RetailOrderResult> {
    // Read outside the order transaction so a database without migration 017 falls back to defaults.
    const settings = await this.settings.settings();
    if (settings.catalogSource === 'DEMO') {
      throw new BadRequestException('La boutique est en mode aperçu : les commandes sont fermées.');
    }
    const discount = input.discountCode ? await this.settings.findUsableCode(input.discountCode) : undefined;
    if (input.discountCode && !discount) {
      throw new BadRequestException('Ce code de réduction n’est pas valide ou a expiré.');
    }
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
         WHERE p.organization_id = $1 AND ${storefrontScopeFilter(settings.productScope)}
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
      if (discount && subtotal < discount.minSubtotal) {
        throw new BadRequestException(
          `Le code ${discount.code} s’applique dès ${discount.minSubtotal} MAD d’achats.`,
        );
      }
      const discountTotal = discount ? computeDiscount(discount, subtotal) : 0;
      // Free shipping is earned on the subtotal before any discount code.
      const shippingTotal = subtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
      const grandTotal = subtotal - discountTotal + shippingTotal;
      const notes = [input.customer.notes, discount ? `Code de réduction : ${discount.code}` : '']
        .filter(Boolean)
        .join('\n');
      const orderNumber = `WEB-${Date.now().toString(36).toUpperCase()}`;
      const order = await client.query<{ id: string }>(
        `INSERT INTO sales_orders
          (organization_id, location_id, customer_id, order_number, channel, status,
           subtotal, discount_total, shipping_total, grand_total, amount_paid, notes, placed_at)
         VALUES ($1, $2, $3, $4, 'RETAIL_WEB', 'ORDERED', $5, $6, $7, $8, 0, $9, now())
         RETURNING id`,
        [
          DEFAULT_ORGANIZATION_ID,
          DEFAULT_LOCATION_ID,
          customer.rows[0]!.id,
          orderNumber,
          subtotal,
          discountTotal,
          shippingTotal,
          grandTotal,
          notes,
        ],
      );
      const orderId = order.rows[0]!.id;
      // A usable code means migration 017 is in place, so its column exists.
      if (discount) {
        await client.query('UPDATE sales_orders SET discount_code = $2 WHERE id = $1', [orderId, discount.code]);
      }

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
        discountTotal,
        shippingTotal,
        grandTotal,
        currency: 'MAD',
      };
    });
  }
}
