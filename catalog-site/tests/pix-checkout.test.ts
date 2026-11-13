import assert from "node:assert/strict";
import test from "node:test";
import { hasPixPayment, submitCatalogOrder, type CatalogOrderInput } from "../lib/order-client.ts";
const input: CatalogOrderInput = { idempotencyKey: "order-key", customerName: "Cliente", payment: "Pix", delivery: "Retirada", items: [{ variantId: "variant", quantity: 1 }] };
const base = { id: "order", code: "EXC-ORDER", whatsappUrl: "https://wa.me/5584996008220?text=EXC-ORDER", total: 10000 };

test("Pix receipt keeps canonical payment instructions and opens payment before WhatsApp", async () => {
  const receipt = await submitCatalogOrder(input, async () => Response.json({ ...base, paymentStatus: "awaiting_verification", pix: { copyPaste: "000201010211pix-test", receiverName: "EXCLUSIV" } }), "https://test/create-order");
  assert.equal(hasPixPayment(input.payment, receipt), true);
  assert.equal(receipt.pix?.copyPaste, "000201010211pix-test");
  assert.equal(receipt.total, 10000);
  assert.equal(hasPixPayment("Dinheiro", receipt), false);
});
test("unconfigured Pix preserves WhatsApp checkout without fabricating a payment key", async () => {
  const receipt = await submitCatalogOrder(input, async () => Response.json(base), "https://test/create-order");
  assert.equal(hasPixPayment("Pix", receipt), false);
});
test("malformed Pix instructions are rejected without losing the safe retry semantics", async () => {
  for (const pix of [{copyPaste:"",receiverName:"Loja"}, {copyPaste:123,receiverName:"Loja"}, {copyPaste:"valid",receiverName:""}]) {
    await assert.rejects(() => submitCatalogOrder(input, async () => Response.json({...base,pix}), "https://test/create-order"), error => {
      assert.match((error as Error).message, /Resposta inválida/);
      assert.equal((error as {uncertain:boolean}).uncertain,true);
      return true;
    });
  }
});
