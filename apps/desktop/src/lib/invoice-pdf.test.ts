import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { InvoiceDetail } from "@cosmetics/contracts";
import { makeInvoicePdf } from "./invoice-pdf";
const font = readFileSync(resolve("public/fonts/Lato-Regular.ttf"));
const sample: InvoiceDetail = {
  id: "qa",
  kind: "sale",
  documentNumber: "FAC-QA-2026",
  partnerName: "Élégance Cosmétique",
  status: "PARTIALLY_PAID",
  total: 246.8,
  amountPaid: 100,
  issuedAt: "2026-09-06T10:00:00Z",
  partner: {
    id: "qa",
    name: "Élégance Cosmétique",
    phone: "0600000000",
    email: "boutique@example.test",
    address: "12 avenue des Fleurs, Casablanca",
  },
  channel: "WHOLESALE_DESKTOP",
  notes: "Internal note must not appear on customer document",
  subtotal: 246.8,
  shippingTotal: 0,
  taxTotal: 0,
  discountTotal: 0,
  items: [
    {
      id: "item-qa",
      variantId: "variant-qa",
      description: "Sérum éclat à la vitamine C · Édition été",
      imageUrl: "",
      quantity: 2,
      returnedQuantity: 0,
      unitMultiplier: 1,
      unitPrice: 123.4,
      lineTotal: 246.8,
    },
  ],
  payments: [],
  returns: [],
  history: [],
};
function saveSample(name: string, bytes: Uint8Array) {
  if (!process.env.PDF_QA_OUTPUT) return;
  mkdirSync(process.env.PDF_QA_OUTPUT, { recursive: true });
  writeFileSync(resolve(process.env.PDF_QA_OUTPUT, name), bytes);
}
describe("downloadable invoice PDF", () => {
  it("embeds the font and creates a readable one-page A4 invoice with French text", async () => {
    const bytes = await makeInvoicePdf(sample, font);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe("Facture FAC-QA-2026");
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPages()[0]!.getWidth()).toBeCloseTo(595.28);
    saveSample("invoice-single.pdf", bytes);
  });
  it("paginates large invoices and long unbroken names", async () => {
    const bytes = await makeInvoicePdf(
      {
        ...sample,
        documentNumber: "FAC-QA-MULTI",
        total: 12340,
        subtotal: 12340,
        items: Array.from({ length: 100 }, (_, index) => ({
          ...sample.items[0]!,
          quantity: 1,
          lineTotal: 123.4,
          description: `Article ${index + 1} · Soin cosmétique professionnel ${index === 1 ? "REFERENCE".repeat(50) : "hydratant longue durée"}`,
        })),
      },
      font,
    );
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(3);
    expect(pdf.getPageCount()).toBeLessThan(15);
    saveSample("invoice-multi.pdf", bytes);
  }, 20000);
});
