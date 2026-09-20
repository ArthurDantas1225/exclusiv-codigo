-- EXCLUSIV: amounts are integer BRL cents. No business writes through REST.
-- Some Supabase projects install this event-trigger helper in public with
-- default RPC EXECUTE privileges. The trigger continues to run without them.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
create table public.organizations(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz not null default now());
create table public.profiles(id uuid primary key references auth.users(id),organization_id uuid not null references public.organizations(id),name text not null,email text not null,role text not null default 'admin' check(role in ('admin','manager','seller')),active boolean not null default true,created_at timestamptz not null default now());
create function public.my_org() returns uuid language sql stable security definer set search_path='' as $$ select organization_id from public.profiles where id=auth.uid() and active $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select role='admin' from public.profiles where id=auth.uid() and active),false) $$;
create table public.products(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null check(length(name)>0),category text not null default '',collection text not null default '',price bigint not null check(price>=0),active boolean not null default true,image_path text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,id));
create table public.product_variants(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),product_id uuid not null,sku text not null,barcode text not null default '',size text not null,color text not null,stock integer not null default 0 check(stock>=0),minimum integer not null default 2 check(minimum>=0),cost bigint not null default 0 check(cost>=0),created_at timestamptz not null default now(),unique(organization_id,id),unique(organization_id,sku),foreign key(organization_id,product_id) references public.products(organization_id,id));
create table public.customers(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null check(length(name)>0),phone text not null default '',email text not null default '',instagram text not null default '',notes text not null default '',tags text not null default '',marketing_consent boolean not null default false,credit_enabled boolean not null default false,credit_limit bigint not null default 0 check(credit_limit>=0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,id));
create table public.cash_sessions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),opening bigint not null check(opening>=0),counted bigint check(counted>=0),expected bigint,status text not null default 'open' check(status in ('open','closed')),created_by uuid not null references auth.users(id),closed_by uuid references auth.users(id),created_at timestamptz not null default now(),closed_at timestamptz,unique(organization_id,id));
create unique index one_open_cash on public.cash_sessions(organization_id) where status='open';
create table public.sales(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),number bigint generated always as identity,request_id uuid not null,customer_id uuid,gross bigint not null check(gross>=0),discount bigint not null check(discount>=0 and discount<=gross),total bigint not null check(total>=0),cost bigint not null check(cost>=0),tendered bigint not null default 0,change_amount bigint not null default 0 check(change_amount>=0),status text not null default 'completed' check(status in ('completed','cancelled','returned','partially_returned')),notes text not null default '',cancel_reason text,cancelled_at timestamptz,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(organization_id,id),unique(organization_id,request_id),foreign key(organization_id,customer_id) references public.customers(organization_id,id));
create table public.sale_items(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),sale_id uuid not null,variant_id uuid not null,product_name text not null,variant_description text not null,quantity integer not null check(quantity>0),unit_price bigint not null check(unit_price>=0),unit_cost bigint not null check(unit_cost>=0),total bigint not null check(total>=0),returned integer not null default 0 check(returned>=0 and returned<=quantity),foreign key(organization_id,sale_id) references public.sales(organization_id,id),foreign key(organization_id,variant_id) references public.product_variants(organization_id,id));
create table public.sale_payments(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),sale_id uuid not null,method text not null check(method in ('Pix','Dinheiro','Débito','Crédito','Fiado','Crédito na loja','Outro')),amount bigint not null check(amount>0),installments integer not null default 1,fee bigint not null default 0,expected_date date,foreign key(organization_id,sale_id) references public.sales(organization_id,id));
create table public.ledger(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),customer_id uuid,sale_id uuid,cash_session_id uuid,kind text not null check(kind in ('sale','debt','receipt','credit','credit_use','expense','income','withdrawal','supply','reversal','refund')),amount bigint not null,cost_delta bigint not null default 0,description text not null,method text not null,due_date date not null default (now() at time zone 'America/Fortaleza')::date,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),foreign key(organization_id,customer_id) references public.customers(organization_id,id),foreign key(organization_id,sale_id) references public.sales(organization_id,id),foreign key(organization_id,cash_session_id) references public.cash_sessions(organization_id,id));
create table public.inventory_movements(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),variant_id uuid not null,quantity integer not null,before_stock integer not null,after_stock integer not null check(after_stock>=0),reason text not null,reference_id uuid,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),foreign key(organization_id,variant_id) references public.product_variants(organization_id,id));
create table public.crm_tasks(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),customer_id uuid not null,description text not null,due_date date not null,status text not null default 'pending' check(status in ('pending','completed','cancelled')),stage text not null default 'Novo contato',created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),foreign key(organization_id,customer_id) references public.customers(organization_id,id));
create table public.app_settings(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),key text not null,value text not null,unique(organization_id,key));
create table public.audit_logs(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),user_id uuid not null references auth.users(id),action text not null,entity text not null,entity_id uuid,before_data jsonb,after_data jsonb,created_at timestamptz not null default now());
create table public.operation_keys(organization_id uuid not null references public.organizations(id),request_id uuid not null,result jsonb not null,primary key(organization_id,request_id));
create table public.inventory_counts(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),status text not null default 'open',created_at timestamptz not null default now(),created_by uuid not null references auth.users(id),unique(organization_id,id));
create table public.inventory_count_items(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),count_id uuid not null,variant_id uuid not null,expected integer not null,counted integer check(counted>=0),foreign key(organization_id,count_id) references public.inventory_counts(organization_id,id),foreign key(organization_id,variant_id) references public.product_variants(organization_id,id),unique(count_id,variant_id));
-- Uniform tenant isolation and read-only API grants. All writes pass guarded RPC.
do $$ declare t text; begin
 foreach t in array array['profiles','products','product_variants','customers','cash_sessions','sales','sale_items','sale_payments','ledger','inventory_movements','crm_tasks','app_settings','audit_logs','operation_keys','inventory_counts','inventory_count_items'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy tenant_read on public.%I for select to authenticated using (organization_id=public.my_org())',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create index on public.%I(organization_id)',t);
 end loop;
