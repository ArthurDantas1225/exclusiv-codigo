create or replace function public.apply_catalog_snapshot(p jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
  variant jsonb;
  image jsonb;
  snapshot_product_id uuid;
  incoming_version bigint;
  stored_version bigint;
  applied integer := 0;
begin
  for snapshot in select value from jsonb_array_elements(coalesce(p->'products', '[]'::jsonb)) loop
    snapshot_product_id := (snapshot->'product'->>'source_id')::uuid;
    incoming_version := (snapshot->'product'->>'version')::bigint;

    insert into public.catalog_products(source_id,name,category,subcategory,collection,price,published,version,updated_at)
    values (
      snapshot_product_id, snapshot->'product'->>'name', coalesce(snapshot->'product'->>'category',''),
      coalesce(snapshot->'product'->>'subcategory',''), coalesce(snapshot->'product'->>'collection',''),
      (snapshot->'product'->>'price')::bigint, (snapshot->'product'->>'published')::boolean,
      incoming_version, now()
    )
    on conflict (source_id) do update set
      name=excluded.name, category=excluded.category, subcategory=excluded.subcategory,
      collection=excluded.collection, price=excluded.price, published=excluded.published,
      version=excluded.version, updated_at=now()
    where public.catalog_products.version <= excluded.version;

    select version into stored_version from public.catalog_products where source_id=snapshot_product_id;
    if stored_version <> incoming_version then continue; end if;

    for variant in select value from jsonb_array_elements(coalesce(snapshot->'variants', '[]'::jsonb)) loop
      insert into public.catalog_variants(source_id,product_id,model,color,size,stock,version,updated_at)
      values ((variant->>'source_id')::uuid, snapshot_product_id, coalesce(variant->>'model',''), variant->>'color', variant->>'size', (variant->>'stock')::integer, incoming_version, now())
      on conflict (source_id) do update set model=excluded.model,color=excluded.color,size=excluded.size,stock=excluded.stock,version=excluded.version,updated_at=now()
      where public.catalog_variants.version <= excluded.version;
    end loop;
    delete from public.catalog_variants current
    where current.product_id=snapshot_product_id and current.version <= incoming_version
      and not exists (select 1 from jsonb_array_elements(coalesce(snapshot->'variants','[]'::jsonb)) item where (item->>'source_id')::uuid=current.source_id);

    for image in select value from jsonb_array_elements(coalesce(snapshot->'images', '[]'::jsonb)) loop
      insert into public.catalog_images(source_id,product_id,path,url,color,view,position,is_primary,version,updated_at)
      values ((image->>'source_id')::uuid, snapshot_product_id, image->>'path', image->>'url', coalesce(image->>'color',''), coalesce(image->>'view','other'), (image->>'position')::integer, (image->>'is_primary')::boolean, incoming_version, now())
      on conflict (source_id) do update set path=excluded.path,url=excluded.url,color=excluded.color,view=excluded.view,position=excluded.position,is_primary=excluded.is_primary,version=excluded.version,updated_at=now()
      where public.catalog_images.version <= excluded.version;
    end loop;
    delete from public.catalog_images current
    where current.product_id=snapshot_product_id and current.version <= incoming_version
      and not exists (select 1 from jsonb_array_elements(coalesce(snapshot->'images','[]'::jsonb)) item where (item->>'source_id')::uuid=current.source_id);

    applied := applied + 1;
  end loop;
  return applied;
end;
$$;

revoke all on function public.apply_catalog_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.apply_catalog_snapshot(jsonb) to service_role;
