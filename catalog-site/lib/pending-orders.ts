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
