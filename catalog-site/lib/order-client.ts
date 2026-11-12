export type CatalogOrderInput = {
  idempotencyKey: string;
  customerName: string;
  payment: string;
  delivery: string;
  promotionVersion?: number;
  items: { variantId: string; quantity: number }[];
};

export type CatalogOrderReceipt = {
  id: string;
  code: string;
  total: number;
  subtotal: number;
  discount: number;
  promotionVersion: number;
  status: "pending";
  items: { productName: string; model: string; color: string; size: string; quantity: number; unitPrice: number }[];
  whatsappUrl: string;
};

export class CatalogOrderError extends Error {
  uncertain: boolean;
  constructor(message: string, uncertain: boolean) {
    super(message);
    this.name = "CatalogOrderError";
    this.uncertain = uncertain;
  }
}

export async function submitCatalogOrder(
  input: CatalogOrderInput,
  fetcher: typeof fetch = fetch,
  endpoint = process.env.NEXT_PUBLIC_CATALOG_ORDER_URL ?? "",
): Promise<CatalogOrderReceipt> {
  if (!endpoint) throw new CatalogOrderError("Pedidos ainda não configurados.", false);
  let response: Response;
  try { response = await fetcher(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(15000),
  }); } catch {
    throw new CatalogOrderError("Não foi possível confirmar o envio. Tente novamente para recuperar o mesmo pedido sem duplicá-lo.", true);
  }
  const result = await response.json().catch(() => null) as (CatalogOrderReceipt & { error?: string }) | null;
  if (!result || typeof result !== "object") throw new CatalogOrderError("Não foi possível registrar o pedido. Tente novamente para recuperar o mesmo pedido.", true);
  if (!response.ok) throw new CatalogOrderError(result.error || "Não foi possível registrar o pedido.", ![400,401,403,409,422,429].includes(response.status));
  if (!result.id || !result.code || !result.whatsappUrl) throw new CatalogOrderError("Resposta inválida ao registrar o pedido. Tente novamente para recuperar o mesmo pedido.", true);
  let destination: URL;
  try { destination = new URL(result.whatsappUrl); }
  catch { throw new CatalogOrderError("Resposta inválida ao registrar o pedido.", true); }
  if (destination.protocol !== "https:" || destination.hostname !== "wa.me" ||
    destination.username || destination.password || destination.port || !/^\/\d+$/.test(destination.pathname)) {
    throw new CatalogOrderError("Resposta inválida ao registrar o pedido.", true);
  }
  return result;
}
