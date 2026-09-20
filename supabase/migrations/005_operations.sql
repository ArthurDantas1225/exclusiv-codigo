create table public.suppliers(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null,phone text not null default '',email text not null default '',notes text not null default '',created_at timestamptz not null default now(),unique(organization_id,id));
create table public.purchase_orders(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),supplier_id uuid not null,total bigint not null check(total>=0),status text not null default 'ordered' check(status in ('ordered','partial','received','cancelled')),due_date date not null,created_at timestamptz not null default now(),created_by uuid not null references auth.users(id),unique(organization_id,id),foreign key(organization_id,supplier_id) references public.suppliers(organization_id,id));
create table public.purchase_order_items(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),purchase_id uuid not null,variant_id uuid not null,quantity integer not null check(quantity>0),received integer not null default 0 check(received>=0 and received<=quantity),unit_cost bigint not null check(unit_cost>=0),created_at timestamptz not null default now(),foreign key(organization_id,purchase_id) references public.purchase_orders(organization_id,id),foreign key(organization_id,variant_id) references public.product_variants(organization_id,id));
create table public.accounts_payable(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),supplier_id uuid,purchase_id uuid,description text not null,category text not null default 'Outros',amount bigint not null check(amount>0),paid bigint not null default 0 check(paid>=0 and paid<=amount),due_date date not null,recurring boolean not null default false,created_at timestamptz not null default now(),foreign key(organization_id,supplier_id) references public.suppliers(organization_id,id),foreign key(organization_id,purchase_id) references public.purchase_orders(organization_id,id));
create table public.product_images(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),product_id uuid not null,path text not null,is_primary boolean not null default false,created_at timestamptz not null default now(),foreign key(organization_id,product_id) references public.products(organization_id,id));
do $$ declare t text; begin foreach t in array array['suppliers','purchase_orders','purchase_order_items','accounts_payable','product_images'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy tenant_read on public.%I for select to authenticated using(organization_id=public.my_org())',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create index on public.%I(organization_id)',t);
 end loop; end $$;
