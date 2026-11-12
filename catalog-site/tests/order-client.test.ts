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

test("order submission explains non-JSON failures without leaking a parser error", async () => {
  const fetcher: typeof fetch = async () => new Response("<html>Bad gateway</html>", { status: 502 });
  await assert.rejects(() => submitCatalogOrder(input, fetcher, "https://catalog.test/create-order"), /Não foi possível registrar o pedido/);
});

test("order receipt cannot redirect customers to an arbitrary destination", async () => {
  for (const whatsappUrl of ["javascript:alert(1)", "https://wa.me.attacker.test/55", "http://wa.me/55"]) {
    const fetcher: typeof fetch = async () => Response.json({ id:"o1", code:"EXC-1", whatsappUrl });
    await assert.rejects(() => submitCatalogOrder(input, fetcher, "https://catalog.test/create-order"), /Resposta inválida/);
  }
});

test("order requests have a deadline and preserve the provided retry key", async () => {
  const fetcher: typeof fetch = async (_url, init) => {
    assert.ok(init?.signal instanceof AbortSignal);
    assert.equal(JSON.parse(String(init?.body)).idempotencyKey, input.idempotencyKey);
    return Response.json({id:"o1",code:"EXC-1",whatsappUrl:"https://wa.me/5584996008220?text=EXC-1"});
  };
  await submitCatalogOrder(input, fetcher, "https://catalog.test/create-order");
});

test("network failures keep an uncertain result and explain a safe retry in Portuguese", async () => {
  const fetcher: typeof fetch = async () => { throw new DOMException("The operation timed out", "TimeoutError"); };
  await assert.rejects(() => submitCatalogOrder(input, fetcher, "https://catalog.test/create-order"), (error: unknown) => {
    assert.match((error as Error).message, /Tente novamente para recuperar o mesmo pedido/);
    assert.equal((error as { uncertain: boolean }).uncertain, true);
    return true;
  });
});
test("a stock rejection is a definite failure that allows editing the draft", async () => {
  const fetcher: typeof fetch = async () => Response.json({error:"Estoque insuficiente"}, {status:409});
  await assert.rejects(() => submitCatalogOrder(input, fetcher, "https://catalog.test/create-order"), (error: unknown) => {
    assert.equal((error as { uncertain: boolean }).uncertain, false);
    return true;
  });
});

test("production catalog origin is allowed by the order function", () => {
  const handler = readFileSync(new URL("../../supabase-catalog/functions/create-order/index.ts", import.meta.url), "utf8");
  assert.match(handler, /https:\/\/exclusiv-catalogo\.vercel\.app/);
  assert.match(handler, /createWhatsAppMessage\(order\)/);
});

test("duplicate variants are rejected before an order total can diverge from its items", () => {
  const handler = readFileSync(new URL("../../supabase-catalog/functions/create-order/index.ts", import.meta.url), "utf8");
  assert.match(handler, /new Set\(variantIds\)\.size !== variantIds\.length/);
});
