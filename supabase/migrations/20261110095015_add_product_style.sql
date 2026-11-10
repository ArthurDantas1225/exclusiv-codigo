alter table public.products
  add column style text not null default ''
  check (style in ('', 'Streetwear', 'Casual', 'Surfwear'));

create or replace function public.save_product_grid_with_taxonomy(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
  o uuid := public.my_org();
  pid uuid;
  next_subcategory text := trim(coalesce(p->>'subcategory',''));
  next_style text := trim(coalesce(p->>'style',''));
begin
  if length(next_subcategory) > 80 then raise exception 'Subcategoria muito longa'; end if;
  if next_style not in ('', 'Streetwear', 'Casual', 'Surfwear') then raise exception 'Estilo inválido'; end if;
  result := public.save_product_grid(p);
  pid := (result->>'id')::uuid;
  update public.products set subcategory=next_subcategory,style=next_style,updated_at=now()
    where id=pid and organization_id=o and archived_at is null
      and (subcategory is distinct from next_subcategory or style is distinct from next_style);
  if found then
    insert into public.audit_logs(organization_id,user_id,action,entity,entity_id,after_data)
      values(o,auth.uid(),'product_taxonomy','product',pid,
        jsonb_build_object('category',p->>'category','subcategory',next_subcategory,'style',next_style));
  end if;
  return result;
end $$;

revoke all on function public.save_product_grid_with_taxonomy(jsonb) from public,anon;
grant execute on function public.save_product_grid_with_taxonomy(jsonb) to authenticated;
