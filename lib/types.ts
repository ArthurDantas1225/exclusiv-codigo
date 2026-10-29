export type Product = {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  collection: string;
  price: number;
  active: boolean;
  created_at: string;
  image_path?: string;
  catalog_visible?: boolean;
  archived_at?: string | null;
};
export type Variant = {
  id: string;
  product_id: string;
  sku: string;
  barcode: string;
  size: string;
  color: string;
  model?: string;
  stock: number;
  minimum: number;
  cost: number;
  created_at: string;
};
export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  instagram: string;
  notes: string;
  tags: string;
  marketing_consent: boolean;
  credit_enabled: boolean;
  credit_limit: number;
  created_at: string;
};
export type Sale = {
  tendered?: number;
  change_amount?: number;
  id: string;
  number: number;
  customer_id: string | null;
  total: number;
  gross: number;
  discount: number;
  cost: number;
  status: string;
  created_at: string;
  notes: string;
  created_by?: string;
};
export type SaleItem = {
  id: string;
  sale_id: string;
  variant_id: string;
  product_name: string;
  variant_description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total: number;
  returned: number;
};
export type Payment = {
  id: string;
  sale_id: string;
  method: string;
  amount: number;
};
export type Entry = {
  id: string;
  customer_id: string | null;
  sale_id: string | null;
  kind: string;
  amount: number;
  cost_delta?: number;
  description: string;
  method: string;
  due_date: string;
  created_at: string;
  cash_session_id: string | null;
  created_by?: string;
};
export type CashSession = {
  id: string;
  opening: number;
  counted: number | null;
  expected: number | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  created_by?: string;
  closed_by?: string | null;
};
export type Movement = {
  id: string;
  variant_id: string;
  quantity: number;
  before_stock: number;
  after_stock: number;
  reason: string;
  created_at: string;
  created_by: string;
};
export type Task = {
  id: string;
  customer_id: string;
  description: string;
  due_date: string;
  status: string;
  stage: string;
  created_by?: string;
};
export type Profile = {
  id: string;
  name: string;
  email: string;
  role: string;
  organization_id: string;
  active: boolean;
};
export type AuditLog = {
  id: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
};
export type Setting = { id: string; key: string; value: string };
export type Store = {
  suppliers: Supplier[];
  purchase_orders: Purchase[];
  purchase_order_items: PurchaseItem[];
  accounts_payable: Payable[];
  product_images: ProductImage[];
  balances?: {
    customers: Record<string, number>;
    cash: Record<string, number>;
  };
  products: Product[];
  product_variants: Variant[];
  customers: Customer[];
  sales: Sale[];
  sale_items: SaleItem[];
  sale_payments: Payment[];
  ledger: Entry[];
  cash_sessions: CashSession[];
  inventory_movements: Movement[];
  crm_tasks: Task[];
  app_settings: Setting[];
  profiles: Profile[];
  audit_logs: AuditLog[];
};
export const emptyStore: Store = {
  suppliers: [],
  purchase_orders: [],
  purchase_order_items: [],
  accounts_payable: [],
  product_images: [],
  products: [],
  product_variants: [],
  customers: [],
  sales: [],
  sale_items: [],
  sale_payments: [],
  ledger: [],
  cash_sessions: [],
  inventory_movements: [],
  crm_tasks: [],
  app_settings: [],
  profiles: [],
  audit_logs: [],
};
export const methods = [
  "Pix",
  "Dinheiro",
  "Débito",
  "Crédito",
  "Fiado",
  "Crédito na loja",
  "Outro",
] as const;
export type Supplier = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
};
export type Purchase = {
  id: string;
  supplier_id: string;
  total: number;
  status: string;
  kind: "merchandise" | "bags" | "other";
  notes: string;
  due_date: string;
  created_at: string;
  created_by?: string;
};
export type PurchaseItem = {
  id: string;
  purchase_id: string;
  variant_id: string;
  quantity: number;
  received: number;
  unit_cost: number;
};
export type Payable = {
  id: string;
  description: string;
  category: string;
  amount: number;
  paid: number;
  due_date: string;
  recurring: boolean;
};
export type ProductImage = {
  id: string;
  product_id: string;
  path: string;
  is_primary: boolean;
  color?: string;
  view?: "front" | "back" | "detail" | "other";
  hidden_at?: string | null;
};
