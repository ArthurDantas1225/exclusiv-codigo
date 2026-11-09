import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { calculatePromotions, parsePromotions } from "../_shared/promotions.ts";

const catalogOrdersUrl = "https://sduacssupdhzwqmlijqv.supabase.co/functions/v1/catalog-orders";
const origins = new Set(["https://exclusiv-codigo.vercel.app", "http://localhost:3000"]);
const reply = (status: number, body: unknown, headers: Record<string, string>) => new Response(JSON.stringify(body), { status, headers });
type ProductVariantRow = { id: string; product_id: string; stock: number; products: { id: string; category: string; subcategory: string; price: number; active: boolean } };

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origins.has(origin) ? origin : "https://exclusiv-codigo.vercel.app",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "Origin",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST" || (origin && !origins.has(origin))) return reply(403, { error: "Origem não permitida." }, headers);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Entre novamente para continuar." }, headers);
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return reply(400, { error: "Venda inválida." }, headers); }
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return reply(503, { error: "Serviço de vendas temporariamente indisponível." }, headers);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return reply(401, { error: "Sessão inválida." }, headers);
  const { data: profile } = await admin.from("profiles").select("organization_id,role,active").eq("id", auth.user.id).maybeSingle();
  if (!profile?.active || profile.role !== "admin") return reply(403, { error: "Somente sócios administradores podem registrar vendas." }, headers);

  const requestId = String(payload.request_id ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return reply(400, { error: "Identificador da venda inválido." }, headers);
  const { data: previous } = await admin.from("operation_keys").select("result").eq("organization_id", profile.organization_id).eq("request_id", requestId).maybeSingle();
  if (previous?.result?.id) return reply(200, previous.result, headers);
  const items = Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : [];
  const source: "app" | "catalog" = payload.promotion_source === "catalog" ? "catalog" : "app";
  if (!items.length || items.length > 100 || items.some((item) => typeof item.variant_id !== "string" || !Number.isInteger(item.quantity) || Number(item.quantity) < 1)) return reply(400, { error: "Revise os itens da venda." }, headers);
  const variantIds = items.map((item) => String(item.variant_id));
  if (new Set(variantIds).size !== variantIds.length) return reply(400, { error: "O carrinho contém opções repetidas." }, headers);
  const { data: variantRows, error: variantError } = await admin.from("product_variants")
    .select("id,product_id,stock,products!inner(id,category,subcategory,price,active)")
    .eq("organization_id", profile.organization_id).in("id", variantIds);
  if (variantError) return reply(503, { error: "Não foi possível validar os produtos da venda." }, headers);
  const variants = new Map(((variantRows ?? []) as unknown as ProductVariantRow[]).map((variant) => [variant.id, variant]));
  const lines = [];
  let gross = 0;
  for (const item of items) {
    const variant = variants.get(String(item.variant_id));
    const quantity = Number(item.quantity);
    if (!variant || (source === "app" && !variant.products.active) || variant.stock < quantity) return reply(409, { error: "Estoque alterado. Revise o carrinho." }, headers);
    const unitPrice = source === "catalog" ? Number(item.unit_price) : variant.products.price;
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || (source === "app" && unitPrice !== variant.products.price)) return reply(409, { error: "O preço de um produto foi atualizado. Revise o carrinho." }, headers);
    gross += unitPrice * quantity;
    if (!Number.isSafeInteger(gross)) return reply(400, { error: "O total da venda excede o limite permitido." }, headers);
    lines.push({ productId: variant.product_id, category: variant.products.category, subcategory: variant.products.subcategory ?? "", unitPrice, quantity });
  }
  const { data: setting, error: settingError } = await admin.from("app_settings").select("value").eq("organization_id", profile.organization_id).eq("key", "promotions").maybeSingle();
  if (settingError) return reply(503, { error: "Não foi possível confirmar as promoções." }, headers);
  const config = parsePromotions(setting?.value);
  if (source === "app" && Number(payload.promotion_version ?? 0) !== config.version) return reply(409, { error: "As promoções foram atualizadas. Recarregue a venda e tente novamente." }, headers);

  let promotionDiscount: number;
  let campaignIds: string[];
  let manualDiscount = Number(payload.manual_discount ?? payload.discount ?? 0);
  if (source === "catalog") {
    const orderId = String(payload.promotion_order_id ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) return reply(400, { error: "Pedido do catálogo inválido." }, headers);
    const remoteResponse = await fetch(catalogOrdersUrl, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ action: "get_for_sale", order_id: orderId }) }).catch(() => null);
    const remote = remoteResponse?.ok ? await remoteResponse.json().catch(() => null) : null;
    const order = remote?.order;
    if (!order) return reply(409, { error: "Não foi possível confirmar o pedido original do catálogo." }, headers);
    const submitted = items.map((item) => `${item.variant_id}:${item.quantity}:${item.unit_price}`).sort();
    const frozen = (order.catalog_order_items ?? []).map((item: { variant_id: string; quantity: number; unit_price: number }) => `${item.variant_id}:${item.quantity}:${item.unit_price}`).sort();
    promotionDiscount = Number(order.promotion_discount);
    campaignIds = order.promotion_campaign_ids ?? [];
    manualDiscount = 0;
    if (!(["pending", "failed"].includes(order.status)) || order.id !== orderId || order.subtotal !== gross || order.total !== Number(payload.discount === undefined ? -1 : gross - Number(payload.discount)) || Number(payload.discount) !== promotionDiscount || Number(payload.promotion_discount) !== promotionDiscount || Number(payload.promotion_version) !== order.promotion_version || JSON.stringify(submitted) !== JSON.stringify(frozen)) return reply(409, { error: "O pedido ou os valores foram alterados. Recarregue os pedidos pendentes." }, headers);
  } else {
    const result = calculatePromotions(config.campaigns, lines, "app");
    promotionDiscount = result.discount;
    campaignIds = result.campaignIds;
    if (!Number.isSafeInteger(manualDiscount) || manualDiscount < 0 || manualDiscount >= gross - promotionDiscount) return reply(400, { error: "O total da venda precisa permanecer acima de zero." }, headers);
  }
  const validated = { ...payload, discount: promotionDiscount + manualDiscount, manual_discount: manualDiscount,
    promotion_discount: promotionDiscount, promotion_campaign_ids: campaignIds,
    promotion_version: source === "catalog" ? Number(payload.promotion_version) : config.version,
    promotion_source: source, ...(source === "catalog" ? { promotion_order_id: payload.promotion_order_id } : {}) };
  const authenticated = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { authorization: `Bearer ${token}` } } });
  const { data: result, error } = await authenticated.rpc("sale_with_promotions", { p: validated });
  if (error) return reply(400, { error: error.message }, headers);
  return reply(200, result, headers);
});
