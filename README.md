# Cosmetics Commerce Platform

A desktop-first wholesale cosmetics system with a shared retail storefront
foundation. This repository replaces the original single-file Python/SQLite
application with an API-first TypeScript platform.

## What is implemented

- Production-oriented pnpm/Turborepo monorepo.
- PostgreSQL schema for organizations, locations, users, customers, suppliers,
  products, SKUs, packaging units, lots/expiry dates, stock movements, wholesale
  and retail orders, payments, checks, purchases, returns, expenses, audit logs,
  and transactional outbox events.
- NestJS API with health, dashboard, product creation/search, public-store catalog,
  and audited inventory-adjustment endpoints.
- React/Vite desktop interface with dashboard, stock alerts, inventory search and
  filters, and a working product-creation form.
- Tauri 2 desktop packaging scaffold.
- Next.js retail storefront with a cart and cash-on-delivery checkout. Retail
  prices and totals are always recalculated by the API, and submitted orders
  reserve stock without recording a payment as collected.
- Shared Zod contracts used by the API and frontends.
- Idempotent demonstration data covering products, stock states, wholesale and
  retail orders, cash/check/COD payments, a purchase, and expenses.

The remaining sidebar modules are intentionally visible as planned modules. They
will be implemented as vertical slices rather than as disconnected CRUD screens.

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
pnpm build
```

## Current API surface

```text
GET  /api/v1/health
GET  /api/v1/dashboard/summary
GET  /api/v1/products
POST /api/v1/products
POST /api/v1/inventory/adjustments
GET  /api/v1/store/products
POST /api/v1/store/orders
```

`POST /api/v1/store/orders` accepts only `paymentMethod: "COD"`. No payment
gateway or card data is used.

## VPS deployment

The production Compose stack runs PostgreSQL, the NestJS API, the Next.js store,
the administrative web build, and an Nginx gateway. Put the VPS connection values
in the ignored root `.env`, then run:

```bash
pnpm deploy:vps
```

The deploy script installs Docker when necessary, adds swap on small servers,
keeps database and administration secrets across releases, applies migrations,
loads the idempotent demonstration seed, and verifies the live services. It writes
the generated temporary administration login to the ignored local file
`.deployment-credentials`.

The storefront and COD order endpoint are public. The administrative UI,
management APIs, and Swagger are protected with HTTP Basic Auth until native
staff authentication is implemented. A domain and TLS are required before real
production use.

## Next vertical slices

1. Staff authentication, sessions, and role permissions.
2. Wholesale POS: draft cart, price overrides, invoice confirmation, credit, and checks.
3. Purchases: supplier orders, receipts, lots, and supplier payments.
4. Returns/refunds and immutable document reversals.
5. PDF invoices, Excel exports, scheduled reports, backups, and updater delivery.
6. Retail order fulfillment, delivery tracking, COD collection, and cancellation
   workflows.

See [ADR 0001](docs/architecture/0001-platform-architecture.md) for the architectural
rules behind the implementation.
