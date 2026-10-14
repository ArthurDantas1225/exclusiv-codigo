import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { buildCatalogProjection } from "../_shared/catalog-projection.ts";

const appOrigin = "https://exclusiv-codigo.vercel.app";
const allowedOrigins = new Set([appOrigin, "http://localhost:3000"]);

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

  const sourceUrl = Deno.env.get("SUPABASE_URL");
  const sourceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const catalogUrl = Deno.env.get("CATALOG_SUPABASE_URL");
  const catalogKey = Deno.env.get("CATALOG_SUPABASE_SERVICE_ROLE_KEY");
  if (!sourceUrl || !sourceKey || !catalogUrl || !catalogKey) return reply(503, { error: "Sincronização não configurada." });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Sessão necessária." });
  const source = createClient(sourceUrl, sourceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: auth, error: authError } = await source.auth.getUser(token);
  if (authError || !auth.user) return reply(401, { error: "Sessão inválida." });
  const { data: profile } = await source.from("profiles").select("organization_id,role").eq("id", auth.user.id).eq("active", true).maybeSingle();
  if (!profile) return reply(403, { error: "Acesso suspenso." });

  let body: { product_ids?: string[] } = {};
  try { body = await request.json(); } catch { /* full synchronization */ }
  const ids = Array.isArray(body.product_ids) ? [...new Set(body.product_ids)].slice(0, 100) : [];
  if (ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) return reply(400, { error: "Produto inválido." });

  let productQuery = source.from("products")
    .select("id,name,category,subcategory,collection,price,active,catalog_visible,archived_at")
    .eq("organization_id", profile.organization_id).limit(500);
  if (ids.length) productQuery = productQuery.in("id", ids);
  const { data: products, error: productError } = await productQuery;
  if (productError) return reply(502, { error: "Não foi possível ler os produtos do ERP." });
  if (!products?.length) return reply(200, { applied: 0, failed: [] });

  const productIds = products.map((product) => product.id);
  const [{ data: variants, error: variantError }, { data: images, error: imageError }] = await Promise.all([
    source.from("product_variants").select("id,product_id,size,color,model,stock").eq("organization_id", profile.organization_id).in("product_id", productIds).limit(5000),
    source.from("product_images").select("id,product_id,path,color,view,is_primary,hidden_at").eq("organization_id", profile.organization_id).in("product_id", productIds).limit(2000),
  ]);
  if (variantError || imageError) return reply(502, { error: "Não foi possível ler as opções e fotos." });

  const catalog = createClient(catalogUrl, catalogKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: existingImages } = await catalog.from("catalog_images").select("source_id,path,url").in("product_id", productIds);
  const existingById = new Map((existingImages ?? []).map((image) => [image.source_id, image]));
  const snapshots = [];
  const failed: { productId: string; reason: string }[] = [];
  const version = Date.now();

  for (const product of products) {
    try {
      const publicImages = [];
      for (const image of (images ?? []).filter((item) => item.product_id === product.id && !item.hidden_at)) {
        const existing = existingById.get(image.id);
        if (existing) { publicImages.push({ ...image, path: existing.path, url: existing.url }); continue; }
        const { data: file, error: downloadError } = await source.storage.from("products").download(image.path);
        if (downloadError || !file) throw new Error("Falha ao copiar uma foto.");
        const extension = image.path.split(".").pop()?.toLowerCase() || "webp";
        const path = `${product.id}/${image.id}.${extension}`;
        const { error: uploadError } = await catalog.storage.from("catalog-products").upload(path, file, { upsert: true, contentType: file.type || `image/${extension}` });
        if (uploadError) throw new Error("Falha ao armazenar uma foto.");
        const { data: publicUrl } = catalog.storage.from("catalog-products").getPublicUrl(path);
        publicImages.push({ ...image, path, url: publicUrl.publicUrl });
      }
      snapshots.push(buildCatalogProjection({
        product,
        variants: (variants ?? []).filter((variant) => variant.product_id === product.id),
        images: publicImages,
        version,
      }));
    } catch (error) {
      failed.push({ productId: product.id, reason: error instanceof Error ? error.message : "Falha desconhecida." });
    }
  }

  const { data: applied, error: applyError } = await catalog.rpc("apply_catalog_snapshot", { p: { products: snapshots } });
  if (applyError) return reply(502, { error: "Não foi possível atualizar o catálogo.", failed });
  return reply(failed.length ? 207 : 200, { applied, failed });
});
