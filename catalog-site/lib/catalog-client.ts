export type CatalogImage = { id: string; url: string; color: string; view: string; is_primary: boolean };
export type CatalogVariant = { id: string; product_id: string; size: string; color: string; model: string; stock: number };
export type CatalogProduct = { id: string; name: string; category: string; subcategory?: string; collection: string; price: number; image: string | null; images: CatalogImage[]; variants: CatalogVariant[] };
export type CatalogData = { shop: string; products: CatalogProduct[]; settings?: { whatsapp: string; instagram: string; headline: string } };

type Rows = {
  settings: { shop_name: string; whatsapp: string; instagram: string; headline: string } | null;
  products: { source_id: string; name: string; category: string; subcategory: string; collection: string; price: number; published: boolean }[];
  variants: { source_id: string; product_id: string; size: string; color: string; model: string; stock: number }[];
  images: { source_id: string; product_id: string; url: string; color: string; view: string; is_primary: boolean; position: number }[];
};

export function buildCatalogData(rows: Rows): CatalogData {
  return {
    shop: rows.settings?.shop_name ?? "EXCLUSIV",
    settings: rows.settings ? { whatsapp: rows.settings.whatsapp, instagram: rows.settings.instagram, headline: rows.settings.headline } : undefined,
    products: rows.products.filter((product) => product.published).map((product) => {
      const images = rows.images.filter((image) => image.product_id === product.source_id)
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position)
        .map((image) => ({ id: image.source_id, url: image.url, color: image.color, view: image.view, is_primary: image.is_primary }));
      return {
        id: product.source_id, name: product.name, category: product.category,
        subcategory: product.subcategory, collection: product.collection, price: product.price,
        image: images[0]?.url ?? null, images,
        variants: rows.variants.filter((variant) => variant.product_id === product.source_id && variant.stock > 0)
          .map((variant) => ({ id: variant.source_id, product_id: variant.product_id, size: variant.size, color: variant.color, model: variant.model, stock: variant.stock })),
      };
    }),
  };
}

export async function loadCatalog(fetcher: typeof fetch = fetch): Promise<CatalogData> {
  const base = process.env.NEXT_PUBLIC_CATALOG_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_CATALOG_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error("Catálogo não configurado.");
  const get = async <T,>(path: string): Promise<T> => {
    const response = await fetcher(`${base}/rest/v1/${path}`, {
      headers: { apikey: key }, next: { revalidate: 300 }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Catálogo temporariamente indisponível.");
    return response.json() as Promise<T>;
  };
  const [settings, products, variants, images] = await Promise.all([
    get<NonNullable<Rows["settings"]>[]>("catalog_settings?id=eq.exclusiv&select=shop_name,whatsapp,instagram,headline"),
    get<Rows["products"]>("catalog_products?published=eq.true&select=source_id,name,category,subcategory,collection,price,published&order=updated_at.desc"),
    get<Rows["variants"]>("catalog_variants?stock=gt.0&select=source_id,product_id,size,color,model,stock"),
    get<Rows["images"]>("catalog_images?select=source_id,product_id,url,color,view,is_primary,position&order=position.asc"),
  ]);
  const catalog = buildCatalogData({ settings: settings[0] ?? null, products, variants, images });
  if (catalog.products.some((product) => product.images.length)) return catalog;
  try {
    const response = await fetcher("https://rznnojrtgolekdkcvxnv.supabase.co/functions/v1/catalog", {
      next: { revalidate: 300 }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return catalog;
    const fallback = await response.json() as CatalogData;
    return Array.isArray(fallback.products) ? { ...fallback, settings: catalog.settings ?? fallback.settings } : catalog;
  } catch {
    return catalog;
  }
}
