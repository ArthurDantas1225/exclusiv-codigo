alter table public.catalog_orders
  add column if not exists subtotal bigint not null default 0 check (subtotal >= 0),
  add column if not exists promotion_discount bigint not null default 0 check (promotion_discount >= 0),
  add column if not exists promotion_version bigint not null default 0 check (promotion_version >= 0),
  add column if not exists promotion_campaign_ids text[] not null default '{}',
  add column if not exists promotion_summary jsonb not null default '[]'::jsonb;

update public.catalog_orders set subtotal = total where subtotal = 0 and total > 0;

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
  calculated_subtotal bigint := 0;
  calculated_discount bigint := coalesce((p->'promotion'->>'discount')::bigint, 0);
  calculated_version bigint := coalesce((p->'promotion'->>'version')::bigint, 0);
  requested_subtotal bigint := coalesce((p->'promotion'->>'subtotal')::bigint, -1);
  generated_id uuid := gen_random_uuid();
begin
  if nullif(p->>'idempotencyKey', '') is null then raise exception 'invalid_idempotency_key'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended((p->>'idempotencyKey')::uuid::text, 0));
  select * into existing from public.catalog_orders where idempotency_key = (p->>'idempotencyKey')::uuid;
  if found then
    return jsonb_build_object('id', existing.id, 'code', existing.code, 'subtotal', existing.subtotal,
      'discount', existing.promotion_discount, 'promotionVersion', existing.promotion_version,
      'promotionSummary', existing.promotion_summary,
      'total', existing.total, 'status', existing.status);
  end if;

  if nullif(trim(p->>'customerName'), '') is null or jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then
    raise exception 'invalid_order';
  end if;

  for requested_item in select value from jsonb_array_elements(p->'items') loop
    requested_quantity := (requested_item->>'quantity')::integer;
    if requested_quantity not between 1 and 20 then raise exception 'invalid_quantity'; end if;
    select v.source_id as variant_id, v.product_id, v.model, v.color, v.size, v.stock, p.name, p.price
    into selected_product
    from public.catalog_variants v join public.catalog_products p on p.source_id = v.product_id
    where v.source_id = (requested_item->>'variantId')::uuid and p.published
    for update of v;
    if not found then raise exception 'variant_unavailable'; end if;
    if selected_product.stock < requested_quantity then raise exception 'insufficient_stock'; end if;
    calculated_subtotal := calculated_subtotal + selected_product.price * requested_quantity;
  end loop;

  if p->'promotion' is null then
    requested_subtotal := calculated_subtotal;
    calculated_discount := 0;
    calculated_version := 0;
  end if;
  if requested_subtotal <> calculated_subtotal or calculated_discount < 0 or calculated_discount > calculated_subtotal
    or (calculated_subtotal > 0 and calculated_discount >= calculated_subtotal) then
    raise exception 'invalid_promotion_total';
  end if;

  insert into public.catalog_orders(id, code, idempotency_key, customer_name, payment, delivery, subtotal,
    promotion_discount, promotion_version, promotion_campaign_ids, promotion_summary, total)
  values (generated_id, 'EXC-' || upper(substr(replace(generated_id::text, '-', ''), 1, 8)),
    (p->>'idempotencyKey')::uuid, left(trim(p->>'customerName'), 120),
    left(trim(coalesce(p->>'payment', 'Não informado')), 80), left(trim(coalesce(p->>'delivery', 'Retirada')), 240),
    calculated_subtotal, calculated_discount, calculated_version,
    array(select jsonb_array_elements_text(coalesce(p->'promotion'->'campaignIds', '[]'::jsonb))),
    coalesce(p->'promotion'->'applied', '[]'::jsonb),
    calculated_subtotal - calculated_discount)
  on conflict (idempotency_key) do update set updated_at = public.catalog_orders.updated_at
  returning * into new_order;

  for requested_item in select value from jsonb_array_elements(p->'items') loop
    requested_quantity := (requested_item->>'quantity')::integer;
    insert into public.catalog_order_items(order_id, product_id, variant_id, product_name, model, color, size, quantity, unit_price)
    select new_order.id, v.product_id, v.source_id, cp.name, v.model, v.color, v.size, requested_quantity, cp.price
    from public.catalog_variants v join public.catalog_products cp on cp.source_id = v.product_id
    where v.source_id = (requested_item->>'variantId')::uuid
    on conflict (order_id, variant_id) do nothing;
  end loop;

  insert into public.catalog_sync_events(event_type, aggregate_id) values ('order.created', new_order.id);
  return jsonb_build_object('id', new_order.id, 'code', new_order.code, 'subtotal', new_order.subtotal,
    'discount', new_order.promotion_discount, 'promotionVersion', new_order.promotion_version,
    'promotionSummary', new_order.promotion_summary,
    'total', new_order.total, 'status', new_order.status);
end;
$$;

revoke all on function public.create_catalog_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_catalog_order(jsonb) to service_role;
