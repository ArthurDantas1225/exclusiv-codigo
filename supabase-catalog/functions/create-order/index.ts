import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { calculate, type Campaign, type Line } from "../_shared/promotions.ts";
import { createWhatsAppMessage, type ReceiptOrder } from "./receipt-message.ts";

type Input = {
  idempotencyKey?: string;
  customerName?: string;
  payment?: string;
  delivery?: string;
  promotionVersion?: number;
  items?: { variantId?: string; quantity?: number }[];
};

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const reply = (status: number, body: unknown, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...cors } });

function validUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validate(input: Input) {
  if (!validUuid(input.idempotencyKey)) return "Identificador do pedido inválido.";
  if (!input.customerName?.trim() || input.customerName.trim().length > 120) return "Informe o nome do cliente.";
  if (!input.payment?.trim() || input.payment.length > 80) return "Forma de pagamento inválida.";
  if (!input.delivery?.trim() || input.delivery.length > 240) return "Forma de entrega inválida.";
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 30) return "Revise os itens do pedido.";
  if (!Number.isSafeInteger(input.promotionVersion) || input.promotionVersion! < 0) return "Atualize o catálogo antes de concluir o pedido.";
  if (input.items.some((item) => !validUuid(item.variantId) || !Number.isInteger(item.quantity) || item.quantity! < 1 || item.quantity! > 20)) return "Quantidade ou opção inválida.";
  const variantIds = input.items.map((item) => item.variantId);
  if (new Set(variantIds).size !== variantIds.length) return "Uma opção não pode aparecer duas vezes no pedido.";
  return null;
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

function receipt(order: ReceiptOrder) {
  const items = order.catalog_order_items.map((item) => ({ productName: item.product_name, model: item.model, color: item.color, size: item.size, quantity: item.quantity, unitPrice: item.unit_price }));
  const message = createWhatsAppMessage(order);
  return { id: order.id, code: order.code, subtotal: order.subtotal, discount: order.promotion_discount, promotionVersion: order.promotion_version, total: order.total, status: order.status, items, whatsappUrl: `https://wa.me/5584996008220?text=${encodeURIComponent(message)}` };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const allowed = new Set(["https://exclusiv-catalogo.vercel.app", "https://exclusiv-codigo.vercel.app", Deno.env.get("CATALOG_SITE_ORIGIN") ?? "", "http://localhost:3000"]);
  const cors = {
    "access-control-allow-origin": allowed.has(origin) ? origin : "",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "Origin",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST" || (origin && !allowed.has(origin))) return reply(403, { error: "Origem não permitida." }, cors);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply(503, { error: "Pedidos temporariamente indisponíveis." }, cors);
  let input: Input;
  try { input = await request.json(); }
  catch { return reply(400, { error: "Pedido inválido." }, cors); }
  const validation = validate(input);
  if (validation) return reply(400, { error: validation }, cors);

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const orderSelect = "id,code,subtotal,promotion_discount,promotion_version,promotion_summary,total,status,customer_name,payment,delivery,catalog_order_items(product_name,model,color,size,quantity,unit_price)";
  const { data: prior } = await admin.from("catalog_orders").select(orderSelect).eq("idempotency_key", input.idempotencyKey!).maybeSingle();
  if (prior) return reply(200, receipt(prior as unknown as ReceiptOrder), cors);
  const fingerprint = await sha256(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown");
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await admin.from("catalog_order_attempts").select("id", { count: "exact", head: true }).eq("fingerprint_hash", fingerprint).gte("created_at", since);
  if ((count ?? 0) >= 8) return reply(429, { error: "Muitas tentativas. Aguarde alguns minutos." }, cors);
  await admin.from("catalog_order_attempts").insert({ fingerprint_hash: fingerprint });
  const promoResponse = await fetch("https://rznnojrtgolekdkcvxnv.supabase.co/functions/v1/catalog?view=promotions", { cache: "no-store", signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!promoResponse?.ok) return reply(503, { error: "Não foi possível confirmar as promoções. Tente novamente." }, cors);
  const promoConfig = await promoResponse.json().catch(() => null) as { version?: number; campaigns?: Campaign[] } | null;
  if (!promoConfig || !Number.isSafeInteger(promoConfig.version) || input.promotionVersion !== promoConfig.version) return reply(409, { error: "As promoções foram atualizadas. Atualize o catálogo e revise o total." }, cors);
  const variantIds = input.items!.map((item) => item.variantId!);
  const { data: variants, error: variantError } = await admin.from("catalog_variants")
    .select("source_id,product_id,stock,catalog_products!inner(name,category,subcategory,price,published)")
    .in("source_id", variantIds);
  if (variantError) return reply(503, { error: "Não foi possível confirmar os produtos." }, cors);
  type VariantRow = { source_id: string; product_id: string; stock: number; catalog_products: { name: string; category: string; subcategory: string; price: number; published: boolean } };
  const variantMap = new Map((variants as unknown as VariantRow[] ?? []).map((variant) => [variant.source_id, variant]));
  let promoLines: Line[];
  try { promoLines = input.items!.map((item) => {
    const variant = variantMap.get(item.variantId!);
    if (!variant || !variant.catalog_products.published || variant.stock < item.quantity!) throw new Error("variant_unavailable");
    return { productId: variant.product_id, category: variant.catalog_products.category, subcategory: variant.catalog_products.subcategory ?? "", unitPrice: variant.catalog_products.price, quantity: item.quantity! };
  }); } catch { return reply(409, { error: "Uma das peças ficou indisponível. Revise o pedido." }, cors); }
  const promotion = calculate(promoConfig.campaigns ?? [], promoLines);
  promotion.version = promoConfig.version!;
  const { data: created, error: createError } = await admin.rpc("create_catalog_order", { p: { ...input, promotion: { version: promotion.version, subtotal: promotion.subtotal, discount: promotion.discount, campaignIds: promotion.campaignIds, applied: promotion.applied } } });
  if (createError) {
    const stock = createError.message.includes("insufficient_stock") || createError.message.includes("variant_unavailable");
    return reply(stock ? 409 : 400, { error: stock ? "Estoque insuficiente para esta opção." : "Não foi possível registrar o pedido." }, cors);
  }
  const { data: order, error: orderError } = await admin.from("catalog_orders")
    .select(orderSelect)
    .eq("id", created.id).single();
  if (orderError || !order) return reply(503, { error: "Pedido salvo; tente abrir novamente em instantes." }, cors);
  return reply(200, receipt(order as unknown as ReceiptOrder), cors);
});