end $$;
alter table public.organizations enable row level security;
create policy own_org on public.organizations for select to authenticated using(id=public.my_org());
revoke all on public.organizations from anon,authenticated;
grant select on public.organizations to authenticated;
create index sales_date on public.sales(organization_id,created_at desc);
create index sales_customer on public.sales(organization_id,customer_id);
create index variant_product on public.product_variants(organization_id,product_id);
create index variant_barcode on public.product_variants(organization_id,barcode);
create index ledger_customer on public.ledger(organization_id,customer_id);
create index item_sale on public.sale_items(organization_id,sale_id);
create index item_variant on public.sale_items(organization_id,variant_id);
create index ledger_date on public.ledger(organization_id,created_at);
create index tasks_due on public.crm_tasks(organization_id,status,due_date);
-- Internal helper: intentionally inaccessible to application roles.
create function public.move_stock(o uuid,v uuid,q integer,why text,ref uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare old integer; begin
 select stock into old from public.product_variants where id=v and organization_id=o for update;
 if not found or old+q<0 then raise exception 'Estoque insuficiente ou variante inexistente'; end if;
 update public.product_variants set stock=old+q where id=v and organization_id=o;
 insert into public.inventory_movements(organization_id,variant_id,quantity,before_stock,after_stock,reason,reference_id,created_by) values(o,v,q,old,old+q,why,ref,auth.uid());
end $$;
create function public.command(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o uuid; actor uuid; sid uuid; cid uuid; vid uuid; rid uuid; cs uuid; result jsonb; x jsonb; v record; pr record; c record; s record; it record; e record; gross bigint:=0; disc bigint:=0; total bigint:=0; paid bigint:=0; debt bigint:=0; store_credit bigint:=0; cash_payment bigint:=0; cash_tendered bigint:=0; cost_total bigint:=0; qty integer; amount bigint; current_balance bigint; cash_expected bigint; old jsonb; returned_value bigint; why text;
begin
 actor:=auth.uid(); o:=public.my_org();
 if actor is null or o is null or not public.is_admin() then raise exception 'Acesso administrativo necessário'; end if;
 -- Serialize mutations per shop; prevents stock/credit/cash races and repeat submits.
 perform pg_advisory_xact_lock(hashtextextended(o::text,0));
 rid:=(p->>'request_id')::uuid;
 if rid is null then raise exception 'Chave de operação obrigatória'; end if;
 select k.result into result from public.operation_keys k where organization_id=o and request_id=rid;
 if found then return result; end if;
 select id into cs from public.cash_sessions where organization_id=o and status='open' for update;
 if action='product' then
 sid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
 select to_jsonb(t) into old from public.products t where id=sid and organization_id=o;
 insert into public.products(id,organization_id,name,category,collection,price,active) values(sid,o,trim(p->>'name'),coalesce(p->>'category',''),coalesce(p->>'collection',''),(p->>'price')::bigint,coalesce((p->>'active')::boolean,true)) on conflict(id) do update set name=excluded.name,category=excluded.category,collection=excluded.collection,price=excluded.price,active=excluded.active,updated_at=now() where products.organization_id=o;
 if not found then raise exception 'Produto inválido'; end if;
 elsif action='variant' then
 sid:=gen_random_uuid();
 insert into public.product_variants(id,organization_id,product_id,sku,barcode,size,color,minimum,cost) values(sid,o,(p->>'product_id')::uuid,trim(p->>'sku'),coalesce(p->>'barcode',''),p->>'size',p->>'color',(p->>'minimum')::integer,(p->>'cost')::bigint);
 qty:=(p->>'stock')::integer; if qty<0 then raise exception 'Estoque inválido'; end if;
 perform public.move_stock(o,sid,qty,'Entrada inicial',sid);
 elsif action='stock' then
 sid:=(p->>'variant_id')::uuid; why:=trim(p->>'reason');
 if coalesce(length(why),0)<3 then raise exception 'Informe o motivo'; end if;
 perform public.move_stock(o,sid,(p->>'quantity')::integer,why,sid);
 elsif action='customer' then
 sid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
 select to_jsonb(t) into old from public.customers t where id=sid and organization_id=o;
 insert into public.customers(id,organization_id,name,phone,email,instagram,notes,tags,marketing_consent,credit_enabled,credit_limit) values(sid,o,trim(p->>'name'),coalesce(p->>'phone',''),coalesce(p->>'email',''),coalesce(p->>'instagram',''),coalesce(p->>'notes',''),coalesce(p->>'tags',''),coalesce((p->>'marketing_consent')::boolean,false),coalesce((p->>'credit_enabled')::boolean,false),coalesce((p->>'credit_limit')::bigint,0)) on conflict(id) do update set name=excluded.name,phone=excluded.phone,email=excluded.email,instagram=excluded.instagram,notes=excluded.notes,tags=excluded.tags,marketing_consent=excluded.marketing_consent,credit_enabled=excluded.credit_enabled,credit_limit=excluded.credit_limit,updated_at=now() where customers.organization_id=o;
 if not found then raise exception 'Cliente inválido'; end if;
 elsif action='sale' then
 if cs is null then raise exception 'Abra o caixa antes de vender'; end if;
 cid:=nullif(p->>'customer_id','')::uuid;
 if cid is not null then select * into c from public.customers where id=cid and organization_id=o for update; if not found then raise exception 'Cliente inválido'; end if; end if;
 if coalesce(jsonb_array_length(p->'items'),0) not between 1 and 100 then raise exception 'Carrinho inválido'; end if;
 if (select count(distinct a->>'variant_id') from jsonb_array_elements(p->'items') a)<>jsonb_array_length(p->'items') then raise exception 'Variante duplicada'; end if;
 for x in select * from jsonb_array_elements(p->'items') loop
 select * into v from public.product_variants where id=(x->>'variant_id')::uuid and organization_id=o for update;
 if not found then raise exception 'Variante inválida'; end if;
 select * into pr from public.products where id=v.product_id and organization_id=o and active;
 if not found then raise exception 'Produto inativo'; end if;
 qty:=(x->>'quantity')::integer; amount:=(x->>'unit_price')::bigint;
 if qty is null or qty<=0 or qty>v.stock or amount is null or amount<0 then raise exception 'Quantidade, preço ou estoque inválido'; end if;
 gross:=gross+qty*amount; cost_total:=cost_total+qty*v.cost;
 end loop;
 disc:=(p->>'discount')::bigint;
 if disc is null or disc<0 or disc>gross then raise exception 'Desconto inválido'; end if;
 total:=gross-disc;
 if coalesce(jsonb_array_length(p->'payments'),0)<1 then raise exception 'Informe o pagamento'; end if;
 for x in select * from jsonb_array_elements(p->'payments') loop
 amount:=(x->>'amount')::bigint;
 if amount is null or amount<=0 or (x->>'method') not in ('Pix','Dinheiro','Débito','Crédito','Fiado','Crédito na loja','Outro') then raise exception 'Pagamento inválido'; end if;
 paid:=paid+amount; if x->>'method'='Dinheiro' then cash_payment:=cash_payment+amount; end if; if x->>'method'='Crédito na loja' then store_credit:=store_credit+amount; end if; if x->>'method'='Fiado' then debt:=debt+amount; end if;
 end loop;
 cash_tendered:=coalesce((p->>'tendered')::bigint,cash_payment); if cash_tendered<cash_payment then raise exception 'Dinheiro entregue insuficiente'; end if;
 if paid<>total then raise exception 'Pagamentos devem somar o total da venda'; end if;
 if store_credit>0 then
 if cid is null then raise exception 'Crédito exige cliente'; end if;
 select coalesce(sum(l.amount),0) into current_balance from public.ledger l where organization_id=o and customer_id=cid and kind in ('debt','receipt','credit','credit_use');
 if store_credit>greatest(-current_balance,0) then raise exception 'Crédito na loja insuficiente'; end if;
 end if;
 if debt>0 then
 if cid is null or not c.credit_enabled then raise exception 'Cliente sem autorização para fiado'; end if;
 select coalesce(sum(l.amount),0) into current_balance from public.ledger l where organization_id=o and customer_id=cid and kind in ('debt','receipt','credit','credit_use');
 if current_balance+debt>c.credit_limit then raise exception 'Limite de crédito excedido'; end if;
 end if;
 sid:=gen_random_uuid();
 insert into public.sales(id,organization_id,request_id,customer_id,gross,discount,total,cost,tendered,change_amount,notes,created_by) values(sid,o,rid,cid,gross,disc,total,cost_total,cash_tendered,greatest(cash_tendered-cash_payment,0),coalesce(p->>'notes',''),actor);
 for x in select * from jsonb_array_elements(p->'items') loop
 select * into v from public.product_variants where id=(x->>'variant_id')::uuid and organization_id=o;
 select * into pr from public.products where id=v.product_id and organization_id=o;
 qty:=(x->>'quantity')::integer; amount:=(x->>'unit_price')::bigint;
 insert into public.sale_items(organization_id,sale_id,variant_id,product_name,variant_description,quantity,unit_price,unit_cost,total) values(o,sid,v.id,pr.name,v.color||' / '||v.size,qty,amount,v.cost,qty*amount);
 perform public.move_stock(o,v.id,-qty,'Venda',sid);
 end loop;
 for x in select * from jsonb_array_elements(p->'payments') loop
 insert into public.sale_payments(organization_id,sale_id,method,amount) values(o,sid,x->>'method',(x->>'amount')::bigint);
 insert into public.ledger(organization_id,customer_id,sale_id,cash_session_id,kind,amount,description,method,created_by) values(o,cid,sid,cs,case when x->>'method'='Fiado' then 'debt' when x->>'method'='Crédito na loja' then 'credit_use' else 'sale' end,(x->>'amount')::bigint,'Venda',x->>'method',actor);
 end loop;
 elsif action='cancel' then
 sid:=(p->>'sale_id')::uuid; why:=trim(p->>'reason');
 if coalesce(length(why),0)<3 then raise exception 'Informe o motivo'; end if;
 select * into s from public.sales where id=sid and organization_id=o for update;
 if not found or s.status<>'completed' then raise exception 'Venda não pode ser cancelada'; end if;
 if exists(select 1 from public.ledger where organization_id=o and customer_id=s.customer_id and kind='receipt') and exists(select 1 from public.sale_payments where sale_id=sid and method='Fiado') then raise exception 'Fiado com recebimentos: use devolução para crédito'; end if;
 if cs is null and exists(select 1 from public.sale_payments where sale_id=sid and method='Dinheiro') then raise exception 'Abra o caixa para estornar dinheiro'; end if;
 for it in select * from public.sale_items where sale_id=sid and organization_id=o loop perform public.move_stock(o,it.variant_id,it.quantity,'Cancelamento: '||why,sid); end loop;
 for e in select * from public.ledger where sale_id=sid and organization_id=o and kind in ('sale','debt','credit_use') loop
 insert into public.ledger(organization_id,customer_id,sale_id,cash_session_id,kind,amount,description,method,created_by) values(o,e.customer_id,sid,cs,case when e.kind in ('debt','credit_use') then 'credit' else 'reversal' end,-e.amount,'Cancelamento: '||why,e.method,actor);
 end loop;
 update public.sales set status='cancelled',cancel_reason=why,cancelled_at=now() where id=sid;
 elsif action='return' then
 sid:=(p->>'sale_id')::uuid; why:=trim(p->>'reason');
 if coalesce(length(why),0)<3 then raise exception 'Informe o motivo'; end if;
 select * into s from public.sales where id=sid and organization_id=o for update;
 if not found or s.status not in ('completed','partially_returned') then raise exception 'Venda inválida'; end if;
 select * into it from public.sale_items where id=(p->>'item_id')::uuid and sale_id=sid and organization_id=o for update;
 qty:=(p->>'quantity')::integer;
 if not found or qty is null or qty<=0 or qty>it.quantity-it.returned then raise exception 'Quantidade inválida'; end if;
 returned_value:=round(it.unit_price::numeric*qty*(s.gross-s.discount)/nullif(s.gross,0));
 -- Exact final refund absorbs rounding residues from previous partial returns.
 if not exists(select 1 from public.sale_items where sale_id=sid and id<>it.id and returned<quantity) and it.returned+qty=it.quantity then
 select s.total-coalesce(-sum(ledger.amount),0) into returned_value from public.ledger where sale_id=sid and kind in ('refund','credit');
 end if;
 if p->>'method'='Crédito na loja' then if s.customer_id is null then raise exception 'Crédito exige cliente'; end if;
 else
 if exists(select 1 from public.sale_payments where sale_id=sid and method='Fiado') then raise exception 'Devolução de fiado deve gerar crédito na conta'; end if;
 if p->>'method' not in ('Pix','Dinheiro') then raise exception 'Forma de estorno inválida'; end if;
 if p->>'method'='Dinheiro' and cs is null then raise exception 'Abra o caixa'; end if;
 end if;
 perform public.move_stock(o,it.variant_id,qty,'Devolução: '||why,sid);
 update public.sale_items set returned=returned+qty where id=it.id;
 update public.sales set status=case when exists(select 1 from public.sale_items where sale_id=sid and returned<quantity) then 'partially_returned' else 'returned' end where id=sid;
 insert into public.ledger(organization_id,customer_id,sale_id,cash_session_id,kind,amount,description,method,created_by) values(o,s.customer_id,sid,cs,case when p->>'method'='Crédito na loja' then 'credit' else 'refund' end,-returned_value,'Devolução: '||why,p->>'method',actor);
 update public.ledger set cost_delta=-it.unit_cost*qty where organization_id=o and sale_id=sid and created_at=now() and description='Devolução: '||why;
 elsif action='open_cash' then
 if cs is not null then raise exception 'Já existe caixa aberto'; end if;
 insert into public.cash_sessions(organization_id,opening,created_by) values(o,(p->>'amount')::bigint,actor) returning id into sid;
 elsif action='close_cash' then
 if cs is null then raise exception 'Caixa fechado'; end if;
 select opening into cash_expected from public.cash_sessions where id=cs;
 select cash_expected+coalesce(sum(case when kind='receipt' then -ledger.amount else ledger.amount end),0) into cash_expected from public.ledger where cash_session_id=cs and method='Dinheiro' and kind not in ('debt','credit');
 update public.cash_sessions set status='closed',expected=cash_expected,counted=(p->>'amount')::bigint,closed_at=now(),closed_by=actor where id=cs;
 sid:=cs;
 elsif action in ('expense','income','supply','withdrawal','receipt') then
 amount:=(p->>'amount')::bigint; why:=trim(p->>'description');
 if amount is null or amount<=0 or coalesce(length(why),0)<3 then raise exception 'Valor e descrição obrigatórios'; end if;
 if p->>'method' not in ('Pix','Dinheiro','Débito','Crédito','Outro') then raise exception 'Pagamento inválido'; end if;
 if p->>'method'='Dinheiro' and cs is null then raise exception 'Abra o caixa'; end if;
 if action in ('supply','withdrawal') and p->>'method'<>'Dinheiro' then raise exception 'Movimentação deve ser em dinheiro'; end if;
 cid:=nullif(p->>'customer_id','')::uuid;
 if action='receipt' then
 select id into cid from public.customers where id=cid and organization_id=o for update;
 if not found then raise exception 'Cliente inválido'; end if;
 select coalesce(sum(l.amount),0) into current_balance from public.ledger l where organization_id=o and customer_id=cid and kind in ('debt','receipt','credit','credit_use');
 if amount>current_balance then raise exception 'Valor maior que o saldo devedor'; end if;
 end if;
 insert into public.ledger(organization_id,customer_id,cash_session_id,kind,amount,description,method,due_date,created_by) values(o,cid,cs,action,case when action in ('expense','withdrawal','receipt') then -amount else amount end,why,p->>'method',coalesce(nullif(p->>'due_date','')::date,(now() at time zone 'America/Fortaleza')::date),actor) returning id into sid;
 elsif action='task' then
 sid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
 insert into public.crm_tasks(id,organization_id,customer_id,description,due_date,status,stage,created_by) values(sid,o,(p->>'customer_id')::uuid,p->>'description',(p->>'due_date')::date,coalesce(p->>'status','pending'),coalesce(p->>'stage','Novo contato'),actor) on conflict(id) do update set description=excluded.description,due_date=excluded.due_date,status=excluded.status,stage=excluded.stage where crm_tasks.organization_id=o;
 if not found then raise exception 'Tarefa inválida'; end if;
 elsif action='setting' then
 insert into public.app_settings(organization_id,key,value) values(o,p->>'key',p->>'value') on conflict(organization_id,key) do update set value=excluded.value returning id into sid;
 elsif action='anonymize' then
 sid:=(p->>'customer_id')::uuid;
 if exists(select 1 from public.ledger where organization_id=o and customer_id=sid and kind in ('debt','receipt','credit','credit_use') group by customer_id having sum(ledger.amount)<>0) then raise exception 'Resolva o saldo antes de anonimizar'; end if;
 update public.customers set name='Cliente anonimizado',phone='',email='',instagram='',notes='',tags='',marketing_consent=false,credit_enabled=false,updated_at=now() where id=sid and organization_id=o;
 if not found then raise exception 'Cliente inválido'; end if;
 update public.crm_tasks set description='Dados removidos',status='cancelled' where customer_id=sid and organization_id=o;
 elsif action='start_count' then
 insert into public.inventory_counts(organization_id,created_by) values(o,actor) returning id into sid;
 insert into public.inventory_count_items(organization_id,count_id,variant_id,expected) select o,sid,id,stock from public.product_variants where organization_id=o;
 elsif action='finish_count' then
 sid:=(p->>'count_id')::uuid;
 perform 1 from public.inventory_counts where id=sid and organization_id=o and status='open' for update;
 if not found then raise exception 'Inventário inválido'; end if;
 for x in select * from jsonb_array_elements(p->'items') loop
 update public.inventory_count_items set counted=(x->>'counted')::integer where count_id=sid and variant_id=(x->>'variant_id')::uuid and organization_id=o;
 end loop;
 if exists(select 1 from public.inventory_count_items where count_id=sid and counted is null) then raise exception 'Conte todos os SKUs'; end if;
 for it in select * from public.inventory_count_items where count_id=sid and organization_id=o loop
 select stock into qty from public.product_variants where id=it.variant_id for update;
 if qty<>it.expected then raise exception 'Estoque mudou durante a contagem. Inicie novo inventário'; end if;
 perform public.move_stock(o,it.variant_id,it.counted-it.expected,'Inventário',sid);
 end loop;
 update public.inventory_counts set status='completed' where id=sid;
 else raise exception 'Operação desconhecida'; end if;
 result:=jsonb_build_object('id',sid);
 -- Customer audit omits private snapshots; operation metadata remains traceable.
 insert into public.audit_logs(organization_id,user_id,action,entity,entity_id,before_data,after_data) values(o,actor,action,action,sid,case when action='customer' then null else old end,case when action in ('customer','anonymize','task') then jsonb_build_object('id',sid) else p end);
 insert into public.operation_keys values(o,rid,result);
 return result;
end $$;
revoke all on function public.move_stock(uuid,uuid,integer,text,uuid) from public,anon,authenticated;
revoke all on function public.command(text,jsonb) from public,anon;
grant execute on function public.command(text,jsonb) to authenticated;
revoke all on function public.my_org() from public,anon;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.my_org(),public.is_admin() to authenticated;
