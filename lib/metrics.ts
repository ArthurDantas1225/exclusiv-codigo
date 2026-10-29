"use client";
import { useEffect, useState } from "react";
import { day } from "./format";
import { supabase } from "./supabase";
import { useStore } from "@/components/provider";
import { currentSaleProfit } from "./profit";
export interface SellerSalary {
  user_id: string;
  name: string;
  sales: number;
  revenue: number;
  cost: number;
  gross_profit: number;
  salary: number;
}
export interface Metrics {
  revenue: number;
  gross: number;
  discount: number;
  cost: number;
  count: number;
  expenses: number;
  refunds: number;
  receivable: number;
  low_stock: number;
  units: number;
  stock_cost: number;
  daily: { day: string; revenue: number; sales: number }[];
  monthly: { month: number; revenue: number; sales: number; cost: number }[];
  payments: { method: string; amount: number }[];
  salary: number;
  seller_salary: SellerSalary[];
}
export function useMetrics(start: string, end: string) {
  const { demo, data } = useStore();
  const [result, setResult] = useState<Metrics | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (demo) {
      const sales = data.sales.filter(
        (s) =>
          day(new Date(s.created_at)) >= start &&
          day(new Date(s.created_at)) <= end,
      );
      const sellerSalary = new Map<string, SellerSalary>();
      for (const sale of sales.filter((item) => item.status !== "cancelled")) {
        const profit = currentSaleProfit(sale, data.ledger);
        const userId = sale.created_by ?? "demo";
        const seller = sellerSalary.get(userId) ?? {
          user_id: userId,
          name:
            data.profiles.find((profile) => profile.id === userId)?.name ??
            "Equipe EXCLUSIV",
          sales: 0,
          revenue: 0,
          cost: 0,
          gross_profit: 0,
          salary: 0,
        };
        seller.sales += 1;
        seller.revenue += profit.revenue;
        seller.cost += profit.cost;
        seller.gross_profit += profit.profit;
        seller.salary += profit.salary;
        sellerSalary.set(userId, seller);
      }
      const salaries = [...sellerSalary.values()];
      setResult({
        revenue: sales.reduce((a, s) => a + s.total, 0),
        gross: sales.reduce((a, s) => a + s.gross, 0),
        discount: sales.reduce((a, s) => a + s.discount, 0),
        cost: sales.reduce((a, s) => a + s.cost, 0),
        count: sales.length,
        expenses: 0,
        refunds: 0,
        receivable: 10000,
        low_stock: 1,
        units: 18,
        stock_cost: 126600,
        daily: sales.length ? [{ day: end, revenue: 48990, sales: 2 }] : [],
        monthly: [
          {
            month: new Date().getMonth() + 1,
            revenue: 48990,
            sales: 2,
            cost: 21400,
          },
        ],
        payments: [
          { method: "Pix", amount: 14000 },
          { method: "Dinheiro", amount: 24990 },
          { method: "Fiado", amount: 10000 },
        ],
        salary: salaries.reduce((sum, seller) => sum + seller.salary, 0),
        seller_salary: salaries,
      });
      return;
    }
    if (supabase) {
      supabase
        .rpc("metrics", { start_date: start, end_date: end })
        .then(({ data, error }) => {
          if (active) {
            if (error) setError(error.message);
            else {
              setResult(data);
              setError("");
            }
          }
        });
    }
    return () => {
      active = false;
    };
  }, [start, end, demo, data]);
  return { metrics: result, error };
}
