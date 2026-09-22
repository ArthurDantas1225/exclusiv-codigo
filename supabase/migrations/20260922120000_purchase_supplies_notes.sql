alter table public.purchase_orders
  add column kind text not null default 'merchandise'
    check (kind in ('merchandise','bags','other')),
  add column notes text not null default '';

alter function public.command(text,jsonb) rename to command_operations_v1;
revoke all on function public.command_operations_v1(text,jsonb) from public,anon,authenticated;

create function public.command(action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  o uuid:=public.my_org(); actor uuid:=auth.uid(); rid uuid; sid uuid;
  v uuid; r jsonb; x jsonb; t record; qty integer; total bigint:=0;
  val bigint; purchase_kind text; purchase_notes text;
begin
  if action not in ('purchase','receive_purchase') then
    return public.command_operations_v1(action,p);
  end if;
  if o is null or not public.is_admin() then raise exception 'Acesso administrativo necessário'; end if;
  perform pg_advisory_xact_lock(hashtextextended(o::text,0));
  rid:=(p->>'request_id')::uuid;
  if rid is null then raise exception 'Chave de operação obrigatória'; end if;
  select result into r from public.operation_keys where organization_id=o and request_id=rid;
  if found then return r; end if;

  if action='purchase' then
    purchase_kind:=coalesce(nullif(p->>'kind',''),'merchandise');
    purchase_notes:=trim(coalesce(p->>'notes',''));
    if purchase_kind not in ('merchandise','bags','other') then raise exception 'Tipo de compra inválido'; end if;
    if length(purchase_notes)>2000 then raise exception 'Observação muito longa'; end if;
    if purchase_kind='merchandise' then
      if coalesce(jsonb_array_length(p->'items'),0) not between 1 and 100 then raise exception 'Informe os itens'; end if;
      for x in select * from jsonb_array_elements(p->'items') loop
        qty:=(x->>'quantity')::integer; val:=(x->>'unit_cost')::bigint;
        if qty is null or qty<=0 or val is null or val<0 then raise exception 'Item de compra inválido'; end if;
        total:=total+qty*val;
      end loop;
    else
      if coalesce(jsonb_array_length(p->'items'),0)<>0 then raise exception 'Compras sem SKU não aceitam itens de estoque'; end if;
      total:=(p->>'amount')::bigint;
      if total is null or total<=0 then raise exception 'Informe o valor do pedido'; end if;
    end if;
    insert into public.purchase_orders(organization_id,supplier_id,total,due_date,created_by,kind,notes)
    values(o,(p->>'supplier_id')::uuid,total,(p->>'due_date')::date,actor,purchase_kind,purchase_notes)
    returning id into sid;
    if purchase_kind='merchandise' then
      for x in select * from jsonb_array_elements(p->'items') loop
        insert into public.purchase_order_items(organization_id,purchase_id,variant_id,quantity,unit_cost)
        values(o,sid,(x->>'variant_id')::uuid,(x->>'quantity')::int,(x->>'unit_cost')::bigint);
      end loop;
    end if;
  else
    sid:=(p->>'purchase_id')::uuid;
    select * into t from public.purchase_orders
      where id=sid and organization_id=o and status in ('ordered','partial') for update;
    if not found then raise exception 'Pedido não disponível'; end if;
    if t.kind='merchandise' then
      for x in select * from jsonb_array_elements(p->'items') loop
        qty:=(x->>'quantity')::integer;
        if qty is null or qty<=0 then raise exception 'Quantidade inválida'; end if;
        select variant_id,unit_cost into v,val from public.purchase_order_items
          where id=(x->>'id')::uuid and purchase_id=sid and organization_id=o
            and received+qty<=quantity for update;
        if not found then raise exception 'Recebimento acima do pedido ou item inválido'; end if;
        perform public.move_stock(o,v,qty,'Compra recebida',sid);
        update public.product_variants set cost=val where id=v and organization_id=o;
        update public.purchase_order_items set received=received+qty where id=(x->>'id')::uuid;
        total:=total+val*qty;
      end loop;
      if total<=0 then raise exception 'Nenhum recebimento informado'; end if;
      insert into public.accounts_payable(organization_id,supplier_id,purchase_id,description,category,amount,due_date)
      values(o,t.supplier_id,sid,'Recebimento de mercadoria','Mercadoria',total,t.due_date);
      update public.purchase_orders set status=case when exists(
        select 1 from public.purchase_order_items where purchase_id=sid and received<quantity
      ) then 'partial' else 'received' end where id=sid;
    else
      if t.status<>'ordered' then raise exception 'Pedido sem SKU já recebido'; end if;
      insert into public.accounts_payable(organization_id,supplier_id,purchase_id,description,category,amount,due_date)
      values(o,t.supplier_id,sid,
        case when t.kind='bags' then 'Reposição de sacolas' else 'Compra sem SKU' end,
        case when t.kind='bags' then 'Sacolas e embalagens' else 'Suprimentos' end,
        t.total,t.due_date);
      update public.purchase_orders set status='received' where id=sid;
    end if;
  end if;
  r:=jsonb_build_object('id',sid);
  insert into public.audit_logs(organization_id,user_id,action,entity,entity_id,after_data)
  values(o,actor,action,action,sid,jsonb_build_object('request_id',rid));
  insert into public.operation_keys values(o,rid,r);
  return r;
end $$;

revoke all on function public.command(text,jsonb) from public,anon;
grant execute on function public.command(text,jsonb) to authenticated;
