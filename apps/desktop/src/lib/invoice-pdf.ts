import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { BrandSettings, InvoiceSnapshot } from "@cosmetics/contracts";
import { defaultBrandSettings } from "./brand-settings";

const amount = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value === 0 ? 0 : value)
    .replaceAll("\u202f", " ") + " MAD";
const clean = (value: string) =>
  value.replace(/[\u0000-\u0008\u000b-\u001f]/g, "").replaceAll("\u202f", " ");

/** Self-contained, downloadable A4 document; no print dialog or remote rendering service. */
export async function makeInvoicePdf(
  value: InvoiceSnapshot,
  fontBytes: Uint8Array | ArrayBuffer,
  settings: BrandSettings = defaultBrandSettings,
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  pdf.setTitle(
    `${value.kind === "sale" ? "Facture" : "Achat"} ${value.documentNumber}`,
  );
  pdf.setAuthor(settings.title);
  pdf.setSubject("Document commercial");
  const ink = rgb(0.2, 0.19, 0.22),
    muted = rgb(0.43, 0.42, 0.46),
    brand = rgb(0.75, 0.28, 0.39),
    line = rgb(0.9, 0.87, 0.89);
  let page!: PDFPage;
  let y = 0;
  const text = (
    value: string,
    x: number,
    top: number,
    size = 10,
    color = ink,
  ) => page.drawText(clean(value), { x, y: top, size, font, color });
  const right = (value: string, edge: number, top: number, size = 10) => {
    const content = clean(value);
    text(content, edge - font.widthOfTextAtSize(content, size), top, size);
  };
  const fittedSize = (value: string, width: number, size: number, min = 6) => {
    const content = clean(value);
    let fitted = size;
    while (fitted > min && font.widthOfTextAtSize(content, fitted) > width)
      fitted -= 0.25;
    return fitted;
  };
  const center = (value: string, top: number, size = 10, color = ink) => {
    const content = clean(value);
    const actualSize = fittedSize(content, 511, size);
    text(
      content,
      (595.28 - font.widthOfTextAtSize(content, actualSize)) / 2,
      top,
      actualSize,
      color,
    );
  };
  const wrap = (value: string, width: number, size = 10) => {
    const lines: string[] = [];
    for (const paragraph of clean(value).split(/\r?\n/)) {
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (
          current &&
          font.widthOfTextAtSize(current + " " + word, size) <= width
        ) {
          current += " " + word;
          continue;
        }
        if (current) {
          lines.push(current);
          current = "";
        }
        // Break long identifiers too, so no email or SKU can escape the column.
        for (const char of word) {
          if (current && font.widthOfTextAtSize(current + char, size) > width) {
            lines.push(current);
            current = "";
          }
          current += char;
        }
      }
      if (current) lines.push(current);
    }
    return lines.length ? lines : [""];
  };
  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    text(
      settings.title,
      42,
      794,
      fittedSize(settings.title, 300, 17, 10),
      brand,
    );
    text(
      settings.subtitle,
      42,
      777,
      fittedSize(settings.subtitle, 300, 9),
      muted,
    );
    text(settings.phones, 42, 762, fittedSize(settings.phones, 300, 9));
    right(
      value.kind === "sale" ? "FACTURE DE VENTE" : "DOCUMENT D’ACHAT",
      553,
      794,
      10,
    );
    right(value.documentNumber, 553, 777, 10);
    right(
      new Date(value.issuedAt).toLocaleDateString("fr-FR", {
        timeZone: "Africa/Casablanca",
      }),
      553,
      760,
      9,
    );
    page.drawLine({
      start: { x: 42, y: 742 },
      end: { x: 553, y: 742 },
      thickness: 1,
      color: line,
    });
    y = 718;
  };
  const paragraph = (content: string, size = 10, color = ink) => {
    for (const row of wrap(content, 511, size)) {
      if (y < 75) newPage();
      text(row, 42, y, size, color);
      y -= size + 5;
    }
  };
  const tableHeader = () => {
    page.drawRectangle({
      x: 42,
      y: y - 9,
      width: 511,
      height: 25,
      color: rgb(0.97, 0.94, 0.95),
    });
    text("DÉSIGNATION", 50, y, 8, muted);
    right("QUANTITÉ", 347, y, 8);
    right("PRIX UNITAIRE", 441, y, 8);
    right("TOTAL", 545, y, 8);
    y -= 30;
  };
  newPage();
  paragraph(value.kind === "sale" ? "CLIENT" : "FOURNISSEUR", 8, muted);
  paragraph(value.partnerName, 13);
  if (value.partner?.address) paragraph(value.partner.address, 10, muted);
  if (value.partner?.phone) paragraph(value.partner.phone, 10, muted);
  if (value.partner?.email) paragraph(value.partner.email, 10, muted);
  y -= 10;
  const cancelled = ["CANCELED", "CANCELLED", "REFUNDED"].includes(
    value.status,
  );
  if (cancelled) {
    paragraph("DOCUMENT ANNULÉ / REMBOURSÉ", 11, brand);
    y -= 10;
  }
  if (y < 130) newPage();
  tableHeader();
  for (const item of value.items) {
    const description = wrap(item.description, 235, 10);
    // Also split exceptionally long legacy descriptions across pages.
    let first = true;
    while (description.length) {
      if (y < 100) {
        newPage();
        tableHeader();
      }
      const room = Math.max(1, Math.floor((y - 80) / 13));
      const segment = description.splice(0, room);
      segment.forEach((row, index) => text(row, 50, y - index * 13));
      if (first) {
        right(
          `${item.quantity}${item.unitMultiplier > 1 ? " × " + item.unitMultiplier : ""}`,
          347,
          y,
          9,
        );
        right(amount(item.unitPrice), 441, y, 8.5);
        right(amount(item.lineTotal), 545, y, 8.5);
      }
      y -= Math.max(30, segment.length * 13 + 14);
      page.drawLine({
        start: { x: 42, y: y + 12 },
        end: { x: 553, y: y + 12 },
        thickness: 0.5,
        color: line,
      });
      first = false;
    }
  }
  const totals: [string, number][] = [
    ["Sous-total", value.subtotal],
    ["Remise", -value.discountTotal],
    ["Livraison", value.shippingTotal],
    ["Taxes", value.taxTotal],
    ["Total", value.total],
    ["Réglé", value.amountPaid],
  ];
  if (!cancelled)
    totals.push([
      "Solde à régler",
      Math.max(0, value.total - value.amountPaid),
    ]);
  if (y < totals.length * 24 + 100) newPage();
  y -= 20;
  for (const [label, number] of totals) {
    if (label === "Total" || label === "Solde à régler")
      page.drawRectangle({
        x: 315,
        y: y - 7,
        width: 238,
        height: 23,
        color: rgb(0.97, 0.94, 0.95),
      });
    text(label, 325, y, 10);
    right(amount(number), 545, y, 10);
    y -= 24;
  }
  if (
    value.payments.some(
      (payment) => payment.method === "CHECK" && payment.status === "PENDING",
    )
  ) {
    if (y < 105) newPage();
    y -= 10;
    paragraph(
      "Les chèques en attente ne sont pas inclus dans le montant réglé.",
      9,
      muted,
    );
  }
  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    page = current;
    if (value.kind === "sale") {
      center(settings.thankYouText, 63, 10, brand);
      center(settings.returnPolicy, 49, 8, muted);
    }
    page.drawLine({
      start: { x: 42, y: value.kind === "sale" ? 39 : 53 },
      end: { x: 553, y: value.kind === "sale" ? 39 : 53 },
      thickness: 0.5,
      color: line,
    });
    text(
      `${settings.title} · ${value.documentNumber} · Montants en MAD`,
      42,
      value.kind === "sale" ? 23 : 36,
      fittedSize(
        `${settings.title} · ${value.documentNumber} · Montants en MAD`,
        440,
        8,
      ),
      muted,
    );
    right(
      `${index + 1} / ${pages.length}`,
      553,
      value.kind === "sale" ? 23 : 36,
      8,
    );
  });
  return pdf.save();
}

export async function downloadInvoicePdf(
  value: InvoiceSnapshot,
  settings: BrandSettings = defaultBrandSettings,
) {
  const response = await fetch(
    `${import.meta.env.BASE_URL}fonts/Lato-Regular.ttf`,
  );
  if (!response.ok)
    throw new Error("Impossible de charger la police du document. Réessayez.");
  const bytes = await makeInvoicePdf(
    value,
    await response.arrayBuffer(),
    settings,
  );
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${value.documentNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
