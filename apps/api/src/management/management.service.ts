import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  BusinessPartner,
  CreateCustomerInput,
  CreatePurchaseInput,
  CreateSupplierInput,
  CreateWholesaleSaleInput,
  OperationResult,
  OrderListItem,
  OrderListQuery,
  OrderStatus,
  InvoiceQuery, InvoiceListItem, InvoiceDetail, Paginated,
} from '@cosmetics/contracts';
import type { PoolClient } from 'pg';
import { DEFAULT_LOCATION_ID, DEFAULT_ORGANIZATION_ID } from '../constants.js';
import { DatabaseService } from '../database/database.service.js';

type SupplierRow = Omit<BusinessPartner, 'creditLimit'>;
type CustomerRow = Omit<BusinessPartner, 'creditLimit'> & { creditLimit: string };
type OrderRow = Omit<OrderListItem, 'grandTotal' | 'amountPaid'> & {
  grandTotal: string;
  amountPaid: string;
};
type VariantRow = {
  id: string;
  name: string;
  sku: string;
  purchasePrice: string;
  wholesalePrice: string;
  onHand: number;
  reserved: number;
};

@Injectable()
export class ManagementService {
  constructor(private readonly db: DatabaseService) {}

  async updatePartner(table: 'customers' | 'suppliers', id: string, input: CreateSupplierInput | CreateCustomerInput, actorId: string): Promise<BusinessPartner> {
    return this.db.withTransaction(async client => {
      const before = await client.query(`SELECT * FROM ${table} WHERE id = $1 AND organization_id = $2 AND active = true FOR UPDATE`, [id, DEFAULT_ORGANIZATION_ID]);
      if (!before.rowCount) throw new NotFoundException('Contact introuvable.');
      const values: unknown[] = [id, DEFAULT_ORGANIZATION_ID, input.name, input.phone, input.email, input.address];
      if (table === 'customers') values.push('creditLimit' in input ? input.creditLimit : 0);
      const result = await client.query<BusinessPartner>(`UPDATE ${table} SET name = $3, phone = $4, email = $5, address = $6,
        updated_at = now() ${table === 'customers' ? ', credit_limit = $7' : ''}
        WHERE id = $1 AND organization_id = $2 RETURNING id, name, phone, email, address
        ${table === 'customers' ? ', credit_limit::float AS "creditLimit"' : ''}`, values);
      await client.query(`INSERT INTO audit_logs (organization_id, actor_id, action, entity_type, entity_id, before_data, after_data)
        VALUES ($1, $2, 'PARTNER_UPDATED', $3, $4, $5::jsonb, $6::jsonb)`,
        [DEFAULT_ORGANIZATION_ID, actorId, table, id, JSON.stringify(before.rows[0]), JSON.stringify(result.rows[0])]);
      return result.rows[0]!;
    });
  }

  async archivePartner(table: 'customers' | 'suppliers', id: string, actorId: string) {
    return this.db.withTransaction(async client => {
      const result = await client.query(`UPDATE ${table} SET active = false, updated_at = now()
        WHERE id = $1 AND organization_id = $2 AND active = true RETURNING id`, [id, DEFAULT_ORGANIZATION_ID]);
      if (!result.rowCount) throw new NotFoundException('Contact introuvable.');
      await client.query(`INSERT INTO audit_logs (organization_id, actor_id, action, entity_type, entity_id)
        VALUES ($1, $2, 'PARTNER_ARCHIVED', $3, $4)`, [DEFAULT_ORGANIZATION_ID, actorId, table, id]);
      return { id, archived: true };
    });
  }

