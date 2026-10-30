"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeAlert, BarChart3, ClipboardCheck, Contact, CreditCard, FileUp, HandCoins, Package, ReceiptText, Settings2, ShoppingCart, Sparkles, Truck } from "lucide-react";
import { Card, Field, Form } from "./ui";
import { useStore } from "./provider";
import { supabase } from "@/lib/supabase";
import { dateTime } from "@/lib/format";
export function Settings() {
  const { data, run, busy, profile, load } = useStore();
  const [tab, setTab] = useState("Loja");
  const [activityPerson, setActivityPerson] = useState("");
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamDone, setTeamDone] = useState("");
  async function teamAction(payload: Record<string, string>) {
    if (!supabase || teamBusy) return;
    setTeamBusy(true);
    setTeamError("");
    setTeamDone("");
    try {
      const { data: result, error } = await supabase.functions.invoke("manage-team", { body: payload });
      if (error || !result?.ok) {
        const details = error && "context" in error && error.context instanceof Response
          ? await error.context.json().catch(() => null)
          : result;
        throw new Error(details?.error ?? "Não foi possível alterar a equipe.");
      }
      await load();
      setTeamDone(payload.action === "invite" ? "Convite enviado. O novo sócio define a própria senha pelo e-mail." : "Acesso atualizado.");
      return true;
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : "Não foi possível alterar a equipe.");
      return false;
    } finally {
      setTeamBusy(false);
    }
  }
  const value = (key: string) =>
    data.app_settings.find((s) => s.key === key)?.value ?? "";
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PREFERÊNCIAS / EXCLUSIV</div>
          <h1>Do jeito da sua loja.</h1>
        </div>
      </div>
      <div className="chips">
        {["Loja", "Tamanhos", "Usuários", "Atividade", "Instalar"].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Loja" && (
        <Card>
          <h2>Dados da empresa</h2>
          <Form
            busy={busy}
            onSubmit={async (f) => {
              for (const key of [
                "company_name",
                "instagram",
                "whatsapp",
                "whatsapp_template",
              ]) {
                const saved = await run("setting", { key, value: f.get(key) });
                if (!saved) break;
              }
            }}
          >
            <Field
              name="company_name"
              label="Nome da loja"
              value={value("company_name") || "EXCLUSIV"}
            />
            <Field
              name="instagram"
              label="Instagram"
              value={value("instagram")}
            />
            <Field name="whatsapp" label="WhatsApp" value={value("whatsapp")} />
            <Field name="whatsapp_template" label="Modelo de mensagem">
              <textarea
                name="whatsapp_template"
                defaultValue={
                  value("whatsapp_template") ||
                  "Olá, {nome}! Tudo bem? Aqui é da EXCLUSIV."
                }
              />
            </Field>
            <p className="fine">
              Moeda: BRL · Fuso operacional: America/Fortaleza.
            </p>
          </Form>
        </Card>
      )}
      {tab === "Tamanhos" && (
        <Card>
          <h2>Grade de tamanhos</h2>
          <Form
            busy={busy}
            onSubmit={async (f) => {
              await run("setting", { key: "sizes", value: f.get("sizes") });
            }}
          >
            <Field
              name="sizes"
              label="Tamanhos separados por vírgulas"
              value={value("sizes") || "PP,P,M,G,GG,XG,38,40,42,44"}
              required
            />
            <p className="fine">
              A grade será usada ao cadastrar novas variações. SKUs existentes
              mantêm seus tamanhos.
            </p>
          </Form>
        </Card>
      )}
      {tab === "Usuários" && (
        <Card>
          <h2>Equipe e acesso</h2>
          {data.profiles.map((p) => (
            <div key={p.id} className="row">
              <div>
                <strong>{p.name}</strong>
                <small>{p.email} · {p.active ? "Acesso ativo" : "Acesso suspenso"}</small>
              </div>
              <div className="team-actions">
                <span className="badge gray">{p.role === "admin" ? "Administrador" : p.role}</span>
                {profile?.role === "admin" && profile.id !== p.id && <button
                  type="button"
                  className="ghost"
                  disabled={teamBusy}
                  onClick={() => void teamAction({ action: "set_active", userId: p.id })}
                >{p.active ? "Suspender" : "Reativar"}</button>}
              </div>
            </div>
          ))}
          {profile?.role === "admin" && <form className="team-invite" onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = new FormData(form);
            void teamAction({ action: "invite", name: String(values.get("name") ?? ""), email: String(values.get("email") ?? "") }).then((saved) => {
              if (saved && form.isConnected) form.reset();
            });
          }}>
            <h3>Convidar novo sócio administrador</h3>
            <p className="fine">Somente administradores convidam pessoas. O convidado recebe um link para definir a própria senha.</p>
            <div className="form-grid">
              <Field name="name" label="Nome completo" required />
              <Field name="email" label="E-mail" type="email" required />
            </div>
            <button className="primary" disabled={teamBusy}>{teamBusy ? "Enviando…" : "Enviar convite"}</button>
          </form>}
          {teamError && <p role="alert" className="negative section-gap">{teamError}</p>}
          {teamDone && <p role="status" className="positive section-gap">{teamDone}</p>}
          <p className="fine section-gap">O papel de funcionário ainda precisa de permissões próprias para vendas, estoque e dados financeiros antes de receber convites.</p>
        </Card>
      )}
      {tab === "Atividade" && <Card>
        <h2>Responsável por cada operação</h2>
        <p className="fine">Últimos registros carregados da organização. As mudanças antigas sem autor identificado aparecem como registro anterior.</p>
        <select aria-label="Filtrar atividade por pessoa" className="section-gap" value={activityPerson} onChange={(event) => setActivityPerson(event.target.value)}>
          <option value="">Toda a equipe</option>
          {data.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {data.audit_logs.filter((log) => !activityPerson || log.user_id === activityPerson).slice(0, 50).map((log) => <div className="row" key={log.id}>
          <div><strong>{({ sale: "Venda", product: "Produto", variant: "Variação", stock: "Estoque", customer: "Cliente", cancel: "Cancelamento", return: "Devolução", staff_invite: "Convite", staff_activate: "Acesso reativado", staff_deactivate: "Acesso suspenso" } as Record<string, string>)[log.action] ?? log.action}</strong>
            <small>{dateTime(log.created_at)} · {data.profiles.find((p) => p.id === log.user_id)?.name ?? "Usuário anterior"}</small></div>
          <span className="badge gray">{log.entity_id?.slice(0, 8) ?? "—"}</span>
        </div>)}
        {!data.audit_logs.length && <p className="fine section-gap">Nenhuma atividade registrada ainda.</p>}
      </Card>}
      {tab === "Instalar" && (
        <Card>
          <h2>EXCLUSIV na Tela de Início</h2>
          <p className="section-gap">
            No Safari do iPhone, abra Compartilhar e escolha “Adicionar à Tela
            de Início”. Use o endereço HTTPS publicado na Vercel.
          </p>
          <p className="fine">
            As operações precisam de internet. Dados financeiros não são
            gravados offline.
          </p>
        </Card>
      )}
    </>
  );
}
export function More() {
  const modules = [
    ["stylist", "Stylist IA", "Kits e roteiros para Stories", Sparkles],
    ["vendas", "Vendas", "Histórico, recibos e devoluções", ReceiptText],
    ["compras", "Compras", "Entradas de mercadoria e custos", ShoppingCart],
    ["fornecedores", "Fornecedores", "Contatos para reposição", Truck],
    ["financeiro/pagar", "Contas a pagar", "Despesas e vencimentos", CreditCard],
    ["financeiro", "Financeiro", "Caixa, entradas e recebimentos", HandCoins],
    ["produtos", "Produtos", "Fotos, preços e catálogo online", Package],
    ["inventario", "Inventário", "Conferência e ajustes de estoque", ClipboardCheck],
    ["importar", "Importar CSV", "Adicionar dados por planilha", FileUp],
    ["crm", "Relacionamento", "Tarefas e retorno aos clientes", Contact],
    ["relatorios", "Relatórios", "Indicadores de vendas e lucro", BarChart3],
    ["configuracoes", "Configurações", "Loja, equipe e permissões", Settings2],
    ["alertas", "Alertas", "Pendências da operação", BadgeAlert],
  ] as const;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TODA A OPERAÇÃO</div>
          <h1>Mais da EXCLUSIV.</h1>
          <p>Encontre as ferramentas da loja e entenda para que serve cada uma.</p>
        </div>
      </div>
      <div className="menu-grid">
        {modules.map(([url, label, description, Icon]) => (
          <Link href={"/app/" + url} key={url}>
            <span className="menu-icon"><Icon size={22} /></span>
            <span className="menu-copy"><strong>{label}</strong><small>{description}</small></span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </>
  );
}
export function Alerts() {
  const { data } = useStore();
  return (
    <>
      <div className="page-heading">
        <h1>Central de atenção.</h1>
      </div>
      <Card>
        <h2>Estoque baixo</h2>
        {data.product_variants
          .filter((v) => v.stock <= v.minimum)
          .map((v) => (
            <Link
              className="row"
              href={"/app/produtos/" + v.product_id}
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
          ))}
      </Card>
      <Card className="section-gap">
        <h2>Próximas conversas</h2>
        {data.crm_tasks
          .filter((t) => t.status === "pending")
          .map((t) => (
            <Link className="row" href="/app/crm" key={t.id}>
              <strong>{t.description}</strong>
              <span>{t.due_date.split("-").reverse().join("/")}</span>
            </Link>
          ))}
      </Card>
    </>
  );
}
