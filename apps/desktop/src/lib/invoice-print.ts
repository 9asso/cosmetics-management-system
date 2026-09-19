import type { BrandSettings, InvoiceSnapshot } from "@cosmetics/contracts";
import { defaultBrandSettings } from "./brand-settings";

const formatMoney = (val: number) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(val === 0 ? 0 : val)
    .replaceAll("\u202f", " ") + " MAD";

const escapeHtml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const statusLabels: Record<string, string> = {
  ORDERED: "Commandée",
  CONFIRMED: "Confirmée",
  PAID: "Payée",
  PARTIALLY_PAID: "Partiellement payée",
  DELIVERED: "Livrée",
  FULFILLED: "Livrée",
  CANCELED: "Annulée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
  RECEIVED: "Reçue",
  PARTIALLY_RECEIVED: "Partiellement reçue",
  DRAFT: "Brouillon",
};

const paymentMethodLabels: Record<string, string> = {
  CASH: "Espèces",
  CHECK: "Chèque",
  CARD: "Carte",
  TRANSFER: "Virement",
  CREDIT: "Crédit",
  COD: "Paiement à la livraison",
  OTHER: "Autre",
};

const paymentStatusLabels: Record<string, string> = {
  COMPLETED: "Encaissé",
  PENDING: "En attente",
  CANCELLED: "Annulé",
  FAILED: "Échoué",
};

/**
 * Generates an A4-ready HTML document for an invoice or order.
 */