  async invoices(query: InvoiceQuery): Promise<Paginated<InvoiceListItem>> {
    const result = await this.db.query<InvoiceListItem & { totalCount: string }>(
      `WITH documents AS (
        SELECT id, 'sale' AS kind, order_number AS "documentNumber", COALESCE(partner_snapshot->>'name', 'Client comptoir') AS "partnerName",
          status, grand_total::float AS total, amount_paid::float AS "amountPaid", COALESCE(placed_at, created_at) AS "issuedAt"
        FROM sales_orders WHERE organization_id = $1 AND status NOT IN ('DRAFT', 'ORDERED')
        UNION ALL
        SELECT id, 'purchase', order_number, COALESCE(partner_snapshot->>'name', 'Fournisseur'), status,
          total::float, amount_paid::float, COALESCE(ordered_at, created_at)
        FROM purchase_orders WHERE organization_id = $1 AND status NOT IN ('DRAFT', 'ORDERED')
      ) SELECT *, COUNT(*) OVER()::text AS "totalCount" FROM documents
      WHERE ($2 = 'all' OR kind = $2) AND ("documentNumber" ILIKE $3 OR "partnerName" ILIKE $3)
      ORDER BY "issuedAt" DESC, id LIMIT 25 OFFSET $4`,
      [DEFAULT_ORGANIZATION_ID, query.kind, `%${query.search}%`, (query.page - 1) * 25],
    );
    return { items: result.rows.map(({ totalCount: _, ...row }) => row), total: Number(result.rows[0]?.totalCount ?? 0), page: query.page, pageSize: 25 };
  }

  async invoice(kind: 'sale' | 'purchase', id: string): Promise<InvoiceDetail> {
    const sale = kind === 'sale';
    const result = await this.db.query<Omit<InvoiceDetail, 'items' | 'payments'>>(
      `SELECT id, order_number AS "documentNumber", status, partner_snapshot AS partner,
        COALESCE(partner_snapshot->>'name', 'Client comptoir') AS "partnerName",
        ${sale ? 'grand_total' : 'total'}::float AS total, amount_paid::float AS "amountPaid",
        COALESCE(${sale ? 'placed_at' : 'ordered_at'}, created_at)::text AS "issuedAt",
        ${sale ? "channel, COALESCE(notes, '') AS notes, subtotal::float, shipping_total::float AS \"shippingTotal\", tax_total::float AS \"taxTotal\", discount_total::float AS \"discountTotal\"" : "'PURCHASE' AS channel, '' AS notes, total::float AS subtotal, 0 AS \"shippingTotal\", 0 AS \"taxTotal\", 0 AS \"discountTotal\""}
      FROM ${sale ? 'sales_orders' : 'purchase_orders'} WHERE id = $1 AND organization_id = $2`, [id, DEFAULT_ORGANIZATION_ID]);
    const header = result.rows[0];
    if (!header) throw new NotFoundException('Document introuvable.');
    const items = await this.db.query<InvoiceDetail['items'][number]>(sale
      ? `SELECT description, quantity, unit_multiplier AS "unitMultiplier", unit_price::float AS "unitPrice", line_total::float AS "lineTotal"
         FROM sales_order_items WHERE sales_order_id = $1 ORDER BY id`
      : `SELECT p.name || ' · ' || v.sku AS description, i.quantity, 1 AS "unitMultiplier", i.unit_cost::float AS "unitPrice", i.line_total::float AS "lineTotal"
         FROM purchase_order_items i JOIN product_variants v ON v.id = i.variant_id JOIN products p ON p.id = v.product_id WHERE i.purchase_order_id = $1 ORDER BY i.id`, [id]);
    const payments = await this.db.query<InvoiceDetail['payments'][number]>(`SELECT id, method, status, amount::float, paid_at::text AS "paidAt"
      FROM payments WHERE organization_id = $1 AND reference = $2 AND direction = $3 ORDER BY paid_at DESC`,
      [DEFAULT_ORGANIZATION_ID, header.documentNumber, sale ? 'IN' : 'OUT']);
    return { ...header, kind, items: items.rows, payments: payments.rows };
  }

  async suppliers(): Promise<BusinessPartner[]> {
    const result = await this.db.query<SupplierRow>(
      `SELECT id, name, COALESCE(phone, '') AS phone, COALESCE(email, '') AS email,
        COALESCE(address, '') AS address
       FROM suppliers WHERE organization_id = $1 AND active = true ORDER BY name`,
      [DEFAULT_ORGANIZATION_ID],
    );
    return result.rows;
  }

  async createSupplier(input: CreateSupplierInput): Promise<BusinessPartner> {
    const result = await this.db.query<SupplierRow>(
      `INSERT INTO suppliers (organization_id, name, phone, email, address)
       VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''))
       RETURNING id, name, COALESCE(phone, '') AS phone, COALESCE(email, '') AS email,
         COALESCE(address, '') AS address`,
      [DEFAULT_ORGANIZATION_ID, input.name, input.phone, input.email, input.address],
    );
    return result.rows[0]!;
  }

