"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Download, MessageCircle } from "lucide-react";
import { useStore } from "./provider";
import { Card, Empty, Sheet, Field, Form, Stat } from "./ui";
import { cents, money, dateTime, downloadCSV, whatsapp } from "@/lib/format";
import { balance, segment } from "@/lib/domain";
import type { Customer } from "@/lib/types";
export function CustomerForm({
  customer,
  onSaved,
}: {
  customer?: Customer;
  onSaved: () => void;
}) {
  const { run, busy } = useStore();
  return (
    <Form
      busy={busy}
      onSubmit={async (f) => {
        if (
          await run("customer", {
            id: customer?.id,
            name: f.get("name"),
            phone: f.get("phone"),
            email: f.get("email"),
            instagram: f.get("instagram"),
            notes: f.get("notes"),
            tags: f.get("tags"),
            marketing_consent: f.get("marketing_consent") === "on",
            credit_enabled: f.get("credit_enabled") === "on",
            credit_limit: cents(f.get("credit_limit")),
          })
        )
          onSaved();
      }}
    >
      <Field name="name" label="Nome" value={customer?.name} required />
      <Field
        name="phone"
        label="WhatsApp com DDD"
        type="tel"
        value={customer?.phone}
        required
      />
      <div className="form-grid">
        <Field
          name="email"
          label="E-mail (opcional)"
          type="email"
          value={customer?.email}
        />
        <Field
          name="instagram"
          label="Instagram (opcional)"
          value={customer?.instagram}
        />
      </div>
      <Field
        name="tags"
        label="Tags separadas por vírgulas"
        value={customer?.tags}
      />
      <Field name="notes" label="Preferências / observações">
        <textarea name="notes" defaultValue={customer?.notes} />
      </Field>
      <label className="check">
        <input
          type="checkbox"
          name="marketing_consent"
          defaultChecked={customer?.marketing_consent}
        />
        Cliente autorizou contato de marketing
      </label>
      <label className="check">
        <input
          type="checkbox"
          name="credit_enabled"
          defaultChecked={customer?.credit_enabled}
        />
        Autorizar fiado
      </label>
      <Field
        name="credit_limit"
        label="Limite de fiado (R$)"
        type="number"
        min={0}
        step="0.01"
        value={(customer?.credit_limit ?? 0) / 100}
      />
    </Form>
  );
}
export function WhatsAppSheet({
  customer,
  message,
  close,
}: {
  customer: Customer;
  message: string;
  close: () => void;
}) {
  const [text, setText] = useState(message);
  const { notify } = useStore();
  return (
    <Sheet title="Mensagem no WhatsApp" close={close}>
      <Field name="message" label="Revise antes de abrir">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ minHeight: 200 }}
        />
      </Field>
      <button
        className="primary full"
        onClick={() => {
          try {
            window.open(
              whatsapp(customer.phone, text),
              "_blank",
              "noopener,noreferrer",
            );
          } catch (e) {
            notify((e as Error).message);
          }
        }}
      >
        <MessageCircle size={18} />
        Abrir WhatsApp
      </button>
      <p className="fine">Você decide se envia a mensagem no WhatsApp.</p>
    </Sheet>
  );
}
export function Customers({ id }: { id?: string }) {
  const { data, run, busy } = useStore();
  const customerAuthor = (customerId: string) => {
    const events = data.audit_logs.filter((a) => a.action === "customer" && a.entity_id === customerId);
    return data.profiles.find((p) => p.id === events.at(-1)?.user_id)?.name ?? "Registro anterior";
  };
  const params = useSearchParams();
  const [modal, setModal] = useState(params.get("novo") ? "edit" : ""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("Todos");
  const customer = data.customers.find((c) => c.id === id),
    sales = data.sales.filter(
      (s) => s.customer_id === id && s.status !== "cancelled",
    ),
    debt = id ? balance(data, id) : 0;
  const filtered = data.customers.filter(
    (c) =>
      (c.name + c.phone + c.tags)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "Todos" || segment(data, c) === filter),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">RELACIONAMENTO / EXCLUSIV</div>
          <h1>{customer?.name ?? "Quem veste a EXCLUSIV."}</h1>
          <p>
            {customer
              ? "Histórico, preferências e próximos contatos."
              : "Cada cliente tem uma história com a loja."}
          </p>
        </div>
        <button className="primary" onClick={() => setModal("edit")}>
          <Plus size={18} />
          {customer ? "Editar" : "Novo cliente"}
        </button>
      </div>
      {customer ? (
        <>
          <div className="stats">
            <Stat
              label="Total de compras"
              value={money(sales.reduce((a, s) => a + s.total, 0))}
              accent
            />
            <Stat label="Compras" value={sales.length} />
            <Stat
              label="Ticket médio"
              value={money(
                sales.length
                  ? sales.reduce((a, s) => a + s.total, 0) / sales.length
                  : 0,
              )}
            />
            <Stat
              label="Saldo em conta"
              value={money(debt)}
              detail={debt < 0 ? "Crédito disponível" : "Valor pendente"}
            />
          </div>
          <div className="dashboard-grid">
            <Card>
              <div className="customer-head">
                <div className="profile-avatar">
                  {customer.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2>{customer.name}</h2>
                  <small>
                    {customer.phone || "Sem WhatsApp"} ·{" "}
                    {segment(data, customer)}
                  </small>
                  <small>Cadastro: {customerAuthor(customer.id)}</small>
                </div>
              </div>
              <p>{customer.notes || "Nenhuma preferência registrada."}</p>
              <div className="chips section-gap">
                {customer.tags
                  .split(",")
                  .filter(Boolean)
                  .map((t) => (
                    <span className="badge gray" key={t}>
                      {t}
                    </span>
                  ))}
              </div>
              <div className="inline-actions">
                <button onClick={() => setModal("whatsapp")}>
                  <MessageCircle size={18} />
                  WhatsApp
                </button>
                {debt > 0 && (
                  <Link className="button" href="/app/financeiro/receber">
                    Receber pagamento
                  </Link>
                )}
                <button
                  className="ghost danger"
                  onClick={() => setModal("anonymize")}
                >
                  Anonimizar
                </button>
              </div>
            </Card>
            <Card>
              <h2>Conta do cliente</h2>
              <div className="row">
                <span>Fiado autorizado</span>
                <span>{customer.credit_enabled ? "Sim" : "Não"}</span>
              </div>
              <div className="row">
                <span>Limite</span>
                <span>{money(customer.credit_limit)}</span>
              </div>
              <div className="row">
                <span>Marketing autorizado</span>
                <span>{customer.marketing_consent ? "Sim" : "Não"}</span>
              </div>
            </Card>
          </div>
          <Card>
            <h2>Histórico de compras</h2>
            {sales.map((s) => (
              <Link className="row" href={"/app/vendas/" + s.id} key={s.id}>
                <div>
                  <strong>Venda #{s.number}</strong>
                  <small>{dateTime(s.created_at)} · {data.profiles.find((p) => p.id === s.created_by)?.name ?? "Registro anterior"}</small>
                </div>
                <span>{money(s.total)}</span>
              </Link>
            ))}
            {!sales.length && <Empty title="Nenhuma compra registrada" />}
          </Card>
          <Card className="section-gap">
            <h2>Movimentações da conta</h2>
            {data.ledger
              .filter(
                (e) =>
                  e.customer_id === id &&
                  ["debt", "receipt", "credit"].includes(e.kind),
              )
              .map((e) => (
                <div className="row" key={e.id}>
                  <div>
                    <strong>{e.description}</strong>
                    <small>{dateTime(e.created_at)} · {data.profiles.find((p) => p.id === e.created_by)?.name ?? "Registro anterior"}</small>
                  </div>
                  <span>{money(e.amount)}</span>
                </div>
              ))}
          </Card>
        </>
      ) : (
        <>
          <div className="toolbar">
            <input
              className="search-input"
              aria-label="Buscar clientes"
              placeholder="Buscar nome, WhatsApp ou tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button onClick={() => downloadCSV("clientes", filtered)}>
              <Download size={18} />
              CSV
            </button>
          </div>
          <div className="chips">
            {[
              "Todos",
              "Novo",
              "Ativo",
              "Recorrente",
              "VIP",
              "Em risco",
              "Inativo",
              "Devedor",
            ].map((f) => (
              <button
                className={filter === f ? "selected" : ""}
                key={f}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <Card>
            {filtered.map((c) => (
              <Link href={"/app/clientes/" + c.id} className="row" key={c.id}>
                <div className="customer-head" style={{ margin: 0 }}>
                  <div className="profile-avatar">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong>{c.name}</strong>
                    <small>{c.phone || "Sem telefone"}</small>
                    <small>Cadastro: {customerAuthor(c.id)}</small>
                  </div>
                </div>
                <span
                  className={
                    "badge " +
                    (segment(data, c) === "Devedor" ? "warning" : "gray")
                  }
                >
                  {segment(data, c)}
                </span>
              </Link>
            ))}
            {!filtered.length && (
              <Empty
                title="Nenhum cliente encontrado"
                text="Cadastre nome e WhatsApp para começar."
              />
            )}
          </Card>
          <p className="fine">
            Lista e indicadores individuais limitados aos últimos 500 registros
            carregados.
          </p>
        </>
      )}
      {modal === "edit" && (
        <Sheet
          title={customer ? "Editar cliente" : "Novo cliente"}
          close={() => setModal("")}
        >
          <CustomerForm customer={customer} onSaved={() => setModal("")} />
        </Sheet>
      )}
      {modal === "whatsapp" && customer && (
        <WhatsAppSheet
          customer={customer}
          close={() => setModal("")}
          message={
            debt > 0
              ? `Olá, ${customer.name}! Tudo bem? Passando para lembrar do saldo de ${money(debt)} referente às suas compras na EXCLUSIV. Se já pagou, pode desconsiderar. Obrigado! 🖤`
              : `Olá, ${customer.name}! Tudo bem? Aqui é da EXCLUSIV. 🖤`
          }
        />
      )}
      {modal === "anonymize" && customer && (
        <Sheet title="Anonimizar dados pessoais" close={() => setModal("")}>
          <p>
            Nome, contato e preferências serão removidos. O histórico financeiro
            será preservado. Esta ação não pode ser desfeita.
          </p>
          <button
            className="danger full"
            disabled={busy}
            onClick={async () => {
              if (await run("anonymize", { customer_id: id })) setModal("");
            }}
          >
            Confirmar anonimização
          </button>
        </Sheet>
      )}
    </>
  );
}
