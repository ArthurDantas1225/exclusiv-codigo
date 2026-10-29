import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

test("stock and POS show salary estimates through shared profit helpers", () => {
  const stock = source("components/stock-product-card.tsx");
  const pos = source("components/pos.tsx");

  assert.match(stock, /averageVariantCost/);
  assert.match(stock, /salaryFromRevenue/);
  assert.match(stock, /Salário estimado/);
  assert.match(pos, /averageVariantCost/);
  assert.match(pos, /salaryFromRevenue/);
  assert.match(pos, /Salário estimado/);
});

test("sale details show current salary but customer receipt stays private", () => {
  const sales = source("components/sales.tsx");
  const receiptTemplate = sales.slice(
    sales.indexOf("const receipt"),
    sales.indexOf("const shareReceiptImage"),
  );

  assert.match(sales, /currentSaleProfit/);
  assert.match(sales, /Salário gerado/);
  assert.doesNotMatch(receiptTemplate, /Salário/);
});

test("reports expose salary total and seller breakdown", () => {
  const reports = source("components/reports.tsx");
  const metrics = source("lib/metrics.ts");

  assert.match(metrics, /salary: number/);
  assert.match(metrics, /seller_salary/);
  assert.match(reports, /Salários \(50% do lucro real\)/);
  assert.match(reports, /Salário por vendedor/);
  assert.match(reports, /salarios-por-vendedor/);
});
