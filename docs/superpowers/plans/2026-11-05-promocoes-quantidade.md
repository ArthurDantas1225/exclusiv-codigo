# Promoções por quantidade — Implementation Plan

> **For agentic workers:** Execute task-by-task with clear interfaces; preserve current app and catalog conventions.

**Goal:** Configure and apply quantity promotions consistently in the EXCLUSIV POS app and public catalog.

**Architecture:** Store versioned campaigns in ERP settings and expose a public-safe projection from the primary ERP API. Keep products, photos and orders in the separate catalog database. Share the promotion rules and calculate order discounts server-side.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Postgres/Edge Functions, existing `app_settings` and catalog sync.

**Spec:** `docs/superpowers/specs/2026-11-05-promocoes-quantidade-design.md`

## Global Constraints

- Support four types: percentage tiers, fixed discount above quantity, fixed bundle price, and buy X get Y.
- Campaigns have channel, date, and product/category scopes; overlapping scope groups use the largest total saving.
- Discounts are integer BRL cents, capped at subtotal; manual POS discount follows automatic promotion.
- Pending catalog orders freeze price, discount, campaign and published version at creation.
- Catalog database receives public-safe configuration only; never publish internal cost or margin.
- ERP settings are the single source of truth; the public API exposes only campaign fields.
- No new dependencies.

## Review Focus

- Duplicate/stale sync version — keep current published campaigns when a new version fails.
- Invalid thresholds or discounts — reject at admin and server boundaries.
- Repeated bundle rules — apply only complete groups and charge leftovers at list price.
- Conflicting campaigns — select the greatest saving once per overlapping scope.
- Pending order confirmation — preserve frozen promotion values and avoid discounting twice.

## Files and Responsibilities

- `lib/promotions.ts`: shared promotion types and deterministic cents-based calculation.
- `components/settings.tsx`: promotion editor and publish status.
- `components/pos.tsx`, `components/pending-orders.tsx`: POS preview and order-to-sale discount transfer.
- `components/public-catalog.tsx`, `lib/catalog-client.ts`: public cart preview and versioned campaign data.
- `supabase/migrations/*`: ERP campaign version persistence and sale RPC validation.
- `supabase-catalog/migrations/*`: frozen order discount fields.
- `supabase/functions/promotions/index.ts`, `supabase-catalog/functions/create-order/index.ts`: public campaign projection and trusted order calculation.
- Catalog page/action call sites: pass published campaign/version safely.

## Tasks

### Task 1: Shared promotion calculator

- Define the campaign schema and validation for the four styles, dates, channels, and scopes.
- Implement deterministic price calculation in cents, campaign conflicts, full-group repeats, and result breakdown.
- Keep the interface reusable by app and catalog; no database or UI dependencies.

### Task 2: ERP persistence and POS

- Add versioned campaign save operation and sale promotion metadata to the ERP schema/RPC.
- Add Settings > Promoções editor with activation, type, thresholds, product/category scope, channels, validity, and publish feedback.
- Show promotion savings in POS and pass promotion version and breakdown to sale RPC.
- Make sale RPC recompute the published promotion before recording the sale; apply manual discount afterward.

### Task 3: Publish to catalog and calculate public orders

- Add a dedicated public projection endpoint for current campaign rules; keep it separate from cost and internal ERP fields.
- Add catalog server-side campaign calculation and persist subtotal, discount, campaign/version in orders.
- Return the final price breakdown to WhatsApp generation and pending orders.

### Task 4: Pending order conversion and consistency

- Display online order subtotal/discount/total in pending orders.
- Transfer saved order discount to ERP sale exactly once and retain campaign/version metadata.
- Ensure retries remain idempotent and older orders without promotion fields continue to work.

### Task 5: Review and verification

- Review all callers and migrations for backward compatibility, tenant isolation, RLS/grants, and no cost data in catalog payloads.
- Run the project's typecheck, lint, and production build; do not alter Supabase production schemas or deploy unless separately requested.
