import { describe, expect, it } from "vitest";
import { loadInvoiceSnapshot, type InvoiceQueryable } from "./invoice-data.js";

function invoiceDb(reference: string | null) {
  const queries: string[] = [];
  const db = {
    async query(sql: string) {
      queries.push(sql);
      if (
        sql.includes("FROM sales_orders") ||
        sql.includes("FROM purchase_orders")
      )
        return {
          rows: [
            {
              id: "invoice-1",
              documentNumber: "FAC-001",
              partnerName: "Client",
              status: "CONFIRMED",
              total: 100,
              amountPaid: 0,
            },
          ],
        };
      if (
        sql.includes("FROM sales_order_items") ||
        sql.includes("FROM purchase_order_items")
      )
        return {
          rows: [
            {
              id: "item-1",
              variantId: "variant-1",
              productName: "Fauxfilter concealer",
              productBrand: "Huda Beauty",
              productReference: reference,
              imageUrl: "",
              quantity: 1,
              returnedQuantity: 0,
              unitMultiplier: 1,
              unitPrice: 100,
              lineTotal: 100,
            },
          ],
        };
      return { rows: [] };
    },
  } as unknown as InvoiceQueryable;
  return { db, queries };
}

describe("invoice product labels", () => {
  it.each(["sale", "purchase"] as const)(
    "shows name, brand and reference without SKU on a %s invoice",
    async (kind) => {
      const { db, queries } = invoiceDb("REF-42");
      const invoice = await loadInvoiceSnapshot(db, kind, "invoice-1");

      expect(invoice.items[0]?.description).toBe(
        "Fauxfilter concealer · Huda Beauty · Réf. REF-42",
      );
      expect(
        queries.find((sql) =>
          sql.includes(
            "FROM " + (kind === "sale" ? "sales" : "purchase") + "_order_items",
          ),
        ),
      ).not.toContain("v.sku");
    },
  );

  it("does not substitute a SKU when the reference is empty", async () => {
    const { db } = invoiceDb(null);
    const invoice = await loadInvoiceSnapshot(db, "sale", "invoice-1");

    expect(invoice.items[0]?.description).toBe(
      "Fauxfilter concealer · Huda Beauty",
    );
  });
});
