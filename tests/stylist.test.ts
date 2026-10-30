import test from "node:test";
import assert from "node:assert/strict";
import type { Product, ProductImage, Variant } from "../lib/types.ts";
import {
  buildStylistCandidates,
  fallbackStylistResult,
  resolveStylistPhoto,
  validateStylistResult,
} from "../lib/stylist.ts";

function product(id: string, category: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    name: `${category} ${id}`,
    category,
    collection: "Urbana",
    price: 6000,
    active: true,
    catalog_visible: true,
    created_at: "2026-10-01T12:00:00Z",
    ...overrides,
  };
}

function variant(id: string, productId: string, overrides: Partial<Variant> = {}): Variant {
  return {
    id,
    product_id: productId,
    sku: id.toUpperCase(),
    barcode: "",
    size: "M",
    color: "Preto",
    stock: 3,
    minimum: 1,
    cost: 2500,
    created_at: "2026-10-01T12:00:00Z",
    ...overrides,
  };
}

function image(id: string, productId: string, overrides: Partial<ProductImage> = {}): ProductImage {
  return {
    id,
    product_id: productId,
    path: `${productId}/${id}.webp`,
    is_primary: true,
    color: "Preto",
    view: "front",
    ...overrides,
  };
}

test("shirt_short only pairs shirts with shorts", () => {
  const products = [product("shirt", "Camisa"), product("short", "Short"), product("pants", "Calça")];
  const variants = products.map((entry) => variant(`v-${entry.id}`, entry.id));
  const images = products.map((entry) => image(`i-${entry.id}`, entry.id));

  const candidates = buildStylistCandidates({ products, variants, images }, "shirt_short", "sell_today");

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].top.productId, "shirt");
  assert.equal(candidates[0].bottom.productId, "short");
  assert.equal(candidates[0].pairing, "shirt_short");
});

test("shirt_pants never uses a short as the bottom", () => {
  const products = [product("shirt", "Camisa"), product("short", "Short"), product("pants", "Calça")];
  const variants = products.map((entry) => variant(`v-${entry.id}`, entry.id));
  const images = products.map((entry) => image(`i-${entry.id}`, entry.id));

  const candidates = buildStylistCandidates({ products, variants, images }, "shirt_pants", "sell_today");

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].bottom.productId, "pants");
  assert.equal(candidates[0].pairing, "shirt_pants");
});

test("ineligible products are excluded and candidates expose sellable metadata", () => {
  const products = [
    product("shirt", "Camisa", { price: 7000 }),
    product("short", "Short", { price: 5500 }),
    product("inactive", "Camisa", { active: false }),
    product("archived", "Camisa", { archived_at: "2026-10-20T12:00:00Z" }),
    product("hidden", "Camisa", { catalog_visible: false }),
    product("no-photo", "Camisa"),
    product("no-stock", "Camisa"),
  ];
  const variants = [
    variant("v-shirt-m", "shirt", { size: "M", stock: 2, color: "Bege" }),
    variant("v-shirt-g", "shirt", { size: "G", stock: 1, color: "Bege" }),
    variant("v-short", "short", { size: "40", stock: 4 }),
    variant("v-inactive", "inactive"),
    variant("v-archived", "archived"),
    variant("v-hidden", "hidden"),
    variant("v-no-photo", "no-photo"),
    variant("v-no-stock", "no-stock", { stock: 0 }),
  ];
  const images = products
    .filter((entry) => entry.id !== "no-photo")
    .map((entry) => image(`i-${entry.id}`, entry.id, { color: entry.id === "shirt" ? "Bege" : "Preto" }));

  const [candidate] = buildStylistCandidates({ products, variants, images }, "shirt_short", "sell_today");

  assert.ok(candidate);
  assert.equal(candidate.id, "shirt:bege|short:preto");
  assert.deepEqual(candidate.top.sizes, ["G", "M"]);
  assert.equal(candidate.top.price, 7000);
  assert.equal(candidate.top.stock, 3);
  assert.equal(candidate.bottom.price, 5500);
  assert.equal(candidate.bottom.stock, 4);
  assert.equal(candidate.totalPrice, 12500);
  assert.equal(typeof candidate.score, "number");
});

test("equivalent color spellings share one piece without changing its displayed color", () => {
  const products = [product("shirt", "Camisa"), product("short", "Short")];
  const variants = [
    variant("shirt-1", "shirt", { color: "  Preta ", size: "M", stock: 2 }),
    variant("shirt-2", "shirt", { color: "preto", size: "G", stock: 3 }),
    variant("short-1", "short", { color: "Preto" }),
  ];
  const images = [image("shirt-front", "shirt", { color: "Preta" }), image("short-front", "short")];

  const candidates = buildStylistCandidates({ products, variants, images }, "shirt_short", "sell_today");

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].top.color, "Preta");
  assert.equal(candidates[0].top.stock, 5);
  assert.deepEqual(candidates[0].top.sizes, ["G", "M"]);
});

test("photo resolution prefers color front, color view, primary and first visible", () => {
  const images = [
    image("first", "shirt", { color: "", view: "detail", is_primary: false }),
    image("primary", "shirt", { color: "Azul", view: "back", is_primary: true }),
    image("black-back", "shirt", { color: "Preto", view: "back", is_primary: false }),
    image("black-front", "shirt", { color: "Preta", view: "front", is_primary: false }),
    image("hidden-front", "shirt", { color: "Preto", view: "front", hidden_at: "2026-10-01T00:00:00Z" }),
  ];

  assert.equal(resolveStylistPhoto(images, "shirt", "preto")?.id, "black-front");
  assert.equal(resolveStylistPhoto(images.filter((entry) => entry.id !== "black-front"), "shirt", "preto")?.id, "black-back");
  assert.equal(resolveStylistPhoto(images, "shirt", "Verde")?.id, "primary");
  assert.equal(resolveStylistPhoto(images.filter((entry) => !entry.is_primary), "shirt", "Verde")?.id, "first");
});

