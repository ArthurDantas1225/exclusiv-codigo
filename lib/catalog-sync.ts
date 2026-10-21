import { supabase } from "./supabase.ts";

export { buildCatalogProjection, shouldApplyVersion } from "../supabase-catalog/functions/_shared/catalog-projection.ts";

type SyncBatchResult = { failed?: unknown[] };

export async function runCatalogSyncBatches(
  productIds: string[] | undefined,
  send: (productIds: string[]) => Promise<SyncBatchResult>,
) {
  const ids = [...new Set(productIds ?? [])];
  const batches = ids.length
    ? Array.from({ length: Math.ceil(ids.length / 5) }, (_, index) => ids.slice(index * 5, index * 5 + 5))
    : [[]];
  let failures = 0;
  for (const batch of batches) failures += (await send(batch)).failed?.length ?? 0;
  if (failures) throw new Error(`${failures} produto(s) ficaram pendentes de sincronização.`);
}

export async function requestCatalogSync(productIds?: string[]) {
  if (!supabase) throw new Error("Aplicativo não conectado.");
  const { data: session, error } = await supabase.auth.refreshSession();
  const token = session.session?.access_token;
  if (error || !token) throw new Error("Sessão necessária. Entre novamente no aplicativo.");
  await runCatalogSyncBatches(productIds, async (batch) => {
    const response = await fetch("https://sduacssupdhzwqmlijqv.supabase.co/functions/v1/sync-catalog", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ product_ids: batch }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data?.error ?? "Não foi possível sincronizar o catálogo."));
    if (data?.error) throw new Error(String(data.error));
    return data;
  });
}
