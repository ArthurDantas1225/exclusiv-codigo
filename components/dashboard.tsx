"use client";
import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  Lightbulb,
  Package,
  UserPlus,
  Wallet,
  ShoppingBag,
} from "lucide-react";
import { useStore } from "./provider";
import { Card, Stat, Empty } from "./ui";
import { money, day, dateTime } from "@/lib/format";
import { cashBalance } from "@/lib/domain";
import { useMetrics } from "@/lib/metrics";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
export function Dashboard() {
  const { data } = useStore();
  const today = day(),
    { metrics: m, error } = useMetrics(today, today),
    { metrics: month } = useMetrics(today.slice(0, 8) + "01", today);
  const cash = data.cash_sessions.find((s) => s.status === "open");
  const low = data.product_variants
    .filter((v) => v.stock <= v.minimum)
    .sort((a, b) => a.stock - b.stock);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "full",
              timeZone: "America/Fortaleza",
            })
              .format(new Date())
              .toUpperCase()}
          </div>
          <h1>No ritmo da sua loja.</h1>
          <p>Acompanhe o dia e cuide do próximo movimento.</p>
        </div>
        <Link className="button primary" href="/app/vender">
          <Plus size={18} /> Nova venda
        </Link>
      </div>
      <Link href="/app/vender" className="sell-hero">
        <span className="sell-hero-icon"><ShoppingBag size={28} /></span>
        <span className="sell-hero-copy">
          <strong>Fazer uma venda</strong>
          <small>{m ? `${m.count} venda${m.count === 1 ? "" : "s"} hoje · ${money(m.revenue - m.refunds)} em vendas` : "Acesse o caixa e registre uma venda"}</small>
        </span>
        <ArrowUpRight size={25} aria-hidden="true" />
      </Link>
      {error && (
        <div className="banner">
          Não foi possível calcular os indicadores: {error}
        </div>
      )}
      <div className="stats">
        <Stat
          accent
          label="Faturamento hoje"
          value={m ? money(m.revenue - m.refunds) : "…"}
          detail="Vendas, descontadas as devoluções"
        />
        <Stat
          label="Vendas hoje"
          value={m?.count ?? "…"}
          detail={
            m
              ? `Ticket médio ${money(m.count ? m.revenue / m.count : 0)}`
              : "Carregando"
          }
        />
        <Stat
          label="Lucro bruto estimado"
          value={m ? money(m.revenue - m.cost - m.refunds) : "…"}
          detail="Antes das despesas operacionais"
        />
        <Stat
          label="Caixa em dinheiro"
          value={cash ? money(cashBalance(data, cash.id)) : "Fechado"}
          detail={
            cash ? "Aberto · saldo esperado" : "Abra para começar a vender"
          }
        />
      </div>
      <div className="quick-actions">
        <Link href="/app/vender">
          <Plus size={18} />
          Registrar venda
        </Link>
        <Link href="/app/produtos?novo=1">
          <Package size={18} />
          Novo produto
        </Link>
        <Link href="/app/clientes?novo=1">
          <UserPlus size={18} />
          Novo cliente
        </Link>
        <Link href="/app/financeiro">
          <Wallet size={18} />
          Financeiro
        </Link>
      </div>
      <div className="dashboard-grid">
        <Card>
          <div className="card-head">
            <div>
              <div className="eyebrow">ESTE MÊS</div>
              <h2>O movimento da EXCLUSIV</h2>
            </div>
            <Link href="/app/relatorios">
              Relatórios <ArrowUpRight size={17} />
            </Link>
          </div>
          <strong style={{ font: "600 30px monospace" }}>
            {month ? money(month.revenue - month.refunds) : "…"}
          </strong>
          <div className="chart">
            {month?.daily.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={month.daily}>
                  <defs>
                    <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#ff6b35"
                        stopOpacity={0.25}
                      />
                      <stop offset="100%" stopColor="#ff6b35" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#27313f" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(v) => String(v).slice(8)}
                    axisLine={false}
                    tickLine={false}
                    stroke="#a0abba"
                  />
                  <Tooltip
                    formatter={(v) => money(Number(v))}
                    contentStyle={{
                      background: "#19212c",
                      border: "1px solid #384354",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Vendas"
                    stroke="#ff6b35"
                    fill="url(#revenue)"
                    strokeWidth={3}
                    dot={{ fill: "#ff6b35", r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty
                title="Seu mês começa aqui"
                text="As vendas registradas aparecem neste gráfico."
              />
            )}
          </div>
        </Card>
        <Card>
          <div className="card-head">
            <h2>Precisa de atenção</h2>
            <Link href="/app/alertas">Ver tudo <ArrowUpRight size={16} /></Link>
          </div>
          <Link href="/app/estoque" className="row">
            <div>
              <strong>Estoque para repor</strong>
              <small>SKUs no mínimo ou abaixo</small>
            </div>
            <span className="badge warning">{m?.low_stock ?? "…"} SKUs</span>
          </Link>
          <Link href="/app/financeiro/receber" className="row">
            <div>
              <strong>Contas a receber</strong>
              <small>Saldo em conta dos clientes</small>
            </div>
            <span className="amount">{m ? money(m.receivable) : "…"}</span>
          </Link>
          <Link href="/app/crm" className="row">
            <div>
              <strong>Retomar conversas</strong>
              <small>Lembretes até hoje</small>
            </div>
            <span className="badge gray">
              {
                data.crm_tasks.filter(
                  (t) => t.status === "pending" && t.due_date <= today,
                ).length
              }
            </span>
          </Link>
          <Link href="/app/financeiro/caixa" className="row">
            <div>
              <strong>{cash ? "Conferir o caixa" : "Abrir caixa"}</strong>
              <small>
                {cash
                  ? "Entradas, saídas e fechamento"
                  : "Comece a operação do dia"}
              </small>
            </div>
            <ArrowUpRight size={20} />
          </Link>
        </Card>
      </div>
      {low.length > 0 && (
        <div className="insight">
          <Lightbulb size={23} />
          <div>
            <strong>Uma reposição pode fazer a próxima venda.</strong>
            <p>
              {low.length} SKU{low.length > 1 ? "s estão" : " está"} no estoque
              mínimo entre os registros carregados. Confira tamanhos e cores
              antes do próximo pedido.
            </p>
          </div>
        </div>
      )}
      <div className="dashboard-grid">
        <Card>
          <div className="card-head">
            <h2>Últimas vendas</h2>
            <Link href="/app/vendas">Histórico <ArrowUpRight size={16} /></Link>
          </div>
          {data.sales.length ? (
            data.sales.slice(0, 5).map((s) => (
              <Link href={"/app/vendas/" + s.id} className="row" key={s.id}>
                <div>
                  <strong>
                    #{s.number} ·{" "}
                    {data.customers.find((c) => c.id === s.customer_id)?.name ??
                      "Consumidor final"}
                  </strong>
                  <small>{dateTime(s.created_at)}</small>
                </div>
                <span className="amount">{money(s.total)}</span>
              </Link>
            ))
          ) : (
            <Empty
              title="Nenhuma venda ainda"
              text="Registre a primeira venda para começar."
            />
          )}
        </Card>
        <Card>
          <div className="card-head">
            <h2>De olho no estoque</h2>
            <Link href="/app/estoque">Ver estoque <ArrowUpRight size={16} /></Link>
          </div>
          {low.length ? (
            low.slice(0, 4).map((v) => (
              <Link
                href={"/app/produtos/" + v.product_id}
                className="row"
                key={v.id}
              >
                <div>
                  <strong>
                    {data.products.find((p) => p.id === v.product_id)?.name}
                  </strong>
                  <small>
                    {v.color} / {v.size}
                  </small>
                </div>
                <span className="badge warning">{v.stock} un.</span>
              </Link>
            ))
          ) : (
            <Empty
              title="Estoque sem alertas"
              text="Os SKUs carregados estão acima do mínimo."
            />
          )}
        </Card>
      </div>
    </>
  );
}
