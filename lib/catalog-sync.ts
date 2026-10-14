import { supabase } from "./supabase.ts";

export { buildCatalogProjection, shouldApplyVersion } from "../supabase/functions/_shared/catalog-projection.ts";

export async function requestCatalogSync(productIds?: string[]) {
  if (!supabase) throw new Error("Aplicativo não conectado.");
  const { data, error } = await supabase.functions.invoke("sync-catalog", { body: { product_ids: productIds } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  if (data?.failed?.length) throw new Error(`${data.failed.length} produto(s) ficaram pendentes de sincronização.`);
}
