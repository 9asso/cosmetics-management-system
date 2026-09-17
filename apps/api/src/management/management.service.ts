import {
  createInvoiceReturnSchema,
  createPurchaseSchema,
  createWholesaleSaleSchema,
  updateInvoiceSchema,
  brandSettingsSchema,
} from "@cosmetics/contracts";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  BusinessPartner,
  CreateCustomerInput,
  CreatePurchaseInput,
  CreateSupplierInput,
  CreateWholesaleSaleInput,
  CreateInvoiceReturnInput,
  OperationResult,
  OrderListItem,
  OrderListQuery,
  OrderStatus,
  InvoiceQuery,
  InvoiceListItem,
  InvoiceDetail,
  Paginated,
  UpdateInvoiceInput,
  BrandSettings,
} from "@cosmetics/contracts";
import type { PoolClient } from "pg";
import { DEFAULT_LOCATION_ID, DEFAULT_ORGANIZATION_ID } from "../constants.js";
import { DatabaseService } from "../database/database.service.js";
import {
  captureInvoiceHistory,
  ensureInitialInvoiceHistory,
  loadInvoice,
} from "./invoice-data.js";

type SupplierRow = Omit<BusinessPartner, "creditLimit">;
type CustomerRow = Omit<BusinessPartner, "creditLimit"> & {
  creditLimit: string;
};
type OrderRow = Omit<OrderListItem, "grandTotal" | "amountPaid"> & {
  grandTotal: string;
  amountPaid: string;
};
type VariantRow = {
  id: string;
  name: string;
  sku: string;
  purchasePrice: string;
  wholesalePrice: string;
  retailPrice: string;
  onHand: number;
  reserved: number;
};

@Injectable()
export class ManagementService {
  constructor(private readonly db: DatabaseService) {}

  async brandSettings(): Promise<BrandSettings> {
    const result = await this.db.query<BrandSettings>(
      `SELECT invoice_title AS title, invoice_subtitle AS subtitle,
        invoice_phones AS phones, invoice_thank_you AS "thankYouText",
        invoice_return_policy AS "returnPolicy"
       FROM organizations WHERE id=$1`,
      [DEFAULT_ORGANIZATION_ID],
    );
    if (!result.rows[0])
      throw new NotFoundException("Organisation introuvable.");
    return result.rows[0];
  }

  async updateBrandSettings(
    input: BrandSettings,
    actorId: string,
  ): Promise<BrandSettings> {
    input = brandSettingsSchema.parse(input);
    return this.db.withTransaction(async (client) => {
      const before = await client.query(
        "SELECT invoice_title,invoice_subtitle,invoice_phones,invoice_thank_you,invoice_return_policy FROM organizations WHERE id=$1 FOR UPDATE",
        [DEFAULT_ORGANIZATION_ID],
      );
      if (!before.rows[0])
        throw new NotFoundException("Organisation introuvable.");
      const result = await client.query<BrandSettings>(
        `UPDATE organizations SET invoice_title=$2,invoice_subtitle=$3,
          invoice_phones=$4,invoice_thank_you=$5,invoice_return_policy=$6,updated_at=now()
         WHERE id=$1 RETURNING invoice_title AS title,invoice_subtitle AS subtitle,
          invoice_phones AS phones,invoice_thank_you AS "thankYouText",
          invoice_return_policy AS "returnPolicy"`,
        [
          DEFAULT_ORGANIZATION_ID,
          input.title,
          input.subtitle,
          input.phones,
          input.thankYouText,
          input.returnPolicy,
        ],
      );
      await client.query(
        `INSERT INTO audit_logs
          (organization_id,actor_id,action,entity_type,entity_id,before_data,after_data)
         VALUES($1,$2,'BRAND_SETTINGS_UPDATED','organization',$1,$3::jsonb,$4::jsonb)`,
        [
          DEFAULT_ORGANIZATION_ID,
          actorId,
          JSON.stringify(before.rows[0]),
          JSON.stringify(result.rows[0]),
        ],
      );
      return result.rows[0]!;
    });
  }

