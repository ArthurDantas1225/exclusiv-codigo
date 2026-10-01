<<<<<<< HEAD
"use client";
import { useState } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";
import { useStore } from "./provider";
import { Card, Empty, Sheet, Field, Form } from "./ui";
import { money, dateTime, day, downloadCSV, dataUrlToFile } from "@/lib/format";
import { WhatsAppSheet } from "./customers";
const statuses: Record<string, string> = {
  completed: "Concluída",
  cancelled: "Cancelada",
  returned: "Devolvida",
  partially_returned: "Devolução parcial",
};
export function Sales({ id }: { id?: string }) {
  const { data, run, busy, notify } = useStore();
  const [modal, setModal] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(day()),
    [status, setStatus] = useState(""),
    [sellerFilter, setSellerFilter] = useState(""),
    [query, setQuery] = useState("");
  const sale = data.sales.find((s) => s.id === id),
    items = data.sale_items.filter((i) => i.sale_id === id),
    customer = data.customers.find((c) => c.id === sale?.customer_id);
  const actorName = (actor?: string) =>
    data.profiles.find((p) => p.id === actor)?.name ?? "Equipe EXCLUSIV";
  const companyName = data.app_settings.find((s) => s.key === "company_name")?.value || "EXCLUSIV";
  const payments = data.sale_payments.filter((p) => p.sale_id === id);
  const list = data.sales.filter(
    (s) =>
      (!start || day(new Date(s.created_at)) >= start) &&
      day(new Date(s.created_at)) <= end &&
      (!status || s.status === status) &&
      (!sellerFilter || s.created_by === sellerFilter) &&
      (
        String(s.number) +
        " " +
        (data.customers.find((c) => c.id === s.customer_id)?.name ?? "")
      )
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const receipt = sale
    ? `${companyName} · Comprovante de venda #${sale.number}\n${dateTime(sale.created_at)}\nCliente: ${customer?.name ?? "Consumidor final"}\nAtendimento: ${actorName(sale.created_by)}\n${items.map((i) => `${i.quantity} × ${i.product_name} (${i.variant_description}) — ${money(i.total)}`).join("\n")}\nSubtotal: ${money(sale.gross)}\nDesconto: ${money(sale.discount)}\nTotal: ${money(sale.total)}\n${payments.map((p) => `${p.method}: ${money(p.amount)}`).join("\n")}\nReferência: ${sale.id}\nEmitido pela ${companyName}. Comprovante não fiscal; não substitui NFC-e.`
    : "";
  const shareReceiptImage = async () => {
    const element = document.getElementById("comprovante-venda-wrapper");
    if (!element || !sale) {
      notify("Não foi possível localizar o comprovante para compartilhar.");
      return;
    }
    try {
      const width = Math.min(420, element.scrollWidth || 420);
      const height = Math.max(element.scrollHeight + 24, 680);
      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        width,
        height,
      });
      const file = dataUrlToFile(
        dataUrl,
        `comprovante-venda-${sale.number}-${sale.id.slice(0, 8)}.png`,
      );
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Comprovante EXCLUSIV #${sale.number}`,
          files: [file],
        });
        return;
      }
      const href = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = file.name;
      anchor.click();
      URL.revokeObjectURL(href);
      notify("Imagem do comprovante salva para download.");
    } catch {
      notify("Não foi possível gerar a imagem do comprovante.");
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">VENDAS / HISTÓRICO</div>
          <h1>{sale ? "Venda #" + sale.number : "Cada venda conta."}</h1>
          <p>
            {sale ? dateTime(sale.created_at) : "Consulte o movimento da loja."}
          </p>
        </div>
        <Link className="button primary" href="/app/vender">
          Nova venda
        </Link>
      </div>
      {sale ? (
        <>
          <div className="dashboard-grid">
            <div className="receipt-share-wrap" id="comprovante-venda-wrapper">
              <div className="receipt receipt-art" id="comprovante-venda">
                <div className="receipt-topline">COMPROVANTE DIGITAL / {companyName.toUpperCase()}</div>
                <div className="wordmark">EXCLUSIV®</div>
                <p>Venda #{sale.number} · {dateTime(sale.created_at)}</p>
                <div className="row">
                  <span>Cliente: {customer?.name ?? "Consumidor final"}</span>
                  <span>{statuses[sale.status]}</span>
                </div>
                <div className="row"><span>Atendimento</span><strong>{actorName(sale.created_by)}</strong></div>
                {items.map((i) => (
                  <div className="row" key={i.id}>
                    <div>
                      <strong>
                        {i.quantity} × {i.product_name}
                      </strong>
                      <small>
                        {i.variant_description}
                        {i.returned ? ` · ${i.returned} devolvido(s)` : ""}
                      </small>
                    </div>
                    <span>{money(i.total)}</span>
                  </div>
                ))}
                <div className="total-row">
                  <span>Subtotal</span>
                  <span>{money(sale.gross)}</span>
                </div>
                <div className="total-row">
                  <span>Desconto</span>
                  <span>− {money(sale.discount)}</span>
                </div>
                <div className="total-row total">
                  <span>Total</span>
                  <span>{money(sale.total)}</span>
                </div>
                {payments.map((p) => (
                    <div className="total-row" key={p.id}>
                      <span>{p.method}</span>
                      <span>{money(p.amount)}</span>
                    </div>
                  ))}
                <div className="receipt-signature"><strong>{companyName}</strong><span>Emitido pela loja · registro {sale.id.slice(0, 8).toUpperCase()}</span></div>
                <small>Referência completa: {sale.id}</small>
                <small className="receipt-legal">Comprovante não fiscal. Não substitui NFC-e ou nota fiscal autorizada pela SEFAZ.</small>
              </div>
            </div>
            <Card>
              <h2>Detalhes da venda</h2>
              <div className="row">
                <span>Status</span>
                <span className="badge gray">{statuses[sale.status]}</span>
              </div>
              <div className="row"><span>Venda registrada por</span><strong>{actorName(sale.created_by)}</strong></div>
              <div className="row">
                <span>Custo histórico</span>
                <span>{money(sale.cost)}</span>
              </div>
              <div className="row">
                <span>Lucro bruto original</span>
                <span>{money(sale.total - sale.cost)}</span>
              </div>
              <div className="row">
                <span>Dinheiro entregue / troco</span>
                <span>
                  {money(sale.tendered ?? 0)} / {money(sale.change_amount ?? 0)}
                </span>
              </div>
              <p className="fine">{sale.notes || "Sem observações."}</p>
              <div className="inline-actions">
                <button onClick={shareReceiptImage}>Compartilhar recibo</button>
                {customer && (
                  <button onClick={() => setModal("whatsapp")}>WhatsApp</button>
                )}
                <button onClick={() => window.print()}>Imprimir</button>
              </div>
              {sale.status === "completed" && (
                <button
                  className="danger full"
                  onClick={() => setModal("cancel")}
                >
                  Cancelar venda
                </button>
              )}
              {["completed", "partially_returned"].includes(sale.status) && (
                <button
                  className="ghost full"
                  onClick={() => setModal("return")}
                >
                  Devolução / troca
                </button>
              )}
            </Card>
          </div>
        </>
      ) : (
        <>
          <div className="toolbar">
            <input
              className="search-input"
              aria-label="Buscar vendas"
              placeholder="Número da venda ou cliente"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button onClick={() => downloadCSV("vendas", list)}>
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
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
          <div className="chips">
            <button
              onClick={() => {
                setStart(day());
                setEnd(day());
              }}
            >
              Hoje
            </button>
            <button
              onClick={() => {
                setStart(day(new Date(Date.now() - 7 * 86400000)));
                setEnd(day());
              }}
            >
              7 dias
            </button>
            <button
              onClick={() => {
                setStart(day().slice(0, 8) + "01");
                setEnd(day());
              }}
            >
              Este mês
            </button>
            <select
              aria-label="Status da venda"
              style={{ width: "auto" }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              {Object.entries(statuses).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select aria-label="Responsável pela venda" style={{ width: "auto" }} value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}>
              <option value="">Toda a equipe</option>
              {data.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <Card>
            {list.map((s) => (
              <Link key={s.id} href={"/app/vendas/" + s.id} className="row">
                <div>
                  <strong>
                    #{s.number} ·{" "}
                    {data.customers.find((c) => c.id === s.customer_id)?.name ??
                      "Consumidor final"}
                  </strong>
                  <small>
                    {dateTime(s.created_at)} · {statuses[s.status]} · {actorName(s.created_by)}
                  </small>
                </div>
                <span className="amount">{money(s.total)}</span>
              </Link>
            ))}
            {!list.length && (
              <Empty
                title="Nenhuma venda neste período"
                text="Altere os filtros ou registre uma nova venda."
              />
            )}
          </Card>
          <p className="fine">
            Consulta nos registros carregados. Totais completos estão em
            Relatórios.
          </p>
        </>
      )}
      {modal === "cancel" && (
        <Sheet title="Cancelar venda" close={() => setModal("")}>
          <p>
            O estoque será devolvido e os pagamentos serão estornados no
            registro financeiro. Efetue também o estorno externo quando
            necessário.
          </p>
          <Form
            busy={busy}
            label="Confirmar cancelamento"
            onSubmit={async (f) => {
              if (await run("cancel", { sale_id: id, reason: f.get("reason") }))
                setModal("");
            }}
          >
            <Field name="reason" label="Motivo" required />
          </Form>
        </Sheet>
      )}
      {modal === "return" && (
        <Sheet title="Devolução vinculada à venda" close={() => setModal("")}>
          <p className="fine">
            Para troca, devolva a peça e registre a nova venda. O crédito fica
            na conta e pode ser usado no pagamento da nova venda.
          </p>
          <Form
            busy={busy}
            label="Confirmar devolução"
            onSubmit={async (f) => {
              if (
                await run("return", {
                  sale_id: id,
                  item_id: f.get("item_id"),
                  quantity: Number(f.get("quantity")),
                  method: f.get("method"),
                  reason: f.get("reason"),
                })
              )
                setModal("");
            }}
          >
            <Field name="item_id" label="Item">
              <select name="item_id">
                {items
                  .filter((i) => i.returned < i.quantity)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.product_name} / {i.variant_description} (
                      {i.quantity - i.returned} disponível)
                    </option>
                  ))}
              </select>
            </Field>
            <Field
              name="quantity"
              label="Quantidade"
              type="number"
              min={1}
              value={1}
              required
            />
            <Field name="method" label="Destino do valor">
              <select name="method">
                <option>Pix</option>
                <option>Dinheiro</option>
                <option>Crédito na loja</option>
              </select>
            </Field>
            <Field name="reason" label="Motivo" required />
          </Form>
        </Sheet>
      )}
      {modal === "whatsapp" && customer && (
        <WhatsAppSheet
          customer={customer}
          message={receipt}
          close={() => setModal("")}
        />
      )}
    </>
  );
}
=======
"use client";
import { useState } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";
import { useStore } from "./provider";
import { Card, Empty, Sheet, Field, Form } from "./ui";
import { money, dateTime, day, downloadCSV, dataUrlToFile } from "@/lib/format";
import { WhatsAppSheet } from "./customers";
const statuses: Record<string, string> = {
  completed: "Concluída",
  cancelled: "Cancelada",
  returned: "Devolvida",
  partially_returned: "Devolução parcial",
};
export function Sales({ id }: { id?: string }) {
  const { data, run, busy, notify } = useStore();
  const [modal, setModal] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(day()),
    [status, setStatus] = useState(""),
    [sellerFilter, setSellerFilter] = useState(""),
    [query, setQuery] = useState("");
  const sale = data.sales.find((s) => s.id === id),
    items = data.sale_items.filter((i) => i.sale_id === id),
    customer = data.customers.find((c) => c.id === sale?.customer_id);
  const actorName = (actor?: string) =>
    data.profiles.find((p) => p.id === actor)?.name ?? "Equipe EXCLUSIV";
  const companyName = data.app_settings.find((s) => s.key === "company_name")?.value || "EXCLUSIV";
  const payments = data.sale_payments.filter((p) => p.sale_id === id);
  const list = data.sales.filter(
    (s) =>
      (!start || day(new Date(s.created_at)) >= start) &&
      day(new Date(s.created_at)) <= end &&
      (!status || s.status === status) &&
      (!sellerFilter || s.created_by === sellerFilter) &&
      (
        String(s.number) +
        " " +
        (data.customers.find((c) => c.id === s.customer_id)?.name ?? "")
      )
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const receipt = sale
    ? `${companyName} · Comprovante de venda #${sale.number}\n${dateTime(sale.created_at)}\nCliente: ${customer?.name ?? "Consumidor final"}\nAtendimento: ${actorName(sale.created_by)}\n${items.map((i) => `${i.quantity} × ${i.product_name} (${i.variant_description}) — ${money(i.total)}`).join("\n")}\nSubtotal: ${money(sale.gross)}\nDesconto: ${money(sale.discount)}\nTotal: ${money(sale.total)}\n${payments.map((p) => `${p.method}: ${money(p.amount)}`).join("\n")}\nReferência: ${sale.id}\nEmitido pela ${companyName}. Comprovante não fiscal; não substitui NFC-e.`
    : "";
  const shareReceiptImage = async () => {
    const element = document.getElementById("comprovante-venda-wrapper");
    if (!element || !sale) {
      notify("Não foi possível localizar o comprovante para compartilhar.");
      return;
    }
    try {
      const width = Math.min(420, element.scrollWidth || 420);
      const height = Math.max(element.scrollHeight + 24, 680);
      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        width,
        height,
      });
      const file = dataUrlToFile(
        dataUrl,
        `comprovante-venda-${sale.number}-${sale.id.slice(0, 8)}.png`,
      );
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Comprovante EXCLUSIV #${sale.number}`,
          files: [file],
        });
        return;
      }
      const href = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = file.name;
      anchor.click();
      URL.revokeObjectURL(href);
      notify("Imagem do comprovante salva para download.");
    } catch {
      notify("Não foi possível gerar a imagem do comprovante.");
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">VENDAS / HISTÓRICO</div>
          <h1>{sale ? "Venda #" + sale.number : "Cada venda conta."}</h1>
          <p>
            {sale ? dateTime(sale.created_at) : "Consulte o movimento da loja."}
          </p>
        </div>
        <Link className="button primary" href="/app/vender">
          Nova venda
        </Link>
      </div>
      {sale ? (
        <>
          <div className="dashboard-grid">
            <div className="receipt-share-wrap" id="comprovante-venda-wrapper">
              <div className="receipt receipt-art" id="comprovante-venda">
                <div className="receipt-topline">COMPROVANTE DIGITAL / {companyName.toUpperCase()}</div>
                <div className="wordmark">EXCLUSIV®</div>
                <p>Venda #{sale.number} · {dateTime(sale.created_at)}</p>
                <div className="row">
                  <span>Cliente: {customer?.name ?? "Consumidor final"}</span>
                  <span>{statuses[sale.status]}</span>
                </div>
                <div className="row"><span>Atendimento</span><strong>{actorName(sale.created_by)}</strong></div>
                {items.map((i) => (
                  <div className="row" key={i.id}>
                    <div>
                      <strong>
                        {i.quantity} × {i.product_name}
                      </strong>
                      <small>
                        {i.variant_description}
                        {i.returned ? ` · ${i.returned} devolvido(s)` : ""}
                      </small>
                    </div>
                    <span>{money(i.total)}</span>
                  </div>
                ))}
                <div className="total-row">
                  <span>Subtotal</span>
                  <span>{money(sale.gross)}</span>
                </div>
                <div className="total-row">
                  <span>Desconto</span>
                  <span>− {money(sale.discount)}</span>
                </div>
                <div className="total-row total">
                  <span>Total</span>
                  <span>{money(sale.total)}</span>
                </div>
                {payments.map((p) => (
                    <div className="total-row" key={p.id}>
                      <span>{p.method}</span>
                      <span>{money(p.amount)}</span>
                    </div>
                  ))}
                <div className="receipt-signature"><strong>{companyName}</strong><span>Emitido pela loja · registro {sale.id.slice(0, 8).toUpperCase()}</span></div>
                <small>Referência completa: {sale.id}</small>
                <small className="receipt-legal">Comprovante não fiscal. Não substitui NFC-e ou nota fiscal autorizada pela SEFAZ.</small>
              </div>
            </div>
            <Card>
              <h2>Detalhes da venda</h2>
              <div className="row">
                <span>Status</span>
                <span className="badge gray">{statuses[sale.status]}</span>
              </div>
              <div className="row"><span>Venda registrada por</span><strong>{actorName(sale.created_by)}</strong></div>
              <div className="row">
                <span>Custo histórico</span>
                <span>{money(sale.cost)}</span>
              </div>
              <div className="row">
                <span>Lucro bruto original</span>
                <span>{money(sale.total - sale.cost)}</span>
              </div>
              <div className="row">
                <span>Dinheiro entregue / troco</span>
                <span>
                  {money(sale.tendered ?? 0)} / {money(sale.change_amount ?? 0)}
                </span>
              </div>
              <p className="fine">{sale.notes || "Sem observações."}</p>
              <div className="inline-actions">
                <button onClick={shareReceiptImage}>Compartilhar recibo</button>
                {customer && (
                  <button onClick={() => setModal("whatsapp")}>WhatsApp</button>
                )}
                <button onClick={() => window.print()}>Imprimir</button>
              </div>
              {sale.status === "completed" && (
                <button
                  className="danger full"
                  onClick={() => setModal("cancel")}
                >
                  Cancelar venda
                </button>
              )}
              {["completed", "partially_returned"].includes(sale.status) && (
                <button
                  className="ghost full"
                  onClick={() => setModal("return")}
                >
                  Devolução / troca
                </button>
              )}
            </Card>
          </div>
        </>
      ) : (
        <>
          <div className="toolbar">
            <input
              className="search-input"
              aria-label="Buscar vendas"
              placeholder="Número da venda ou cliente"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button onClick={() => downloadCSV("vendas", list)}>
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
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
          <div className="chips">
            <button
              onClick={() => {
                setStart(day());
                setEnd(day());
              }}
            >
              Hoje
            </button>
            <button
              onClick={() => {
                setStart(day(new Date(Date.now() - 7 * 86400000)));
                setEnd(day());
              }}
            >
              7 dias
            </button>
            <button
              onClick={() => {
                setStart(day().slice(0, 8) + "01");
                setEnd(day());
              }}
            >
              Este mês
            </button>
            <select
              aria-label="Status da venda"
              style={{ width: "auto" }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              {Object.entries(statuses).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select aria-label="Responsável pela venda" style={{ width: "auto" }} value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}>
              <option value="">Toda a equipe</option>
              {data.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <Card>
            {list.map((s) => (
              <Link key={s.id} href={"/app/vendas/" + s.id} className="row">
                <div>
                  <strong>
                    #{s.number} ·{" "}
                    {data.customers.find((c) => c.id === s.customer_id)?.name ??
                      "Consumidor final"}
                  </strong>
                  <small>
                    {dateTime(s.created_at)} · {statuses[s.status]} · {actorName(s.created_by)}
                  </small>
                </div>
                <span className="amount">{money(s.total)}</span>
              </Link>
            ))}
            {!list.length && (
              <Empty
                title="Nenhuma venda neste período"
                text="Altere os filtros ou registre uma nova venda."
              />
            )}
          </Card>
          <p className="fine">
            Consulta nos registros carregados. Totais completos estão em
            Relatórios.
          </p>
        </>
      )}
      {modal === "cancel" && (
        <Sheet title="Cancelar venda" close={() => setModal("")}>
          <p>
            O estoque será devolvido e os pagamentos serão estornados no
            registro financeiro. Efetue também o estorno externo quando
            necessário.
          </p>
          <Form
            busy={busy}
            label="Confirmar cancelamento"
            onSubmit={async (f) => {
              if (await run("cancel", { sale_id: id, reason: f.get("reason") }))
                setModal("");
            }}
          >
            <Field name="reason" label="Motivo" required />
          </Form>
        </Sheet>
      )}
      {modal === "return" && (
        <Sheet title="Devolução vinculada à venda" close={() => setModal("")}>
          <p className="fine">
            Para troca, devolva a peça e registre a nova venda. O crédito fica
            na conta e pode ser usado no pagamento da nova venda.
          </p>
          <Form
            busy={busy}
            label="Confirmar devolução"
            onSubmit={async (f) => {
              if (
                await run("return", {
                  sale_id: id,
                  item_id: f.get("item_id"),
                  quantity: Number(f.get("quantity")),
                  method: f.get("method"),
                  reason: f.get("reason"),
                })
              )
                setModal("");
            }}
          >
            <Field name="item_id" label="Item">
              <select name="item_id">
                {items
                  .filter((i) => i.returned < i.quantity)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.product_name} / {i.variant_description} (
                      {i.quantity - i.returned} disponível)
                    </option>
                  ))}
              </select>
            </Field>
            <Field
              name="quantity"
              label="Quantidade"
              type="number"
              min={1}
              value={1}
              required
            />
            <Field name="method" label="Destino do valor">
              <select name="method">
                <option>Pix</option>
                <option>Dinheiro</option>
                <option>Crédito na loja</option>
              </select>
            </Field>
            <Field name="reason" label="Motivo" required />
          </Form>
        </Sheet>
      )}
      {modal === "whatsapp" && customer && (
        <WhatsAppSheet
          customer={customer}
          message={receipt}
          close={() => setModal("")}
        />
      )}
    </>
  );
}
>>>>>>> bc64b2f (fix: center receipt image when sharing)
