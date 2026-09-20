"use client";
import { useState, useEffect } from "react";
import { useStore } from "./provider";
import { supabase } from "@/lib/supabase";
import { Card, Empty } from "./ui";
type Count = { id: string; status: string; created_at: string };
type Item = { variant_id: string; expected: number; counted: number | null };
export function Inventory() {
  const { data, run, busy, demo, notify } = useStore();
  const [counts, setCounts] = useState<Count[]>([]),
    [items, setItems] = useState<Item[]>([]),
    [id, setId] = useState("");
  async function refresh() {
    if (supabase && !demo) {
      const { data, error } = await supabase
        .from("inventory_counts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) notify(error.message);
      else setCounts(data ?? []);
    }
  }
  useEffect(() => {
    void refresh(); /* initial read */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ESTOQUE / CONTAGEM FÍSICA</div>
          <h1>Conte. Confira. Ajuste.</h1>
          <p>Evite movimentar as peças durante a contagem.</p>
        </div>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            const id = await run("start_count", {});
            if (id) await refresh();
          }}
        >
          Novo inventário
        </button>
      </div>
      <Card>
        {counts.map((c) => (
          <div key={c.id} className="row">
            <div>
              <strong>
                {new Date(c.created_at).toLocaleDateString("pt-BR")}
              </strong>
              <small>
                {c.status === "open" ? "Em andamento" : "Finalizado"}
              </small>
            </div>
            <button
              onClick={async () => {
                const { data, error } = await supabase!
                  .from("inventory_count_items")
                  .select("*")
                  .eq("count_id", c.id);
                if (error) notify(error.message);
                else {
                  setId(c.id);
                  setItems(data ?? []);
                }
              }}
            >
              Ver contagem
            </button>
          </div>
        ))}
        {!counts.length && (
          <Empty
            title="Nenhum inventário"
            text="Inicie uma contagem para conferir cada SKU."
          />
        )}
      </Card>
      {id && (
        <Card className="section-gap">
          <h2>Contagem por SKU</h2>
          {items.map((item, i) => (
            <div className="count-row" key={item.variant_id}>
              <div>
                <strong>
                  {data.product_variants.find((v) => v.id === item.variant_id)
                    ?.sku ?? item.variant_id}
                </strong>
                <small style={{ display: "block" }}>
                  Sistema: {item.expected} · Diferença:{" "}
                  {item.counted === null ? "—" : item.counted - item.expected}
                </small>
              </div>
              <input
                type="number"
                aria-label="Quantidade contada"
                min={0}
                disabled={counts.find((c) => c.id === id)?.status !== "open"}
                value={item.counted ?? ""}
                onChange={(e) =>
                  setItems(
                    items.map((x, j) =>
                      i === j
                        ? {
                            ...x,
                            counted:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          }
                        : x,
                    ),
                  )
                }
              />
            </div>
          ))}
          {counts.find((c) => c.id === id)?.status === "open" && (
            <button
              className="primary full"
              disabled={busy || items.some((i) => i.counted === null)}
              onClick={async () => {
                if (await run("finish_count", { count_id: id, items })) {
                  setId("");
                  await refresh();
                }
              }}
            >
              Finalizar inventário e registrar ajustes
            </button>
          )}
        </Card>
      )}
    </>
  );
}
