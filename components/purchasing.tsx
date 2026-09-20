"use client";
import { useState } from "react";
import { useStore } from "./provider";
import { Card, Empty, Sheet, Field, Form } from "./ui";
import { cents, money, day } from "@/lib/format";
import type { Supplier, Payable, Purchase } from "@/lib/types";
export function Suppliers() {
  const { data, run, busy } = useStore();
  const supplierAuthor = (supplierId: string) => {
    const events = data.audit_logs.filter((a) => a.action === "supplier" && a.entity_id === supplierId);
    return data.profiles.find((p) => p.id === events.at(-1)?.user_id)?.name ?? "Registro anterior";
  };
  const [open, setOpen] = useState(false),
    [edit, setEdit] = useState<Supplier>();
  return (
    <>
      <div className="page-heading">
        <h1>Fornecedores</h1>
        <button
          className="primary"
          onClick={() => {
            setEdit(undefined);
            setOpen(true);
          }}
        >
          Novo fornecedor
        </button>
      </div>
      <Card>
        {data.suppliers.map((s) => (
          <div className="row" key={s.id}>
            <div>
              <strong>{s.name}</strong>
              <small>
                {s.phone} · {s.email}
              </small>
              <small>Cadastro: {supplierAuthor(s.id)}</small>
            </div>
            <button
              onClick={() => {
                setEdit(s);
                setOpen(true);
              }}
            >
              Editar
            </button>
          </div>
        ))}
        {!data.suppliers.length && <Empty title="Cadastre seus parceiros" />}
      </Card>
      {open && (
        <Sheet
          title={edit ? "Editar fornecedor" : "Novo fornecedor"}
          close={() => setOpen(false)}
        >
          <Form
            busy={busy}
            onSubmit={async (f) => {
              if (
                await run("supplier", {
                  ...Object.fromEntries(f),
                  id: edit?.id,
                })
              )
                setOpen(false);
            }}
          >
            <Field
              name="name"
              label="Nome / empresa"
              value={edit?.name}
              required
            />
            <Field name="phone" label="WhatsApp" value={edit?.phone} />
            <Field
              name="email"
              label="E-mail"
              type="email"
              value={edit?.email}
            />
            <Field
              name="notes"
              label="Condições e observações"
              value={edit?.notes}
            />
          </Form>
        </Sheet>
      )}
    </>
  );
}
export function Payables() {
  const { data, run, busy } = useStore();
  const [open, setOpen] = useState(false),
    [pay, setPay] = useState<Payable>(),
    [filter, setFilter] = useState("A pagar");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Contas a pagar</h1>
          <p>Vencimentos e pagamentos da operação.</p>
        </div>
        <button className="primary" onClick={() => setOpen(true)}>
          Nova conta
        </button>
      </div>
      <div className="chips">
        {["A pagar", "Vencidas", "Hoje", "Pagas"].map((f) => (
          <button
            key={f}
            className={filter === f ? "selected" : ""}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <Card>
        {data.accounts_payable
          .filter((p) =>
            filter === "Pagas"
              ? p.paid === p.amount
              : p.paid < p.amount &&
                (filter === "A pagar" ||
                  (filter === "Hoje" && p.due_date === day()) ||
                  (filter === "Vencidas" && p.due_date < day())),
          )
          .map((p) => (
            <div className="row" key={p.id}>
              <div>
                <strong>{p.description}</strong>
                <small>
                  {p.category} · {p.due_date.split("-").reverse().join("/")}
                  {p.recurring ? " · Mensal" : ""}
                </small>
                <small>{money(p.amount - p.paid)} restante</small>
              </div>
              <button disabled={p.paid >= p.amount} onClick={() => setPay(p)}>
                {p.paid >= p.amount ? "Pago" : "Pagar"}
              </button>
            </div>
          ))}
        {!data.accounts_payable.length && (
          <Empty title="Nenhuma conta cadastrada" />
        )}
      </Card>
      {open && (
        <Sheet title="Nova conta a pagar" close={() => setOpen(false)}>
          <Form
            busy={busy}
            onSubmit={async (f) => {
              if (
                await run("payable", {
                  ...Object.fromEntries(f),
                  amount: cents(f.get("amount")),
                  recurring: f.get("recurring") === "on",
                })
              )
                setOpen(false);
            }}
          >
            <Field name="description" label="Descrição" required />
            <Field name="category" label="Categoria" value="Outros" required />
            <Field
              name="amount"
              label="Valor (R$)"
              type="number"
              min={0.01}
              step="0.01"
              required
            />
            <Field
              name="due_date"
              label="Vencimento"
              type="date"
              value={day()}
              required
            />
            <label className="check">
              <input type="checkbox" name="recurring" />
              Repetir mensalmente após quitação
            </label>
          </Form>
        </Sheet>
      )}
      {pay && (
        <Sheet title="Registrar pagamento" close={() => setPay(undefined)}>
          <p>
            {pay.description} · Pendente {money(pay.amount - pay.paid)}
          </p>
          <Form
            busy={busy}
            label="Confirmar pagamento registrado"
            onSubmit={async (f) => {
              if (
                await run("pay_bill", {
                  id: pay.id,
                  amount: cents(f.get("amount")),
                  method: f.get("method"),
                })
              )
                setPay(undefined);
            }}
          >
            <Field
              name="amount"
              label="Valor pago (R$)"
              type="number"
              min={0.01}
              step="0.01"
              value={(pay.amount - pay.paid) / 100}
              required
            />
            <Field name="method" label="Forma de pagamento">
              <select name="method">
                <option>Pix</option>
                <option>Dinheiro</option>
                <option>Débito</option>
                <option>Crédito</option>
                <option>Outro</option>
              </select>
            </Field>
            <p className="fine">
              Registra o pagamento no ERP. Não faz transferência bancária.
            </p>
          </Form>
        </Sheet>
      )}
    </>
  );
}
export function Purchases() {
  const { data, run, busy } = useStore();
  const actorName = (id?: string) => data.profiles.find((p) => p.id === id)?.name ?? "Registro anterior";
  const [open, setOpen] = useState(false),
    [receive, setReceive] = useState<Purchase>(),
    [lines, setLines] = useState<
      { variant_id: string; quantity: number; unit_cost: number }[]
    >([]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Compras e entradas</h1>
          <p>Recebimento gera estoque e conta a pagar em uma única operação.</p>
        </div>
        <button className="primary" onClick={() => setOpen(true)}>
          Novo pedido
        </button>
      </div>
      <Card>
        {data.purchase_orders.map((p) => (
          <div className="row" key={p.id}>
            <div>
              <strong>
                {data.suppliers.find((s) => s.id === p.supplier_id)?.name}
              </strong>
              <small>
                {money(p.total)} ·{" "}
                {p.status === "received"
                  ? "Recebido"
                  : p.status === "partial"
                    ? "Parcialmente recebido"
                    : "Pedido"}
              </small>
              <small>Registrado por {actorName(p.created_by)}</small>
            </div>
            <button
              disabled={p.status === "received"}
              onClick={() => setReceive(p)}
            >
              Receber
            </button>
          </div>
        ))}
        {!data.purchase_orders.length && (
          <Empty
            title="Nenhum pedido de compra"
            text="Cadastre fornecedores e SKUs antes de criar o pedido."
          />
        )}
      </Card>
      {open && (
        <Sheet title="Novo pedido de compra" close={() => setOpen(false)}>
          <Form
            busy={busy}
            onSubmit={async (f) => {
              if (
                await run("purchase", {
                  supplier_id: f.get("supplier_id"),
                  due_date: f.get("due_date"),
                  items: lines,
                })
              ) {
                setOpen(false);
                setLines([]);
              }
            }}
          >
            <Field name="supplier_id" label="Fornecedor">
              <select name="supplier_id" required>
                <option value="">Selecione</option>
                {data.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              name="due_date"
              label="Vencimento da compra"
              type="date"
              required
              value={day()}
            />
            <Field name="add" label="Adicionar SKU">
              <select
                value=""
                onChange={(e) => {
                  const v = data.product_variants.find(
                    (v) => v.id === e.target.value,
                  );
                  if (v && !lines.some((l) => l.variant_id === v.id))
                    setLines([
                      ...lines,
                      { variant_id: v.id, quantity: 1, unit_cost: v.cost },
                    ]);
                }}
              >
                <option value="">Selecione</option>
                {data.product_variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku}
                  </option>
                ))}
              </select>
            </Field>
            {lines.map((l, i) => (
              <div key={l.variant_id}>
                <h3>
                  {
                    data.product_variants.find((v) => v.id === l.variant_id)
                      ?.sku
                  }
                </h3>
                <div className="form-grid">
                  <Field name={"quantity" + i} label="Quantidade">
                    <input
                      type="number"
                      min={1}
                      required
                      value={l.quantity}
                      onChange={(e) =>
                        setLines(
                          lines.map((x, j) =>
                            i === j
                              ? { ...x, quantity: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field name={"cost" + i} label="Custo (R$)">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      value={l.unit_cost / 100}
                      onChange={(e) =>
                        setLines(
                          lines.map((x, j) =>
                            i === j
                              ? { ...x, unit_cost: cents(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setLines(lines.filter((_, j) => i !== j))}
                >
                  Remover item
                </button>
              </div>
            ))}
            <p className="fine">
              Total{" "}
              {money(lines.reduce((a, l) => a + l.quantity * l.unit_cost, 0))}
            </p>
          </Form>
        </Sheet>
      )}
      {receive && (
        <Sheet title="Receber mercadoria" close={() => setReceive(undefined)}>
          <Form
            busy={busy}
            label="Confirmar entrada"
            onSubmit={async (f) => {
              const items = data.purchase_order_items
                .filter((i) => i.purchase_id === receive.id)
                .map((i) => ({ id: i.id, quantity: Number(f.get(i.id) ?? 0) }))
                .filter((i) => i.quantity > 0);
              if (
                await run("receive_purchase", {
                  purchase_id: receive.id,
                  items,
                })
              )
                setReceive(undefined);
            }}
          >
            {data.purchase_order_items
              .filter(
                (i) => i.purchase_id === receive.id && i.received < i.quantity,
              )
              .map((i) => (
                <Field
                  key={i.id}
                  name={i.id}
                  label={`${data.product_variants.find((v) => v.id === i.variant_id)?.sku} · faltam ${i.quantity - i.received}`}
                  type="number"
                  min={0}
                  value={i.quantity - i.received}
                />
              ))}
          </Form>
        </Sheet>
      )}
    </>
  );
}
