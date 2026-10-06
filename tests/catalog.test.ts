import { test } from "node:test";
import assert from "node:assert/strict";
import { availableVariants } from "../lib/domain.ts";
import { whatsappOrderUrl } from "../lib/catalog-order.ts";
import { galleryForColor, imagesForColor } from "../lib/catalog-selection.ts";
import { readPendingOrders, savePendingOrder, removePendingOrder } from "../lib/pending-orders.ts";

test("available variants only include combinations with positive stock", () => {
  const variants = [
    { id: "black-g", stock: 3 },
    { id: "red-m", stock: 1 },
    { id: "red-g", stock: 0 },
    { id: "black-m", stock: 0 },
  ];
  assert.deepEqual(availableVariants(variants).map((variant) => variant.id), [
    "black-g",
    "red-m",
  ]);
});

test("catalog builds a complete WhatsApp order without placing a sale", () => {
  const url = new URL(whatsappOrderUrl([
    { product: { name: "Camisa Street", price: 6000 }, variant: { model: "Oversized", color: "Preto ", size: "M" }, quantity: 2 },
  ], "Gabriel", "Pix", "Retirada na loja"));
  assert.equal(url.hostname, "wa.me");
  assert.equal(url.pathname, "/5584996008220");
  const text = url.searchParams.get("text") ?? "";
  assert.match(text, /Camisa Street/);
  assert.match(text, /Meu nome é Gabriel/);
  assert.match(text, /Modelo: Oversized/);
  assert.match(text, /Cor: Preto/);
  assert.match(text, /Tamanho: M/);
  assert.match(text, /Quantidade: 2/);
  assert.match(text, /R\$\s*120,00/);
  assert.match(text, /Pix/);
  assert.equal((text.match(/Gabriel/g) ?? []).length,1);
  assert.equal((text.match(/R\$\s*120,00/g) ?? []).length,1);
  assert.doesNotMatch(text, /Cor: Preto\s+\n/);
  assert.match(text, /confirmar a disponibilidade/);
  assert.throws(() => whatsappOrderUrl([], "Gabriel", "Pix", "Retirada"), /obrigatórios/);
});
test("gallery shows the selected color rather than another color", () => {
  const photos = [
    { id:"a", url:"/black-front", color:"Preto", view:"front", is_primary:true },
    { id:"b", url:"/black-back", color:"Preto", view:"back", is_primary:false },
    { id:"c", url:"/white-front", color:"Branco", view:"front", is_primary:false },
    { id:"d", url:"/generic", color:"", view:"other", is_primary:false },
  ];
  assert.deepEqual(imagesForColor(photos,"Preto",2).map((photo) => photo.id),["a","b"]);
  assert.deepEqual(imagesForColor(photos,"Branco",2).map((photo) => photo.id),["c"]);
  assert.deepEqual(imagesForColor(photos,"Azul",3).map((photo) => photo.id),["d"]);
  assert.deepEqual(imagesForColor(photos,"Azul",1).map((photo) => photo.id),["d"]);
  assert.deepEqual(galleryForColor(photos,"Branco").map((photo) => photo.id),["c","a","b","d"]);
});

test("pending order is saved and retrievable for later confirmation", () => {
  const memory = new Map<string, string>();
  const storage: Storage = {
    length: 0,
    clear: () => { memory.clear(); },
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    key: (index: number) => Array.from(memory.keys())[index] ?? null,
  };
  Object.defineProperty(storage, "length", {
    get: () => memory.size,
    configurable: true,
  });
  const order = {
    customerName: "Fernanda",
    payment: "Pix",
    delivery: "Retirada na loja",
    items: [{
      productId: "prod-1",
      productName: "Jaqueta Bomber",
      variantId: "var-1",
      variantModel: "Oversized",
      variantColor: "Preto",
      variantSize: "M",
      quantity: 1,
      unitPrice: 18000,
    }],
  };
  const saved = savePendingOrder(order, storage);
  const pending = readPendingOrders(storage);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, saved.id);
  assert.equal(pending[0].customerName, "Fernanda");
  assert.equal(pending[0].items[0].productName, "Jaqueta Bomber");
  removePendingOrder(saved.id, storage);
  assert.equal(readPendingOrders(storage).length, 0);
});
