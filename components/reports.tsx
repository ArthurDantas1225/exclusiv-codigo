"use client";
import { useState } from "react";
import { useMetrics } from "@/lib/metrics";
import { money, day, downloadCSV } from "@/lib/format";
import { Card, Stat, Field } from "./ui";
export function Reports() {
  const today = day();
  const [start, setStart] = useState(today.slice(0, 8) + "01"),
    [end, setEnd] = useState(today);
  const { metrics: m, error } = useMetrics(start, end);
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: new Intl.DateTimeFormat("pt-BR", {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, i, 1))),
    ...m?.monthly.find((x) => x.month === i + 1),
  }));
  const max = Math.max(1, ...monthly.map((m) => m.revenue ?? 0));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">RELATÓRIOS / DECISÕES</div>
          <h1>Enxergue além da venda.</h1>
          <p>
            Indicadores calculados no banco, para todo o período selecionado.
          </p>
        </div>
        <button
          disabled={!m}
          onClick={() => m && downloadCSV("relatorio-mensal", monthly)}
        >
          Exportar CSV
        </button>
      </div>
      <div className="form-grid">
        <Field name="start" label="De">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field name="end" label="Até">
          <input
            type="date"
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </div>
      <div className="chips">
        <button
          onClick={() => {
            setStart(today);
            setEnd(today);
          }}
        >
          Hoje
        </button>
        <button
          onClick={() => {
            setStart(day(new Date(Date.now() - 7 * 86400000)));
            setEnd(today);
          }}
        >
          7 dias
        </button>
        <button
          onClick={() => {
            setStart(today.slice(0, 8) + "01");
            setEnd(today);
          }}
        >
          Este mês
        </button>
        <button
          onClick={() => {
            setStart(today.slice(0, 5) + "01-01");
            setEnd(today);
          }}
        >
          Este ano
        </button>
      </div>
      {error && <div className="banner">{error}</div>}
      <div className="stats">
        <Stat
          accent
          label="Receita líquida"
          value={m ? money(m.revenue - m.refunds) : "…"}
        />
        <Stat label="Vendas" value={m?.count ?? "…"} />
        <Stat
          label="Ticket médio original"
          value={m ? money(m.count ? m.revenue / m.count : 0) : "…"}
        />
        <Stat
          label="Resultado estimado"
          value={
            m
              ? money(
                  m.revenue -
                    m.refunds -
                    m.cost -
                    m.expenses -
                    (m.salary ?? 0),
                )
              : "…"
          }
        />
      </div>
      <div className="dashboard-grid">
        <Card>
          <div className="card-head">
            <h2>Visão anual · {start.slice(0, 4)}</h2>
          </div>
          <div className="report-bars">
            {monthly.map((m) => (
              <div
                className="report-bar"
                key={m.month}
                title={`${m.label}: ${money(m.revenue ?? 0)}`}
              >
                <div
                  style={{
                    height: Math.max(1, ((m.revenue ?? 0) / max) * 160),
                  }}
                />
                <small>{m.label.replace(".", "")}</small>
              </div>
            ))}
          </div>
          <p className="fine">
            Vendas mensais antes de devoluções, excluindo cancelamentos.
          </p>
        </Card>
        <Card>
          <h2>DRE simplificada</h2>
          {[
            ["Faturamento bruto", m?.gross],
            ["Descontos", -(m?.discount ?? 0)],
            ["Devoluções", -(m?.refunds ?? 0)],
            ["Receita líquida", (m?.revenue ?? 0) - (m?.refunds ?? 0)],
            ["CMV", -(m?.cost ?? 0)],
            [
              "Lucro bruto",
              (m?.revenue ?? 0) - (m?.refunds ?? 0) - (m?.cost ?? 0),
            ],
            ["Salários (50% do lucro real)", -(m?.salary ?? 0)],
            [
              "Lucro após salários",
              (m?.revenue ?? 0) -
                (m?.refunds ?? 0) -
                (m?.cost ?? 0) -
                (m?.salary ?? 0),
            ],
            ["Despesas operacionais", -(m?.expenses ?? 0)],
            [
              "Resultado operacional",
              (m?.revenue ?? 0) -
                (m?.refunds ?? 0) -
                (m?.cost ?? 0) -
                (m?.salary ?? 0) -
                (m?.expenses ?? 0),
            ],
          ].map(([label, value]) => (
            <div className="row" key={label}>
              <span>{label}</span>
              <strong>{m ? money(Number(value)) : "…"}</strong>
            </div>
          ))}
          <p className="fine">
            Relatório gerencial estimado. Não substitui a contabilidade oficial.
          </p>
        </Card>
      </div>
      <Card>
        <div className="card-head">
          <div>
            <h2>Salário por vendedor</h2>
            <p className="fine">
              50% do lucro bruto real, já considerando descontos e devoluções.
            </p>
          </div>
          <button
            disabled={!m?.seller_salary.length}
            onClick={() =>
              m &&
              downloadCSV(
                "salarios-por-vendedor",
                m.seller_salary.map((seller) => ({
                  vendedor: seller.name,
                  vendas: seller.sales,
                  receita_liquida: seller.revenue / 100,
                  custo: seller.cost / 100,
                  lucro_bruto_real: seller.gross_profit / 100,
                  salario: seller.salary / 100,
                })),
              )
            }
          >
            Exportar salários CSV
          </button>
        </div>
        {m?.seller_salary.map((seller) => (
          <div className="row" key={seller.user_id}>
            <div>
              <strong>{seller.name}</strong>
              <small>
                {seller.sales} venda{seller.sales === 1 ? "" : "s"} · lucro
                real {money(seller.gross_profit)}
              </small>
            </div>
            <strong>{money(seller.salary)}</strong>
          </div>
        ))}
        {m && !m.seller_salary.length && (
          <p className="fine">Nenhum salário gerado neste período.</p>
        )}
      </Card>
      <Card>
        <h2>Formas de pagamento</h2>
        {m?.payments.map((p) => (
          <div className="row" key={p.method}>
            <span>{p.method}</span>
            <strong>
              {money(p.amount)} ·{" "}
              {m.revenue ? Math.round((p.amount / m.revenue) * 100) : 0}%
            </strong>
          </div>
        ))}
        <p className="fine">
          Distribuição das vendas originais. Cartões e fiado não equivalem a
          dinheiro disponível em caixa.
        </p>
      </Card>
    </>
  );
}
