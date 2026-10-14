import { supabase } from "./supabase.ts";

export type PendingOrderItem = {
  productId: string;
  productName: string;
  variantId: string;
  variantModel?: string;
  variantColor: string;
  variantSize: string;
  quantity: number;
  unitPrice: number;
};

export type PendingOrder = {
  id: string;
  code?: string;
  status?: string;
  createdAt: string;
  customerName: string;
  payment: string;
  delivery: string;
  items: PendingOrderItem[];
};

export type PendingOrderInput = Omit<PendingOrder, "id" | "createdAt">;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PENDING_ORDERS_KEY = "exclusiv-pending-orders";

function getStorage(storage?: StorageLike) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readPendingOrders(storage?: StorageLike): PendingOrder[] {
  const target = getStorage(storage);
  if (!target) return [];
  try {
    const raw = target.getItem(PENDING_ORDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function savePendingOrder(
  input: PendingOrderInput,
  storage?: StorageLike,
): PendingOrder {
  const target = getStorage(storage);
  const next: PendingOrder = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  if (!target) return next;
  const list = [next, ...readPendingOrders(target)];
  try {
    target.setItem(PENDING_ORDERS_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage failures to keep the WhatsApp flow resilient.
  }
  return next;
}

export function removePendingOrder(id: string, storage?: StorageLike) {
  const target = getStorage(storage);
  if (!target) return;
  const next = readPendingOrders(target).filter((order) => order.id !== id);
  try {
    if (!next.length) {
      target.removeItem(PENDING_ORDERS_KEY);
      return;
    }
    target.setItem(PENDING_ORDERS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures to keep the app resilient.
  }
}

type RemoteOrderRow = {
  id: string;
  code: string;
  created_at: string;
  customer_name: string;
  payment: string;
  delivery: string;
  status: string;
  catalog_order_items: {
    product_id: string;
    product_name: string;
    variant_id: string;
    model: string;
    color: string;
    size: string;
    quantity: number;
    unit_price: number;
  }[];
};

export function remoteOrderFromRow(row: RemoteOrderRow): PendingOrder {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    createdAt: row.created_at,
    customerName: row.customer_name,
    payment: row.payment,
    delivery: row.delivery,
    items: row.catalog_order_items.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      variantId: item.variant_id,
      variantModel: item.model,
      variantColor: item.color,
      variantSize: item.size,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
  };
}

export function saleRequestId(order: PendingOrder) {
  return order.id;
}

export async function migrateLegacyOrders(
  send: (order: PendingOrder) => Promise<boolean>,
  storage?: StorageLike,
) {
  for (const order of readPendingOrders(storage)) {
    try {
      if (await send(order)) removePendingOrder(order.id, storage);
    } catch {
      // Keep invalid legacy orders locally so one old item cannot hide new remote orders.
    }
  }
}
async function invoke(body: Record<string, unknown>) {
  if (!supabase) throw new Error("Aplicativo não conectado.");
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Sessão necessária.");
  const response = await fetch("https://sduacssupdhzwqmlijqv.supabase.co/functions/v1/catalog-orders", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(String(data?.error ?? "Não foi possível acessar os pedidos."));
  return data;
}

export async function listRemotePendingOrders() {
  const data = await invoke({ action: "list" });
  return ((data?.orders ?? []) as RemoteOrderRow[]).map(remoteOrderFromRow);
}

export async function importLegacyPendingOrder(order: PendingOrder) {
  await invoke({
    action: "import_legacy",
    order: {
      idempotencyKey: order.id,
      customerName: order.customerName,
      payment: order.payment,
      delivery: order.delivery,
      items: order.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    },
  });
  return true;
}

export async function confirmRemotePendingOrder(orderId: string, saleId: string) {
  await invoke({ action: "confirm", order_id: orderId, sale_id: saleId });
}

export async function cancelRemotePendingOrder(orderId: string) {
  await invoke({ action: "cancel", order_id: orderId });
}
