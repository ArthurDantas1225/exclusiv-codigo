-- Subcategory belongs to the product, not to each stock variant.
alter table public.products add column subcategory text not null default ''
  check (length(subcategory) <= 80);

create function public.save_product_grid_with_taxonomy(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
  o uuid := public.my_org();
  pid uuid;
  next_subcategory text := trim(coalesce(p->>'subcategory',''));
begin
  if length(next_subcategory) > 80 then raise exception 'Subcategoria muito longa'; end if;
  -- The grid function checks the active admin, organization and request id.
  result := public.save_product_grid(p);
  pid := (result->>'id')::uuid;
  update public.products set subcategory=next_subcategory,updated_at=now()
    where id=pid and organization_id=o and archived_at is null
      and subcategory is distinct from next_subcategory;
  if found then
    insert into public.audit_logs(organization_id,user_id,action,entity,entity_id,after_data)
      values(o,auth.uid(),'product_taxonomy','product',pid,
        jsonb_build_object('category',p->>'category','subcategory',next_subcategory));
  end if;
  return result;
end $$;

revoke all on function public.save_product_grid_with_taxonomy(jsonb) from public,anon;
grant execute on function public.save_product_grid_with_taxonomy(jsonb) to authenticated;
