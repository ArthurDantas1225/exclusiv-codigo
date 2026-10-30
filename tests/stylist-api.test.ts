import test from "node:test";
import assert from "node:assert/strict";
import type { Product, ProductImage, Variant } from "../lib/types.ts";
import {
  buildStylistCandidates,
  fallbackStylistResult,
  type StylistRequest,
} from "../lib/stylist.ts";
import { buildStylistPrompt, generateStylistResult } from "../lib/stylist-server.ts";
import { createStylistPost } from "../app/api/stylist/route.ts";

function requestInput(): StylistRequest {
  const products: Product[] = [
    { id: "shirt", name: "Camisa Aura", category: "Camisa", collection: "Urbana", price: 6000, active: true, catalog_visible: true, created_at: "2026-10-01T00:00:00Z" },
    { id: "short", name: "Short Duo", category: "Short", collection: "Urbana", price: 4000, active: true, catalog_visible: true, created_at: "2026-10-01T00:00:00Z" },
  ];
  const variants: Variant[] = products.map((product) => ({ id: `v-${product.id}`, product_id: product.id, sku: product.id, barcode: "", size: "M", color: "Preto", stock: 3, minimum: 1, cost: 2200, created_at: "2026-10-01T00:00:00Z" }));
  const images: ProductImage[] = products.map((product) => ({ id: `i-${product.id}`, product_id: product.id, path: `private/${product.id}.webp`, is_primary: true, color: "Preto", view: "front" }));
  return { pairing: "shirt_short", goal: "sell_today", candidates: buildStylistCandidates({ products, variants, images }, "shirt_short", "sell_today") };
}

test("prompt contains sellable metadata but no sensitive fields or image locations", () => {
  const input = requestInput();
  const prompt = buildStylistPrompt(input.pairing, input.goal, input.candidates);

  assert.match(prompt, /Camisa Aura/);
  assert.match(prompt, /shirt:preto\|short:preto/);
  assert.doesNotMatch(prompt, /cost|custo|cliente|venda|lucro|private\/|imageId|createdAt/i);
});

test("generator accepts a valid result and rejects inventions with local fallback", async () => {
  const input = requestInput();
  const valid = fallbackStylistResult(input.candidates[0], input.goal);
  const ai = await generateStylistResult(input, async () => valid);
  assert.equal(ai.source, "ai");
  assert.deepEqual(ai.result, valid);

  const invented = structuredClone(valid);
  invented.kits[0].candidateId = "invented";
  const fallback = await generateStylistResult(input, async () => invented);
  assert.equal(fallback.source, "fallback");
  assert.deepEqual(fallback.result, valid);
});

test("generator errors use fallback and empty candidates fail before calling AI", async () => {
  const input = requestInput();
  const fallback = await generateStylistResult(input, async () => { throw new Error("gateway unavailable"); });
  assert.equal(fallback.source, "fallback");

  let called = false;
  await assert.rejects(
    generateStylistResult({ ...input, candidates: [] }, async () => { called = true; return {}; }),
    /candidate/i,
  );
  assert.equal(called, false);
});

test("HTTP boundary authenticates before generation and returns source with result", async () => {
  const events: string[] = [];
  const input = requestInput();
  const post = createStylistPost({
    authenticate: async (token) => { events.push(`auth:${token}`); return "active"; },
    generate: async () => { events.push("generate"); return { source: "fallback", result: fallbackStylistResult(input.candidates[0], input.goal) }; },
  });
  const response = await post(new Request("http://local/api/stylist", {
    method: "POST",
    headers: { authorization: "Bearer valid-token", "content-type": "application/json" },
    body: JSON.stringify(input),
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(events, ["auth:valid-token", "generate"]);
  assert.equal((await response.json()).source, "fallback");
});

test("HTTP boundary denies missing/invalid sessions and inactive profiles without generation", async () => {
  const input = requestInput();
  let generated = 0;
  const generate = async () => { generated += 1; return { source: "fallback" as const, result: fallbackStylistResult(input.candidates[0], input.goal) }; };

  const noBearer = createStylistPost({ authenticate: async () => "active", generate });
  assert.equal((await noBearer(new Request("http://local/api/stylist", { method: "POST" }))).status, 401);

  const invalid = createStylistPost({ authenticate: async () => "invalid", generate });
  assert.equal((await invalid(new Request("http://local/api/stylist", { method: "POST", headers: { authorization: "Bearer bad" }, body: JSON.stringify(input) }))).status, 401);

  const inactive = createStylistPost({ authenticate: async () => "inactive", generate });
  assert.equal((await inactive(new Request("http://local/api/stylist", { method: "POST", headers: { authorization: "Bearer user" }, body: JSON.stringify(input) }))).status, 403);
  assert.equal(generated, 0);
});

test("HTTP boundary rejects invalid and oversized candidate bodies", async () => {
  const input = requestInput();
  let generated = 0;
  const post = createStylistPost({
    authenticate: async () => "active",
    generate: async () => { generated += 1; return { source: "fallback", result: fallbackStylistResult(input.candidates[0], input.goal) }; },
  });
  const headers = { authorization: "Bearer user", "content-type": "application/json" };
  const invalid = await post(new Request("http://local/api/stylist", { method: "POST", headers, body: JSON.stringify({ pairing: "free", candidates: [] }) }));
  assert.equal(invalid.status, 400);

  const oversized = await post(new Request("http://local/api/stylist", { method: "POST", headers, body: JSON.stringify({ ...input, candidates: Array(13).fill(input.candidates[0]) }) }));
  assert.equal(oversized.status, 400);
  assert.equal(generated, 0);
});
