export type ReceiptOrder = {
  code: string;
  subtotal: number;
  promotion_discount: number;
  total: number;
  customer_name: string;
  payment: string;
  delivery: string;
  promotion_summary: { name: string; discount: number }[];
  catalog_order_items: { product_name: string; model: string; color: string; size: string; quantity: number; unit_price: number }[];
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function createWhatsAppMessage(order: ReceiptOrder) {
  const itemLines = order.catalog_order_items.flatMap((item, index) => [
    `${index + 1}. ${item.product_name}`,
    ...(item.model ? [`Modelo: ${item.model}`] : []),
    `Cor: ${item.color} · Tamanho: ${item.size}`,
    `Quantidade: ${item.quantity}${order.catalog_order_items.length > 1 ? ` · Subtotal: ${money(item.unit_price * item.quantity)}` : ""}`,
    "",
  ]);
  const summary = [
    ...(order.promotion_discount > 0 ? [`Subtotal: ${money(order.subtotal)}`] : []),
    ...(order.promotion_summary ?? []).map((item) => `${item.name}: − ${money(item.discount)}`),
    ...(order.promotion_discount > 0 && !order.promotion_summary?.length ? [`Desconto promocional: − ${money(order.promotion_discount)}`] : []),
    `Total: ${money(order.total)}`,
  ];
  return [`Olá, EXCLUSIV! Quero confirmar o pedido ${order.code}.`, "", `Cliente: ${order.customer_name}`, `Pagamento: ${order.payment}`, `Entrega: ${order.delivery}`, "", "Peças:", ...itemLines, "Resumo:", ...summary].join("\n");
}
