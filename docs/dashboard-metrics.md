# Home dashboard metric contract

The existing React management app is the delivery surface. PostgreSQL is the
source of truth; seeded historical records are clearly identifiable demo data.

- Compare revenue and gross margin with three honest grains: 12 monthly buckets
  (year), 30 daily buckets (month), or 7 daily buckets (week), including the
  current partial bucket in Africa/Casablanca time.
- Use a smooth monotone line only between observed bucket totals. Fill missing
  buckets with zero; retain order counts and exact values in an accessible table.
- Revenue is sales grand_total; margin is item line_total less quantity × pack
  multiplier × historical unit cost. Shipping/taxes are included in revenue but
  not product margin. Exclude draft, ordered, canceled and refunded orders.
- Period revenue/margin cards reconcile with chart rows. Inventory value and
  receivables are current balances, not period measures, and are labeled as such.
- Recharts owns rendering inside the existing dashboard. Use a dark primary line,
  a pale-pink comparator, a data-coordinate highlight band, peak change marker,
  MAD labels, tooltip, direct legend, and a keyboard-accessible exact-value table.
- Query refreshes every 30 seconds and after operations. Source timestamp and
  exclusions remain visible. Journal uses actual sales/purchase/inventory records.
- QA: aggregate fixtures, exclusions and period boundaries; compare sum of months
  to cards; inspect wide/narrow containers and the zero-sales state.
