import { z } from "zod";
import type { Store, Customer } from "./types";
export const saleSchema = z.object({
  request_id: z.uuid(),
  customer_id: z.uuid().nullable(),
  discount: z.number().int().nonnegative(),
  notes: z.string().max(2000),
  items: z
    .array(
      z.object({
        variant_id: z.uuid(),
        quantity: z.number().int().positive(),
        unit_price: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(100),
  payments: z
    .array(
      z.object({
        method: z.enum([
          "Pix",
          "Dinheiro",
          "Débito",
          "Crédito",
          "Fiado",
          "Crédito na loja",
          "Outro",
        ]),
        amount: z.number().int().positive(),
      }),
    )
    .min(1),
  tendered: z.number().int().nonnegative(),
});
export function balance(s: Store, id: string) {
  if (s.balances) return s.balances.customers[id] ?? 0;
  return s.ledger
    .filter(
      (e) =>
        e.customer_id === id &&
        ["debt", "receipt", "credit", "credit_use"].includes(e.kind),
    )
    .reduce((a, e) => a + e.amount, 0);
}
export function segment(s: Store, c: Customer) {
  const sales = s.sales.filter(
    (v) => v.customer_id === c.id && v.status !== "cancelled",
  );
  if (balance(s, c.id) > 0) return "Devedor";
  if (!sales.length) return "Novo";
  const days =
    (Date.now() -
      Math.max(...sales.map((v) => new Date(v.created_at).getTime()))) /
    86400000;
  if (days > 90) return "Inativo";
  if (days > 60) return "Em risco";
  if (sales.reduce((a, v) => a + v.total, 0) >= 200000) return "VIP";
  return sales.length >= 3 ? "Recorrente" : "Ativo";
}
export function cashBalance(s: Store, id: string) {
  if (s.balances) return s.balances.cash[id] ?? 0;
  const session = s.cash_sessions.find((c) => c.id === id);
  return (
    (session?.opening ?? 0) +
    s.ledger
      .filter(
        (e) =>
          e.cash_session_id === id &&
          e.method === "Dinheiro" &&
          e.kind !== "debt" &&
          e.kind !== "credit",
      )
      .reduce((a, e) => a + (e.kind === "receipt" ? -e.amount : e.amount), 0)
  );
}
