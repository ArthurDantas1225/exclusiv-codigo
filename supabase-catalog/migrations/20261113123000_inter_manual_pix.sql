-- Manual Inter Pix configuration is private. Never put bank credentials here.
create table public.catalog_pix_settings (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 key text not null default '',
 receiver_name text not null default '',
 city text not null default '',
 updated_at timestamptz not null default now(),
 updated_by uuid,
 check (not enabled or (key ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' and length(receiver_name) between 1 and 25 and length(city) between 1 and 15))
);
alter table public.catalog_pix_settings enable row level security;
revoke all on public.catalog_pix_settings from anon, authenticated;
grant all on public.catalog_pix_settings to service_role;
insert into public.catalog_pix_settings(id) values(true);
alter table public.catalog_orders
 add column payment_status text not null default 'not_required' check(payment_status in ('not_required','awaiting_verification','paid')),
 add column pix_snapshot jsonb,
 add column payment_confirmed_at timestamptz,
 add column payment_confirmed_by uuid;
create or replace function public.freeze_catalog_pix() returns trigger language plpgsql security definer set search_path = '' as $$
declare config public.catalog_pix_settings%rowtype;
begin
 if new.payment = 'Pix' and new.total > 0 then
  select * into config from public.catalog_pix_settings where id and enabled;
  if found then
   new.pix_snapshot := jsonb_build_object('enabled',true,'key',config.key,'receiverName',config.receiver_name,'city',config.city);
   new.payment_status := 'awaiting_verification';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.freeze_catalog_pix() from public,anon,authenticated;
create trigger freeze_catalog_pix before insert on public.catalog_orders for each row execute function public.freeze_catalog_pix();
create or replace function public.mark_catalog_pix_paid(p_order_id uuid,p_actor uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.catalog_orders%rowtype;
begin
 if p_actor is null then raise exception 'actor_required'; end if;
 select * into target from public.catalog_orders where id=p_order_id for update;
 if not found or target.status not in ('pending','failed') or target.payment_status='not_required' then raise exception 'order_not_payable';end if;
 if target.payment_status='paid' then return jsonb_build_object('ok',true,'alreadyPaid',true);end if;
 update public.catalog_orders set payment_status='paid',payment_confirmed_at=now(),payment_confirmed_by=p_actor,updated_at=now() where id=p_order_id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.mark_catalog_pix_paid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mark_catalog_pix_paid(uuid,uuid) to service_role;
