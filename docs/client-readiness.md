# Desktop workflow review — September 2026

The desktop now supports multi-product sales and receipts, invoice follow-up,
checks, expenses, stock alerts, and complete filtered CSV exports. These are
working API/database workflows, not demonstration-only buttons. This review does
not certify that every workflow required by a particular client is implemented.

## Delivered in this update

| Area | Working behavior |
| --- | --- |
| Wholesale sales and purchases | Add up to 100 different products to one document, search by name/SKU/barcode, browse the entire catalog, edit quantities/prices, remove lines, merge repeated selections, and open the resulting invoice. |
| Customer collections | Find outstanding invoices by document/contact, inspect balances and invoice age, record partial or full cash/transfer payments, or register a check. |
| Supplier settlements | Find received purchases with balances, record additional payments, and preserve the purchase's receipt status. |
| Check register | Record bank, number, and due date; filter pending checks; mark deposited, cleared, bounced, or canceled. Show received and issued checks and link to the original invoice. |
| Expenses | Record category, amount, date, and supporting reference/notes. Cancel a mistaken expense with a reason while retaining its history. |
| Dashboard | Stock alerts open their exact filters; check and balance alerts open the finance workspace; adding a product opens its form. Shortcuts respect the current user's role. |
| Inventory | Availability alerts account for retail reservations and exclude archived variants. Exports include every matching page and escape spreadsheet formulas in text fields. |
| Product media | Upload up to 10 JPG/PNG/WebP photos (5 MB each), choose the featured photo, and attach/replace one MP4/WebM preview (30 MB). Edit existing galleries; desktop and storefront share the same persisted media. Video delivery supports byte ranges. |
| Theme and catalogue cleanup | Login stays light while retaining the dashboard theme preference. Detail modals and inventory/contact tabs support dark mode. Imported demo source links, promotional descriptions, supplier branding and asset paths are cleaned. |
| Documents | Invoice details download a self-contained A4 PDF with an embedded French-compatible font, repeated headers, page numbers, and multi-page line items. No browser print dialog or remote document service is required. |

## Financial rules

- A pending check does **not** reduce `amount_paid`. It reserves its face value
  against additional payment entry, preventing double collection while awaiting
  bank clearance. Rejection/cancellation releases that reservation; clearance
  updates the invoice exactly once.
- Explicit payment links connect receipts and settlements to sales/purchase
  documents. Migration `006_finance_workflows.sql` backfills existing reference
  matches and corrects previously counted pending checks. Review historical
  balances before applying this migration to a production dataset.
- Finance is restricted at the API and navigation layers to owner, manager, and
  accountant roles. Existing authorized sales/purchase roles can still record an
  initial payment while creating their document.
- Follow-up payments and expense creation use request IDs to prevent duplicate
  records when the same request is retried. Row locks and transactions protect
  balances. This retry protection does not yet extend to whole new sales orders,
  purchase documents, or storefront checkouts.
- Financial amounts accept at most two decimals. Credit is an unpaid balance;
  selecting CREDIT cannot also record an immediate payment.
- Unpaid invoice age is time since issue, **not** contractual days overdue.
  Payment due dates/terms are not yet modeled for invoices.
- Monthly payment indicators count completed receipts and settlements in
  Africa/Casablanca time. Expenses are presented separately and excluded when
  voided. These indicators are not a bank reconciliation or cash-drawer balance.
- Historical checks without a document match cannot be cleared automatically.
  Missing historic bank/date fields are shown as missing rather than fabricated.
- Undelivered retail COD orders cannot be paid through the finance workspace;
  the existing delivery flow still records their COD collection.

## Verification

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` for the normal checks.
With the local database running and migrated through `pnpm dev:local`, run
`pnpm test:local` for real PostgreSQL integration tests. The runner reads only
`.env.local`, restricts the database connection to localhost, and rolls back
integration-test data. It never reads deployment credentials.

Coverage includes partial payments, overpayment rejection, request retries,
check settlement/rejection, canceled documents, COD restrictions, expense
reversals, role restrictions, stock reservations, multiple product lines,
cent-precision totals, and rollback when a cart cannot be fulfilled. UI tests
cover entry forms, navigation filters, full-catalog search, and complete exports. PDF samples cover accented French text, long identifiers, and a 100-line document. Media tests cover safe URLs, image normalization, gallery persistence, featured selection, partial upload failures, access roles and video byte ranges.

Local migrations were applied during development. Production deployment and
native desktop installer validation are separate steps.

## Remaining work before a full client handoff

The following are concrete gaps identified in the current application. They
should be prioritized with the client's operating process rather than presented
as completed features.

1. **Returns, refunds, and credit notes.** The existing order cancellation flow
   restores/releases stock, but collected money requires a separate refund
   workflow. Add partial returns, damaged/discarded items, refund records, and
   links back to the original invoice.
2. **Cosmetics lot and expiry control.** Lot tables exist; receiving, allocation,
   FEFO picking, expiry alerts, blocked expired stock, and batch recall screens
   are still needed. Align cost valuation with the chosen lot/average-cost policy.
3. **Business identity and document configuration.** Add company address and
   business identifiers, document numbering rules, configurable invoice details,
   delivery slips, tax/discount entry, and a client-approved document template.
4. **Backups and recovery.** Define encrypted scheduled backups, retention,
   restore testing, and an operator-facing backup/restore process. Validate the
   production domain/TLS and signed native packaging/update delivery.
5. **Credit policy and collection terms.** Credit limits can be stored on client
   records but are not enforced by sales yet. Add explicit invoice due dates,
   policy enforcement, customer statements, and optional reminder workflows.
6. **Purchasing lifecycle.** Add draft purchase orders, partial receipts, supplier
   returns, receiving discrepancies, and supplier invoice references. Current
   purchase entry immediately receives all entered quantities.
7. **Stock operations.** Add general product information editing/archiving, batch imports with a
   preview, stock movement history, cycle counts, barcode labels, and transfers
   if the client operates multiple warehouses or stores.
8. **Delivery and cash control.** Separate delivery confirmation from courier COD
   remittance if those happen at different times. Add courier tracking and cash
   sessions with opening/closing reconciliation if a physical till is used.
9. **Operational resilience and permissions.** Persist/recover drafts, extend
   idempotency to order creation, verify interrupted-network recovery, and refine
   cost/margin visibility. Existing general read APIs still expose financial
   information outside the dedicated finance workspace.
10. **Media scale.** Uploaded files currently use PostgreSQL storage. Add object storage/CDN, automatic removal of unused uploads, and video transcoding if catalogue volume or large videos require it.
11. **Optional commercial tools.** Customer-specific prices, packaging units,
    promotions, loyalty, advanced reports, and integrations should follow actual
    client requirements.
