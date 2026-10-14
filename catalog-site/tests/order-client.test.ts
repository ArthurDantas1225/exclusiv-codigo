import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { submitCatalogOrder, type CatalogOrderInput } from "../lib/order-client.ts";

const input: CatalogOrderInput = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  customerName: "Ana",
  payment: "Pix",
  delivery: "Retirada",
  items: [{ variantId: "22222222-2222-4222-8222-222222222222", quantity: 2 }],
};

test("order submission uses the canonical receipt returned by the server", async () => {
  let sent = "";
  const fetcher: typeof fetch = async (_url, init) => {
    sent = String(init?.body);
    return new Response(JSON.stringify({ id: "o1", code: "EXC-1234", total: 15980, status: "pending", items: [], whatsappUrl: "https://wa.me/55?text=EXC-1234" }), { status: 200 });
  };

  const receipt = await submitCatalogOrder(input, fetcher, "https://catalog.test/create-order");

  assert.equal(receipt.code, "EXC-1234");
  assert.equal(receipt.whatsappUrl, "https://wa.me/55?text=EXC-1234");
  assert.deepEqual(JSON.parse(sent), input);
});

test("order submission preserves a server rejection before WhatsApp", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({ error: "Estoque insuficiente para esta opção." }), { status: 409 });
  await assert.rejects(() => submitCatalogOrder(input, fetcher, "https://catalog.test/create-order"), /Estoque insuficiente/);
});

test("production catalog origin is allowed by the order function", () => {
  const handler = readFileSync(new URL("../../supabase-catalog/functions/create-order/index.ts", import.meta.url), "utf8");
  assert.match(handler, /https:\/\/exclusiv-catalogo\.vercel\.app/);
});

test("duplicate variants are rejected before an order total can diverge from its items", () => {
  const handler = readFileSync(new URL("../../supabase-catalog/functions/create-order/index.ts", import.meta.url), "utf8");
  assert.match(handler, /new Set\(variantIds\)\.size !== variantIds\.length/);
});
