import { supabase } from "./supabase.ts";

export { buildCatalogProjection, shouldApplyVersion } from "../supabase-catalog/functions/_shared/catalog-projection.ts";

export async function requestCatalogSync(productIds?: string[]) {
  if (!supabase) throw new Error("Aplicativo não conectado.");
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Sessão necessária.");
  const response = await fetch("https://sduacssupdhzwqmlijqv.supabase.co/functions/v1/sync-catalog", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ product_ids: productIds }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(data?.error ?? "Não foi possível sincronizar o catálogo."));
  if (data?.error) throw new Error(String(data.error));
  if (data?.failed?.length) throw new Error(`${data.failed.length} produto(s) ficaram pendentes de sincronização.`);
}