  async updatePartner(
    table: "customers" | "suppliers",
    id: string,
    input: CreateSupplierInput | CreateCustomerInput,
    actorId: string,
  ): Promise<BusinessPartner> {
    return this.db.withTransaction(async (client) => {
      const before = await client.query(
        `SELECT * FROM ${table} WHERE id = $1 AND organization_id = $2 AND active = true FOR UPDATE`,
        [id, DEFAULT_ORGANIZATION_ID],
      );
      if (!before.rowCount) throw new NotFoundException("Contact introuvable.");
      const values: unknown[] = [
        id,
        DEFAULT_ORGANIZATION_ID,
        input.name,
        input.phone,
        input.email,
        input.address,
      ];
      if (table === "customers")
        values.push("creditLimit" in input ? input.creditLimit : 0);
      const result = await client.query<BusinessPartner>(
        `UPDATE ${table} SET name = $3, phone = $4, email = $5, address = $6,
        updated_at = now() ${table === "customers" ? ", credit_limit = $7" : ""}
        WHERE id = $1 AND organization_id = $2 RETURNING id, name, phone, email, address
        ${table === "customers" ? ', credit_limit::float AS "creditLimit"' : ""}`,
        values,
      );
      await client.query(
        `INSERT INTO audit_logs (organization_id, actor_id, action, entity_type, entity_id, before_data, after_data)
        VALUES ($1, $2, 'PARTNER_UPDATED', $3, $4, $5::jsonb, $6::jsonb)`,
        [
          DEFAULT_ORGANIZATION_ID,
          actorId,
          table,
          id,
          JSON.stringify(before.rows[0]),
          JSON.stringify(result.rows[0]),
        ],
      );
      return result.rows[0]!;
    });
  }

