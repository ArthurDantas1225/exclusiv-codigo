import { money } from "./format.ts";

export type OrderLine = {
  product: { name: string; price: number };
  variant: { model?: string; color: string; size: string };
  quantity: number;
};

export function whatsappOrderUrl(lines: OrderLine[], name: string, payment: string, delivery: string, promo?: { discount: number; campaignNames: string[] }) {
  if (!lines.length || !name.trim()) throw new Error("Pedido e nome são obrigatórios.");
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const discount = Math.max(0, Math.min(subtotal, promo?.discount ?? 0));
  const total = subtotal - discount;
  const message = [
    `Olá, EXCLUSIV! Meu nome é ${name.trim()} e quero confirmar este pedido:`,
    "",
    "*PEÇAS*",
    ...lines.map((line, i) => [
      `${i + 1}. *${line.product.name.trim()}*`,
      ...(line.variant.model?.trim() ? [`Modelo: ${line.variant.model.trim()}`] : []),
      `Cor: ${line.variant.color.trim()}`,
      `Tamanho: ${line.variant.size.trim()}`,
      `Quantidade: ${line.quantity}`,
      ...(lines.length > 1 ? [`Subtotal: ${money(line.product.price * line.quantity)}`] : []),
      "",
    ].join("\n")),
    "*RESUMO*",
    `Subtotal: ${money(subtotal)}`,
    ...(discount ? [`Promoção: ${promo?.campaignNames.join(", ") || "Desconto por quantidade"}`, `Desconto: − ${money(discount)}`] : []),
    `Total estimado: ${money(total)}`,
    `Pagamento desejado: ${payment.trim()}`,
    `Recebimento: ${delivery.trim()}`,
    "",
    "Podem confirmar a disponibilidade e me orientar sobre o pagamento?",
  ].join("\n");
  return `https://wa.me/5584996008220?text=${encodeURIComponent(message)}`;
}
