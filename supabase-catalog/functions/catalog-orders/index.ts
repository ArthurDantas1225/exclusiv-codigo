import { createClient } from "npm:@supabase/supabase-js@2.57.0";

import { normalizePixSettings } from "../_shared/inter-pix.ts";

const appOrigin = "https://exclusiv-codigo.vercel.app";
const allowedOrigins = new Set([appOrigin, "http://localhost:3000"]);
const erpUrl = "https://rznnojrtgolekdkcvxnv.supabase.co";
const erpKey = "sb_publishable_dggLRkn1mzZJFu6_Bp0Rsw_L56cJlu0";

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": allowedOrigins.has(origin) ? origin : appOrigin,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "Origin",
  };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST" || (origin && !allowedOrigins.has(origin))) return reply(403, { error: "Origem não permitida." });

  const catalogUrl = Deno.env.get("SUPABASE_URL");
  const catalogKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!catalogUrl || !catalogKey) return reply(503, { error: "Integração do catálogo não configurada." });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Sessão necessária." });
  const source = createClient(erpUrl, erpKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authError } = await source.auth.getUser(token);
  if (authError || !auth.user) return reply(401, { error: "Sessão inválida." });
  const { data: profile } = await source.from("profiles").select("id,role").eq("organization_id", "f993c345-a8ed-4ea4-a91d-b0f7f7946151").eq("id", auth.user.id).eq("active", true).maybeSingle();
  if (!profile) return reply(403, { error: "Acesso suspenso." });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return reply(400, { error: "Solicitação inválida." }); }
  const catalog = createClient(catalogUrl, catalogKey, { auth: { autoRefreshToken: false, persistSession: false } });

  if (body.action === "get_pix_settings") {
    if (profile.role !== "admin") return reply(403, { error: "Somente administradores podem configurar o Pix." });
    const { data, error } = await catalog.from("catalog_pix_settings").select("enabled,key,receiver_name,city").eq("id",true).single();
    return error ? reply(502,{ error: "Não foi possível carregar o Pix." }) : reply(200,{ settings: { enabled: data.enabled,key: data.key,receiverName: data.receiver_name,city: data.city } });
  }
  if (body.action === "save_pix_settings") {
    if (profile.role !== "admin") return reply(403, { error: "Somente administradores podem configurar o Pix." });
    let config;
    try { config = normalizePixSettings(body.settings as Record<string, unknown>); }
    catch { return reply(400,{error: "Informe a chave aleatória, o titular e a cidade corretamente."}); }
    const { error } = await catalog.from("catalog_pix_settings").update({enabled: config.enabled,key: config.key,receiver_name:config.receiverName,city:config.city,updated_by:auth.user.id,updated_at:new Date().toISOString()}).eq("id",true);
    return error ? reply(502,{error:"Não foi possível salvar o Pix."}) : reply(200,{ok:true});
  }
  if (body.action === "mark_paid") {
    const orderId = String(body.order_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return reply(400,{error:"Pedido inválido."});
    const { data,error } = await catalog.rpc("mark_catalog_pix_paid",{p_order_id:orderId,p_actor:auth.user.id});
    return error ? reply(409,{error:"Este pedido não está disponível para confirmação de pagamento."}) : reply(200,data);
  }

  if (body.action === "get_for_sale") {
    const orderId = String(body.order_id ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) return reply(400, { error: "Pedido inválido." });
    const { data, error } = await catalog.from("catalog_orders")
      .select("id,code,status,payment_status,subtotal,promotion_discount,promotion_version,promotion_campaign_ids,total,catalog_order_items(product_id,product_name,variant_id,model,color,size,quantity,unit_price)")
      .eq("id", orderId).maybeSingle();
    if (error) return reply(502, { error: "Não foi possível confirmar o pedido." });
    if (!data || !["pending", "failed"].includes(data.status)) return reply(409, { error: "Pedido não está aguardando confirmação." });
    if (data.payment_status === "awaiting_verification") return reply(409, { error: "Confira o Pix no Inter e confirme o pagamento antes de registrar a venda." });
    return reply(200, { order: data });
  }

  if (body.action === "list") {
    const { data, error } = await catalog.from("catalog_orders")
      .select("id,code,created_at,customer_name,payment,delivery,subtotal,total,promotion_discount,promotion_campaign_ids,promotion_version,status,payment_status,payment_confirmed_at,catalog_order_items(product_id,product_name,variant_id,model,color,size,quantity,unit_price)")
      .in("status", ["pending", "failed", "importing"]).order("created_at", { ascending: false }).limit(200);
    return error ? reply(502, { error: "Não foi possível carregar os pedidos." }) : reply(200, { orders: data ?? [] });
  }

  if (body.action === "import_legacy") {
    const { data, error } = await catalog.rpc("create_catalog_order", { p: body.order });
    return error ? reply(409, { error: "Pedido antigo precisa ser revisado antes da importação." }) : reply(200, { order: data });
  }

  if (body.action === "confirm") {
    const orderId = String(body.order_id ?? "");
    const saleId = String(body.sale_id ?? "");
    const { data: existing } = await catalog.from("catalog_orders").select("status,source_sale_id,payment_status").eq("id", orderId).maybeSingle();
    if (existing?.status === "confirmed") {
      return existing.source_sale_id === saleId ? reply(200, { ok: true }) : reply(409, { error: "Pedido já vinculado a outra venda." });
    }
    if (!existing || !["pending","failed","importing"].includes(existing.status)) return reply(409,{error:"Pedido indisponível para confirmação."});
    if (existing.payment_status === "awaiting_verification") return reply(409,{error:"Confira e confirme o Pix no Inter antes de registrar a venda."});
    const { data: sale, error: saleError } = await source.from("sales").select("id").eq("id",saleId).eq("request_id",orderId).eq("organization_id","f993c345-a8ed-4ea4-a91d-b0f7f7946151").eq("status","completed").maybeSingle();
    if (saleError || !sale) return reply(409,{error:"A venda vinculada a este pedido não foi encontrada."});
    const { error } = await catalog.from("catalog_orders").update({ status: "confirmed", source_sale_id: saleId, last_error: null, updated_at: new Date().toISOString() }).eq("id", orderId).in("status", ["pending", "failed", "importing"]);
    if (!error) await catalog.from("catalog_sync_events").update({ status: "processed", updated_at: new Date().toISOString() }).eq("aggregate_id", orderId).eq("event_type", "order.created");
    return error ? reply(502, { error: "Venda salva; não foi possível concluir o pedido remoto." }) : reply(200, { ok: true });
  }

  if (body.action === "cancel") {
    const { error } = await catalog.from("catalog_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", String(body.order_id ?? "")).in("status", ["pending", "failed"]);
    return error ? reply(502, { error: "Não foi possível cancelar o pedido." }) : reply(200, { ok: true });
  }

  return reply(400, { error: "Ação inválida." });
});
