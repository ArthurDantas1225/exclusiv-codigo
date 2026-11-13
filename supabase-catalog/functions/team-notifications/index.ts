import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import webpush from "npm:web-push@3.6.7";
import { orderPushPayload, validPushSubscription } from "../_shared/team-push.ts";

const appOrigin = "https://exclusiv-codigo.vercel.app";
const erpUrl = "https://rznnojrtgolekdkcvxnv.supabase.co";
const erpKey = "sb_publishable_dggLRkn1mzZJFu6_Bp0Rsw_L56cJlu0";
const organizationId = "f993c345-a8ed-4ea4-a91d-b0f7f7946151";
const authOptions = { autoRefreshToken: false, persistSession: false };

async function sameSecret(left: string, right: string) {
  if (!left || !right) return false;
  const digest = (text: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  const av = new Uint8Array(a), bv = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < av.length; i++) difference |= av[i] ^ bv[i];
  return difference === 0;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin === appOrigin || origin === "http://localhost:3000" ? origin : appOrigin,
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "POST, OPTIONS", vary: "Origin",
  };
  const reply = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST" || (origin && origin !== appOrigin && origin !== "http://localhost:3000")) return reply(403, { error: "Origem não permitida." });
  if (Number(request.headers.get("content-length") ?? 0) > 12000) return reply(413, { error: "Solicitação muito grande." });
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply(503, { error: "Avisos não configurados." });
  const admin = createClient(url, key, { auth: authOptions });
  const { data: config, error: configError } = await admin.from("catalog_push_config").select("*").eq("id", true).maybeSingle();
  if (configError) return reply(503, { error: "Avisos temporariamente indisponíveis." });
  let input: Record<string, unknown>;
  try { const text = await request.text(); if (text.length > 12000) return reply(413, { error: "Solicitação muito grande." }); input = JSON.parse(text); }
  catch { return reply(400, { error: "Solicitação inválida." }); }
  if (!input || typeof input !== "object") return reply(400, { error: "Solicitação inválida." });

  if (input.action === "dispatch") {
    if (!config?.enabled || !await sameSecret(request.headers.get("x-dispatch-secret") ?? "", config.dispatch_secret)) return reply(403, { error: "Acesso não permitido." });
    try {
      webpush.setVapidDetails(config.subject, config.vapid_public_key, config.vapid_private_key);
      const { data: events, error: eventError } = await admin.rpc("catalog_claim_notifications");
      if (eventError) throw eventError;
      const erp = createClient(erpUrl, erpKey, { auth: authOptions });
      const memberships = new Map<string, boolean>();
      let delivered = 0;
      for (const event of events ?? []) {
        const { data: subscriptions, error: readError } = await admin.from("catalog_push_subscriptions").select("id,user_id,subscription").lte("created_at", event.created_at);
        if (readError) throw readError;
        let retry = false;
        for (const subscription of subscriptions ?? []) {
          if (!memberships.has(subscription.user_id)) {
            const { data: member, error: memberError } = await erp.rpc("is_catalog_notification_member", { p_user_id: subscription.user_id, p_secret: config.dispatch_secret });
            if (memberError) { retry = true; continue; }
            memberships.set(subscription.user_id, member === true);
          }
          if (!memberships.get(subscription.user_id)) {
            await admin.from("catalog_push_subscriptions").delete().eq("user_id", subscription.user_id);
            continue;
          }
          if (!validPushSubscription(subscription.subscription)) { await admin.from("catalog_push_subscriptions").delete().eq("id", subscription.id); continue; }
          const { data: previous, error: previousError } = await admin.from("catalog_push_deliveries").select("event_id").eq("event_id", event.id).eq("subscription_id", subscription.id).maybeSingle();
          if (previousError) { retry = true; continue; }
          if (previous) continue;
          try {
            await webpush.sendNotification(subscription.subscription, JSON.stringify(orderPushPayload(event)), { TTL: 3600, urgency: "high", timeout: 8000 });
            const { error: saveError } = await admin.from("catalog_push_deliveries").upsert({ event_id: event.id, subscription_id: subscription.id }, { onConflict: "event_id,subscription_id" });
            if (saveError) retry = true;
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) await admin.from("catalog_push_subscriptions").delete().eq("id", subscription.id);
            else retry = true;
          }
        }
        if (!retry) {
          const { error } = await admin.from("catalog_notification_outbox").update({ delivered_at: new Date().toISOString() }).eq("id", event.id);
          if (!error) delivered++;
        }
      }
      return reply(200, { delivered });
    } catch { return reply(503, { error: "Envio adiado. A fila tentará novamente." }); }
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Sessão necessária." });
  const erp = createClient(erpUrl, erpKey, { auth: authOptions, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: auth, error: authError } = await erp.auth.getUser(token);
  if (authError || !auth.user) return reply(401, { error: "Sessão inválida." });
  const { data: profile } = await erp.from("profiles").select("id").eq("id", auth.user.id).eq("active", true).eq("organization_id", organizationId).maybeSingle();
  if (!profile) return reply(403, { error: "Acesso suspenso." });
  if (input.action === "status") {
    let subscribed = false;
    if (typeof input.endpoint === "string") {
      const { data } = await admin.from("catalog_push_subscriptions").select("id").eq("user_id", auth.user.id).eq("endpoint", input.endpoint).maybeSingle();
      subscribed = !!data && !!config?.enabled;
    }
    return reply(200, { configured: !!config?.enabled, publicKey: config?.enabled ? config.vapid_public_key : undefined, subscribed });
  }
  if (input.action === "unsubscribe") {
    if (typeof input.endpoint !== "string") return reply(400, { error: "Dispositivo inválido." });
    const { error } = await admin.from("catalog_push_subscriptions").delete().eq("user_id", auth.user.id).eq("endpoint", input.endpoint);
    return error ? reply(503, { error: "Não foi possível desativar os avisos." }) : reply(200, { ok: true });
  }
  if (input.action === "subscribe") {
    if (!config?.enabled) return reply(503, { error: "Os avisos ainda não foram configurados." });
    if (!validPushSubscription(input.subscription)) return reply(400, { error: "Dispositivo de notificação inválido." });
    const { count } = await admin.from("catalog_push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id);
    const { data: existing } = await admin.from("catalog_push_subscriptions").select("id").eq("endpoint", input.subscription.endpoint).maybeSingle();
    if (!existing && (count ?? 0) >= 10) return reply(409, { error: "Limite de dez dispositivos por pessoa atingido." });
    const { error } = await admin.from("catalog_push_subscriptions").upsert({ user_id: auth.user.id, endpoint: input.subscription.endpoint, subscription: input.subscription, updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
    return error ? reply(503, { error: "Não foi possível ativar os avisos." }) : reply(200, { ok: true });
  }
  return reply(400, { error: "Ação inválida." });
});
