"use client";
import { useState } from "react";
import { useStore } from "./provider";
import { Card, Field } from "./ui";
import { parsePromotions, type PromotionCampaign } from "@/lib/promotions";

const fresh = (): PromotionCampaign => ({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), name: "", active: true, channels: ["app", "catalog"], productIds: [], categories: [], priority: 0, type: "percent_tiers", tiers: [{ quantity: 3, percent: 10 }] });

export function PromotionSettings() {
  const { data, run, busy, notify } = useStore();
  const current = parsePromotions(data.app_settings.find((entry) => entry.key === "promotions")?.value);
  const [form, setForm] = useState<PromotionCampaign | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [tiersText, setTiersText] = useState("3:10, 5:15");
  const [categoryText, setCategoryText] = useState("");

  function edit(campaign?: PromotionCampaign) {
    const next = campaign ? { ...campaign } : fresh();
    setForm(next);
    setTiersText((next.tiers ?? []).map((tier) => `${tier.quantity}:${tier.percent}`).join(", "));
    setCategoryText((next.categories ?? []).join(", "));
  }

  async function publish(campaigns: PromotionCampaign[]) {
    if (publishing || busy) return;
    setPublishing(true);
    try {
      const result = await run("promotions_save", { expected_version: current.version, campaigns });
      if (!result) return;
      setForm(null);
      notify("Promoção atualizada no app e no catálogo.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível publicar a promoção.");
    } finally { setPublishing(false); }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const values = new FormData(event.currentTarget);
    const type = String(values.get("type")) as PromotionCampaign["type"];
    const scopeProducts = values.getAll("productIds").map(String);
    const tierParts = tiersText.split(",").map((entry) => entry.trim()).filter(Boolean);
    const tiers = tierParts.map((entry) => { const [quantity, percent] = entry.split(":").map(Number); return { quantity, percent }; });
    const campaign: PromotionCampaign = {
      ...form,
      name: String(values.get("name") ?? "").trim(),
      active: values.get("active") === "on",
      type,
      channels: [values.get("channel_app") ? "app" : null, values.get("channel_catalog") ? "catalog" : null].filter((channel): channel is "app" | "catalog" => !!channel),
      startsAt: String(values.get("startsAt") ?? "") || undefined,
      endsAt: String(values.get("endsAt") ?? "") || undefined,
      productIds: scopeProducts,
      categories: categoryText.split(",").map((item) => item.trim()).filter(Boolean),
      priority: Number(values.get("priority") || 0),
      tiers,
      minQuantity: Number(values.get("minQuantity") || 1),
      discountCents: Math.round(Number(values.get("discount") || 0) * 100),
      bundleQuantity: Number(values.get("bundleQuantity") || 1),
      bundlePriceCents: Math.round(Number(values.get("bundlePrice") || 0) * 100),
      buyQuantity: Number(values.get("buyQuantity") || 1),
      freeQuantity: Number(values.get("freeQuantity") || 1),
    };
    if (!campaign.name || !campaign.channels.length || (campaign.startsAt && campaign.endsAt && campaign.startsAt > campaign.endsAt) || (type === "percent_tiers" && (!tiers.length || tiers.length > 10 || tiers.some((tier, index) => !Number.isInteger(tier.quantity) || tier.quantity < 1 || !Number.isFinite(tier.percent) || tier.percent < 1 || tier.percent > 90 || (index > 0 && tier.quantity <= tiers[index - 1].quantity)))) || (type === "fixed" && (campaign.minQuantity! < 1 || campaign.discountCents! <= 0)) || (type === "bundle" && (campaign.bundleQuantity! < 2 || campaign.bundlePriceCents! < 0)) || (type === "buy_get" && (campaign.buyQuantity! < 1 || campaign.freeQuantity! < 1 || campaign.buyQuantity! + campaign.freeQuantity! > 10))) {
      notify("Revise o nome, o canal e os valores da promoção.");
      return;
    }
    const campaigns = [...current.campaigns.filter((item) => item.id !== campaign.id), campaign];
    if (campaigns.length > 20) { notify("O limite é de 20 promoções cadastradas."); return; }
    await publish(campaigns);
  }

  async function remove(id: string) {
    await publish(current.campaigns.filter((campaign) => campaign.id !== id));
  }

  return <Card>
    <div className="row"><div><h2>Promoções por quantidade</h2><p className="fine">Versão {current.version || "—"} · Regras salvas aqui são usadas no app e no catálogo.</p></div><button className="primary" disabled={publishing || busy} onClick={() => edit()}>Nova promoção</button></div>
    {!current.campaigns.length && <p className="fine section-gap">Ainda não há promoções cadastradas.</p>}
    {current.campaigns.map((campaign) => <div className="row" key={campaign.id}>
      <div><strong>{campaign.name}</strong><small>{campaign.active ? "Ativa" : "Pausada"} · {campaign.type.replaceAll("_", " ")} · {campaign.channels.join(" e ")}</small></div>
      <div className="team-actions"><button className="ghost" disabled={publishing || busy} onClick={() => edit(campaign)}>Editar</button><button className="ghost" disabled={publishing || busy} onClick={() => void remove(campaign.id)}>Excluir</button></div>
    </div>)}
    {form && <form key={form.id} className="promotion-form section-gap" onSubmit={save}>
      <h3>{current.campaigns.some((item) => item.id === form.id) ? "Editar promoção" : "Criar promoção"}</h3>
      <div className="form-grid">
        <Field name="name" label="Nome da promoção" value={form.name} required />
        <Field name="type" label="Formato"><select name="type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as PromotionCampaign["type"] })}><option value="percent_tiers">Desconto percentual por quantidade</option><option value="fixed">Desconto fixo acima de uma quantidade</option><option value="bundle">Preço fechado por grupo de peças</option><option value="buy_get">Compre X e ganhe Y</option></select></Field>
        <Field name="startsAt" label="Início (opcional)"><input name="startsAt" type="date" defaultValue={form.startsAt} /></Field><Field name="endsAt" label="Fim (opcional)"><input name="endsAt" type="date" defaultValue={form.endsAt} /></Field>
        <Field name="categories" label="Categorias (separadas por vírgula)"><input name="categories" value={categoryText} onChange={(event) => setCategoryText(event.target.value)} placeholder="Camisa, Short" /></Field>
        <div className="field"><span>Produtos específicos (opcional)</span><div className="promotion-product-list">{data.products.filter((product) => product.active).map((product) => <label key={product.id}><input type="checkbox" name="productIds" value={product.id} defaultChecked={form.productIds.includes(product.id)} />{product.name}</label>)}</div></div>
        {form.type === "percent_tiers" && <Field name="tiers" label="Faixas: quantidade:desconto %, separadas por vírgula"><input value={tiersText} onChange={(event) => setTiersText(event.target.value)} placeholder="3:10, 5:15" /></Field>}
        {form.type === "fixed" && <><Field name="minQuantity" label="Quantidade mínima"><input name="minQuantity" type="number" min="1" defaultValue={form.minQuantity ?? 3} /></Field><Field name="discount" label="Desconto fixo (R$)"><input name="discount" type="number" min="0.01" step="0.01" defaultValue={(form.discountCents ?? 500) / 100} /></Field></>}
        {form.type === "bundle" && <><Field name="bundleQuantity" label="Peças por grupo"><input name="bundleQuantity" type="number" min="2" defaultValue={form.bundleQuantity ?? 3} /></Field><Field name="bundlePrice" label="Preço do grupo (R$)"><input name="bundlePrice" type="number" min="0" step="0.01" defaultValue={(form.bundlePriceCents ?? 0) / 100} /></Field></>}
        {form.type === "buy_get" && <><Field name="buyQuantity" label="Peças pagas"><input name="buyQuantity" type="number" min="1" defaultValue={form.buyQuantity ?? 2} /></Field><Field name="freeQuantity" label="Peças grátis"><input name="freeQuantity" type="number" min="1" defaultValue={form.freeQuantity ?? 1} /></Field></>}
      </div>
      <label className="checkbox-line"><input type="checkbox" name="channel_app" defaultChecked={form.channels.includes("app")} /> Aplicativo (vendas)</label>
      <label className="checkbox-line"><input type="checkbox" name="channel_catalog" defaultChecked={form.channels.includes("catalog")} /> Catálogo online</label>
      <label className="checkbox-line"><input type="checkbox" name="active" defaultChecked={form.active} /> Promoção ativa</label>
      <Field name="priority" label="Prioridade (menor número vence em empate)"><input name="priority" type="number" min="0" defaultValue={form.priority} /></Field>
      <div className="team-actions section-gap"><button className="primary" disabled={publishing || busy}>{publishing ? "Publicando…" : "Salvar e publicar"}</button><button type="button" className="ghost" onClick={() => setForm(null)}>Cancelar</button></div>
    </form>}
  </Card>;
}
