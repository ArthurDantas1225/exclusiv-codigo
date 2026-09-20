"use client";
import { useState } from "react";
import { useStore } from "./provider";
import { Card, Field } from "./ui";
import { parseCSV, csvSchemas } from "@/lib/csv";
import { downloadCSV } from "@/lib/format";
export function ImportCSV() {
  const { run, busy } = useStore();
  const [kind, setKind] = useState<keyof typeof csvSchemas>("customers"),
    [rows, setRows] = useState<Record<string, unknown>[]>([]),
    [errors, setErrors] = useState<string[]>([]),
    [success, setSuccess] = useState(false);
  const templates = {
    customers: {
      name: "Nome do cliente",
      phone: "85999999999",
      email: "",
      tags: "",
    },
    products: {
      name: "Camiseta",
      category: "Camisetas",
      collection: "Verão",
      price: 129.9,
      sku: "CAM-PT-M",
      size: "M",
      color: "Preto",
      cost: 52,
      stock: 2,
      minimum: 2,
    },
    stock: { sku: "CAM-PT-M", quantity: 2, reason: "Entrada de mercadoria" },
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Importar com conferência.</h1>
          <p>Até 200 linhas por lote. Revise antes de gravar.</p>
        </div>
      </div>
      <Card>
        <Field name="kind" label="Tipo de importação">
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setRows([]);
              setErrors([]);
              setSuccess(false);
            }}
          >
            <option value="customers">Clientes</option>
            <option value="products">Produtos e variantes</option>
            <option value="stock">Movimentação de estoque</option>
          </select>
        </Field>
        <button
          onClick={() => downloadCSV("modelo-" + kind, [templates[kind]])}
        >
          Baixar modelo CSV
        </button>
        <Field name="file" label="Arquivo CSV (UTF-8)">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              setSuccess(false);
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 1000000) {
                setErrors(["Arquivo maior que 1 MB."]);
                return;
              }
              try {
                const raw = parseCSV(await file.text());
                const parsed: Record<string, unknown>[] = [],
                  errs: string[] = [];
                if (raw.length > 200 || !raw.length)
                  throw new Error("Escolha um arquivo com 1 a 200 linhas.");
                raw.forEach((r, i) => {
                  const p = csvSchemas[kind].safeParse(r);
                  if (p.success) parsed.push(p.data);
                  else
                    errs.push(
                      `Linha ${i + 2}: ${p.error.issues.map((e) => e.path.join(".") + " — " + e.message).join("; ")}`,
                    );
                });
                setRows(parsed);
                setErrors(errs);
              } catch (e) {
                setRows([]);
                setErrors([(e as Error).message]);
              }
            }}
          />
        </Field>
        <p className="fine">
          Valores monetários no CSV usam ponto decimal. Cada linha de produtos
          cria um produto e um SKU; para várias variações do mesmo produto, use
          o cadastro do catálogo.
        </p>
        {errors.map((e) => (
          <p className="negative" key={e}>
            {e}
          </p>
        ))}
        {!!rows.length && (
          <>
            <p>
              {rows.length} linhas válidas · {errors.length} erros
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {Object.keys(rows[0]).map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i}>
                      {Object.values(r).map((v, j) => (
                        <td key={j}>{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fine">
              Prévia das primeiras 20 linhas. Valores monetários validados são
              exibidos em centavos.
            </p>
            <button
              className="primary full"
              disabled={busy || errors.length > 0 || success}
              onClick={async () => {
                if (await run("import", { kind, rows })) setSuccess(true);
              }}
            >
              {success
                ? "Importação concluída"
                : "Confirmar importação de " + rows.length + " linhas"}
            </button>
          </>
        )}
      </Card>
    </>
  );
}
