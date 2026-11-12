import assert from "node:assert/strict";
import test from "node:test";
import { createWhatsAppMessage } from "../supabase-catalog/functions/create-order/receipt-message.ts";

const order = {
  code: "EXC-1234",
  customer_name: "Gabriel",
  payment: "Pix",
  delivery: "Retirada na loja",
  subtotal: 12000,
  promotion_discount: 0,
  promotion_summary: [],
  total: 12000,
  catalog_order_items: [{ product_name: "Short", model: "Coreon", color: "Preto", size: "M", quantity: 3, unit_price: 4000 }],
};

test("WhatsApp receipt shows a no-discount single-item total only once", () => {
  const message = createWhatsAppMessage(order);

  assert.match(message, /Cliente: Gabriel/);
  assert.match(message, /Short/);
  assert.equal((message.match(/R\$\s*120,00/g) ?? []).length, 1);
});

test("WhatsApp receipt keeps the discount calculation clear", () => {
  const message = createWhatsAppMessage({
    ...order,
    subtotal: 12000,
    promotion_discount: 1200,
    promotion_summary: [{ name: "Leve 3", discount: 1200 }],
    total: 10800,
  });

  assert.match(message, /Subtotal: R\$\s*120,00/);
  assert.match(message, /Leve 3: − R\$\s*12,00/);
  assert.match(message, /Total: R\$\s*108,00/);
});
