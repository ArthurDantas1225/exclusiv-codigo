import { money } from "./format.ts";

export type OrderLine = {
  product: { name: string; price: number };
  variant: { model?: string; color: string; size: string };
  quantity: number;
};

export function whatsappOrderUrl(lines: OrderLine[], name: string, payment: string, delivery: string) {
  if (!lines.length || !name.trim()) throw new Error("Pedido e nome são obrigatórios.");
  const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
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
    `Total estimado: ${money(total)}`,
    `Pagamento desejado: ${payment.trim()}`,
    `Recebimento: ${delivery.trim()}`,
    "",
    "Podem confirmar a disponibilidade e me orientar sobre o pagamento?",
  ].join("\n");
  return `https://wa.me/5584996008220?text=${encodeURIComponent(message)}`;
}
