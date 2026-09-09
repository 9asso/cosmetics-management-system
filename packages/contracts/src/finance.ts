import { z } from "zod";
import { moneySchema, paginationQuerySchema, uuidSchema } from "./shared.js";

export const financialAmountSchema = moneySchema.refine(
  (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
  "Deux décimales maximum.",
);
export const checkDetailsSchema = z.object({
  bankName: z.string().trim().min(2).max(120),
  checkNumber: z.string().trim().min(1).max(100),
  dueDate: z.iso.date(),
});
const manualCheckDetailsSchema = checkDetailsSchema.extend({
  checkNumber: z.string().trim().max(100).default(""),
});
export const recordPaymentSchema = z
  .object({
    requestId: uuidSchema,
    amount: financialAmountSchema.refine(
      (value) => value > 0,
      "Le montant doit être positif.",
    ),
    method: z.enum(["CASH", "CHECK"]),
    check: checkDetailsSchema.optional(),
  })
  .refine(
    (value) => value.method !== "CHECK" || Boolean(value.check),
    "Renseignez les informations du chèque.",
  );
export const updateCheckSchema = z.object({
  status: z.enum(["DEPOSITED", "CLEARED", "BOUNCED", "CANCELLED"]),
});
export const createManualCheckSchema = z.object({
  requestId: uuidSchema,
  contactName: z.string().trim().min(2).max(160),
  amount: financialAmountSchema.refine(
    (value) => value > 0,
    "Le montant doit être positif.",
  ),
  reference: z.string().trim().max(120).default(""),
  check: manualCheckDetailsSchema,
});
export const expenseCategories = [
  "RENT",
  "SALARIES",
  "TRANSPORT",
  "UTILITIES",
  "MARKETING",
  "SUPPLIES",
  "OTHER",
] as const;
export const createExpenseSchema = z
  .object({
    requestId: uuidSchema,
    name: z.string().trim().min(2).max(160),
    category: z.enum(expenseCategories),
    amount: financialAmountSchema.refine(
      (value) => value > 0,
      "Le montant doit être positif.",
    ),
    incurredOn: z.iso.date(),
    expenseType: z.enum(["FIXED", "VARIABLE"]).default("VARIABLE"),
    paymentMethod: z.enum(["CASH", "CHECK", "CREDIT"]).default("CASH"),
    recurringDay: z.coerce.number().int().min(1).max(31).optional(),
    notes: z.string().trim().max(1000).default(""),
  })
  .refine(
    (value) => value.expenseType !== "FIXED" || Boolean(value.recurringDay),
    "Choisissez le jour mensuel de cette dépense fixe.",
  )
  .refine(
    (value) => value.category !== "SALARIES" || value.expenseType === "FIXED",
    "Une dépense de salaire doit être mensuelle.",
  );
export const voidExpenseSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export const financeQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(160).default(""),
  kind: z.enum(["sale", "purchase"]).default("sale"),
  status: z.enum(["all", "pending"]).default("all"),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type CheckDetails = z.infer<typeof checkDetailsSchema>;
export type UpdateCheckInput = z.infer<typeof updateCheckSchema>;
export type CreateManualCheckInput = z.infer<typeof createManualCheckSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type FinanceQuery = z.infer<typeof financeQuerySchema>;
export interface FinanceBalance {
  id: string;
  kind: "sale" | "purchase";
  documentNumber: string;
  partnerName: string;
  phone: string;
  total: number;
  amountPaid: number;
  pendingAmount: number;
  balance: number;
  availableToPay: number;
  issuedAt: string;
  ageDays: number;
}
export interface FinanceCheck {
  id: string;
  kind: "sale" | "purchase" | null;
  documentId: string | null;
  documentNumber: string;
  partnerName: string;
  direction: "IN" | "OUT";
  amount: number;
  bankName: string;
  checkNumber: string;
  dueDate: string | null;
  status: string;
  documentStatus: string | null;
}
export interface ExpenseItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  incurredOn: string;
  notes: string;
  expenseType: "FIXED" | "VARIABLE";
  paymentMethod: "CASH" | "CHECK" | "CREDIT";
  recurringDay: number | null;
  recurringId: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}
export interface FinanceSummary {
  receivables: number;
  payables: number;
  pendingChecks: number;
  pendingCheckAmount: number;
  dueChecks: number;
  monthExpenses: number;
  monthIncoming: number;
  monthOutgoing: number;
}