  async archivePartner(
    table: "customers" | "suppliers",
    id: string,
    actorId: string,
  ) {
    return this.db.withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE ${table} SET active = false, updated_at = now()
        WHERE id = $1 AND organization_id = $2 AND active = true RETURNING id`,
        [id, DEFAULT_ORGANIZATION_ID],
      );
      if (!result.rowCount) throw new NotFoundException("Contact introuvable.");
      await client.query(
        `INSERT INTO audit_logs (organization_id, actor_id, action, entity_type, entity_id)
        VALUES ($1, $2, 'PARTNER_ARCHIVED', $3, $4)`,
        [DEFAULT_ORGANIZATION_ID, actorId, table, id],
      );
      return { id, archived: true };
    });
  }

  async invoices(query: InvoiceQuery): Promise<Paginated<InvoiceListItem>> {
    const result = await this.db.query<
      InvoiceListItem & { totalCount: string }
    >(
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
      [
        DEFAULT_ORGANIZATION_ID,
        query.kind,
        `%${query.search}%`,
        (query.page - 1) * 25,
      ],
    );
    return {
      items: result.rows.map(({ totalCount: _, ...row }) => row),
      total: Number(result.rows[0]?.totalCount ?? 0),
      page: query.page,
      pageSize: 25,
    };
  }

  async invoice(kind: "sale" | "purchase", id: string): Promise<InvoiceDetail> {
    return loadInvoice(this.db, kind, id);
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
      [
        DEFAULT_ORGANIZATION_ID,
        input.name,
        input.phone,
        input.email,
        input.address,
      ],
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
    return result.rows.map((row) => ({
      ...row,
      creditLimit: Number(row.creditLimit ?? 0),
    }));
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

  async createPurchase(
    input: CreatePurchaseInput,
    actorId: string,
  ): Promise<OperationResult> {
    input = createPurchaseSchema.parse(input);
    const collected = input.paymentMethod === "CHECK" ? 0 : input.paidAmount;
    return this.db.withTransaction(async (client) => {
      await this.requireActivePartner(client, "suppliers", input.supplierId);
      const variants = await this.loadVariants(
        client,
        input.items.map((item) => item.variantId),
        true,
      );
      const variantMap = new Map(
        variants.map((variant) => [variant.id, variant]),
      );
      if (
        variantMap.size !==
        new Set(input.items.map((item) => item.variantId)).size
      ) {
        throw new BadRequestException(
          "Un ou plusieurs produits sont introuvables.",
        );
      }
      const total =
        input.items.reduce(
          (sum, item) => sum + item.quantity * Math.round(item.unitCost * 100),
          0,
        ) / 100;
      if (total > 999_999_999)
        throw new BadRequestException(
          "Le total dépasse le montant maximum autorisé.",
        );
      if (input.paidAmount > total)
        throw new BadRequestException("Le paiement dépasse le total.");
      const documentNumber = `ACH-${Date.now().toString(36).toUpperCase()}`;
      const purchase = await client.query<{ id: string }>(
        `INSERT INTO purchase_orders
          (organization_id, location_id, supplier_id, order_number, status, total,
           amount_paid, notes, ordered_at, created_by)
         VALUES ($1, $2, $3, $4, 'RECEIVED', $5, $6, $7, now(), $8) RETURNING id`,
        [
          DEFAULT_ORGANIZATION_ID,
          DEFAULT_LOCATION_ID,
          input.supplierId,
          documentNumber,
          total,
          collected,
          input.notes,
          actorId,
        ],
      );
      const purchaseId = purchase.rows[0]!.id;
      for (const item of input.items) {
        const variant = variantMap.get(item.variantId)!;
        const weightedCost =
          (variant.onHand * Number(variant.purchasePrice) +
            item.quantity * item.unitCost) /
          (variant.onHand + item.quantity);
        await client.query(
          `INSERT INTO purchase_order_items
            (purchase_order_id, variant_id, quantity, received_quantity, unit_cost,
             wholesale_price_snapshot, retail_price_snapshot, line_total)
           VALUES ($1, $2, $3, $3, $4, $5, $6, $7)`,
          [
            purchaseId,
            item.variantId,
            item.quantity,
            item.unitCost,
            item.wholesalePrice ?? Number(variant.wholesalePrice),
            item.retailPrice ?? Number(variant.retailPrice),
            item.quantity * item.unitCost,
          ],
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
          `UPDATE product_variants SET purchase_price=$2,updated_at=now() WHERE id=$1`,
          [item.variantId, weightedCost],
        );
        await client.query(
          `INSERT INTO inventory_movements
            (organization_id, variant_id, location_id, quantity_delta, reason,
             reference_type, reference_id, unit_cost, wholesale_price, retail_price, note, actor_id)
           VALUES ($1, $2, $3, $4, 'PURCHASE_RECEIPT', 'purchase_order', $5, $6, $7, $8, $9, $10)`,
          [
            DEFAULT_ORGANIZATION_ID,
            item.variantId,
            DEFAULT_LOCATION_ID,
            item.quantity,
            purchaseId,
            item.unitCost,
            item.wholesalePrice ?? Number(variant.wholesalePrice),
            item.retailPrice ?? Number(variant.retailPrice),
            input.notes,
            actorId,
          ],
        );
      }
      if (input.paidAmount > 0) {
        const payment = await client.query<{ id: string }>(
          `INSERT INTO payments
            (organization_id, supplier_id, direction, method, status, amount, reference, created_by, purchase_order_id)
           VALUES ($1, $2, 'OUT', $3, $4, $5, $6, $7, $8) RETURNING id`,
          [
            DEFAULT_ORGANIZATION_ID,
            input.supplierId,
            input.paymentMethod,
            input.paymentMethod === "CHECK" ? "PENDING" : "COMPLETED",
            input.paidAmount,
            documentNumber,
            actorId,
            purchaseId,
          ],
        );
        if (input.paymentMethod === "CHECK" && input.check) {
          await client.query(
            `INSERT INTO checks(payment_id,bank_name,check_number,due_date) VALUES($1,$2,$3,$4)`,
            [
              payment.rows[0]!.id,
              input.check.bankName,
              input.check.checkNumber,
              input.check.dueDate,
            ],
          );
        }
      }
      await captureInvoiceHistory(
        client,
        "purchase",
        purchaseId,
        "CREATED",
        actorId,
      );
      return { id: purchaseId, documentNumber, status: "RECEIVED", total };
    });
  }

  async createWholesaleSale(
    input: CreateWholesaleSaleInput,
    actorId: string,
  ): Promise<OperationResult> {
    input = createWholesaleSaleSchema.parse(input);
    const collected = input.paymentMethod === "CHECK" ? 0 : input.paidAmount;
    return this.db.withTransaction(async (client) => {
      await this.requireActivePartner(client, "customers", input.customerId);
      const variants = await this.loadVariants(
        client,
        input.items.map((item) => item.variantId),
        true,
      );
      const variantMap = new Map(
        variants.map((variant) => [variant.id, variant]),
      );
      for (const item of input.items) {
        const variant = variantMap.get(item.variantId);
        if (!variant) throw new BadRequestException("Produit introuvable.");
        if (variant.onHand - variant.reserved < item.quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour ${variant.name}.`,
          );
        }
      }
      const subtotal =
        input.items.reduce((sum, item) => {
          const variant = variantMap.get(item.variantId)!;
          return (
            sum +
            item.quantity *
              Math.round(
                (item.unitPrice ?? Number(variant.wholesalePrice)) * 100,
              )
          );
        }, 0) / 100;
      if (input.discountTotal > subtotal)
        throw new BadRequestException("La remise dépasse le sous-total.");
      const total =
        Math.round(
          (subtotal -
            input.discountTotal +
            input.shippingTotal +
            input.taxTotal) *
            100,
        ) / 100;
      if (total > 999_999_999)
        throw new BadRequestException(
          "Le total dépasse le montant maximum autorisé.",
        );
      if (input.paidAmount > total)
        throw new BadRequestException("Le paiement dépasse le total.");
      const status = "DELIVERED";
      const documentNumber = `FAC-${Date.now().toString(36).toUpperCase()}`;
      const order = await client.query<{ id: string }>(
        `INSERT INTO sales_orders
          (organization_id, location_id, customer_id, order_number, channel, status,
           subtotal, discount_total, shipping_total, tax_total, grand_total,
           amount_paid, notes, placed_at, created_by)
         VALUES ($1, $2, $3, $4, 'WHOLESALE_DESKTOP', $5, $6, $7, $8, $9,
           $10, $11, $12, now(), $13)
         RETURNING id`,
        [
          DEFAULT_ORGANIZATION_ID,
          DEFAULT_LOCATION_ID,
          input.customerId,
          documentNumber,
          status,
          subtotal,
          input.discountTotal,
          input.shippingTotal,
          input.taxTotal,
          total,
          collected,
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
        const payment = await client.query<{ id: string }>(
          `INSERT INTO payments
            (organization_id, customer_id, direction, method, status, amount, reference, created_by, sales_order_id)
           VALUES ($1, $2, 'IN', $3, $4, $5, $6, $7, $8) RETURNING id`,
          [
            DEFAULT_ORGANIZATION_ID,
            input.customerId,
            input.paymentMethod,
            input.paymentMethod === "CHECK" ? "PENDING" : "COMPLETED",
            input.paidAmount,
            documentNumber,
            actorId,
            orderId,
          ],
        );
        if (input.paymentMethod === "CHECK" && input.check) {
          await client.query(
            `INSERT INTO checks(payment_id,bank_name,check_number,due_date) VALUES($1,$2,$3,$4)`,
            [
              payment.rows[0]!.id,
              input.check.bankName,
              input.check.checkNumber,
              input.check.dueDate,
            ],
          );
        }
      }
      await captureInvoiceHistory(client, "sale", orderId, "CREATED", actorId);
      return { id: orderId, documentNumber, status, total };
    });
  }

  async updateInvoice(
    kind: "sale" | "purchase",
    id: string,
    input: UpdateInvoiceInput,
    actorId: string,
  ) {
    input = updateInvoiceSchema.parse(input);
    const sale = kind === "sale";
    return this.db.withTransaction(async (client) => {
      const document = await client.query<{
        status: string;
        channel: string;
        amountPaid: number;
      }>(
        `SELECT status, ${sale ? "channel" : "'PURCHASE'"} AS channel,
          amount_paid::float AS "amountPaid"
         FROM ${sale ? "sales_orders" : "purchase_orders"}
         WHERE id=$1 AND organization_id=$2 FOR UPDATE`,
        [id, DEFAULT_ORGANIZATION_ID],
      );
      const current = document.rows[0];
      if (!current) throw new NotFoundException("Document introuvable.");
      if (["CANCELED", "CANCELLED", "REFUNDED"].includes(current.status))
        throw new BadRequestException(
          "Ce document terminé ne peut plus être modifié.",
        );
      if (sale && current.channel !== "WHOLESALE_DESKTOP")
        throw new BadRequestException(
          "Seules les ventes grossistes peuvent être modifiées ici.",
        );
      if (sale) {
        const returned = await client.query(
          "SELECT 1 FROM returns WHERE sales_order_id=$1 AND status=$2 LIMIT 1",
          [id, "COMPLETED"],
        );
        if (returned.rowCount)
          throw new BadRequestException(
            "Une facture comportant un retour ne peut plus être réécrite.",
          );
      }
      await this.requireActivePartner(
        client,
        sale ? "customers" : "suppliers",
        input.partnerId,
      );
      await ensureInitialInvoiceHistory(client, kind, id, actorId);

      const oldItems = await client.query<{
        variantId: string;
        quantity: number;
        unitPrice: number;
        wholesalePrice: number;
        retailPrice: number;
      }>(
        `SELECT variant_id AS "variantId",quantity::int,
          ${sale ? "unit_price" : "unit_cost"}::float AS "unitPrice",
          ${sale ? "0" : "wholesale_price_snapshot"}::float AS "wholesalePrice",
          ${sale ? "0" : "retail_price_snapshot"}::float AS "retailPrice"
         FROM ${sale ? "sales_order_items" : "purchase_order_items"}
         WHERE ${sale ? "sales_order_id" : "purchase_order_id"}=$1`,
        [id],
      );
      const ids = Array.from(
        new Set([
          ...oldItems.rows.map((row) => row.variantId),
          ...input.items.map((row) => row.variantId),
        ]),
      );
      const variants = await this.loadVariants(client, ids, true);
      const variantMap = new Map(
        variants.map((variant) => [variant.id, variant]),
      );
      if (variantMap.size !== ids.length)
        throw new BadRequestException(
          "Un ou plusieurs produits sont introuvables.",
        );
      const oldQuantities = new Map(
        oldItems.rows.map((row) => [row.variantId, row.quantity]),
      );
      const oldCosts = new Map(
        oldItems.rows.map((row) => [row.variantId, row.unitPrice]),
      );
      const oldWholesalePrices = new Map(
        oldItems.rows.map((row) => [row.variantId, row.wholesalePrice]),
      );
      const oldRetailPrices = new Map(
        oldItems.rows.map((row) => [row.variantId, row.retailPrice]),
      );
      const newItems = new Map(input.items.map((row) => [row.variantId, row]));
      const subtotal =
        Math.round(
          input.items.reduce(
            (sum, row) => sum + row.quantity * row.unitPrice,
            0,
          ) * 100,
        ) / 100;
      if (sale && input.discountTotal > subtotal)
        throw new BadRequestException("La remise dépasse le sous-total.");
      const total = sale
        ? Math.round(
            (subtotal -
              input.discountTotal +
              input.shippingTotal +
              input.taxTotal) *
              100,
          ) / 100
        : subtotal;
      const pending = await client.query<{ amount: number }>(
        `SELECT COALESCE(SUM(amount),0)::float AS amount FROM payments
         WHERE ${sale ? "sales_order_id" : "purchase_order_id"}=$1 AND status='PENDING'`,
        [id],
      );
      if (total + 0.00001 < current.amountPaid + pending.rows[0]!.amount)
        throw new BadRequestException(
          "Le nouveau total est inférieur aux règlements déjà enregistrés ou en attente.",
        );

      for (const variantId of ids) {
        const variant = variantMap.get(variantId)!;
        const oldQuantity = oldQuantities.get(variantId) ?? 0;
        const next = newItems.get(variantId);
        const nextQuantity = next?.quantity ?? 0;
        const delta = sale
          ? oldQuantity - nextQuantity
          : nextQuantity - oldQuantity;
        if (variant.onHand + delta < variant.reserved)
          throw new BadRequestException(
            `Stock insuffisant pour corriger ${variant.name}.`,
          );
        await client.query(
          `UPDATE inventory_balances SET on_hand=on_hand+$3,version=version+1,updated_at=now()
           WHERE variant_id=$1 AND location_id=$2`,
          [variantId, DEFAULT_LOCATION_ID, delta],
        );
        if (!sale) {
          const newOnHand = variant.onHand + delta;
          const correctedInventoryValue =
            variant.onHand * Number(variant.purchasePrice) -
            oldQuantity * (oldCosts.get(variantId) ?? 0) +
            nextQuantity * (next?.unitPrice ?? 0);
          if (correctedInventoryValue < -0.005)
            throw new BadRequestException(
              `Le lot de ${variant.name} a déjà été consommé; cette correction de coût exige un ajustement comptable séparé.`,
            );
          const weightedCost =
            newOnHand > 0
              ? Math.max(0, correctedInventoryValue) / newOnHand
              : Number(variant.purchasePrice);
          await client.query(
            "UPDATE product_variants SET purchase_price=$2,updated_at=now() WHERE id=$1",
            [variantId, weightedCost],
          );
        }
      }

      await client.query(
        `DELETE FROM inventory_movements WHERE organization_id=$1 AND reference_type=$2 AND reference_id=$3
         AND reason=$4`,
        [
          DEFAULT_ORGANIZATION_ID,
          sale ? "sales_order" : "purchase_order",
          id,
          sale ? "WHOLESALE_SALE" : "PURCHASE_RECEIPT",
        ],
      );
      await client.query(
        `DELETE FROM ${sale ? "sales_order_items" : "purchase_order_items"} WHERE ${sale ? "sales_order_id" : "purchase_order_id"}=$1`,
        [id],
      );
      for (const row of input.items) {
        const variant = variantMap.get(row.variantId)!;
        if (sale) {
          await client.query(
            `INSERT INTO sales_order_items
              (sales_order_id,variant_id,description,quantity,unit_price,unit_cost_snapshot,line_total)
             VALUES($1,$2,$3,$4,$5,$6,$7)`,
            [
              id,
              row.variantId,
              `${variant.name} · ${variant.sku}`,
              row.quantity,
              row.unitPrice,
              variant.purchasePrice,
              row.quantity * row.unitPrice,
            ],
          );
        } else {
          await client.query(
            `INSERT INTO purchase_order_items
              (purchase_order_id,variant_id,quantity,received_quantity,unit_cost,
               wholesale_price_snapshot,retail_price_snapshot,line_total)
             VALUES($1,$2,$3,$3,$4,$5,$6,$7)`,
            [
              id,
              row.variantId,
              row.quantity,
              row.unitPrice,
              oldWholesalePrices.get(row.variantId) ??
                Number(variant.wholesalePrice),
              oldRetailPrices.get(row.variantId) ?? Number(variant.retailPrice),
              row.quantity * row.unitPrice,
            ],
          );
        }
        await client.query(
          `INSERT INTO inventory_movements
            (organization_id,variant_id,location_id,quantity_delta,reason,reference_type,reference_id,unit_cost,note,actor_id)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            DEFAULT_ORGANIZATION_ID,
            row.variantId,
            DEFAULT_LOCATION_ID,
            sale ? -row.quantity : row.quantity,
            sale ? "WHOLESALE_SALE" : "PURCHASE_RECEIPT",
            sale ? "sales_order" : "purchase_order",
            id,
            sale ? variant.purchasePrice : row.unitPrice,
            `Correction de facture · ${input.notes}`,
            actorId,
          ],
        );
      }
      const partnerSnapshot = sale
        ? `(SELECT jsonb_build_object('id',id,'name',name,'phone',COALESCE(phone,''),'email',COALESCE(email,''),'address',COALESCE(address,'')) FROM customers WHERE id=$2)`
        : `(SELECT jsonb_build_object('id',id,'name',name,'phone',COALESCE(phone,''),'email',COALESCE(email,''),'address',COALESCE(address,'')) FROM suppliers WHERE id=$2)`;
      if (sale) {
        await client.query(
          `UPDATE sales_orders SET customer_id=$2,partner_snapshot=${partnerSnapshot},subtotal=$3,
            discount_total=$4,shipping_total=$5,tax_total=$6,grand_total=$7,notes=$8,status='DELIVERED',updated_at=now()
           WHERE id=$1`,
          [
            id,
            input.partnerId,
            subtotal,
            input.discountTotal,
            input.shippingTotal,
            input.taxTotal,
            total,
            input.notes,
          ],
        );
      } else {
        await client.query(
          `UPDATE purchase_orders SET supplier_id=$2,partner_snapshot=${partnerSnapshot},total=$3,notes=$4,updated_at=now()
           WHERE id=$1`,
          [id, input.partnerId, total, input.notes],
        );
      }
      await captureInvoiceHistory(client, kind, id, "UPDATED", actorId);
      return { id, total };
    });
  }

  async createInvoiceReturn(
    id: string,
    input: CreateInvoiceReturnInput,
    actorId: string,
  ) {
    input = createInvoiceReturnSchema.parse(input);
    return this.db.withTransaction(async (client) => {
      const document = await client.query<{
        status: string;
        total: number;
        subtotal: number;
        amountPaid: number;
        customerId: string | null;
        documentNumber: string;
      }>(
        `SELECT status,grand_total::float AS total,subtotal::float,amount_paid::float AS "amountPaid",
          customer_id AS "customerId",order_number AS "documentNumber"
         FROM sales_orders WHERE id=$1 AND organization_id=$2 FOR UPDATE`,
        [id, DEFAULT_ORGANIZATION_ID],
      );
      const order = document.rows[0];
      if (!order) throw new NotFoundException("Facture introuvable.");
      if (["CANCELED", "REFUNDED"].includes(order.status))
        throw new BadRequestException(
          "Cette facture ne peut plus recevoir de retour.",
        );
      await ensureInitialInvoiceHistory(client, "sale", id, actorId);
      const requestedIds = input.items.map((row) => row.invoiceItemId);
      const rows = await client.query<{
        id: string;
        variantId: string;
        quantity: number;
        returnedQuantity: number;
        unitPrice: number;
        unitCost: number;
      }>(
        `SELECT id,variant_id AS "variantId",quantity::int,returned_quantity::int AS "returnedQuantity",
          unit_price::float AS "unitPrice",unit_cost_snapshot::float AS "unitCost"
         FROM sales_order_items WHERE sales_order_id=$1 AND id=ANY($2::uuid[]) FOR UPDATE`,
        [id, requestedIds],
      );
      if (rows.rowCount !== requestedIds.length)
        throw new BadRequestException(
          "Un ou plusieurs articles ne figurent pas sur cette facture.",
        );
      const byId = new Map(rows.rows.map((row) => [row.id, row]));
      let returnValue = 0;
      for (const requested of input.items) {
        const row = byId.get(requested.invoiceItemId)!;
        if (requested.quantity > row.quantity - row.returnedQuantity)
          throw new BadRequestException(
            "La quantité retournée dépasse la quantité encore éligible.",
          );
        returnValue += requested.quantity * row.unitPrice;
      }
      returnValue = Math.round(returnValue * 100) / 100;
      const nextTotal = Math.max(
        0,
        Math.round((order.total - returnValue) * 100) / 100,
      );
      const minimumRefund = Math.max(0, order.amountPaid - nextTotal);
      const maximumRefund = Math.min(order.amountPaid, returnValue);
      if (
        input.refundAmount < minimumRefund ||
        input.refundAmount > maximumRefund
      )
        throw new BadRequestException(
          `Le remboursement doit être compris entre ${minimumRefund.toFixed(2)} et ${maximumRefund.toFixed(2)} MAD.`,
        );
      const returnNumber = `RET-${Date.now().toString(36).toUpperCase()}`;
      const created = await client.query<{ id: string }>(
        `INSERT INTO returns(organization_id,sales_order_id,return_number,status,refund_total,reason,created_by)
         VALUES($1,$2,$3,'COMPLETED',$4,$5,$6) RETURNING id`,
        [
          DEFAULT_ORGANIZATION_ID,
          id,
          returnNumber,
          input.refundAmount,
          input.reason,
          actorId,
        ],
      );
      const returnId = created.rows[0]!.id;
      for (const requested of input.items) {
        const row = byId.get(requested.invoiceItemId)!;
        await client.query(
          `INSERT INTO return_items(return_id,sales_order_item_id,variant_id,quantity,refund_amount,disposition)
           VALUES($1,$2,$3,$4,$5,$6)`,
          [
            returnId,
            row.id,
            row.variantId,
            requested.quantity,
            requested.quantity * row.unitPrice,
            requested.disposition,
          ],
        );
        await client.query(
          "UPDATE sales_order_items SET returned_quantity=returned_quantity+$2 WHERE id=$1",
          [row.id, requested.quantity],
        );
        if (requested.disposition === "RESTOCK") {
          await client.query(
            `UPDATE inventory_balances SET on_hand=on_hand+$3,version=version+1,updated_at=now()
             WHERE variant_id=$1 AND location_id=$2`,
            [row.variantId, DEFAULT_LOCATION_ID, requested.quantity],
          );
          await client.query(
            `INSERT INTO inventory_movements
              (organization_id,variant_id,location_id,quantity_delta,reason,reference_type,reference_id,unit_cost,note,actor_id)
             VALUES($1,$2,$3,$4,'CUSTOMER_RETURN','return',$5,$6,$7,$8)`,
            [
              DEFAULT_ORGANIZATION_ID,
              row.variantId,
              DEFAULT_LOCATION_ID,
              requested.quantity,
              returnId,
              row.unitCost,
              input.reason,
              actorId,
            ],
          );
        }
      }
      if (input.refundAmount > 0) {
        await client.query(
          `INSERT INTO payments(organization_id,customer_id,direction,method,status,amount,reference,created_by,sales_order_id)
           VALUES($1,$2,'OUT',$3,'COMPLETED',$4,$5,$6,$7)`,
          [
            DEFAULT_ORGANIZATION_ID,
            order.customerId,
            input.refundMethod,
            input.refundAmount,
            `${order.documentNumber} · ${returnNumber}`,
            actorId,
            id,
          ],
        );
      }
      const totals = await client.query<{ allReturned: boolean }>(
        `SELECT bool_and(returned_quantity=quantity) AS "allReturned" FROM sales_order_items WHERE sales_order_id=$1`,
        [id],
      );
      const nextPaid = Math.max(0, order.amountPaid - input.refundAmount);
      const status = totals.rows[0]?.allReturned ? "REFUNDED" : "DELIVERED";
      await client.query(
        `UPDATE sales_orders SET subtotal=GREATEST(0,subtotal-$2),grand_total=$3,amount_paid=$4,status=$5,updated_at=now() WHERE id=$1`,
        [id, returnValue, nextTotal, nextPaid, status],
      );
      await captureInvoiceHistory(client, "sale", id, "RETURNED", actorId);
      return { id: returnId, returnNumber, refundTotal: input.refundAmount };
    });
  }

  async recordInvoicePrint(
    kind: "sale" | "purchase",
    id: string,
    actorId: string,
  ) {
    return this.db.withTransaction(async (client) => {
      await ensureInitialInvoiceHistory(client, kind, id, actorId);
      await captureInvoiceHistory(client, kind, id, "PRINTED", actorId);
      return { id };
    });
  }

  async orders(query: OrderListQuery): Promise<OrderListItem[]> {
    const values: unknown[] = [DEFAULT_ORGANIZATION_ID];
    const filters = ["so.organization_id = $1"];
    if (query.channel !== "all") {
      values.push(query.channel);
      filters.push(`so.channel = $${values.length}`);
    }
    if (query.status !== "all") {
      values.push(query.status);
      filters.push(
        `(CASE WHEN so.status IN ('PAID', 'PARTIALLY_PAID') THEN 'CONFIRMED' WHEN so.status = 'FULFILLED' THEN 'DELIVERED' WHEN so.status = 'CANCELLED' THEN 'CANCELED' WHEN so.status = 'DRAFT' THEN 'ORDERED' ELSE so.status END) = $${values.length}`,
      );
    }
    if (query.search) {
      values.push(`%${query.search.toLowerCase()}%`);
      filters.push(
        `(lower(so.order_number) LIKE $${values.length} OR lower(COALESCE(c.name, '')) LIKE $${values.length})`,
      );
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
       WHERE ${filters.join(" AND ")}
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

  async updateOrderStatus(
    id: string,
    status: OrderStatus,
    actorId: string,
  ): Promise<OrderListItem> {
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
      if (!order) throw new NotFoundException("Commande introuvable.");
      const current = this.normalizeStatus(order.status);
      if (
        current === "CANCELED" ||
        (current === "DELIVERED" &&
          !(order.channel === "WHOLESALE_DESKTOP" && status === "CANCELED"))
      ) {
        throw new BadRequestException("Cette commande est déjà terminée.");
      }
      if (!["DELIVERED", "CANCELED"].includes(status)) {
        throw new BadRequestException("Transition de statut invalide.");
      }
      await ensureInitialInvoiceHistory(client, "sale", id, actorId);

      const items = await client.query<{
        variantId: string;
        quantity: number;
        unitCost: string;
      }>(
        `SELECT variant_id AS "variantId", quantity::int, unit_cost_snapshot AS "unitCost"
         FROM sales_order_items WHERE sales_order_id = $1 ORDER BY variant_id`,
        [id],
      );
      if (status === "DELIVERED" && order.channel === "RETAIL_WEB") {
        for (const item of items.rows) {
          const changed = await client.query(
            `UPDATE inventory_balances SET on_hand = on_hand - $3, reserved = reserved - $3,
               version = version + 1, updated_at = now()
             WHERE variant_id = $1 AND location_id = $2 AND reserved >= $3 AND on_hand >= $3`,
            [item.variantId, DEFAULT_LOCATION_ID, item.quantity],
          );
          if (!changed.rowCount)
            throw new BadRequestException("Le stock réservé est incohérent.");
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
           WHERE reference = $1 AND organization_id = $2 AND method = 'COD' AND status = 'PENDING'`,
          [order.orderNumber, DEFAULT_ORGANIZATION_ID],
        );
        await client.query(
          "UPDATE sales_orders SET amount_paid = grand_total WHERE id = $1",
          [id],
        );
      }
      if (status === "CANCELED") {
        for (const item of items.rows) {
          if (order.channel === "RETAIL_WEB") {
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
           WHERE reference = $1 AND organization_id = $2 AND status = 'PENDING'`,
          [order.orderNumber, DEFAULT_ORGANIZATION_ID],
        );
      }
      await client.query(
        `UPDATE checks c SET status = 'CANCELLED' FROM payments p WHERE c.payment_id=p.id AND p.organization_id=$1 AND p.reference=$2 AND p.status='CANCELLED' AND c.status IN ('PENDING','DEPOSITED')`,
        [DEFAULT_ORGANIZATION_ID, order.orderNumber],
      );
      await client.query(
        "UPDATE sales_orders SET status = $2, updated_at = now() WHERE id = $1",
        [id, status],
      );
      await client.query(
        `INSERT INTO audit_logs (organization_id, actor_id, action, entity_type, entity_id, after_data)
         VALUES ($1, $2, 'ORDER_STATUS_CHANGED', 'sales_order', $3, $4::jsonb)`,
        [
          DEFAULT_ORGANIZATION_ID,
          actorId,
          id,
          JSON.stringify({ from: current, to: status }),
        ],
      );
      await captureInvoiceHistory(
        client,
        "sale",
        id,
        "STATUS_CHANGED",
        actorId,
      );
    });
    const orders = await this.orders({
      search: "",
      channel: "all",
      status: "all",
    });
    return orders.find((order) => order.id === id)!;
  }

  private async loadVariants(client: PoolClient, ids: string[], lock = false) {
    const result = await client.query<VariantRow>(
      `SELECT v.id, p.name, v.sku, v.purchase_price AS "purchasePrice",
        v.wholesale_price AS "wholesalePrice", v.retail_price AS "retailPrice",
        COALESCE(b.on_hand, 0)::int AS "onHand",
        COALESCE(b.reserved, 0)::int AS reserved
       FROM product_variants v JOIN products p ON p.id = v.product_id
       JOIN inventory_balances b ON b.variant_id = v.id AND b.location_id = $2
       WHERE p.organization_id = $1 AND p.active = true AND v.active = true
         AND v.id = ANY($3::uuid[]) ORDER BY v.id ${lock ? "FOR UPDATE OF b" : ""}`,
      [DEFAULT_ORGANIZATION_ID, DEFAULT_LOCATION_ID, ids],
    );
    return result.rows;
  }

  private async requireActivePartner(
    client: PoolClient,
    table: "customers" | "suppliers",
    id: string,
  ) {
    const result = await client.query(
      `SELECT id FROM ${table} WHERE id = $1 AND organization_id = $2 AND active = true FOR SHARE`,
      [id, DEFAULT_ORGANIZATION_ID],
    );
    if (!result.rowCount)
      throw new BadRequestException("Ce contact est archivé ou introuvable.");
  }

  private normalizeStatus(status: string): OrderStatus {
    if (status === "FULFILLED") return "DELIVERED";
    if (status === "CANCELLED") return "CANCELED";
    if (status === "DRAFT") return "ORDERED";
    if (status === "PAID" || status === "PARTIALLY_PAID") return "CONFIRMED";
    return status as OrderStatus;
  }
}