test("new arrivals favor recent products", () => {
  const products = [
    product("old-shirt", "Camisa", { name: "Antiga", created_at: "2026-01-01T00:00:00Z" }),
    product("new-shirt", "Camisa", { name: "Nova", created_at: "2026-10-29T00:00:00Z" }),
    product("short", "Short"),
  ];
  const variants = products.map((entry) => variant(`v-${entry.id}`, entry.id));
  const images = products.map((entry) => image(`i-${entry.id}`, entry.id));

  const candidates = buildStylistCandidates({ products, variants, images }, "shirt_short", "new_arrivals");

  assert.equal(candidates[0].top.productId, "new-shirt");
});

test("move stock favors the combination with more available units", () => {
  const products = [product("low", "Camisa", { name: "Pouco" }), product("high", "Camisa", { name: "Muito" }), product("short", "Short")];
  const variants = [variant("v-low", "low", { stock: 1 }), variant("v-high", "high", { stock: 12 }), variant("v-short", "short", { stock: 4 })];
  const images = products.map((entry) => image(`i-${entry.id}`, entry.id));

  const candidates = buildStylistCandidates({ products, variants, images }, "shirt_short", "move_stock");

  assert.equal(candidates[0].top.productId, "high");
});

test("score ties are ordered by product name and id", () => {
  const products = [product("z", "Camisa", { name: "Zulu" }), product("b", "Camisa", { name: "Alfa" }), product("a", "Camisa", { name: "Alfa" }), product("short", "Short")];
  const variants = products.map((entry) => variant(`v-${entry.id}`, entry.id));
  const images = products.map((entry) => image(`i-${entry.id}`, entry.id));

  const candidates = buildStylistCandidates({ products, variants, images }, "shirt_short", "sell_today");

  assert.deepEqual(candidates.map((entry) => entry.top.productId), ["a", "b", "z"]);
});

function remoteKit(candidate: ReturnType<typeof buildStylistCandidates>[number]) {
  return {
    candidateId: candidate.id,
    top: { productId: candidate.top.productId, color: candidate.top.color },
    bottom: { productId: candidate.bottom.productId, color: candidate.bottom.color },
    title: "Kit urbano",
    caption: "Duas peças que conversam entre si e deixam o visual pronto.",
    cta: "Chame no WhatsApp para escolher seu tamanho.",
    story: [
      { headline: "Seu look de hoje", body: "Uma combinação prática para vestir bem." },
      { headline: "Detalhes do kit", body: "Cores fáceis de combinar e tamanhos disponíveis." },
      { headline: "Garanta o seu", body: "Fale com a EXCLUSIV pelo WhatsApp." },
    ],
  };
}

test("remote result rejects an unknown candidate or changed color", () => {
  const products = [product("shirt", "Camisa"), product("short", "Short")];
  const variants = products.map((entry) => variant(`v-${entry.id}`, entry.id));
  const images = products.map((entry) => image(`i-${entry.id}`, entry.id));
  const candidates = buildStylistCandidates({ products, variants, images }, "shirt_short", "sell_today");
  const kit = remoteKit(candidates[0]);

  assert.equal(validateStylistResult({ kits: [{ ...kit, candidateId: "invented" }] }, candidates), null);
  assert.equal(validateStylistResult({ kits: [{ ...kit, top: { ...kit.top, color: "Rosa" } }] }, candidates), null);
});

test("remote result rejects duplicate kits and more than three kits", () => {
  const products = [product("shirt", "Camisa"), product("short", "Short")];
  const variants = products.map((entry) => variant(`v-${entry.id}`, entry.id));
  const images = products.map((entry) => image(`i-${entry.id}`, entry.id));
  const candidates = buildStylistCandidates({ products, variants, images }, "shirt_short", "sell_today");
  const kit = remoteKit(candidates[0]);

  assert.equal(validateStylistResult({ kits: [kit, kit] }, candidates), null);
  assert.equal(validateStylistResult({ kits: [kit, kit, kit, kit] }, candidates), null);
});

test("remote result is discarded when a selected color is out of stock", () => {
  const products = [product("shirt", "Camisa"), product("short", "Short")];
  const variants = products.map((entry) => variant(`v-${entry.id}`, entry.id));
  const images = products.map((entry) => image(`i-${entry.id}`, entry.id));
  const candidates = buildStylistCandidates({ products, variants, images }, "shirt_short", "sell_today");
  const currentVariants = variants.map((entry) => entry.product_id === "shirt" ? { ...entry, stock: 0 } : entry);

  assert.equal(validateStylistResult({ kits: [remoteKit(candidates[0])] }, candidates, currentVariants), null);
});

test("fallback returns one complete kit with exactly three Story frames", () => {
  const products = [product("shirt", "Camisa"), product("short", "Short")];
  const variants = products.map((entry) => variant(`v-${entry.id}`, entry.id));
  const images = products.map((entry) => image(`i-${entry.id}`, entry.id));
  const [candidate] = buildStylistCandidates({ products, variants, images }, "shirt_short", "sell_today");

  const result = fallbackStylistResult(candidate, "sell_today");

  assert.equal(result.kits.length, 1);
  assert.ok(result.kits[0].title);
  assert.ok(result.kits[0].caption);
  assert.ok(result.kits[0].cta);
  assert.equal(result.kits[0].story.length, 3);
  assert.deepEqual(validateStylistResult(result, [candidate]), result);
});
