import { describe, expect, it } from "vitest";
import type { InvoiceDetail } from "@cosmetics/contracts";
import { buildInvoiceHtml } from "./invoice-print";

const sampleSale: InvoiceDetail = {
  id: "qa-sale",
  kind: "sale",
  documentNumber: "FAC-2026-001",
  partnerName: "Boutique Beauté Plus",
  status: "PARTIALLY_PAID",
  total: 500,
  amountPaid: 200,
  issuedAt: "2026-09-15T12:00:00Z",
  partner: {
    id: "p-1",
    name: "Boutique Beauté Plus",
    phone: "0612345678",
    email: "beaute@example.com",
    address: "Bd Anfa, Casablanca",
  },
  channel: "WHOLESALE",
  notes: "Internal staff note",
  subtotal: 500,
  shippingTotal: 0,
  taxTotal: 0,
  discountTotal: 0,
  items: [
    {
      id: "it-1",
      variantId: "var-1",
      description: "Crème Hydratante 50ml",
      imageUrl: "",
      quantity: 10,
      returnedQuantity: 1,
      unitMultiplier: 1,
      unitPrice: 50,
      lineTotal: 500,
    },
  ],
  payments: [
    {
      id: "pay-1",
      direction: "IN",
      method: "CASH",
      status: "COMPLETED",
      amount: 200,
      paidAt: "2026-09-15T14:00:00Z",
    },
  ],
  returns: [],
  history: [],
};

const samplePurchase: InvoiceDetail = {
  id: "qa-purchase",
  kind: "purchase",
  documentNumber: "ACH-2026-001",
  partnerName: "Fournisseur Pro",
  status: "CONFIRMED",
  total: 1200,
  amountPaid: 0,
  issuedAt: "2026-09-16T09:00:00Z",
  partner: null,
  channel: "WHOLESALE",
  notes: "",
  subtotal: 1200,
  shippingTotal: 0,
  taxTotal: 0,
  discountTotal: 0,
  items: [
    {
      id: "it-2",
      variantId: "var-2",
      description: "Shampoing Bio 250ml",
      imageUrl: "",
      quantity: 20,
      returnedQuantity: 0,
      unitMultiplier: 1,
      unitPrice: 60,
      lineTotal: 1200,
    },
  ],
  payments: [],
  returns: [],
  history: [],
};

describe("Invoice HTML Print Generator", () => {
  it("renders a valid HTML invoice for a sale order", () => {
    const html = buildInvoiceHtml(sampleSale);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("FAC-2026-001");
    expect(html).toContain("Facture de vente");
    expect(html).toContain("Boutique Beauté Plus");
    expect(html).toContain("Crème Hydratante 50ml");
    expect(html).toContain("500,00 MAD");
    expect(html).toContain("200,00 MAD");
    expect(html).toContain("300,00 MAD"); // balance
    expect(html).toContain("1 retourné");
    expect(html).toContain("Historique des règlements");
    expect(html).toContain("Espèces");
    // Internal notes should not leak into customer document
    expect(html).not.toContain("Internal staff note");
  });

  it("renders a valid HTML document for a purchase order without partner details", () => {
    const html = buildInvoiceHtml(samplePurchase);

    expect(html).toContain("Document d&#039;achat");
    expect(html).toContain("ACH-2026-001");
    expect(html).toContain("Fournisseur Pro");
    expect(html).toContain("Coordonnées non renseignées");
    expect(html).toContain("Shampoing Bio 250ml");
    expect(html).toContain("1 200,00 MAD");
    expect(html).not.toContain("Historique des règlements");
  });
});
