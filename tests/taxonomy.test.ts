import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogCategories, categoryForProduct, searchable } from "../lib/catalog-taxonomy.ts";

test("catalog taxonomy covers the requested categories and classifies legacy shirts", () => {
  assert.deepEqual(Object.keys(catalogCategories),["Camisa","Short","Calça","Calçados","Fitness","Outros"]);
  assert.equal(categoryForProduct("Street","Camisa Street exclusiv"),"Camisa");
  assert.equal(categoryForProduct("Fitness","Camisa de treino"),"Fitness");
  assert.equal(searchable("Calça Jeans"),"calca jeans");
});