  async customers(): Promise<BusinessPartner[]> {
    const result = await this.db.query<CustomerRow>(
      `SELECT id, name, COALESCE(phone, '') AS phone, COALESCE(email, '') AS email,
        COALESCE(address, '') AS address, credit_limit AS "creditLimit"
       FROM customers
       WHERE organization_id = $1 AND type = 'WHOLESALE' AND active = true ORDER BY name`,
      [DEFAULT_ORGANIZATION_ID],
    );
    return result.rows.map((row) => ({ ...row, creditLimit: Number(row.creditLimit ?? 0) }));
  }

  async createCustomer(input: CreateCustomerInput): Promise<BusinessPartner> {
    const result = await this.db.query<CustomerRow>(
      `INSERT INTO customers
        (organization_id, type, name, phone, email, address, credit_limit)
       VALUES ($1, 'WHOLESALE', $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), $6)
       RETURNING id, name, COALESCE(phone, '') AS phone, COALESCE(email, '') AS email,
         COALESCE(address, '') AS address, credit_limit AS "creditLimit"`,
      [
        DEFAULT_ORGANIZATION_ID,
        input.name,
        input.phone,
        input.email,
        input.address,
        input.creditLimit,
      ],
    );
    const row = result.rows[0]!;
    return { ...row, creditLimit: Number(row.creditLimit) };
  }

  async createPurchase(input: CreatePurchaseInput, actorId: string): Promise<OperationResult> {
    return this.db.withTransaction(async (client) => {
      await this.requireActivePartner(client, 'suppliers', input.supplierId);
      const variants = await this.loadVariants(client, input.items.map((item) => item.variantId));
      const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
      if (variantMap.size !== new Set(input.items.map((item) => item.variantId)).size) {
        throw new BadRequestException('Un ou plusieurs produits sont introuvables.');
      }
      const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
      if (input.paidAmount > total) throw new BadRequestException('Le paiement dépasse le total.');
      const documentNumber = `ACH-${Date.now().toString(36).toUpperCase()}`;
      const purchase = await client.query<{ id: string }>(
        `INSERT INTO purchase_orders
          (organization_id, location_id, supplier_id, order_number, status, total,
           amount_paid, ordered_at, created_by)
         VALUES ($1, $2, $3, $4, 'RECEIVED', $5, $6, now(), $7) RETURNING id`,
        [
          DEFAULT_ORGANIZATION_ID,
          DEFAULT_LOCATION_ID,
          input.supplierId,
          documentNumber,
          total,
          input.paidAmount,
          actorId,
        ],
      );
      const purchaseId = purchase.rows[0]!.id;
      for (const item of input.items) {
        await client.query(
          `INSERT INTO purchase_order_items
            (purchase_order_id, variant_id, quantity, received_quantity, unit_cost, line_total)
           VALUES ($1, $2, $3, $3, $4, $5)`,
          [purchaseId, item.variantId, item.quantity, item.unitCost, item.quantity * item.unitCost],
        );
        await client.query(
          `INSERT INTO inventory_balances (variant_id, location_id, on_hand)
           VALUES ($1, $2, $3)
           ON CONFLICT (variant_id, location_id) DO UPDATE
           SET on_hand = inventory_balances.on_hand + EXCLUDED.on_hand,
             version = inventory_balances.version + 1, updated_at = now()`,
          [item.variantId, DEFAULT_LOCATION_ID, item.quantity],
        );
        await client.query(
          `INSERT INTO inventory_movements
            (organization_id, variant_id, location_id, quantity_delta, reason,
             reference_type, reference_id, unit_cost, note, actor_id)
           VALUES ($1, $2, $3, $4, 'PURCHASE_RECEIPT', 'purchase_order', $5, $6, $7, $8)`,
          [
            DEFAULT_ORGANIZATION_ID,
            item.variantId,
            DEFAULT_LOCATION_ID,
            item.quantity,
            purchaseId,
            item.unitCost,
            input.notes,
            actorId,
          ],
        );
      }
      if (input.paidAmount > 0) {
        await client.query(
          `INSERT INTO payments
            (organization_id, supplier_id, direction, method, status, amount, reference, created_by)
           VALUES ($1, $2, 'OUT', $3, $4, $5, $6, $7)`,
          [
            DEFAULT_ORGANIZATION_ID,
            input.supplierId,
            input.paymentMethod,
            input.paymentMethod === 'CHECK' ? 'PENDING' : 'COMPLETED',
            input.paidAmount,
            documentNumber,
            actorId,
          ],
        );
      }
      return { id: purchaseId, documentNumber, status: 'RECEIVED', total };
    });
  }

