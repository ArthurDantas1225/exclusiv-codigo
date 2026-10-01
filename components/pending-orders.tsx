"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, Clock3, Search, Trash2 } from "lucide-react";
import { useStore } from "./provider";
import { Card, Empty, Field } from "./ui";
import { money, dateTime } from "@/lib/format";
import { readPendingOrders, removePendingOrder, type PendingOrder } from "@/lib/pending-orders";
import { methods } from "@/lib/types";
import { saleSchema } from "@/lib/domain";

export function PendingOrders() {
  const { data, run, busy, notify, online } = useStore();
  const router = useRouter();
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [selected, setSelected] = useState<PendingOrder | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Pix");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("Todos");

  useEffect(() => {
    setOrders(readPendingOrders());
  }, []);

  const refresh = () => setOrders(readPendingOrders());

  const visibleOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesQuery = !q || [order.customerName, order.payment, order.delivery, order.items.map((item) => `${item.productName} ${item.variantColor} ${item.variantSize}`).join(" ")].join(" ").toLowerCase().includes(q);
      const matchesPayment = paymentFilter === "Todos" || order.payment === paymentFilter;
      return matchesQuery && matchesPayment;
    });
  }, [orders, paymentFilter, query]);

  const totalPending = visibleOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);

  async function confirmOrder(order: PendingOrder) {
    const items = order.items
      .map((item) => {
        const variant = data.product_variants.find((entry) => entry.id === item.variantId);
        if (!variant) return null;
        const product = data.products.find((entry) => entry.id === item.productId) ?? { price: item.unitPrice };
        return {
          variant_id: variant.id,
          quantity: item.quantity,
          unit_price: item.unitPrice || product.price || variant.cost,
        };
      })
      .filter((item): item is { variant_id: string; quantity: number; unit_price: number } => !!item);

    if (!items.length) {
      notify("Este pedido pendente não tem itens válidos para vender.");
      return;
    }

    const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const payload = {
      request_id: crypto.randomUUID(),
      customer_id: customerId || null,
      discount: 0,
      notes: notes || `Pedido pendente de ${order.customerName} · Pagamento: ${order.payment} · Entrega: ${order.delivery}`,
      items,
      payments: [{ method: paymentMethod, amount: total }],
      tendered: paymentMethod === "Dinheiro" ? total : 0,
    };

    const parsed = saleSchema.safeParse(payload);
    if (!parsed.success) {
      notify("Revise o cliente, os itens e a forma de pagamento antes de confirmar.");
      return;
    }

    const id = await run("sale", parsed.data);
    if (!id) return;

    removePendingOrder(order.id);
    setSelected(null);
    setCustomerId("");
    setPaymentMethod("Pix");
    setNotes("");
    refresh();
    router.push(`/app/vendas/${id}?sucesso=1`);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PEDIDOS PENDENTES</div>
          <h1>Pedidos aguardando confirmação</h1>
          <p>Os pedidos enviados pelo WhatsApp ficam aqui para você completar e vender.</p>
        </div>
        <Link href="/app/vender" className="button primary">
          Abrir caixa
        </Link>
      </div>

      {!orders.length ? (
        <Empty
          title="Nenhum pedido pendente"
          text="Quando o cliente mandar pelo WhatsApp, o pedido aparece aqui para você validar e fechar a venda."
        />
      ) : (
        <>
          <div className="pending-order-summary">
            <div className="card stat">
              <span>Pedidos</span>
              <strong>{orders.length}</strong>
              <small>{visibleOrders.length} filtrados</small>
            </div>
            <div className="card stat">
              <span>Em aberto</span>
              <strong>{money(totalPending)}</strong>
              <small>valor em análise</small>
            </div>
          </div>

          <div className="pending-orders-toolbar">
            <label className="field pending-search">
              <span>Buscar pedido</span>
              <div className="pending-search-inner">
                <Search size={16} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cliente, produto, cor ou tamanho" />
              </div>
            </label>
            <label className="field pending-filter">
              <span>Pagamento</span>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                <option value="Todos">Todos</option>
                {methods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!visibleOrders.length ? (
            <Empty title="Nenhum pedido encontrado" text="Tente outro termo ou remova um filtro." />
          ) : (
            <div className="stack-list">
              {visibleOrders.map((order) => {
                const subtotal = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                return (
                  <Card key={order.id} className="pending-order-card">
                    <div className="row gap-row">
                      <div>
                        <strong>{order.customerName}</strong>
                        <small>
                          {dateTime(order.createdAt)} · {order.payment} · {order.delivery}
                        </small>
                      </div>
                      <span className="badge gray">
                        <Clock3 size={15} /> pendente
                      </span>
                    </div>

                    <div className="pending-order-items">
                      {order.items.map((item) => (
                        <div key={`${order.id}-${item.variantId}`} className="row pending-item-row">
                          <span>
                            {item.productName} · {item.variantColor} / {item.variantSize}
                            {item.variantModel ? ` · ${item.variantModel}` : ""}
                          </span>
                          <span>
                            {item.quantity}× · {money(item.quantity * item.unitPrice)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="total-row total">
                      <span>Total</span>
                      <span>{money(subtotal)}</span>
                    </div>

                    <div className="inline-actions">
                      <button onClick={() => setSelected(order)} disabled={!online || busy}>
                        Preencher e confirmar
                      </button>
                      <button
                        className="ghost"
                        onClick={() => {
                          removePendingOrder(order.id);
                          refresh();
                        }}
                      >
                        <Trash2 size={16} /> Excluir
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {selected && (
        <Card className="pending-order-confirmation">
          <div className="card-head">
            <h2>Confirmar pedido pendente</h2>
            <CheckCheck size={20} />
          </div>
          <p className="fine">
            Cliente: <strong>{selected.customerName}</strong> · Pagamento desejado: {selected.payment} · Entrega: {selected.delivery}
          </p>

          <div className="pending-order-items confirmation-items">
            {selected.items.map((item) => (
              <div key={`${selected.id}-${item.variantId}`} className="row pending-item-row">
                <span>
                  {item.productName} · {item.variantColor} / {item.variantSize}
                  {item.variantModel ? ` · ${item.variantModel}` : ""}
                </span>
                <span>
                  {item.quantity}× · {money(item.quantity * item.unitPrice)}
                </span>
              </div>
            ))}
          </div>

          <Field label="Cliente da venda" name="customer">
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Consumidor final</option>
              {data.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Forma de pagamento" name="payment-method">
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              {methods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Observação" name="notes">
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalhes do pedido, observações ou entrega" />
          </Field>

          <div className="inline-actions">
            <button onClick={() => void confirmOrder(selected)} disabled={busy || !online}>
              {busy ? "Registrando…" : "Confirmar venda"}
            </button>
            <button className="ghost" onClick={() => setSelected(null)}>
              Fechar
            </button>
          </div>
        </Card>
      )}
    </>
  );
}
