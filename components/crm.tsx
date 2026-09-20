"use client";
import { useState } from "react";
import Link from "next/link";
import { useStore } from "./provider";
import { Card, Empty, Sheet, Field, Form } from "./ui";
import { day } from "@/lib/format";
import { WhatsAppSheet } from "./customers";
import type { Customer } from "@/lib/types";
const stages = [
  "Novo contato",
  "Interessado",
  "Aguardando resposta",
  "Aguardando pagamento",
  "Venda concluída",
  "Pós-venda",
];
export function CRM() {
  const { data, run, busy } = useStore();
  const actorName = (id?: string) => data.profiles.find((p) => p.id === id)?.name ?? "Registro anterior";
  const [modal, setModal] = useState(false),
    [customer, setCustomer] = useState<Customer>(),
    [view, setView] = useState("Lembretes");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">RELACIONAMENTO / PRÓXIMO CONTATO</div>
          <h1>Boas conversas voltam.</h1>
          <p>Acompanhe pedidos, reposições e o pós-venda.</p>
        </div>
        <button className="primary" onClick={() => setModal(true)}>
          Novo lembrete
        </button>
      </div>
      <div className="chips">
        {["Lembretes", "Funil"].map((v) => (
          <button
            key={v}
            className={view === v ? "selected" : ""}
            onClick={() => setView(v)}
          >
            {v}
          </button>
        ))}
      </div>
      {view === "Lembretes" ? (
        <Card>
          {data.crm_tasks
            .filter((t) => t.status === "pending")
            .map((t) => {
              const c = data.customers.find((c) => c.id === t.customer_id);
              return (
                <div className="row" key={t.id}>
                  <div>
                    <Link href={"/app/clientes/" + t.customer_id}>
                      <strong>{c?.name}</strong>
                    </Link>
                    <p>{t.description}</p>
                    <small>
                      {t.due_date.split("-").reverse().join("/")} · {actorName(t.created_by)} ·{" "}
                      {t.due_date < day()
                        ? "Atrasado"
                        : t.due_date === day()
                          ? "Hoje"
                          : "Agendado"}
                    </small>
                  </div>
                  <div className="inline-actions">
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run("task", { ...t, status: "completed" })
                      }
                    >
                      Concluir
                    </button>
                    <button onClick={() => setCustomer(c)}>WhatsApp</button>
                  </div>
                </div>
              );
            })}
          {!data.crm_tasks.some((t) => t.status === "pending") && (
            <Empty
              title="Nenhum lembrete pendente"
              text="Agende uma conversa com um cliente."
            />
          )}
        </Card>
      ) : (
        <div className="kanban">
          {stages.map((stage) => (
            <Card key={stage}>
              <div className="card-head">
                <h3>{stage}</h3>
                <span className="badge gray">
                  {
                    data.crm_tasks.filter(
                      (t) => t.stage === stage && t.status === "pending",
                    ).length
                  }
                </span>
              </div>
              {data.crm_tasks
                .filter((t) => t.stage === stage && t.status === "pending")
                .map((t) => (
                  <div className="cart-line" key={t.id}>
                    <strong>
                      {data.customers.find((c) => c.id === t.customer_id)?.name}
                    </strong>
                    <p className="fine">{t.description}</p>
                    <select
                      aria-label="Mover etapa"
                      value={t.stage}
                      disabled={busy}
                      onChange={(e) =>
                        void run("task", { ...t, stage: e.target.value })
                      }
                    >
                      {stages.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                ))}
            </Card>
          ))}
        </div>
      )}
      {modal && (
        <Sheet title="Novo lembrete" close={() => setModal(false)}>
          <Form
            busy={busy}
            onSubmit={async (f) => {
              if (
                await run("task", {
                  customer_id: f.get("customer_id"),
                  description: f.get("description"),
                  due_date: f.get("due_date"),
                  stage: f.get("stage"),
                })
              )
                setModal(false);
            }}
          >
            <Field name="customer_id" label="Cliente">
              <select name="customer_id" required>
                <option value="">Selecione</option>
                {data.customers.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="description" label="O que lembrar?" required />
            <Field
              name="due_date"
              label="Data"
              type="date"
              value={day()}
              required
            />
            <Field name="stage" label="Etapa">
              <select name="stage">
                {stages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </Form>
        </Sheet>
      )}
      {customer && (
        <WhatsAppSheet
          customer={customer}
          close={() => setCustomer(undefined)}
          message={`Olá, ${customer.name}! Tudo bem? Aqui é da EXCLUSIV. 🖤`}
        />
      )}
    </>
  );
}
