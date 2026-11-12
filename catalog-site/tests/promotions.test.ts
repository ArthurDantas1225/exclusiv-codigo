import assert from "node:assert/strict";
import test from "node:test";
import { calculate as calculateCatalog, promotionProductIds, type Campaign } from "../lib/promotions.ts";
import { calculatePromotions } from "../../lib/promotions.ts";
import { calculatePromotions as calculateErp } from "../../supabase/functions/_shared/promotions.ts";
import { calculate as calculateCatalogServer } from "../../supabase-catalog/functions/_shared/promotions.ts";

const campaign: Campaign = {
  id: "campaign-1",
  name: "Leve 2 com desconto",
  active: true,
  channels: ["catalog"],
  productIds: ["product-1"],
  categories: [],
  requirements: [],
  priority: 0,
  type: "percent_tiers",
  tiers: [{ quantity: 2, percent: 10 }],
};

test("catalog applies a normal promotion saved with an empty requirements list", () => {
  const now = new Date("2026-11-11T12:00:00-03:00");
  const product = { id: "product-1", category: "Camisa" };
  const lines = [
    { productId: "product-1", category: "Camisa", unitPrice: 10000, quantity: 2 },
  ];
  const results = [
    calculateCatalog([campaign], lines, now).discount,
    calculatePromotions([campaign], lines, "catalog", now).discount,
    calculateErp([campaign], lines, "catalog", now).discount,
    calculateCatalogServer([campaign], lines, now).discount,
  ];

  assert.deepEqual([...promotionProductIds([product], [campaign], now)], ["product-1"]);
  assert.deepEqual(results, [2000, 2000, 2000, 2000]);
});

test("mixed-category campaign requires each configured quantity and matches all four engines", () => {
  const now = new Date("2026-11-11T12:00:00-03:00");
  const mixed: Campaign = {
    ...campaign,
    productIds: [],
    categories: [],
    requirements: [
      { kind: "category", value: "Camisa", quantity: 2 },
      { kind: "category", value: "Short", quantity: 1 },
    ],
  };
  const enough = [
    { productId: "shirt", category: "Camisa", subcategory: "Peruana", unitPrice: 10000, quantity: 2 },
    { productId: "short", category: "Short", subcategory: "Sarja", unitPrice: 6000, quantity: 1 },
  ];
  const notEnough = [
    { productId: "shirt", category: "Camisa", unitPrice: 10000, quantity: 1 },
    { productId: "short", category: "Short", unitPrice: 6000, quantity: 1 },
  ];
  const discounts = [
    calculateCatalog([mixed], enough, now).discount,
    calculatePromotions([mixed], enough, "catalog", now).discount,
    calculateErp([mixed], enough, "catalog", now).discount,
    calculateCatalogServer([mixed], enough, now).discount,
  ];

  assert.deepEqual(discounts, [2600, 2600, 2600, 2600]);
  assert.deepEqual([
    calculateCatalog([mixed], notEnough, now).discount,
    calculatePromotions([mixed], notEnough, "catalog", now).discount,
    calculateErp([mixed], notEnough, "catalog", now).discount,
    calculateCatalogServer([mixed], notEnough, now).discount,
  ], [0, 0, 0, 0]);
});

test("subcategory promotion is calculated using the selected product subcategory", () => {
  const now = new Date("2026-11-11T12:00:00-03:00");
  const subcategoryCampaign: Campaign = {
    ...campaign,
    productIds: [],
    categories: [],
    requirements: [
      { kind: "subcategory", value: "Peruana", quantity: 2 },
      { kind: "category", value: "Short", quantity: 1 },
    ],
  };
  const lines = [
    { productId: "shirt", category: "Camisa", subcategory: "Peruana", unitPrice: 10000, quantity: 2 },
    { productId: "short", category: "Short", subcategory: "Sarja", unitPrice: 6000, quantity: 1 },
  ];
  assert.equal(calculateCatalog([subcategoryCampaign], lines, now).discount, 2600);
});

test("overlapping promotions choose one best discount while separate products can stack", () => {
  const now = new Date("2026-11-11T12:00:00-03:00");
  const low: Campaign = { ...campaign, id: "low", requirements: undefined, productIds: ["p1"], tiers: [{ quantity: 2, percent: 5 }] };
  const high: Campaign = { ...campaign, id: "high", requirements: undefined, productIds: ["p1"], tiers: [{ quantity: 2, percent: 15 }] };
  const independent: Campaign = { ...campaign, id: "independent", requirements: undefined, productIds: ["p2"], tiers: [{ quantity: 2, percent: 20 }] };
  const lines = [
    { productId: "p1", category: "Camisa", unitPrice: 10000, quantity: 2 },
    { productId: "p2", category: "Short", unitPrice: 5000, quantity: 2 },
  ];
  const totals = [
    calculateCatalog([low, high, independent], lines, now).discount,
    calculatePromotions([low, high, independent], lines, "catalog", now).discount,
    calculateErp([low, high, independent], lines, "catalog", now).discount,
    calculateCatalogServer([low, high, independent], lines, now).discount,
  ];

  assert.deepEqual(totals, [5000, 5000, 5000, 5000]);
});