alter function public.command(text,jsonb) rename to command_core;
revoke all on function public.command_core(text,jsonb) from public,anon,authenticated;
create function public.command(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o uuid:=public.my_org();actor uuid:=auth.uid();rid uuid;sid uuid;pid uuid;v uuid;r jsonb;x jsonb;t record;qty integer;total bigint:=0;val bigint;why text;
begin
 if o is null or not public.is_admin() then raise exception 'Acesso administrativo necessário'; end if;
 if action not in ('supplier','purchase','receive_purchase','payable','pay_bill','image','import') then return public.command_core(action,p); end if;
 perform pg_advisory_xact_lock(hashtextextended(o::text,0));rid:=(p->>'request_id')::uuid;
 if rid is null then raise exception 'Chave de operação obrigatória'; end if;
 select result into r from public.operation_keys where organization_id=o and request_id=rid; if found then return r; end if;
 if action='supplier' then
 sid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
 insert into public.suppliers(id,organization_id,name,phone,email,notes) values(sid,o,p->>'name',coalesce(p->>'phone',''),coalesce(p->>'email',''),coalesce(p->>'notes','')) on conflict(id) do update set name=excluded.name,phone=excluded.phone,email=excluded.email,notes=excluded.notes where suppliers.organization_id=o;
 if not found then raise exception 'Fornecedor inválido'; end if;
 elsif action='purchase' then
 if coalesce(jsonb_array_length(p->'items'),0) not between 1 and 100 then raise exception 'Informe os itens'; end if;
 for x in select * from jsonb_array_elements(p->'items') loop total:=total+(x->>'quantity')::int*(x->>'unit_cost')::bigint; end loop;
 insert into public.purchase_orders(organization_id,supplier_id,total,due_date,created_by) values(o,(p->>'supplier_id')::uuid,total,(p->>'due_date')::date,actor) returning id into sid;
 for x in select * from jsonb_array_elements(p->'items') loop
 insert into public.purchase_order_items(organization_id,purchase_id,variant_id,quantity,unit_cost) values(o,sid,(x->>'variant_id')::uuid,(x->>'quantity')::int,(x->>'unit_cost')::bigint);
 end loop;
 elsif action='receive_purchase' then
 sid:=(p->>'purchase_id')::uuid;
 select * into t from public.purchase_orders where id=sid and organization_id=o and status in ('ordered','partial') for update;
 if not found then raise exception 'Pedido não disponível'; end if;
 for x in select * from jsonb_array_elements(p->'items') loop
 qty:=(x->>'quantity')::integer; if qty is null or qty<=0 then raise exception 'Quantidade inválida'; end if;
 select variant_id,unit_cost into v,val from public.purchase_order_items where id=(x->>'id')::uuid and purchase_id=sid and organization_id=o and received+qty<=quantity for update;
 if not found then raise exception 'Recebimento acima do pedido ou item inválido'; end if;
 perform public.move_stock(o,v,qty,'Compra recebida',sid);
 update public.product_variants set cost=val where id=v and organization_id=o;
 update public.purchase_order_items set received=received+qty where id=(x->>'id')::uuid;
 total:=total+val*qty;
 end loop;
 if total<=0 then raise exception 'Nenhum recebimento informado'; end if;
 insert into public.accounts_payable(organization_id,supplier_id,purchase_id,description,category,amount,due_date) values(o,t.supplier_id,sid,'Recebimento de mercadoria','Mercadoria',total,t.due_date);
 update public.purchase_orders set status=case when exists(select 1 from public.purchase_order_items where purchase_id=sid and received<quantity) then 'partial' else 'received' end where id=sid;
 elsif action='payable' then
 insert into public.accounts_payable(organization_id,description,category,amount,due_date,recurring) values(o,p->>'description',coalesce(p->>'category','Outros'),(p->>'amount')::bigint,(p->>'due_date')::date,coalesce((p->>'recurring')::boolean,false)) returning id into sid;
 elsif action='pay_bill' then
 sid:=(p->>'id')::uuid;val:=(p->>'amount')::bigint;
 select * into t from public.accounts_payable where id=sid and organization_id=o for update;
 if not found or val is null or val<=0 or val>t.amount-t.paid then raise exception 'Valor inválido para esta conta'; end if;
 perform public.command_core('expense',jsonb_build_object('request_id',gen_random_uuid(),'amount',val,'description',t.category||': '||t.description,'method',p->>'method'));
 update public.accounts_payable set paid=paid+val where id=sid;
 if t.recurring and t.paid+val=t.amount then insert into public.accounts_payable(organization_id,description,category,amount,due_date,recurring) values(o,t.description,t.category,t.amount,(t.due_date+interval '1 month')::date,true); end if;
 elsif action='image' then
 pid:=(p->>'product_id')::uuid;why:=p->>'path';
 if split_part(why,'/',1)<>o::text then raise exception 'Caminho de imagem inválido'; end if;
 if coalesce((p->>'is_primary')::boolean,false) then update public.product_images set is_primary=false where organization_id=o and product_id=pid; end if;
 insert into public.product_images(organization_id,product_id,path,is_primary) values(o,pid,why,coalesce((p->>'is_primary')::boolean,false)) returning id into sid;
 elsif action='import' then
 if coalesce(jsonb_array_length(p->'rows'),0) not between 1 and 200 then raise exception 'Importe de 1 a 200 linhas por lote'; end if;
 for x in select * from jsonb_array_elements(p->'rows') loop
 if p->>'kind'='customers' then r:=public.command_core('customer',x||jsonb_build_object('request_id',gen_random_uuid()));
 elsif p->>'kind'='products' then
 r:=public.command_core('product',x||jsonb_build_object('request_id',gen_random_uuid()));
 r:=public.command_core('variant',x||jsonb_build_object('request_id',gen_random_uuid(),'product_id',r->>'id'));
 elsif p->>'kind'='stock' then
 select id into v from public.product_variants where sku=x->>'sku' and organization_id=o;
 if not found then raise exception 'SKU não encontrado: %',x->>'sku'; end if;
 r:=public.command_core('stock',x||jsonb_build_object('request_id',gen_random_uuid(),'variant_id',v,'reason','Importação CSV: '||coalesce(x->>'reason','ajuste')));
 else raise exception 'Tipo de importação inválido'; end if;
 end loop;sid:=rid;
 end if;
 r:=jsonb_build_object('id',sid);
 insert into public.audit_logs(organization_id,user_id,action,entity,entity_id,after_data) values(o,actor,action,action,sid,jsonb_build_object('request_id',rid));
 insert into public.operation_keys values(o,rid,r);return r;
end $$;
revoke all on function public.command(text,jsonb) from public,anon;
grant execute on function public.command(text,jsonb) to authenticated;
