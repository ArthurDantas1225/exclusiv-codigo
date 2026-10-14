create extension if not exists pgcrypto;

create table if not exists public.catalog_products (
  source_id uuid primary key,
  name text not null,
  category text not null default '',
  subcategory text not null default '',
  collection text not null default '',
  price bigint not null check (price >= 0),
  published boolean not null default false,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (source_id)
);

create table if not exists public.catalog_variants (
  source_id uuid primary key,
  product_id uuid not null references public.catalog_products(source_id) on delete cascade,
  model text not null default '',
  color text not null,
  size text not null,
  stock integer not null default 0 check (stock >= 0),
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (source_id)
);

create index if not exists catalog_variants_product_idx on public.catalog_variants(product_id);

create table if not exists public.catalog_images (
  source_id uuid primary key,
  product_id uuid not null references public.catalog_products(source_id) on delete cascade,
  path text not null,
  url text not null,
  color text not null default '',
  view text not null default 'detail',
  position integer not null default 0,
  is_primary boolean not null default false,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (source_id)
);

create index if not exists catalog_images_product_idx on public.catalog_images(product_id, position);

create table if not exists public.catalog_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  idempotency_key uuid not null,
  customer_name text not null,
  payment text not null,
  delivery text not null,
  total bigint not null check (total >= 0),
  status text not null default 'pending' check (status in ('pending','importing','confirmed','cancelled','failed')),
  source_sale_id uuid,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create table if not exists public.catalog_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.catalog_orders(id) on delete cascade,
  product_id uuid not null,
  variant_id uuid not null,
  product_name text not null,
  model text not null default '',
  color text not null,
  size text not null,
  quantity integer not null check (quantity between 1 and 20),
  unit_price bigint not null check (unit_price >= 0),
  line_total bigint generated always as (quantity * unit_price) stored,
  unique (order_id, variant_id)
);

create table if not exists public.catalog_sync_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  aggregate_id uuid not null,
  status text not null default 'pending' check (status in ('pending','importing','processed','failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_order_attempts (
  id bigint generated always as identity primary key,
  fingerprint_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists catalog_order_attempts_lookup_idx on public.catalog_order_attempts(fingerprint_hash, created_at desc);

create table if not exists public.catalog_settings (
  id text primary key,
  shop_name text not null,
  whatsapp text not null,
  instagram text not null,
  headline text not null,
  updated_at timestamptz not null default now()
);

alter table public.catalog_products enable row level security;
alter table public.catalog_variants enable row level security;
alter table public.catalog_images enable row level security;
alter table public.catalog_orders enable row level security;
alter table public.catalog_order_items enable row level security;
alter table public.catalog_sync_events enable row level security;
alter table public.catalog_order_attempts enable row level security;
alter table public.catalog_settings enable row level security;

create policy "public reads published products" on public.catalog_products
for select to anon, authenticated using (published);

create policy "public reads available variants" on public.catalog_variants
for select to anon, authenticated using (
  stock > 0 and exists (
    select 1 from public.catalog_products p where p.source_id = product_id and p.published
  )
);

create policy "public reads published images" on public.catalog_images
for select to anon, authenticated using (
  exists (select 1 from public.catalog_products p where p.source_id = product_id and p.published)
);

create policy "public reads catalog settings" on public.catalog_settings
for select to anon, authenticated using (true);

create or replace function public.create_catalog_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.catalog_orders%rowtype;
  new_order public.catalog_orders%rowtype;
  requested_item jsonb;
  selected_product record;
  requested_quantity integer;
  calculated_total bigint := 0;
  generated_id uuid := gen_random_uuid();
begin
  select * into existing
  from public.catalog_orders
  where idempotency_key = (p->>'idempotencyKey')::uuid;

  if found then
    return jsonb_build_object('id', existing.id, 'code', existing.code, 'total', existing.total, 'status', existing.status);
  end if;

  if nullif(trim(p->>'customerName'), '') is null or jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then
    raise exception 'invalid_order';
  end if;

  for requested_item in select value from jsonb_array_elements(p->'items') loop
    requested_quantity := (requested_item->>'quantity')::integer;
    if requested_quantity not between 1 and 20 then raise exception 'invalid_quantity'; end if;

    select v.source_id as variant_id, v.product_id, v.model, v.color, v.size, v.stock,
      p.name, p.price
    into selected_product
    from public.catalog_variants v
    join public.catalog_products p on p.source_id = v.product_id
    where v.source_id = (requested_item->>'variantId')::uuid and p.published;

    if not found then raise exception 'variant_unavailable'; end if;
    if selected_product.stock < requested_quantity then raise exception 'insufficient_stock'; end if;
    calculated_total := calculated_total + selected_product.price * requested_quantity;
  end loop;

  insert into public.catalog_orders(id, code, idempotency_key, customer_name, payment, delivery, total)
  values (
    generated_id,
    'EXC-' || upper(substr(replace(generated_id::text, '-', ''), 1, 8)),
    (p->>'idempotencyKey')::uuid,
    left(trim(p->>'customerName'), 120),
    left(trim(coalesce(p->>'payment', 'Não informado')), 80),
    left(trim(coalesce(p->>'delivery', 'Retirada')), 240),
    calculated_total
  )
  on conflict (idempotency_key) do update set updated_at = public.catalog_orders.updated_at
  returning * into new_order;

  for requested_item in select value from jsonb_array_elements(p->'items') loop
    requested_quantity := (requested_item->>'quantity')::integer;
    insert into public.catalog_order_items(
      order_id, product_id, variant_id, product_name, model, color, size, quantity, unit_price
    )
    select new_order.id, v.product_id, v.source_id, p.name, v.model, v.color, v.size,
      requested_quantity, p.price
    from public.catalog_variants v
    join public.catalog_products p on p.source_id = v.product_id
    where v.source_id = (requested_item->>'variantId')::uuid
    on conflict (order_id, variant_id) do nothing;
  end loop;

  insert into public.catalog_sync_events(event_type, aggregate_id)
  values ('order.created', new_order.id);

  return jsonb_build_object('id', new_order.id, 'code', new_order.code, 'total', new_order.total, 'status', new_order.status);
end;
$$;

revoke all on function public.create_catalog_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_catalog_order(jsonb) to service_role;

insert into public.catalog_settings(id, shop_name, whatsapp, instagram, headline)
values ('exclusiv', 'EXCLUSIV', '5584996008220', '@exclusiv_streetwear', 'Escolha suas peças exclusivas')
on conflict (id) do update set
  shop_name = excluded.shop_name,
  whatsapp = excluded.whatsapp,
  instagram = excluded.instagram,
  headline = excluded.headline,
  updated_at = now();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-products', 'catalog-products', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
