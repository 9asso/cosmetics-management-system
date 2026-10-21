# Home dashboard metric contract

The existing React management app is the delivery surface. PostgreSQL is the
source of truth; seeded historical records are clearly identifiable demo data.

- Compare revenue and gross margin for the current calendar year, month or week,
  through today in Africa/Casablanca time. Month means month-to-date, matching
  the original ONight dashboard, rather than a rolling 30-day window.
- Use a smooth monotone line only between observed bucket totals. Fill missing
  buckets with zero; retain order counts and exact values in an accessible table.
- Revenue is sales grand_total; margin is item line_total less quantity × pack
  multiplier × historical unit cost. Shipping/taxes are included in revenue but
  not product margin. Exclude draft, ordered, canceled and refunded orders.
- Period revenue/margin cards reconcile with chart rows. Inventory value and
  receivables are current balances, not period measures, and are labeled as such.
- `dashboard_sales_facts` is shared by cards, charts and reports. Opening debts
  are receivables, not sales. Legacy standalone refunds reduce revenue and margin
  on the return date; native returns already adjust their invoice and are not
  subtracted a second time.
- Available cash is opening cash plus completed receipts minus completed outflows
  and non-void expenses. Pending cheques do not count as cash. The imported old
  app kept cheque sales outside its Simple-credit balance; retain that distinction.
- Source rows are archived losslessly in `legacy_import_rows`. Historical sales
  keep their original unit costs. Missing catalogue items are archived, with no
  stock movements. Importing history must never reapply purchases/sales to stock.
- The legacy database stores partial cash collections on the sale, not a separate
  payment date. Imported collection dates therefore use the source sale date;
  exact historical daily cash timing cannot be recovered from this file.
- Recharts owns rendering inside the existing dashboard. Use a dark primary line,
  a pale-pink comparator, a data-coordinate highlight band, peak change marker,
  MAD labels, tooltip, direct legend, and a keyboard-accessible exact-value table.
- Query refreshes every 30 seconds and after operations. Source timestamp and
  exclusions remain visible. Journal uses actual sales/purchase/inventory records.
- QA: aggregate fixtures, exclusions and period boundaries; compare sum of months
  to cards; inspect wide/narrow containers and the zero-sales state.
