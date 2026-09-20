"use client";
import { useState } from "react";
import Link from "next/link";
import { useStore } from "./provider";
import { Card, Empty, Sheet, Field, Form, Stat } from "./ui";
import { cents, money, dateTime, day, downloadCSV } from "@/lib/format";
import { balance, cashBalance } from "@/lib/domain";
import { WhatsAppSheet } from "./customers";
import type { Customer } from "@/lib/types";
export function Finance({ section }: { section?: string }) {
  const { data, run, busy } = useStore();
  const [modal, setModal] = useState(""),
    [customer, setCustomer] = useState<Customer | undefined>();
  const cash = data.cash_sessions.find((c) => c.status === "open"),
    debtors = data.customers.filter((c) => balance(data, c.id) > 0);
  const actorName = (id?: string | null) => data.profiles.find((p) => p.id === id)?.name ?? "Registro anterior";
  const labels: Record<string, string> = {
    expense: "Nova despesa paga",
    income: "Receita avulsa",
    supply: "Suprimento",
    withdrawal: "Sangria",
    receipt: "Receber pagamento",
    open_cash: "Abrir caixa",
    close_cash: "Fechar caixa",
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FINANCEIRO / EXCLUSIV</div>
          <h1>
            {section === "receber"
              ? "Receber e seguir em frente."
              : section === "caixa"
                ? "Seu caixa, sem dúvida."
                : "Clareza em cada movimento."}
          </h1>
          <p>
            Vendas, recebimentos e dinheiro em caixa são acompanhados
            separadamente.
          </p>
        </div>
        <button className="primary" onClick={() => setModal("expense")}>
          Nova despesa
        </button>
      </div>
      <div className="stats">
        <Stat
          accent
          label="Caixa em dinheiro"
          value={cash ? money(cashBalance(data, cash.id)) : "Fechado"}
          detail={cash ? "Saldo esperado" : "Nenhuma sessão aberta"}
        />
        <Stat
          label="A receber nesta lista"
          value={money(debtors.reduce((a, c) => a + balance(data, c.id), 0))}
        />
        <Stat label="Clientes com saldo" value={debtors.length} />
        <Stat
          label="Despesas carregadas"
          value={money(
            -data.ledger
              .filter((e) => e.kind === "expense")
              .reduce((a, e) => a + e.amount, 0),
          )}
        />
      </div>
      <div className="toolbar">
        <button onClick={() => setModal(cash ? "close_cash" : "open_cash")}>
          {cash ? "Fechar caixa" : "Abrir caixa"}
        </button>
        <button disabled={!cash} onClick={() => setModal("supply")}>
          Suprimento
        </button>
        <button disabled={!cash} onClick={() => setModal("withdrawal")}>
          Sangria
        </button>
        <button onClick={() => setModal("income")}>Receita avulsa</button>
        <button onClick={() => downloadCSV("financeiro", data.ledger)}>
          Exportar CSV
        </button>
        <Link className="button" href="/app/financeiro/pagar">
          Contas a pagar
        </Link>
        <Link className="button" href="/app/relatorios">
          Relatórios
        </Link>
      </div>
      {section !== "caixa" && (
        <Card>
          <div className="card-head">
            <h2>Contas dos clientes</h2>
            <span className="badge gray">{debtors.length} em aberto</span>
          </div>
          {debtors.map((c) => (
            <div className="row" key={c.id}>
              <div>
                <Link href={"/app/clientes/" + c.id}>
                  <strong>{c.name}</strong>
                </Link>
                <small>{money(balance(data, c.id))} pendente</small>
              </div>
              <div className="inline-actions">
                <button
                  onClick={() => {
                    setCustomer(c);
                    setModal("receipt");
                  }}
                >
                  Receber
                </button>
                <button
                  onClick={() => {
                    setCustomer(c);
                    setModal("whatsapp");
                  }}
                >
                  Cobrar
                </button>
              </div>
            </div>
          ))}
          {!debtors.length && (
            <Empty
              title="Nenhum saldo pendente"
              text="Vendas fiado aparecem aqui automaticamente."
            />
          )}
        </Card>
      )}
      <Card className="section-gap">
        <h2>
          {section === "caixa"
            ? "Movimentações do caixa atual"
            : "Movimentações financeiras"}
        </h2>
        {data.ledger
          .filter((e) => section !== "caixa" || e.cash_session_id === cash?.id)
          .map((e) => (
            <div className="row" key={e.id}>
              <div>
                <strong>{e.description}</strong>
                <small>
                  {dateTime(e.created_at)} · {actorName(e.created_by)} · {e.method} ·{" "}
                  {e.kind === "debt"
                    ? "A receber"
                    : e.kind === "receipt"
                      ? "Recebimento"
                      : e.kind === "credit"
                        ? "Crédito na conta"
                        : "Movimentação"}
                </small>
              </div>
              <span
                className={
                  e.amount < 0 && e.kind !== "receipt" ? "negative" : "positive"
                }
              >
                {money(e.kind === "receipt" ? -e.amount : e.amount)}
              </span>
            </div>
          ))}
        {!data.ledger.length && <Empty title="Sem movimentações" />}
      </Card>
      <Card className="section-gap">
        <h2>Histórico de caixas</h2>
        {data.cash_sessions.map((c) => (
          <div key={c.id} className="row">
            <div>
              <strong>
                {c.status === "open" ? "Aberto" : "Fechado"} ·{" "}
                {dateTime(c.created_at)}
              </strong>
              <small>
                Abertura {money(c.opening)} por {actorName(c.created_by)}
                {c.status === "closed"
                  ? ` · Fechado por ${actorName(c.closed_by)} · Esperado ${money(c.expected ?? 0)} · Contado ${money(c.counted ?? 0)}`
                  : ""}
              </small>
            </div>
            {c.status === "closed" && (
              <span className="badge gray">
                Diferença {money((c.counted ?? 0) - (c.expected ?? 0))}
              </span>
            )}
          </div>
        ))}
      </Card>
      <p className="fine">
        Listas mostram 500 registros por lote. Saldos de caixa e de clientes
        consideram todas as movimentações. Confira os totais agregados em
        Relatórios.
      </p>
      {labels[modal] && (
        <Sheet title={labels[modal]} close={() => setModal("")}>
          <Form
            busy={busy}
            label={
              modal === "close_cash" ? "Confirmar fechamento" : "Registrar"
            }
            onSubmit={async (f) => {
              if (
                await run(modal, {
                  amount: cents(f.get("amount")),
                  description: f.get("description") ?? labels[modal],
                  method: f.get("method") ?? "Dinheiro",
                  customer_id: modal === "receipt" ? customer?.id : null,
                  due_date: f.get("due_date") ?? day(),
                })
              )
                setModal("");
            }}
          >
            {modal === "close_cash" && cash && (
              <div className="banner">
                Esperado: {money(cashBalance(data, cash.id))}. Informe o
                dinheiro contado para registrar a diferença.
              </div>
            )}
            {modal === "receipt" && customer && (
              <div className="banner">
                {customer.name} · Pendente {money(balance(data, customer.id))}
              </div>
            )}
            <Field
              name="amount"
              label={
                modal === "close_cash" ? "Valor contado (R$)" : "Valor (R$)"
              }
              type="number"
              min={0}
              step="0.01"
              required
            />
            {!["open_cash", "close_cash"].includes(modal) && (
              <Field
                name="description"
                label="Descrição / motivo"
                required
                value={modal === "receipt" ? "Recebimento parcial" : undefined}
              />
            )}
            {!["open_cash", "close_cash", "supply", "withdrawal"].includes(
              modal,
            ) && (
              <Field name="method" label="Forma de pagamento">
                <select name="method">
                  {["Pix", "Dinheiro", "Débito", "Crédito", "Outro"].map(
                    (m) => (
                      <option key={m}>{m}</option>
                    ),
                  )}
                </select>
              </Field>
            )}
          </Form>
        </Sheet>
      )}
      {modal === "whatsapp" && customer && (
        <WhatsAppSheet
          customer={customer}
          close={() => setModal("")}
          message={`Olá, ${customer.name}! Tudo bem? Passando para lembrar que existe um saldo de ${money(balance(data, customer.id))} referente às suas compras na EXCLUSIV. Se já realizou o pagamento, pode desconsiderar. Obrigado! 🖤`}
        />
      )}
    </>
  );
}
