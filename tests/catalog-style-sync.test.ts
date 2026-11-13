import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import test from "node:test";

test("style snapshot updates its product without an ambiguous source_id", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.catalog_products(source_id uuid primary key,version bigint,updated_at timestamptz);
      create function public.apply_catalog_snapshot(p jsonb) returns integer language sql as 'select 1';
      insert into public.catalog_products values('11111111-1111-4111-8111-111111111111',20,now());`);
    const dir = new URL("../supabase-catalog/migrations/", import.meta.url);
    const original = readFileSync(new URL("20261110095019_add_catalog_product_style.sql",dir),"utf8");
    await db.exec(original);
    // Apply the repair when present; without it this reproduces PostgreSQL 42702.
    for (const file of readdirSync(dir).filter(name=>name.endsWith("_fix_catalog_style_snapshot.sql")).sort()) {
      await db.exec(readFileSync(new URL(file,dir),"utf8"));
    }
    const payload = {products:[{product:{source_id:"11111111-1111-4111-8111-111111111111",version:20,style:"Streetwear"}}]};
    await db.query("select public.apply_catalog_snapshot_with_style($1::jsonb)",[JSON.stringify(payload)]);
    const result = await db.query<{style:string}>("select style from public.catalog_products");
    assert.equal(result.rows[0].style,"Streetwear");
    payload.products[0].product.version=19;
    payload.products[0].product.style="Casual";
    await db.query("select public.apply_catalog_snapshot_with_style($1::jsonb)",[JSON.stringify(payload)]);
    assert.equal((await db.query<{style:string}>("select style from public.catalog_products")).rows[0].style,"Streetwear");
  } finally { await db.close(); }
});
