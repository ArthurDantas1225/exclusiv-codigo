-- Requires payment_status from 20261113123000_inter_manual_pix.sql.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table public.catalog_push_config (
  id boolean primary key default true check (id),
  vapid_public_key text not null,
  vapid_private_key text not null,
  dispatch_secret text not null check (length(dispatch_secret) >= 43),
  subject text not null default 'https://exclusiv-codigo.vercel.app',
  enabled boolean not null default false
);
create table public.catalog_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.catalog_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.catalog_orders(id),
  code text not null,
  payment_status text not null check (payment_status in ('awaiting_verification','paid')),
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0,
  delivered_at timestamptz,
  unique(order_id,payment_status)
);
create table public.catalog_push_deliveries (
  event_id uuid not null references public.catalog_notification_outbox(id) on delete cascade,
  subscription_id uuid not null references public.catalog_push_subscriptions(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  primary key(event_id,subscription_id)
);
create index catalog_push_pending on public.catalog_notification_outbox(next_attempt_at) where delivered_at is null;
create index catalog_push_user on public.catalog_push_subscriptions(user_id);

alter table public.catalog_push_config enable row level security;
alter table public.catalog_push_subscriptions enable row level security;
alter table public.catalog_notification_outbox enable row level security;
alter table public.catalog_push_deliveries enable row level security;
revoke all on public.catalog_push_config,public.catalog_push_subscriptions,public.catalog_notification_outbox,public.catalog_push_deliveries from public,anon,authenticated;
grant all on public.catalog_push_config,public.catalog_push_subscriptions,public.catalog_notification_outbox,public.catalog_push_deliveries to service_role;

create or replace function public.catalog_dispatch_notifications()
returns void language plpgsql security definer set search_path = '' as $$
declare cfg public.catalog_push_config;
begin
  select * into cfg from public.catalog_push_config where id and enabled;
  if not found or not exists (
    select 1 from public.catalog_notification_outbox where delivered_at is null and attempts < 20 and next_attempt_at <= now() and created_at > now() - interval '24 hours'
  ) then return; end if;
  perform net.http_post(
    url := 'https://sduacssupdhzwqmlijqv.supabase.co/functions/v1/team-notifications',
    headers := jsonb_build_object('content-type','application/json','x-dispatch-secret',cfg.dispatch_secret),
    body := '{"action":"dispatch"}'::jsonb,
    timeout_milliseconds := 10000
  );
exception when others then
  -- Notification infrastructure must never roll back a saved order/payment.
  raise warning 'Catalogue notification dispatch deferred';
end;
$$;
revoke all on function public.catalog_dispatch_notifications() from public,anon,authenticated;
grant execute on function public.catalog_dispatch_notifications() to service_role;

create or replace function public.catalog_enqueue_payment_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.payment_status in ('awaiting_verification','paid') then
    if tg_op = 'INSERT' or old.payment_status is distinct from new.payment_status then
      insert into public.catalog_notification_outbox(order_id,code,payment_status)
      values(new.id,new.code,new.payment_status) on conflict(order_id,payment_status) do nothing;
      perform public.catalog_dispatch_notifications();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.catalog_enqueue_payment_notification() from public,anon,authenticated;
create trigger catalog_payment_notification after insert or update of payment_status on public.catalog_orders
for each row execute function public.catalog_enqueue_payment_notification();

create or replace function public.catalog_claim_notifications()
returns setof public.catalog_notification_outbox language sql security definer set search_path = '' as $$
  update public.catalog_notification_outbox n
  set attempts = n.attempts + 1, next_attempt_at = now() + interval '2 minutes'
  where n.id in (
    select o.id from public.catalog_notification_outbox o
    where o.delivered_at is null and o.attempts < 20 and o.next_attempt_at <= now() and o.created_at > now() - interval '24 hours'
    order by o.created_at limit 10 for update skip locked
  ) returning n.*;
$$;
revoke all on function public.catalog_claim_notifications() from public,anon,authenticated;
grant execute on function public.catalog_claim_notifications() to service_role;
-- Disabled until the config row is explicitly enabled after deploying the function.
select cron.schedule('catalog-payment-notifications','* * * * *','select public.catalog_dispatch_notifications()');
