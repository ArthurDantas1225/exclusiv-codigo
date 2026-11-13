create or replace function public.apply_catalog_snapshot_with_style(p jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
  snapshot_source_id uuid;
  incoming_version bigint;
  next_style text;
  applied integer;
begin
  applied := public.apply_catalog_snapshot(p);
  for snapshot in select value from jsonb_array_elements(coalesce(p->'products', '[]'::jsonb)) loop
    snapshot_source_id := (snapshot->'product'->>'source_id')::uuid;
    incoming_version := (snapshot->'product'->>'version')::bigint;
    next_style := coalesce(snapshot->'product'->>'style', '');
    if next_style not in ('', 'Streetwear', 'Casual', 'Surfwear') then raise exception 'Estilo inválido'; end if;
    update public.catalog_products as current_product set style=next_style,updated_at=now()
      where current_product.source_id=snapshot_source_id and current_product.version=incoming_version;
  end loop;
  return applied;
end;
$$;

revoke all on function public.apply_catalog_snapshot_with_style(jsonb) from public, anon, authenticated;
grant execute on function public.apply_catalog_snapshot_with_style(jsonb) to service_role;
