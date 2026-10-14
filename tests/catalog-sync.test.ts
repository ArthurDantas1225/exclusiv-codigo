import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCatalogProjection, shouldApplyVersion } from "../lib/catalog-sync.ts";

test("catalog projection excludes private cost and internal inventory fields", () => {
  const projection = buildCatalogProjection({
    product: { id: "p1", name: "Camisa", category: "Camisa", subcategory: "Básica", collection: "Essenciais", price: 7990, active: true, catalog_visible: true, archived_at: null },
    variants: [{ id: "v1", product_id: "p1", size: "M", color: "Preta", model: "Padrão", stock: 2, cost: 3100, sku: "SECRET-SKU", minimum: 4 }],
    images: [{ id: "i1", product_id: "p1", path: "org/p1/photo.webp", color: "Preta", view: "front", is_primary: true, hidden_at: null, url: "https://catalog.test/photo.webp" }],
    version: 20,
  });

  assert.equal(projection.product.published, true);
  assert.equal(projection.variants[0].stock, 2);
  assert.equal(projection.images[0].url, "https://catalog.test/photo.webp");
  const serialized = JSON.stringify(projection);
  assert.doesNotMatch(serialized, /cost|sku|minimum|archived_at/);
});

test("older catalog snapshots never replace a newer version", () => {
  assert.equal(shouldApplyVersion(20, 19), false);
  assert.equal(shouldApplyVersion(20, 20), true);
  assert.equal(shouldApplyVersion(20, 21), true);
});

test("catalog synchronization runs beside the catalog data and validates the ERP user", () => {
  const client = readFileSync(new URL("../lib/catalog-sync.ts", import.meta.url), "utf8");
  const handler = readFileSync(new URL("../supabase-catalog/functions/sync-catalog/index.ts", import.meta.url), "utf8");
  assert.match(client, /sduacssupdhzwqmlijqv\.supabase\.co\/functions\/v1\/sync-catalog/);
  assert.match(handler, /auth\.getUser\(token\)/);
  assert.doesNotMatch(handler, /CATALOG_SUPABASE_SERVICE_ROLE_KEY/);
});
