import { describe, expect, it } from "vitest";
import {
  createExpenseSchema,
  createPurchaseSchema,
  createInvoiceReturnSchema,
  createWholesaleSaleSchema,
  recordPaymentSchema,
} from "./index.js";
const id = "00000000-0000-4000-8000-000000000001";
describe("finance validation", () => {
  it("rejects zero, negative, non-finite and sub-cent payments", () => {
    for (const amount of [0, -1, Infinity, 1.001])
      expect(
        recordPaymentSchema.safeParse({ requestId: id, method: "CASH", amount })
          .success,
      ).toBe(false);
    expect(
      recordPaymentSchema.parse({
        requestId: id,
        method: "CASH",
        amount: 12.34,
      }).amount,
    ).toBe(12.34);
  });
  it("requires valid check details and dates", () => {
    expect(
      recordPaymentSchema.safeParse({
        requestId: id,
        method: "CHECK",
        amount: 10,
      }).success,
    ).toBe(false);
    expect(
      recordPaymentSchema.safeParse({
        requestId: id,
        method: "CHECK",
        amount: 10,
        check: { bankName: "Bank", checkNumber: "123", dueDate: "2026-02-30" },
      }).success,
    ).toBe(false);
  });
  it("rejects a cash amount on credit operations and duplicate item lines", () => {
    const base = {
      customerId: id,
      supplierId: id,
      items: [{ variantId: id, quantity: 1, unitCost: 10 }],
      paidAmount: 5,
      paymentMethod: "CREDIT",
    };
    for (const schema of [createPurchaseSchema, createWholesaleSaleSchema]) {
      expect(schema.safeParse(base).success).toBe(false);
      expect(
        schema.safeParse({
          ...base,
          paidAmount: 0,
          items: [...base.items, ...base.items],
        }).success,
      ).toBe(false);
      expect(schema.safeParse({ ...base, paidAmount: 0 }).success).toBe(true);
    }
  });
  it("requires an expense name, positive amount and a real date", () => {
    expect(
      createExpenseSchema.safeParse({
        requestId: id,
        name: "Rent",
        category: "RENT",
        amount: 100,
        incurredOn: "2026-13-01",
      }).success,
    ).toBe(false);
  });
  it("requires salaries and fixed expenses to have a monthly day", () => {
    const base = {
      requestId: id,
      name: "Salaires",
      category: "SALARIES",
      amount: 100,
      incurredOn: "2026-09-01",
      paymentMethod: "CREDIT",
    };
    expect(createExpenseSchema.safeParse(base).success).toBe(false);
    expect(
      createExpenseSchema.safeParse({
        ...base,
        expenseType: "FIXED",
        recurringDay: 25,
      }).success,
    ).toBe(true);
  });
  it("supports invoice totals and rejects transfers on wholesale creation", () => {
    const base = {
      customerId: id,
      items: [{ variantId: id, quantity: 2, unitPrice: 100 }],
      paidAmount: 0,
      discountTotal: 10,
      shippingTotal: 20,
      taxTotal: 5,
    };
    expect(createWholesaleSaleSchema.parse(base)).toMatchObject({
      discountTotal: 10,
      shippingTotal: 20,
      taxTotal: 5,
    });
    expect(
      createWholesaleSaleSchema.safeParse({
        ...base,
        paymentMethod: "TRANSFER",
      }).success,
    ).toBe(false);
  });
  it("validates unique return lines and supported refund methods", () => {
    const line = {
      invoiceItemId: id,
      quantity: 1,
      disposition: "RESTOCK",
    };
    expect(
      createInvoiceReturnSchema.safeParse({
        items: [line],
        refundAmount: 10,
        refundMethod: "CASH",
        reason: "Retour client",
      }).success,
    ).toBe(true);
    expect(
      createInvoiceReturnSchema.safeParse({
        items: [line, line],
        refundAmount: 10,
        refundMethod: "CHECK",
        reason: "Retour client",
      }).success,
    ).toBe(false);
  });
});
