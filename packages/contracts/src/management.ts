import { z } from "zod";
import { checkDetailsSchema, financialAmountSchema } from "./finance.js";
import { moneySchema, uuidSchema } from "./shared.js";

export const orderStatuses = [
  "ORDERED",
  "CONFIRMED",
  "DELIVERED",
  "CANCELED",
] as const;
export const orderStatusSchema = z.enum(orderStatuses);

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).default(""),
  email: z.union([z.string().trim().email(), z.literal("")]).default(""),
  address: z.string().trim().max(500).default(""),
});

export const createCustomerSchema = createSupplierSchema.extend({
  creditLimit: moneySchema.default(0),
});

const operationItemSchema = z.object({
  variantId: uuidSchema,
  quantity: z.coerce.number().int().min(1).max(999_999),
});

const documentTotalsSchema = z.object({
  discountTotal: financialAmountSchema.default(0),
  shippingTotal: financialAmountSchema.default(0),
  taxTotal: financialAmountSchema.default(0),
});

export const createPurchaseSchema = z
  .object({
    supplierId: uuidSchema,
    items: z
      .array(
        operationItemSchema.extend({
          unitCost: financialAmountSchema,
          wholesalePrice: financialAmountSchema.optional(),
          retailPrice: financialAmountSchema.optional(),
        }),
      )
      .min(1)
      .max(100),
    paidAmount: financialAmountSchema.default(0),
    check: checkDetailsSchema.optional(),
    paymentMethod: z.enum(["CASH", "CHECK", "CREDIT"]).default("CREDIT"),
    notes: z.string().trim().max(500).default(""),
  })
  .refine(
    (value) => value.paymentMethod !== "CREDIT" || value.paidAmount === 0,
    "Un achat ou une vente à crédit ne constitue pas un paiement.",
  )
  .refine(
    (value) =>
      value.paymentMethod !== "CHECK" ||
      value.paidAmount === 0 ||
      Boolean(value.check),
    "Renseignez les informations du chèque.",
  )
  .refine(
    (value) =>
      new Set(value.items.map((item) => item.variantId)).size ===
      value.items.length,
    "Regroupez les quantités du même produit sur une seule ligne.",
  );

export const createWholesaleSaleSchema = z
  .object({
    customerId: uuidSchema,
    items: z
      .array(
        operationItemSchema.extend({
          unitPrice: financialAmountSchema.optional(),
        }),
      )
      .min(1)
      .max(100),
    paidAmount: financialAmountSchema.default(0),
    check: checkDetailsSchema.optional(),
    paymentMethod: z.enum(["CASH", "CHECK", "CREDIT"]).default("CASH"),
    ...documentTotalsSchema.shape,
    notes: z.string().trim().max(500).default(""),
  })
  .refine(
    (value) => value.paymentMethod !== "CREDIT" || value.paidAmount === 0,
    "Un achat ou une vente à crédit ne constitue pas un paiement.",
  )
  .refine(
    (value) =>
      value.paymentMethod !== "CHECK" ||
      value.paidAmount === 0 ||
      Boolean(value.check),
    "Renseignez les informations du chèque.",
  )
  .refine(
    (value) =>
      new Set(value.items.map((item) => item.variantId)).size ===
      value.items.length,
    "Regroupez les quantités du même produit sur une seule ligne.",
  );

export const updateInvoiceSchema = z
  .object({
    partnerId: uuidSchema,
    items: z
      .array(operationItemSchema.extend({ unitPrice: financialAmountSchema }))
      .min(1)
      .max(100),
    ...documentTotalsSchema.shape,
    notes: z.string().trim().max(500).default(""),
  })
  .refine(
    (value) =>
      new Set(value.items.map((item) => item.variantId)).size ===
      value.items.length,
    "Regroupez les quantités du même produit sur une seule ligne.",
  );

export const createInvoiceReturnSchema = z
  .object({
    items: z
      .array(
        z.object({
          invoiceItemId: uuidSchema,
          quantity: z.coerce.number().int().min(1).max(999_999),
          disposition: z
            .enum(["RESTOCK", "DAMAGED", "DISCARD"])
            .default("RESTOCK"),
        }),
      )
      .min(1)
      .max(100),
    refundAmount: financialAmountSchema,
    refundMethod: z.enum(["CASH", "TRANSFER"]).default("CASH"),
    reason: z.string().trim().min(3).max(500),
  })
  .refine(
    (value) =>
      new Set(value.items.map((item) => item.invoiceItemId)).size ===
      value.items.length,
    "Regroupez les retours du même article.",
  );

export const orderListQuerySchema = z.object({
  search: z.string().trim().max(160).default(""),
  channel: z.enum(["all", "RETAIL_WEB", "WHOLESALE_DESKTOP"]).default("all"),
  status: z.enum(["all", ...orderStatuses]).default("all"),
});

export const updateOrderStatusSchema = z.object({ status: orderStatusSchema });
export const orderParamsSchema = z.object({ id: uuidSchema });
export const invoiceQuerySchema = z.object({
  search: z.string().trim().max(160).default(""),
  kind: z.enum(["all", "sale", "purchase"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});
export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;
export const invoiceParamsSchema = z.object({
  id: uuidSchema,
  kind: z.enum(["sale", "purchase"]),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type CreateWholesaleSaleInput = z.infer<
  typeof createWholesaleSaleSchema
>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type CreateInvoiceReturnInput = z.infer<
  typeof createInvoiceReturnSchema
>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderStatus = (typeof orderStatuses)[number];

export interface BusinessPartner {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  creditLimit?: number;
}

export interface OperationResult {
  id: string;
  documentNumber: string;
  status: string;
  total: number;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  channel: "RETAIL_WEB" | "WHOLESALE_DESKTOP" | "MANUAL";
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  itemCount: number;
  totalQuantity: number;
  grandTotal: number;
  amountPaid: number;
  paymentMethod: string;
  placedAt: string;
}

export interface InvoiceListItem {
  id: string;
  kind: "sale" | "purchase";
  documentNumber: string;
  partnerName: string;
  status: string;
  total: number;
  amountPaid: number;
  issuedAt: string;
}

export interface InvoiceDetail extends InvoiceListItem {
  partner: BusinessPartner | null;
  channel: string;
  notes: string;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountTotal: number;
  items: {
    id: string;
    variantId: string;
    description: string;
    imageUrl: string;
    quantity: number;
    returnedQuantity: number;
    unitMultiplier: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  payments: {
    id: string;
    direction: "IN" | "OUT";
    method: string;
    status: string;
    amount: number;
    paidAt: string;
  }[];
  returns: {
    id: string;
    returnNumber: string;
    refundTotal: number;
    reason: string;
    returnedAt: string;
    quantity: number;
  }[];
  history: InvoiceHistoryEntry[];
}

export type InvoiceSnapshot = Omit<InvoiceDetail, "history">;
export interface InvoiceHistoryEntry {
  id: string;
  eventType: string;
  actorName: string;
  occurredAt: string;
  snapshot: InvoiceSnapshot;
}
