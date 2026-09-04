# ADR 0001: Shared TypeScript commerce platform

## Status

Accepted — 2026-09-04

## Context

The existing Python desktop application combines inventory, wholesale sales,
purchases, credit, checks, returns, expenses, reporting, PDF generation, and
exports in one file backed by SQLite. A customer-facing retail store will be
added later and must share stock with wholesale operations.

## Decision

Build an API-first TypeScript monorepo with four deployable applications:

- React/Vite administrative UI packaged by Tauri for desktop.
- Next.js retail storefront.
- NestJS modular-monolith API.
- A background worker when asynchronous jobs are introduced.

PostgreSQL is the authoritative business database. The desktop application may
eventually use SQLite as a local cache/outbox, but local state must never become
an independent inventory source.

The first implementation uses explicit SQL and a thin database service. Domain
modules own their operations and must use database transactions for workflows
that affect multiple tables.

## Domain invariants

1. Inventory is stored in base units. Packaging is a positive integer conversion.
2. Stock-changing operations append an `inventory_movements` record.
3. `reserved` cannot exceed `on_hand`; available stock is `on_hand - reserved`.
4. Confirming a sale, recording its lines, payment, and stock movement is atomic.
5. Monetary values use PostgreSQL `numeric(18,2)`, never floating-point storage.
6. Commercial and financial documents are cancelled or reversed, not deleted.
7. Wholesale desktop and retail web orders use the same products, variants, and stock.
8. Sensitive writes produce audit records; integration-relevant writes produce outbox events.

## Consequences

- The retail store can be launched without migrating or duplicating inventory.
- Tauri contains only the desktop presentation and native integrations; business
  rules stay in the API.
- Full offline selling is deferred because resolving stock conflicts with an
  online store requires explicit branch allocations and synchronization rules.
- A modular monolith keeps operations simple while preserving boundaries that
  can later be extracted if load or team ownership justifies it.
