import { test } from "node:test";
import assert from "node:assert/strict";
import { fallbackAppRoute, previousAppRoute, rememberAppRoute } from "../lib/navigation.ts";

test("back follows the previous app screen and falls back for direct links", () => {
  const stack = rememberAppRoute(rememberAppRoute(["/app"],"/app/estoque"),"/app/produtos/123");
  assert.deepEqual(previousAppRoute(stack,"/app/produtos/123"),{ destination:"/app/estoque",stack:["/app","/app/estoque"] });
  assert.equal(previousAppRoute([],"/app/produtos/123").destination,"/app/estoque");
  assert.equal(fallbackAppRoute("/app/financeiro/caixa"),"/app/financeiro");
  assert.equal(fallbackAppRoute("/app/clientes/123"),"/app/clientes");
  assert.equal(previousAppRoute(["https://other.example"],"/app/vendas/123").destination,"/app/vendas");
});
