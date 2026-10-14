type Input = {
  product: { id: string; name: string; category: string; subcategory?: string; collection: string; price: number; active: boolean; catalog_visible?: boolean; archived_at?: string | null };
  variants: { id: string; product_id: string; size: string; color: string; model?: string; stock: number; cost?: number; sku?: string; minimum?: number }[];
  images: { id: string; product_id: string; path: string; color?: string; view?: string; is_primary: boolean; hidden_at?: string | null; url: string }[];
  version: number;
};

export function buildCatalogProjection(input: Input) {
  const { product, version } = input;
  return {
    product: {
      source_id: product.id, name: product.name, category: product.category,
      subcategory: product.subcategory ?? "", collection: product.collection,
      price: product.price,
      published: product.active && !!product.catalog_visible && !product.archived_at,
      version,
    },
    variants: input.variants.map((variant) => ({
      source_id: variant.id, product_id: variant.product_id, size: variant.size,
      color: variant.color, model: variant.model ?? "", stock: variant.stock, version,
    })),
    images: input.images.filter((image) => !image.hidden_at).map((image, position) => ({
      source_id: image.id, product_id: image.product_id, path: image.path, url: image.url,
      color: image.color ?? "", view: image.view ?? "other", is_primary: image.is_primary,
      position, version,
    })),
  };
}

export function shouldApplyVersion(current: number, incoming: number) {
  return incoming >= current;
}
