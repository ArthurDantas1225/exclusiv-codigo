export type CostedVariant = { stock: number; cost: number };

export type ProfitSale = {
  id: string;
  status: string;
  total: number;
  cost: number;
};

export type ProfitEntry = {
  sale_id: string | null;
  kind: string;
  amount: number;
  cost_delta?: number;
  description?: string;
};

export function averageVariantCost(variants: readonly CostedVariant[]) {
  if (!variants.length) return 0;
  const units = variants.reduce((sum, variant) => sum + variant.stock, 0);
  const weightedCost = variants.reduce(
    (sum, variant) => sum + variant.cost * (units ? variant.stock : 1),
    0,
  );
  return Math.round(weightedCost / (units || variants.length));
}

export function positiveGrossProfit(revenue: number, cost: number) {
  return Math.max(0, Math.trunc(revenue) - Math.trunc(cost));
}

export function salaryFromProfit(profit: number) {
  return Math.floor(Math.max(0, Math.trunc(profit)) / 2);
}

export function salaryFromRevenue(revenue: number, cost: number) {
  return salaryFromProfit(positiveGrossProfit(revenue, cost));
}

export function currentSaleProfit(
  sale: ProfitSale,
  entries: readonly ProfitEntry[],
) {
  if (sale.status === "cancelled") {
    return { revenue: 0, cost: 0, profit: 0, salary: 0 };
  }
  const returns = entries.filter(
    (entry) =>
      entry.sale_id === sale.id &&
      ["refund", "credit"].includes(entry.kind) &&
      entry.description?.startsWith("Devolução:"),
  );
  const revenue = sale.total + returns.reduce((sum, entry) => sum + entry.amount, 0);
  const cost = sale.cost + returns.reduce((sum, entry) => sum + (entry.cost_delta ?? 0), 0);
  const profit = positiveGrossProfit(revenue, cost);
  return { revenue, cost, profit, salary: salaryFromProfit(profit) };
}
