import { z } from "zod";
export function parseCSV(text: string) {
  const sep = text.split(/\r?\n/)[0].includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === sep && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Aspas não fechadas no CSV.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  const headers =
    rows.shift()?.map((h) => h.replace(/^\uFEFF/, "").trim()) ?? [];
  if (new Set(headers).size !== headers.length)
    throw new Error("Colunas duplicadas.");
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw new Error(`Linha ${i + 2}: quantidade de colunas inválida.`);
    return Object.fromEntries(headers.map((h, j) => [h, r[j].trim()]));
  });
}
const money = z.coerce
  .number()
  .nonnegative()
  .transform((n) => Math.round(n * 100));
export const csvSchemas = {
  customers: z.object({
    name: z.string().min(1),
    phone: z.string().min(10),
    email: z.union([z.email(), z.literal("")]).optional(),
    tags: z.string().optional(),
  }),
  products: z.object({
    name: z.string().min(1),
    category: z.string().default(""),
    collection: z.string().default(""),
    price: money,
    sku: z.string().min(1),
    size: z.string().min(1),
    color: z.string().min(1),
    cost: money,
    stock: z.coerce.number().int().nonnegative(),
    minimum: z.coerce.number().int().nonnegative().default(2),
  }),
  stock: z.object({
    sku: z.string().min(1),
    quantity: z.coerce.number().int(),
    reason: z.string().min(3),
  }),
};
