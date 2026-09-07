import { describe, expect, it } from "vitest";
import {
  createExpenseSchema,
  createPurchaseSchema,
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
});
