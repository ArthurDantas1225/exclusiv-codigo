import { test } from "node:test";
import assert from "node:assert/strict";
import {
  averageVariantCost,
  currentSaleProfit,
  positiveGrossProfit,
  salaryFromProfit,
  salaryFromRevenue,
} from "../lib/profit.ts";

test("salary is exactly half of positive real gross profit", () => {
  assert.equal(positiveGrossProfit(4000, 2200), 1800);
  assert.equal(salaryFromRevenue(4000, 2200), 900);
  assert.equal(salaryFromRevenue(2000, 2200), 0);
  assert.equal(salaryFromProfit(3), 1);
});

test("average cost is weighted by current stock with an empty-stock fallback", () => {
  assert.equal(
    averageVariantCost([
      { stock: 2, cost: 2200 },
      { stock: 1, cost: 2800 },
    ]),
    2400,
  );
  assert.equal(
    averageVariantCost([
      { stock: 0, cost: 2200 },
      { stock: 0, cost: 2800 },
    ]),
    2500,
  );
  assert.equal(averageVariantCost([]), 0);
});

test("current sale profit uses historical cost and completed returns", () => {
  const result = currentSaleProfit(
    { id: "sale-1", status: "partially_returned", total: 4000, cost: 2200 },
    [
      {
        sale_id: "sale-1",
        kind: "refund",
        amount: -1000,
        cost_delta: -550,
        description: "Devolução: tamanho incorreto",
      },
      {
        sale_id: "sale-1",
        kind: "expense",
        amount: -100,
        cost_delta: 0,
        description: "Outro lançamento",
      },
    ],
  );

  assert.deepEqual(result, {
    revenue: 3000,
    cost: 1650,
    profit: 1350,
    salary: 675,
  });
});

test("cancelled sales have no profit or salary", () => {
  assert.deepEqual(
    currentSaleProfit(
      { id: "sale-2", status: "cancelled", total: 4000, cost: 2200 },
      [],
    ),
    { revenue: 0, cost: 0, profit: 0, salary: 0 },
  );
});