export function buildInvoiceHtml(
  value: InvoiceSnapshot,
  settings: BrandSettings = defaultBrandSettings,
): string {
  const isSale = value.kind === "sale";
  const isCancelled = ["CANCELED", "CANCELLED", "REFUNDED"].includes(value.status);
  const statusLabel = statusLabels[value.status] ?? value.status;
  const issueDate = new Date(value.issuedAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Casablanca",
  });
  const balance = Math.max(0, value.total - value.amountPaid);

  const rows = value.items
    .map(
      (item) => `
      <tr>
        <td class="desc">
          <strong>${escapeHtml(item.description)}</strong>
          ${
            item.returnedQuantity > 0
              ? `<span class="tag-returned">(${item.returnedQuantity} retourné${item.returnedQuantity > 1 ? "s" : ""})</span>`
              : ""
          }
        </td>
        <td class="qty">${item.quantity}${item.unitMultiplier > 1 ? ` &times; ${item.unitMultiplier}` : ""}</td>
        <td class="num">${formatMoney(item.unitPrice)}</td>
        <td class="num total-col">${formatMoney(item.lineTotal)}</td>
      </tr>`,
    )
    .join("");

  const paymentsSection =
    value.payments && value.payments.length > 0
      ? `
    <div class="section-title">Historique des règlements</div>
    <table class="payments-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Mode de paiement</th>
          <th>Statut</th>
          <th style="text-align: right;">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${value.payments
          .map(
            (p) => `
          <tr>
            <td>${new Date(p.paidAt).toLocaleDateString("fr-FR", { timeZone: "Africa/Casablanca" })}</td>
            <td>${paymentMethodLabels[p.method] ?? p.method}</td>
            <td><span class="badge ${p.status === "COMPLETED" ? "badge-success" : p.status === "PENDING" ? "badge-pending" : "badge-danger"}">${paymentStatusLabels[p.status] ?? p.status}</span></td>
            <td style="text-align: right; font-weight: bold; ${p.direction === "OUT" ? "color: #b91c1c;" : ""}">${p.direction === "OUT" ? "- " : ""}${formatMoney(p.amount)}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
    `
      : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(isSale ? "Facture" : "Document d'achat")} ${escapeHtml(value.documentNumber)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      color: #262126;
      background: #ffffff;
      line-height: 1.45;
    }
    .invoice-container {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #f66897;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #b83350;
      letter-spacing: -0.2px;
      margin: 0 0 4px 0;
    }
    .brand-sub {
      color: #6e666e;
      font-size: 10px;
      margin: 0 0 3px 0;
    }
    .brand-contact {
      color: #3f3940;
      font-size: 10px;
      margin: 0;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-type {
      font-size: 16px;
      font-weight: 800;
      text-transform: uppercase;
      color: #262126;
      letter-spacing: 0.5px;
      margin: 0 0 4px 0;
    }
    .doc-number {
      font-size: 14px;
      font-weight: 700;
      color: #b83350;
      margin: 0 0 6px 0;
    }
    .doc-date {
      font-size: 10px;
      color: #6e666e;
      margin: 0 0 6px 0;
    }
    .badge {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 9999px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .badge-status {
      background: #fff0f5;
      color: #b83350;
      border: 1px solid #fbcfe8;
    }
    .badge-success {
      background: #ecfdf5;
      color: #047857;
    }
    .badge-pending {
      background: #fffbeb;
      color: #b45309;
    }
    .badge-danger {
      background: #fef2f2;
      color: #b91c1c;
    }
    .cancelled-alert {
      margin-bottom: 16px;
      padding: 10px 14px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      color: #b91c1c;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .parties-grid {
      display: flex;
      gap: 24px;
      margin-bottom: 22px;
    }
    .party-card {
      flex: 1;
      background: #fdfafb;
      border: 1px solid #f0e6e9;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .party-label {
      font-size: 9px;
      font-weight: 700;
      color: #b83350;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
    }
    .party-name {
      font-size: 13px;
      font-weight: 700;
      color: #262126;
      margin: 0 0 4px 0;
    }
    .party-details {
      font-size: 10px;
      color: #554e56;
      line-height: 1.5;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      page-break-inside: auto;
    }
    .items-table thead tr {
      background: #302b2f;
      color: #ffffff;
    }
    .items-table th {
      padding: 8px 10px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
    }
    .items-table th.num,
    .items-table td.num {
      text-align: right;
    }
    .items-table tbody tr {
      border-bottom: 1px solid #eadfe3;
      page-break-inside: avoid;
    }
    .items-table tbody tr:nth-child(even) {
      background: #fbf8f9;
    }
    .items-table td {
      padding: 8px 10px;
      font-size: 10px;
      vertical-align: top;
    }
    .items-table td.desc {
      width: 50%;
    }
    .items-table td.qty {
      text-align: center;
      width: 15%;
    }
    .tag-returned {
      display: inline-block;
      color: #be123c;
      font-size: 9px;
      font-weight: 600;
      margin-left: 5px;
    }
    .total-col {
      font-weight: 700;
      color: #262126;
    }
    .bottom-layout {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-top: 14px;
      page-break-inside: avoid;
    }
    .bottom-left {
      flex: 1.1;
    }
    .totals-box {
      flex: 0.9;
      background: #fdfafb;
      border: 1px solid #eadfe3;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 10px;
      color: #6e666e;
    }
    .totals-row.grand-total {
      border-top: 2px solid #b83350;
      margin-top: 6px;
      padding-top: 8px;
      font-size: 13px;
      font-weight: 800;
      color: #b83350;
    }
    .totals-row.paid-row {
      border-top: 1px dashed #eadfe3;
      margin-top: 6px;
      padding-top: 6px;
      color: #047857;
      font-weight: 700;
    }
    .totals-row.balance-row {
      font-weight: 800;
      color: #262126;
    }
    .section-title {
      font-size: 10px;
      font-weight: 800;
      color: #b83350;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin: 16px 0 8px 0;
    }
    .payments-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .payments-table th, .payments-table td {
      border-bottom: 1px solid #eadfe3;
      padding: 5px 8px;
      text-align: left;
    }
    .payments-table th {
      background: #f5ecef;
      color: #554e56;
      font-weight: 700;
    }
    .pending-checks-note {
      font-size: 9px;
      color: #6e666e;
      font-style: italic;
      margin-top: 6px;
    }
    .footer {
      margin-top: 30px;
      border-top: 1px solid #eadfe3;
      padding-top: 12px;
      text-align: center;
      color: #887e87;
      font-size: 9px;
      line-height: 1.5;
      page-break-inside: avoid;
    }
    .footer-thank-you {
      font-weight: 700;
      color: #b83350;
      margin-bottom: 2px;
    }
    @media print {
      body {
        margin: 0;
        background: transparent;
      }
      .items-table tr {
        page-break-inside: avoid;
      }
      .bottom-layout, .payments-table, .footer {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <header class="header">
      <div>
        <h1 class="brand-title">${escapeHtml(settings.title)}</h1>
        <p class="brand-sub">${escapeHtml(settings.subtitle)}</p>
        <p class="brand-contact">${escapeHtml(settings.phones)}</p>
      </div>
      <div class="doc-meta">
        <div class="doc-type">${escapeHtml(isSale ? "Facture de vente" : "Document d'achat")}</div>
        <div class="doc-number">${escapeHtml(value.documentNumber)}</div>
        <div class="doc-date">Date d'émission : ${escapeHtml(issueDate)}</div>
        <span class="badge badge-status">${escapeHtml(statusLabel)}</span>
      </div>
    </header>

    ${isCancelled ? '<div class="cancelled-alert">Document annulé / remboursé</div>' : ""}

    <section class="parties-grid">
      <div class="party-card">
        <div class="party-label">Émetteur</div>
        <div class="party-name">${escapeHtml(settings.title)}</div>
        <div class="party-details">
          ${escapeHtml(settings.subtitle)}<br/>
          Tél : ${escapeHtml(settings.phones)}
        </div>
      </div>
      <div class="party-card">
        <div class="party-label">${isSale ? "Client" : "Fournisseur"}</div>
        <div class="party-name">${escapeHtml(value.partnerName)}</div>
        <div class="party-details">
          ${value.partner?.phone ? `Tél : ${escapeHtml(value.partner.phone)}<br/>` : ""}
          ${value.partner?.email ? `Email : ${escapeHtml(value.partner.email)}<br/>` : ""}
          ${value.partner?.address ? `Adresse : ${escapeHtml(value.partner.address)}<br/>` : ""}
          ${!value.partner?.phone && !value.partner?.email && !value.partner?.address ? "Coordonnées non renseignées" : ""}
        </div>
      </div>
    </section>

    <table class="items-table">
      <thead>
        <tr>
          <th>Désignation</th>
          <th style="text-align: center;">Quantité</th>
          <th class="num">Prix unitaire</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="bottom-layout">
      <div class="bottom-left">
        ${paymentsSection}
        ${
          value.payments.some((p) => p.method === "CHECK" && p.status === "PENDING")
            ? '<p class="pending-checks-note">Les chèques en attente ne sont pas inclus dans le montant réglé.</p>'
            : ""
        }
      </div>

      <div class="totals-box">
        <div class="totals-row">
          <span>Sous-total</span>
          <strong>${formatMoney(value.subtotal)}</strong>
        </div>
        ${
          value.discountTotal > 0
            ? `<div class="totals-row"><span>Remise</span><strong>- ${formatMoney(value.discountTotal)}</strong></div>`
            : ""
        }
        ${
          value.shippingTotal > 0
            ? `<div class="totals-row"><span>Frais de livraison</span><strong>${formatMoney(value.shippingTotal)}</strong></div>`
            : ""
        }
        ${
          value.taxTotal > 0
            ? `<div class="totals-row"><span>Taxes</span><strong>${formatMoney(value.taxTotal)}</strong></div>`
            : ""
        }
        <div class="totals-row grand-total">
          <span>Total TTC</span>
          <span>${formatMoney(value.total)}</span>
        </div>
        <div class="totals-row paid-row">
          <span>Montant réglé</span>
          <span>${formatMoney(value.amountPaid)}</span>
        </div>
        ${
          !isCancelled
            ? `<div class="totals-row balance-row"><span>Reste à payer</span><span>${formatMoney(balance)}</span></div>`
            : ""
        }
      </div>
    </div>

    <footer class="footer">
      ${isSale ? `<div class="footer-thank-you">${escapeHtml(settings.thankYouText)}</div>` : ""}
      ${isSale ? `<div>${escapeHtml(settings.returnPolicy)}</div>` : ""}
      <div>${escapeHtml(settings.title)} · ${escapeHtml(value.documentNumber)} · Document commercial · Montants en MAD</div>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Triggers native system printing of the invoice directly from the desktop/web client.
 * Uses an invisible offscreen iframe with standard print styles.
 */
export async function printInvoice(
  value: InvoiceSnapshot,
  settings: BrandSettings = defaultBrandSettings,
): Promise<void> {
  const html = buildInvoiceHtml(value, settings);

  return new Promise((resolve) => {
    // Create an off-screen iframe
    const iframe = document.createElement("iframe");
    iframe.setAttribute(
      "style",
      "position:fixed;left:-9999px;top:-9999px;width:210mm;height:297mm;border:none;opacity:0;pointer-events:none;",
    );
    iframe.setAttribute("title", "Invoice Print Frame");
    document.body.appendChild(iframe);

    const targetDoc =
      iframe.contentDocument || iframe.contentWindow?.document;

    if (!targetDoc || !iframe.contentWindow) {
      // Fallback: window.open
      const popup = window.open("", "_blank");
      if (popup) {
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        popup.focus();
        setTimeout(() => {
          popup.print();
          resolve();
        }, 250);
      } else {
        window.print();
        resolve();
      }
      return;
    }

    targetDoc.open();
    targetDoc.write(html);
    targetDoc.close();

    // Give the layout and fonts time to calculate before triggering print dialog
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Native print trigger failed:", err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          resolve();
        }, 4000);
      }
    }, 350);
  });
}
