-- Product onboarding, editable variants and explicit public catalog publishing.
alter table public.products add column catalog_visible boolean not null default false;
alter table public.product_variants add column model text not null default '';
alter table public.organizations add column public_slug text unique;
-- The dedicated EXCLUSIV project has one matching organization. Do not publish
-- another tenant with the same display name in a shared project.
update public.organizations set public_slug='exclusiv'
 where name='EXCLUSIV'
   and (select count(*) from public.organizations where name='EXCLUSIV')=1;

create function public.save_variant(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o uuid := public.my_org();
  actor uuid := auth.uid();
  vid uuid;
  result jsonb;
  sku_value text;
begin
  if actor is null or o is null or not public.is_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  if coalesce(length(trim(p->>'color')), 0) = 0
     or coalesce(length(trim(p->>'size')), 0) = 0
     or length(coalesce(p->>'model', '')) > 100 then
    raise exception 'Informe cor, tamanho e modelo válido';
  end if;
  if nullif(p->>'id', '') is not null then
    vid := (p->>'id')::uuid;
    sku_value := nullif(trim(p->>'sku'), '');
    update public.product_variants
       set sku = coalesce(sku_value, sku),
           barcode = coalesce(p->>'barcode', ''),
           size = trim(p->>'size'),
           color = trim(p->>'color'),
           model = trim(coalesce(p->>'model', '')),
           minimum = (p->>'minimum')::integer,
           cost = (p->>'cost')::bigint
     where id = vid and organization_id = o;
    if not found then raise exception 'Variação não encontrada'; end if;
    insert into public.audit_logs(organization_id,user_id,action,entity,entity_id,after_data)
      values(o,actor,'variant_edit','variant',vid,jsonb_build_object('id',vid));
  else
    sku_value := coalesce(nullif(trim(p->>'sku'), ''), 'EXC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
    result := public.command('variant', p || jsonb_build_object(
      'sku',sku_value,
      'request_id',coalesce(nullif(p->>'request_id','')::uuid,gen_random_uuid())
    ));
    vid := (result->>'id')::uuid;
    update public.product_variants set model = trim(coalesce(p->>'model',''))
      where id = vid and organization_id = o;
  end if;
  return jsonb_build_object('id',vid);
end $$;

create function public.set_catalog_visible(target_product_id uuid, visible boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o uuid := public.my_org();
  actor uuid := auth.uid();
begin
  if actor is null or o is null or not public.is_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  if visible and not exists(select 1 from public.product_variants v
    where v.organization_id=o and v.product_id=target_product_id) then
    raise exception 'Cadastre ao menos uma variação antes de publicar';
  end if;
  update public.products set catalog_visible=visible,updated_at=now()
    where id=target_product_id and organization_id=o;
  if not found then raise exception 'Produto não encontrado'; end if;
  insert into public.audit_logs(organization_id,user_id,action,entity,entity_id,after_data)
    values(o,actor,case when visible then 'catalog_publish' else 'catalog_unpublish' end,
      'product',target_product_id,jsonb_build_object('visible',visible));
  return jsonb_build_object('id',target_product_id);
end $$;

create function public.create_product_bundle(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o uuid := public.my_org();
  actor uuid := auth.uid();
  rid uuid := nullif(p->>'request_id','')::uuid;
  result jsonb;
  product_id uuid;
  variant jsonb;
begin
  if actor is null or o is null or not public.is_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  if rid is null then raise exception 'Chave de operação obrigatória'; end if;
  if p ? 'id' then raise exception 'Use edição para produto existente'; end if;
  if coalesce(jsonb_typeof(p->'variants'),'') <> 'array'
     or jsonb_array_length(p->'variants') not between 1 and 50 then
    raise exception 'Cadastre de 1 a 50 combinações de tamanho e cor';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(o::text,0));
  select k.result into result from public.operation_keys k
    where k.organization_id=o and k.request_id=rid;
  if found then return result; end if;
  result := public.command('product', p || jsonb_build_object('request_id',gen_random_uuid()));
  product_id := (result->>'id')::uuid;
  for variant in select value from jsonb_array_elements(p->'variants') loop
    perform public.save_variant(variant || jsonb_build_object(
      'product_id',product_id,
      'request_id',gen_random_uuid()
    ));
  end loop;
  if coalesce((p->>'catalog_visible')::boolean,false) then
    perform public.set_catalog_visible(product_id,true);
  end if;
  result := jsonb_build_object('id',product_id);
  insert into public.operation_keys(organization_id,request_id,result) values(o,rid,result);
  return result;
end $$;

revoke all on function public.save_variant(jsonb) from public,anon;
revoke all on function public.set_catalog_visible(uuid,boolean) from public,anon;
revoke all on function public.create_product_bundle(jsonb) from public,anon;
grant execute on function public.save_variant(jsonb),public.set_catalog_visible(uuid,boolean),public.create_product_bundle(jsonb) to authenticated;
