-- Reversible product/media removal and one-transaction product grid editing.
alter table public.products add column archived_at timestamptz;
alter table public.products add column archived_was_active boolean;
alter table public.products add column archived_was_public boolean;
alter table public.product_images add column color text not null default '';
alter table public.product_images add column view text not null default 'other'
  check (view in ('front','back','detail','other'));
alter table public.product_images add column hidden_at timestamptz;
create index on public.product_images(organization_id,product_id) where hidden_at is null;

create function public.save_product_grid(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o uuid := public.my_org(); actor uuid := auth.uid();
  rid uuid := nullif(p->>'request_id','')::uuid;
  pid uuid := nullif(p->>'id','')::uuid;
  result jsonb; item jsonb; old_stock integer; vid uuid;
  was_public boolean;
begin
  if actor is null or o is null or not public.is_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  if rid is null then raise exception 'Chave de operação obrigatória'; end if;
  if coalesce(jsonb_typeof(p->'variants'),'') <> 'array'
     or jsonb_array_length(p->'variants') not between 1 and 50 then
    raise exception 'Informe de 1 a 50 tamanhos e cores';
  end if;
  if (select count(distinct lower(trim(value->>'model')) || '|' ||
                lower(trim(value->>'color')) || '|' || lower(trim(value->>'size')))
      from jsonb_array_elements(p->'variants')) <> jsonb_array_length(p->'variants') then
    raise exception 'Modelo, cor e tamanho repetidos';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(o::text,0));
  select k.result into result from public.operation_keys k
   where k.organization_id=o and k.request_id=rid;
  if found then return result; end if;
  if pid is null then
    result := public.create_product_bundle(p);
    return result;
  end if;
  select catalog_visible into was_public from public.products
   where organization_id=o and id=pid and archived_at is null for update;
  if not found then raise exception 'Produto não encontrado ou arquivado'; end if;
  perform public.command('product', p || jsonb_build_object('request_id',gen_random_uuid()));
  for item in select value from jsonb_array_elements(p->'variants') loop
    if nullif(item->>'id','') is not null then
      vid := (item->>'id')::uuid;
      select stock into old_stock from public.product_variants
       where organization_id=o and product_id=pid and id=vid for update;
      if not found then raise exception 'Variação não pertence ao produto'; end if;
      perform public.save_variant(item || jsonb_build_object('product_id',pid));
      if (item->>'stock')::integer is null or (item->>'stock')::integer < 0 then
        raise exception 'Quantidade inválida';
      end if;
      if (item->>'stock')::integer <> old_stock then
        perform public.move_stock(o,vid,(item->>'stock')::integer-old_stock,
          'Edição da grade do produto',pid);
      end if;
    else
      perform public.save_variant(item || jsonb_build_object(
        'product_id',pid,'request_id',gen_random_uuid()));
    end if;
  end loop;
  if coalesce((p->>'catalog_visible')::boolean,false) <> was_public then
    perform public.set_catalog_visible(pid,coalesce((p->>'catalog_visible')::boolean,false));
  end if;
  result := jsonb_build_object('id',pid);
  insert into public.operation_keys(organization_id,request_id,result) values(o,rid,result);
  return result;
end $$;

create function public.set_product_archived(target_product_id uuid, archive boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o uuid := public.my_org(); actor uuid := auth.uid();
begin
  if actor is null or o is null or not public.is_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  if archive then
    update public.products set archived_at=now(),
      archived_was_active=active,archived_was_public=catalog_visible,
      active=false,catalog_visible=false,updated_at=now()
     where organization_id=o and id=target_product_id and archived_at is null;
  else
    update public.products set archived_at=null,
      active=coalesce(archived_was_active,true),
      catalog_visible=coalesce(archived_was_public,false),
      archived_was_active=null,archived_was_public=null,updated_at=now()
     where organization_id=o and id=target_product_id and archived_at is not null;
  end if;
  if not found then raise exception 'Produto não encontrado ou já atualizado'; end if;
  insert into public.audit_logs(organization_id,user_id,action,entity,entity_id)
    values(o,actor,case when archive then 'product_archive' else 'product_restore' end,'product',target_product_id);
  return jsonb_build_object('id',target_product_id);
end $$;

create function public.save_product_image(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o uuid := public.my_org(); actor uuid := auth.uid();
  pid uuid := (p->>'product_id')::uuid; iid uuid := nullif(p->>'id','')::uuid;
  media_color text := trim(coalesce(p->>'color',''));
  media_view text := coalesce(p->>'view','other'); result jsonb;
begin
  if actor is null or o is null or not public.is_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  if length(media_color)>80 or media_view not in ('front','back','detail','other') then
    raise exception 'Cor ou lado da foto inválido';
  end if;
  if not exists(select 1 from public.products where id=pid and organization_id=o and archived_at is null) then
    raise exception 'Produto inválido';
  end if;
  if iid is null then
    if coalesce(p->>'path','') not like o::text || '/' || pid::text || '/%' then
      raise exception 'Caminho de foto inválido';
    end if;
    result := public.command('image', p || jsonb_build_object('request_id',gen_random_uuid()));
    iid := (result->>'id')::uuid;
  end if;
  update public.product_images set color=media_color,view=media_view
   where id=iid and product_id=pid and organization_id=o and hidden_at is null;
  if not found then raise exception 'Foto não encontrada'; end if;
  if coalesce((p->>'is_primary')::boolean,false) then
    update public.product_images set is_primary=(id=iid)
     where organization_id=o and product_id=pid and hidden_at is null;
  end if;
  insert into public.audit_logs(organization_id,user_id,action,entity,entity_id,after_data)
    values(o,actor,'image_meta','image',iid,jsonb_build_object('color',media_color,'view',media_view));
  return jsonb_build_object('id',iid);
end $$;

create function public.set_product_image_hidden(target_image_id uuid, hide boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o uuid := public.my_org(); actor uuid := auth.uid();
begin
  if actor is null or o is null or not public.is_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  update public.product_images set hidden_at=case when hide then now() else null end
   where id=target_image_id and organization_id=o
     and (hidden_at is null) = hide;
  if not found then raise exception 'Foto não encontrada ou já atualizada'; end if;
  insert into public.audit_logs(organization_id,user_id,action,entity,entity_id)
    values(o,actor,case when hide then 'image_hide' else 'image_restore' end,'image',target_image_id);
  return jsonb_build_object('id',target_image_id);
end $$;

revoke all on function public.save_product_grid(jsonb),public.set_product_archived(uuid,boolean),
 public.save_product_image(jsonb),public.set_product_image_hidden(uuid,boolean) from public,anon;
grant execute on function public.save_product_grid(jsonb),public.set_product_archived(uuid,boolean),
 public.save_product_image(jsonb),public.set_product_image_hidden(uuid,boolean) to authenticated;
