"use client";
import { useEffect, useState } from "react";
import { day } from "./format";
import { supabase } from "./supabase";
import { useStore } from "@/components/provider";
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
