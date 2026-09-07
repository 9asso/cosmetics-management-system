# Cosmetics Commerce Platform

A desktop-first wholesale cosmetics system with a shared retail storefront
foundation. This repository replaces the original single-file Python/SQLite
application with an API-first TypeScript platform.

## What is implemented

- PostgreSQL-backed NestJS API with staff authentication and role permissions.
- React/Vite desktop workspace with sales charts, stock alerts, team management,
  product creation, image galleries with a featured photo and preview video,
  inventory adjustments, customers and suppliers.
- Multi-product wholesale sales and supplier receipts with shared inventory,
  full-catalog search, configurable line quantities/prices, and invoice history.
- Finance workspace for customer collections, supplier settlements, check
  lifecycle tracking, and expenses with audited cancellation.
- Payment retry protection, overpayment checks, and correct pending-check balances.
- Filtered CSV exports across every page and downloadable multi-page invoice PDFs.
- Next.js storefront with shared stock reservations and COD order handling.
- Tauri desktop packaging scaffold and idempotent demonstration seeds.

See [the desktop review and client-readiness checklist](docs/client-readiness.md)
for the financial rules, validation commands, and the remaining workflows. Lot
expiry operations, partial returns/refunds, cash reconciliation, and operator
backup/restore are not yet complete.

## Repository layout

```text
apps/
  api/          NestJS modular-monolith API
  desktop/      React/Vite administrative app + Tauri shell
  storefront/   Next.js retail storefront
packages/
  contracts/    Shared runtime validation and TypeScript contracts
database/
  migrations/   Ordered PostgreSQL migrations
  seeds/        Optional local development data
docs/
  architecture/ Architecture decision records
```

## Local prerequisites

- Node.js 24 or newer
- pnpm 10 or newer
- PostgreSQL 17 or newer, or Docker Desktop
- Rust stable and the Tauri platform prerequisites only when packaging the desktop app

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL. With Docker installed:

   ```bash
   docker compose up -d postgres
   ```

4. Create the schema and optional development product:

   ```bash
   pnpm db:migrate
   pnpm --filter @cosmetics/api db:seed
   ```

5. Run all web processes:

   ```bash
   pnpm dev
   ```

   - Desktop web UI: http://localhost:1420
   - API: http://localhost:4000/api/v1
   - API documentation: http://localhost:4000/api/docs
   - Retail storefront: http://localhost:3000

6. Once Rust and OS prerequisites are installed, run the native desktop window:

   ```bash
   pnpm --filter @cosmetics/desktop tauri dev
   ```

## Verification

```bash
pnpm typecheck
pnpm test
pnpm test:local # optional: running, migrated localhost database required
pnpm build
```

## API surface

Authenticated management routes include `/dashboard`, `/products`,
`/inventory/adjustments`, `/customers`, `/suppliers`, `/purchases`,
`/wholesale-sales`, `/orders`, `/invoices`, and `/users`.

Product media routes are `POST /api/v1/products/media` (raw file upload),
`PATCH /api/v1/products/:id/media` (gallery/featured image/video), and public
`GET /api/v1/media/assets/:id` (including byte-range video playback). Images are
limited to 5 MB, previews to 30 MB, and galleries to 10 photos. The first photo
is the featured image. The gateway configuration includes the preview upload limit.

Finance adds:

```text
GET   /api/v1/finance/summary
GET   /api/v1/finance/balances
GET   /api/v1/finance/checks
GET   /api/v1/finance/expenses
POST  /api/v1/finance/payments/:kind/:id
PATCH /api/v1/finance/checks/:id
POST  /api/v1/finance/expenses
PATCH /api/v1/finance/expenses/:id/void
```

Public storefront routes remain `/store/products` and `/store/orders`.
Retail checkout accepts only COD; no payment gateway or card data is used.

## VPS deployment

The production Compose stack runs PostgreSQL, the NestJS API, the Next.js store,
the administrative web build, and an Nginx gateway. Put the VPS connection values
in the ignored root `.env`, then run:

```bash
pnpm deploy:vps
```

The deploy script installs Docker when necessary, adds swap on small servers,
deploys the committed Git tree, keeps database and administration secrets across
releases, builds the images, backs up an existing database before migrations, and
verifies the live services. Demo seeds run only on the first deployment. It writes
the generated temporary administration login to the ignored local file
`.deployment-credentials`.

The storefront and COD order endpoint are public. The administrative UI,
management APIs, and Swagger retain the deployment gateway protection. Staff
sign-in and API role checks are implemented in the application. A domain and TLS are required before real
production use.

## Further development

See [the prioritized client-readiness checklist](docs/client-readiness.md) and
[ADR 0001](docs/architecture/0001-platform-architecture.md).
