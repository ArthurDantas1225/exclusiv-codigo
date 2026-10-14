import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const path = "supabase-catalog/migrations/20261014090000_catalog_core.sql";

function readMigration() {
  assert.ok(existsSync(path), "catalog migration should exist");
  return readFileSync(path, "utf8").toLowerCase();
}

test("catalog schema keeps public inventory separate and orders private", () => {
  const sql = readMigration();

  for (const table of [
    "catalog_products",
    "catalog_variants",
    "catalog_images",
    "catalog_orders",
    "catalog_order_items",
    "catalog_sync_events",
    "catalog_order_attempts",
    "catalog_settings",
  ]) {
    assert.match(sql, new RegExp(`create table(?: if not exists)? public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }

  assert.match(sql, /unique\s*\(source_id\)/);
  assert.match(sql, /unique\s*\(idempotency_key\)/);
  assert.match(sql, /'pending'.*'importing'.*'confirmed'.*'cancelled'.*'failed'/s);
  assert.match(sql, /create or replace function public\.create_catalog_order\(p jsonb\)/);
  assert.match(sql, /revoke all on function public\.create_catalog_order\(jsonb\) from public, anon, authenticated/);
  assert.doesNotMatch(sql, /create policy[^;]+catalog_orders[^;]+for select[^;]+to anon/s);
});

test("catalog order creation validates current public price and stock", () => {
  const sql = readMigration();

  assert.match(sql, /from public\.catalog_variants v\s+join public\.catalog_products p/s);
  assert.match(sql, /selected_product\.stock < requested_quantity/);
  assert.match(sql, /unit_price[^;]+p\.price/s);
  assert.match(sql, /on conflict \(idempotency_key\)/);
});
