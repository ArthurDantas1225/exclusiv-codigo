import assert from "node:assert/strict";
import test from "node:test";
import { matchesAvailableOptions } from "../lib/catalog-filter.ts";

const variants = [
  { size: "M", color: "Preta", stock: 2 },
  { size: "G", color: "Azul", stock: 1 },
  { size: "G", color: "Preta", stock: 0 },
];
test("color and size must match the same in-stock variant", () => {
  assert.equal(matchesAvailableOptions(variants, "G", "Preta"), false);
  assert.equal(matchesAvailableOptions(variants, "M", "Preta"), true);
  assert.equal(matchesAvailableOptions(variants, "G", "Azul"), true);
});
test("missing filters accept any available option and trim display whitespace", () => {
  assert.equal(matchesAvailableOptions(variants, "", ""), true);
  assert.equal(matchesAvailableOptions([{size:" M ",color:" Preta ",stock:1}], "M", "Preta"), true);
  assert.equal(matchesAvailableOptions([], "", ""), false);
  assert.equal(matchesAvailableOptions([{size:"M",color:"Preta",stock:0}], "", ""), false);
});
