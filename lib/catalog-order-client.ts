export async function submitPublicCatalogOrder(input: {
  idempotencyKey: string;
  customerName: string;
  payment: string;
  delivery: string;
  promotionVersion: number;
  items: { variantId: string; quantity: number }[];
}) {
  const endpoint = process.env.NEXT_PUBLIC_CATALOG_ORDER_URL || "https://sduacssupdhzwqmlijqv.supabase.co/functions/v1/create-order";
  const response = await fetch(endpoint, { method: "POST", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  const result = await response.json().catch(() => ({})) as { whatsappUrl?: string; error?: string };
  if (!response.ok || !result.whatsappUrl) throw new Error(result.error || "Não foi possível registrar o pedido.");
  return result;
}
