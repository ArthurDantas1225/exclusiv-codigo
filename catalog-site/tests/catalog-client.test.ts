import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogData, loadCatalog, type CatalogData } from "../lib/catalog-client.ts";

test("catalog data contains only published products and available variants", () => {
  const catalog = buildCatalogData({
    settings: { shop_name: "EXCLUSIV", whatsapp: "5584996008220", instagram: "@exclusiv_streetwear", headline: "Escolha suas peças exclusivas" },
    products: [
      { source_id: "p1", name: "Camisa", category: "Camisa", subcategory: "Básica", collection: "Essenciais", price: 7990, published: true },
      { source_id: "p2", name: "Oculta", category: "Outros", subcategory: "", collection: "", price: 1000, published: false },
      { source_id: "p3", name: "Esgotada", category: "Camisa", subcategory: "Básica", collection: "Essenciais", price: 5000, published: true },
    ],
    variants: [
      { source_id: "v1", product_id: "p1", size: "M", color: "Preta", model: "Padrão", stock: 2 },
      { source_id: "v2", product_id: "p1", size: "G", color: "Preta", model: "Padrão", stock: 0 },
      { source_id: "v3", product_id: "p2", size: "M", color: "Azul", model: "Padrão", stock: 3 },
      { source_id: "v4", product_id: "p3", size: "M", color: "Azul", model: "Padrão", stock: 0 },
    ],
    images: [{ source_id: "i1", product_id: "p1", url: "https://img.test/camisa.webp", color: "Preta", view: "front", is_primary: true, position: 0 }],
  });

  assert.equal(catalog.shop, "EXCLUSIV");
  assert.equal(catalog.products.length, 1);
  assert.equal(catalog.products[0].variants.length, 1);
  assert.equal(catalog.products[0].variants[0].id, "v1");
  assert.equal(catalog.products[0].image, "https://img.test/camisa.webp");
});

test("catalog keeps a published in-stock product without a photo", () => {
  const catalog = buildCatalogData({
    settings: null,
    products: [{ source_id: "p1", name: "Calça", category: "Calça", subcategory: "", collection: "", price: 12000, published: true }],
    variants: [{ source_id: "v1", product_id: "p1", size: "M", color: "Preta", model: "Padrão", stock: 1 }],
    images: [],
  });

  assert.equal(catalog.products[0].image, null);
  assert.equal(catalog.products[0].variants[0].id, "v1");
});

test("ERP photo fallback preserves the promotion version and campaigns used by checkout", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_CATALOG_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_CATALOG_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_CATALOG_SUPABASE_URL = "https://catalog.test";
  process.env.NEXT_PUBLIC_CATALOG_SUPABASE_PUBLISHABLE_KEY = "public-key";
  const fallback: CatalogData = {
    shop: "EXCLUSIV",
    products: [{ id: "p1", name: "Camisa", category: "Camisa", subcategory: "Básica", collection: "", price: 7000, image: "https://erp.test/photo.webp", images: [{ id: "i1", url: "https://erp.test/photo.webp", color: "Preta", view: "front", is_primary: true }], variants: [{ id: "v1", product_id: "p1", size: "M", color: "Preta", model: "Padrão", stock: 1 }] }],
  };
  const campaigns = [{ id:"campaign-current", name:"Promoção real", active:true, channels:["catalog"], productIds:[], categories:[], priority:0, type:"fixed", minQuantity:2, discountCents:100 }];
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("functions/v1/catalog?view=promotions")) return Response.json({ version: 2, campaigns });
    if (url.endsWith("functions/v1/catalog")) return Response.json({ ...fallback, version:2, campaigns });
    if (url.includes("catalog_settings")) return Response.json([]);
    if (url.includes("catalog_products")) return Response.json([{ source_id: "p1", name: "Camisa", category: "Camisa", subcategory: "Básica", collection: "", price: 7000, published: true }]);
    return Response.json([]);
  };

  try {
    const catalog = await loadCatalog(fetcher as typeof fetch);
    assert.equal(catalog.products[0].image, "https://erp.test/photo.webp");
    assert.equal(catalog.promotionVersion, 2);
    assert.deepEqual(catalog.promotions, campaigns);
    // Older ERP snapshots may omit promotion fields entirely.
    const legacy = await loadCatalog((async (input) => String(input).endsWith("functions/v1/catalog")
      ? Response.json(fallback) : fetcher(input)) as typeof fetch);
    assert.equal(legacy.promotionVersion, 2);
    assert.deepEqual(legacy.promotions, campaigns);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_CATALOG_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_CATALOG_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_CATALOG_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_CATALOG_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});
