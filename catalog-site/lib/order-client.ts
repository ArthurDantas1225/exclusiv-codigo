export type CatalogOrderInput = {
  idempotencyKey: string;
  customerName: string;
  payment: string;
  delivery: string;
  items: { variantId: string; quantity: number }[];
};

export type CatalogOrderReceipt = {
  id: string;
  code: string;
  total: number;
  status: "pending";
  items: { productName: string; model: string; color: string; size: string; quantity: number; unitPrice: number }[];
  whatsappUrl: string;
};

export async function submitCatalogOrder(
  input: CatalogOrderInput,
  fetcher: typeof fetch = fetch,
  endpoint = process.env.NEXT_PUBLIC_CATALOG_ORDER_URL ?? "",
): Promise<CatalogOrderReceipt> {
  if (!endpoint) throw new Error("Pedidos ainda não configurados.");
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await response.json() as CatalogOrderReceipt & { error?: string };
  if (!response.ok) throw new Error(result.error || "Não foi possível registrar o pedido.");
  if (!result.id || !result.code || !result.whatsappUrl) throw new Error("Resposta inválida ao registrar o pedido.");
  return result;
}
