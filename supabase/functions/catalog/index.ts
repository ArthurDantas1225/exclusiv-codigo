import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const site = "https://exclusiv-codigo.vercel.app";
const origins = new Set([site, "https://exclusiv-catalogo.vercel.app", "http://localhost:3000"]);

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origins.has(origin) ? origin : site,
    "access-control-allow-headers": "apikey, content-type",
    "access-control-allow-methods": "GET, OPTIONS",
    "cache-control": "no-store",
    vary: "Origin",
  };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "GET" || (origin && !origins.has(origin)))
    return reply(403, { error: "Método ou origem não permitido." });

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply(503, { error: "Catálogo indisponível." });
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: shop, error: shopError } = await admin.from("organizations")
    .select("id,name").eq("public_slug", "exclusiv").maybeSingle();
  if (shopError || !shop) return reply(503, { error: "Loja indisponível." });
  const promotions = async () => {
    const { data, error } = await admin.from("app_settings").select("value").eq("organization_id", shop.id).eq("key", "promotions").maybeSingle();
    if (error) throw error;
    let config: { version?: number; campaigns?: Record<string, unknown>[] } = {};
    try { config = JSON.parse(data?.value ?? "{}"); } catch { /* Invalid settings are never published. */ }
    const project = (campaign: Record<string, unknown>) => ({
      id: campaign.id, createdAt: campaign.createdAt, name: campaign.name, active: campaign.active === true,
      channels: Array.isArray(campaign.channels) ? campaign.channels.filter((channel) => channel === "app" || channel === "catalog") : [],
      startsAt: typeof campaign.startsAt === "string" ? campaign.startsAt : undefined,
      endsAt: typeof campaign.endsAt === "string" ? campaign.endsAt : undefined,
      productIds: Array.isArray(campaign.productIds) ? campaign.productIds.filter((id) => typeof id === "string") : [],
      categories: Array.isArray(campaign.categories) ? campaign.categories.filter((value) => typeof value === "string") : [],
      priority: Number.isSafeInteger(campaign.priority) ? campaign.priority : 0,
      type: ["percent_tiers", "fixed", "bundle", "buy_get"].includes(String(campaign.type)) ? campaign.type : "invalid",
      tiers: Array.isArray(campaign.tiers) ? campaign.tiers.filter((tier) => tier && typeof tier === "object" && Number.isSafeInteger((tier as Record<string, unknown>).quantity) && typeof (tier as Record<string, unknown>).percent === "number").map((tier) => ({ quantity: (tier as Record<string, number>).quantity, percent: (tier as Record<string, number>).percent })) : [], minQuantity: campaign.minQuantity,
      discountCents: campaign.discountCents, bundleQuantity: campaign.bundleQuantity,
      bundlePriceCents: campaign.bundlePriceCents, buyQuantity: campaign.buyQuantity, freeQuantity: campaign.freeQuantity,
    });
    return { version: Number.isSafeInteger(config.version) ? config.version : 0,
      campaigns: Array.isArray(config.campaigns) ? config.campaigns.filter((campaign) => campaign && typeof campaign === "object").map(project) : [] };
  };
  let promotionData: Awaited<ReturnType<typeof promotions>>;
  try { promotionData = await promotions(); }
  catch { return reply(503, { error: "Promoções temporariamente indisponíveis." }); }
  if (new URL(request.url).searchParams.get("view") === "promotions") return reply(200, promotionData);
  const { data: products, error: productError } = await admin.from("products")
    .select("id,name,category,subcategory,collection,price")
    .eq("organization_id", shop.id).eq("active", true).eq("catalog_visible", true)
    .order("created_at", { ascending: false }).limit(100);
  if (productError) return reply(503, { error: "Catálogo indisponível." });
  if (!products?.length) return reply(200, { shop: shop.name, products: [] });
  const ids = products.map((p) => p.id);
  const [{ data: variants, error: variantError }, { data: images, error: imageError }] = await Promise.all([
    admin.from("product_variants").select("id,product_id,size,color,model,stock")
      .eq("organization_id", shop.id).in("product_id", ids).gt("stock", 0).limit(1000),
    admin.from("product_images").select("id,product_id,path,color,view,is_primary")
      .eq("organization_id", shop.id).in("product_id", ids).is("hidden_at", null)
      .order("is_primary", { ascending: false }).order("created_at", { ascending: true }).limit(500),
  ]);
  if (variantError || imageError) return reply(503, { error: "Catálogo indisponível." });
  const selectedImages: NonNullable<typeof images> = [];
  const photoCounts = new Map<string, number>();
  for (const image of images ?? []) {
    if (!image.path.startsWith(`${shop.id}/${image.product_id}/`) ||
      (photoCounts.get(image.product_id) ?? 0) >= 30) continue;
    selectedImages.push(image);
    photoCounts.set(image.product_id, (photoCounts.get(image.product_id) ?? 0) + 1);
  }
  const media = new Map<string, { id: string; url: string; color: string; view: string; is_primary: boolean }[]>();
  if (selectedImages.length) {
    selectedImages.forEach((image) => {
      const { data } = admin.storage.from("products").getPublicUrl(image.path);
      const url = data.publicUrl;
      media.set(image.product_id, [...(media.get(image.product_id) ?? []), {
        id: image.id, url, color: image.color, view: image.view, is_primary: image.is_primary,
      }]);
    });
  }
  return reply(200, {
    shop: shop.name,
    ...promotionData,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      subcategory: p.subcategory,
      collection: p.collection,
      price: p.price,
      image: media.get(p.id)?.[0]?.url ?? null,
      images: media.get(p.id) ?? [],
      variants: (variants ?? []).filter((v) => v.product_id === p.id),
    })),
  });
});
