export function validPushSubscription(value: unknown): value is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!value || typeof value !== "object") return false;
  const item = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof item.endpoint !== "string" || item.endpoint.length > 2048) return false;
  let url: URL;
  try { url = new URL(item.endpoint); } catch { return false; }
  const host = url.hostname;
  const allowed = host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" || host === "web.push.apple.com" || host.endsWith(".notify.windows.com");
  return allowed && url.protocol === "https:" && !url.username && !url.password && !url.hash && (!url.port || url.port === "443")
    && typeof item.keys?.p256dh === "string" && /^[A-Za-z0-9_-]{87}=?$/.test(item.keys.p256dh)
    && typeof item.keys?.auth === "string" && /^[A-Za-z0-9_-]{22}(==)?$/.test(item.keys.auth);
}

export function orderPushPayload(event: { id: string; order_id: string; code: string; payment_status: string }) {
  const paid = event.payment_status === "paid";
  return {
    title: paid ? "EXCLUSIV · Pagamento conferido" : "EXCLUSIV · Pix aguardando conferência",
    body: paid ? `Pedido ${event.code}: pagamento confirmado pela equipe.` : `Pedido ${event.code}: confira o recebimento no Inter.`,
    tag: `catalog-${event.id}`,
    url: "/app/pedidos",
  };
}
