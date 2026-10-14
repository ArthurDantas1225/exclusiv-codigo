import assert from "node:assert/strict";
import test from "node:test";
import { migrateLegacyOrders, remoteOrderFromRow, saleRequestId, savePendingOrder } from "../lib/pending-orders.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("remote catalog order maps to the existing pending-order shape", () => {
  const order = remoteOrderFromRow({
    id: "11111111-1111-4111-8111-111111111111", code: "EXC-1234", created_at: "2026-10-14T12:00:00Z",
    customer_name: "Ana", payment: "Pix", delivery: "Retirada", status: "pending",
    catalog_order_items: [{ product_id: "p1", product_name: "Camisa", variant_id: "v1", model: "Padrão", color: "Preta", size: "M", quantity: 2, unit_price: 7990 }],
  });
  assert.equal(order.customerName, "Ana");
  assert.equal(order.items[0].variantId, "v1");
  assert.equal(order.items[0].unitPrice, 7990);
  assert.equal(saleRequestId(order), order.id);
});

test("legacy local orders are removed only after remote import succeeds", async () => {
  const storage = memoryStorage();
  const saved = savePendingOrder({ customerName: "Bia", payment: "Pix", delivery: "Retirada", items: [] }, storage);
  await migrateLegacyOrders(async () => true, storage);
  assert.equal(storage.getItem("exclusiv-pending-orders"), null);

  savePendingOrder({ customerName: "Bia", payment: "Pix", delivery: "Retirada", items: [] }, storage);
  await migrateLegacyOrders(async () => false, storage);
  assert.match(storage.getItem("exclusiv-pending-orders") ?? "", /Bia/);
  assert.ok(saved.id);
});

test("a rejected legacy import does not block loading remote orders", async () => {
  const storage = memoryStorage();
  savePendingOrder({ customerName: "Cris", payment: "Pix", delivery: "Retirada", items: [] }, storage);
  await assert.doesNotReject(() => migrateLegacyOrders(async () => { throw new Error("invalid legacy item"); }, storage));
  assert.match(storage.getItem("exclusiv-pending-orders") ?? "", /Cris/);
});