  async createWholesaleSale(
    input: CreateWholesaleSaleInput,
    actorId: string,
  ): Promise<OperationResult> {
    return this.db.withTransaction(async (client) => {
      await this.requireActivePartner(client, 'customers', input.customerId);
      const variants = await this.loadVariants(
        client,
        input.items.map((item) => item.variantId),
        true,
      );
      const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
      for (const item of input.items) {
        const variant = variantMap.get(item.variantId);
        if (!variant) throw new BadRequestException('Produit introuvable.');
        if (variant.onHand - variant.reserved < item.quantity) {
          throw new BadRequestException(`Stock insuffisant pour ${variant.name}.`);
        }
      }
      const total = input.items.reduce((sum, item) => {
        const variant = variantMap.get(item.variantId)!;
        return sum + item.quantity * (item.unitPrice ?? Number(variant.wholesalePrice));
      }, 0);
      if (input.paidAmount > total) throw new BadRequestException('Le paiement dépasse le total.');
      const status = input.paidAmount >= total ? 'PAID' : input.paidAmount > 0 ? 'PARTIALLY_PAID' : 'CONFIRMED';
      const documentNumber = `FAC-${Date.now().toString(36).toUpperCase()}`;
      const order = await client.query<{ id: string }>(
        `INSERT INTO sales_orders
          (organization_id, location_id, customer_id, order_number, channel, status,
           subtotal, grand_total, amount_paid, notes, placed_at, created_by)
         VALUES ($1, $2, $3, $4, 'WHOLESALE_DESKTOP', $5, $6, $6, $7, $8, now(), $9)
         RETURNING id`,
        [
          DEFAULT_ORGANIZATION_ID,
          DEFAULT_LOCATION_ID,
          input.customerId,
          documentNumber,
          status,
          total,
          input.paidAmount,
          input.notes,
          actorId,
        ],
      );
      const orderId = order.rows[0]!.id;
      for (const item of input.items) {
        const variant = variantMap.get(item.variantId)!;
        const price = item.unitPrice ?? Number(variant.wholesalePrice);
        await client.query(
          `INSERT INTO sales_order_items
            (sales_order_id, variant_id, description, quantity, unit_price,
             unit_cost_snapshot, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            orderId,
            item.variantId,
            `${variant.name} · ${variant.sku}`,
            item.quantity,
            price,
            variant.purchasePrice,
            price * item.quantity,
          ],
        );
        await client.query(
          `UPDATE inventory_balances SET on_hand = on_hand - $3,
             version = version + 1, updated_at = now()
           WHERE variant_id = $1 AND location_id = $2`,
          [item.variantId, DEFAULT_LOCATION_ID, item.quantity],
        );
        await client.query(
          `INSERT INTO inventory_movements
            (organization_id, variant_id, location_id, quantity_delta, reason,
             reference_type, reference_id, unit_cost, note, actor_id)
           VALUES ($1, $2, $3, $4, 'WHOLESALE_SALE', 'sales_order', $5, $6, $7, $8)`,
          [
            DEFAULT_ORGANIZATION_ID,
            item.variantId,
            DEFAULT_LOCATION_ID,
            -item.quantity,
            orderId,
            variant.purchasePrice,
            input.notes,
            actorId,
          ],
        );
      }
      if (input.paidAmount > 0) {
        await client.query(
          `INSERT INTO payments
            (organization_id, customer_id, direction, method, status, amount, reference, created_by)
           VALUES ($1, $2, 'IN', $3, $4, $5, $6, $7)`,
          [
            DEFAULT_ORGANIZATION_ID,
            input.customerId,
            input.paymentMethod,
            input.paymentMethod === 'CHECK' ? 'PENDING' : 'COMPLETED',
            input.paidAmount,
            documentNumber,
            actorId,
          ],
        );
      }
      return { id: orderId, documentNumber, status, total };
    });
  }

  async orders(query: OrderListQuery): Promise<OrderListItem[]> {
    const values: unknown[] = [DEFAULT_ORGANIZATION_ID];
    const filters = ['so.organization_id = $1'];
    if (query.channel !== 'all') {
      values.push(query.channel);
      filters.push(`so.channel = $${values.length}`);
    }
    if (query.status !== 'all') {
      values.push(query.status);
      filters.push(`(CASE WHEN so.status IN ('PAID', 'PARTIALLY_PAID') THEN 'CONFIRMED' WHEN so.status = 'FULFILLED' THEN 'DELIVERED' WHEN so.status = 'CANCELLED' THEN 'CANCELED' WHEN so.status = 'DRAFT' THEN 'ORDERED' ELSE so.status END) = $${values.length}`);
    }
    if (query.search) {
      values.push(`%${query.search.toLowerCase()}%`);
      filters.push(`(lower(so.order_number) LIKE $${values.length} OR lower(COALESCE(c.name, '')) LIKE $${values.length})`);
    }
    const result = await this.db.query<OrderRow>(
      `SELECT so.id, so.order_number AS "orderNumber", so.channel, so.status,
        COALESCE(c.name, 'Client comptoir') AS "customerName",
        COALESCE(c.phone, '') AS "customerPhone",
        COUNT(soi.id)::int AS "itemCount", COALESCE(SUM(soi.quantity), 0)::int AS "totalQuantity",
        so.grand_total AS "grandTotal", so.amount_paid AS "amountPaid",
        COALESCE((SELECT string_agg(DISTINCT p.method, ', ') FROM payments p WHERE p.reference = so.order_number AND p.organization_id = so.organization_id), '') AS "paymentMethod",
        COALESCE(so.placed_at, so.created_at)::text AS "placedAt"
       FROM sales_orders so
       LEFT JOIN customers c ON c.id = so.customer_id
       LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
       WHERE ${filters.join(' AND ')}
       GROUP BY so.id, c.id ORDER BY COALESCE(so.placed_at, so.created_at) DESC LIMIT 200`,
      values,
    );
    return result.rows.map((row) => ({
      ...row,
      status: this.normalizeStatus(row.status),
      grandTotal: Number(row.grandTotal),
      amountPaid: Number(row.amountPaid),
    }));
  }

  async updateOrderStatus(id: string, status: OrderStatus, actorId: string): Promise<OrderListItem> {
    await this.db.withTransaction(async (client) => {
      const orderResult = await client.query<{
        id: string;
        channel: string;
        status: string;
        orderNumber: string;
        grandTotal: string;
      }>(
        `SELECT id, channel, status, order_number AS "orderNumber", grand_total AS "grandTotal"
         FROM sales_orders WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [id, DEFAULT_ORGANIZATION_ID],
      );
      const order = orderResult.rows[0];
      if (!order) throw new NotFoundException('Commande introuvable.');
      const current = this.normalizeStatus(order.status);
      if (current === 'DELIVERED' || current === 'CANCELED') {
        throw new BadRequestException('Cette commande est déjà terminée.');
      }
      if (status === 'ORDERED' || (status === 'DELIVERED' && current === 'ORDERED')) {
        throw new BadRequestException('Transition de statut invalide.');
      }

      const items = await client.query<{ variantId: string; quantity: number; unitCost: string }>(
        `SELECT variant_id AS "variantId", quantity::int, unit_cost_snapshot AS "unitCost"
         FROM sales_order_items WHERE sales_order_id = $1`,
        [id],
      );
      if (status === 'DELIVERED' && order.channel === 'RETAIL_WEB') {
        for (const item of items.rows) {
          const changed = await client.query(
            `UPDATE inventory_balances SET on_hand = on_hand - $3, reserved = reserved - $3,
               version = version + 1, updated_at = now()
             WHERE variant_id = $1 AND location_id = $2 AND reserved >= $3 AND on_hand >= $3`,
            [item.variantId, DEFAULT_LOCATION_ID, item.quantity],
          );
          if (!changed.rowCount) throw new BadRequestException('Le stock réservé est incohérent.');
          await client.query(
            `INSERT INTO inventory_movements
              (organization_id, variant_id, location_id, quantity_delta, reason,
               reference_type, reference_id, unit_cost, note, actor_id)
             VALUES ($1, $2, $3, $4, 'RETAIL_SALE', 'sales_order', $5, $6,
               'Commande livrée et COD encaissé', $7)`,
            [
              DEFAULT_ORGANIZATION_ID,
              item.variantId,
              DEFAULT_LOCATION_ID,
              -item.quantity,
              id,
              item.unitCost,
              actorId,
            ],
          );
        }
        await client.query(
          `UPDATE payments SET status = 'COMPLETED', paid_at = now()
           WHERE reference = $1 AND method = 'COD' AND status = 'PENDING'`,
          [order.orderNumber],
        );
        await client.query('UPDATE sales_orders SET amount_paid = grand_total WHERE id = $1', [id]);
      }
      if (status === 'CANCELED') {
        for (const item of items.rows) {
          if (order.channel === 'RETAIL_WEB') {
            await client.query(
              `UPDATE inventory_balances SET reserved = reserved - $3,
                 version = version + 1, updated_at = now()
               WHERE variant_id = $1 AND location_id = $2 AND reserved >= $3`,
              [item.variantId, DEFAULT_LOCATION_ID, item.quantity],
            );
          } else {
            await client.query(
              `UPDATE inventory_balances SET on_hand = on_hand + $3,
                 version = version + 1, updated_at = now()
               WHERE variant_id = $1 AND location_id = $2`,
              [item.variantId, DEFAULT_LOCATION_ID, item.quantity],
            );
            await client.query(
              `INSERT INTO inventory_movements
                (organization_id, variant_id, location_id, quantity_delta, reason,
                 reference_type, reference_id, unit_cost, note, actor_id)
               VALUES ($1, $2, $3, $4, 'CUSTOMER_RETURN', 'sales_order', $5, $6,
                 'Annulation vente grossiste', $7)`,
              [
                DEFAULT_ORGANIZATION_ID,
                item.variantId,
                DEFAULT_LOCATION_ID,
                item.quantity,
                id,
                item.unitCost,
                actorId,
              ],
            );
          }
        }
        await client.query(
          `UPDATE payments SET status = 'CANCELLED'
           WHERE reference = $1 AND status = 'PENDING'`,
          [order.orderNumber],
        );
      }
      await client.query('UPDATE sales_orders SET status = $2, updated_at = now() WHERE id = $1', [
        id,
        status,
      ]);
      await client.query(
        `INSERT INTO audit_logs (organization_id, actor_id, action, entity_type, entity_id, after_data)
         VALUES ($1, $2, 'ORDER_STATUS_CHANGED', 'sales_order', $3, $4::jsonb)`,
        [DEFAULT_ORGANIZATION_ID, actorId, id, JSON.stringify({ from: current, to: status })],
      );
    });
    const orders = await this.orders({ search: '', channel: 'all', status: 'all' });
    return orders.find((order) => order.id === id)!;
  }

  private async loadVariants(
    client: PoolClient,
    ids: string[],
    lock = false,
  ) {
    const result = await client.query<VariantRow>(
      `SELECT v.id, p.name, v.sku, v.purchase_price AS "purchasePrice",
        v.wholesale_price AS "wholesalePrice", COALESCE(b.on_hand, 0)::int AS "onHand",
        COALESCE(b.reserved, 0)::int AS reserved
       FROM product_variants v JOIN products p ON p.id = v.product_id
       JOIN inventory_balances b ON b.variant_id = v.id AND b.location_id = $2
       WHERE p.organization_id = $1 AND p.active = true AND v.active = true
         AND v.id = ANY($3::uuid[]) ${lock ? 'FOR UPDATE OF b' : ''}`,
      [DEFAULT_ORGANIZATION_ID, DEFAULT_LOCATION_ID, ids],
    );
    return result.rows;
  }

  private async requireActivePartner(client: PoolClient, table: 'customers' | 'suppliers', id: string) {
    const result = await client.query(`SELECT id FROM ${table} WHERE id = $1 AND organization_id = $2 AND active = true FOR SHARE`, [id, DEFAULT_ORGANIZATION_ID]);
    if (!result.rowCount) throw new BadRequestException('Ce contact est archivé ou introuvable.');
  }

  private normalizeStatus(status: string): OrderStatus {
    if (status === 'FULFILLED') return 'DELIVERED';
    if (status === 'CANCELLED') return 'CANCELED';
    if (status === 'DRAFT') return 'ORDERED';
    if (status === 'PAID' || status === 'PARTIALLY_PAID') return 'CONFIRMED';
    return status as OrderStatus;
  }
}
