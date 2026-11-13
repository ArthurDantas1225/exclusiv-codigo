-- Applied to ERP database, not catalogue. A random shared secret is seeded separately.
create schema if not exists catalog_notifications;
revoke all on schema catalog_notifications from public, anon, authenticated;
create table if not exists catalog_notifications.dispatch_config (
  id boolean primary key default true check (id),
  dispatch_secret text not null check (length(dispatch_secret) >= 43)
);
revoke all on catalog_notifications.dispatch_config from public, anon, authenticated;

create or replace function public.is_catalog_notification_member(p_user_id uuid, p_secret text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or length(p_secret) < 43 or not exists (
    select 1 from catalog_notifications.dispatch_config c where c.id and c.dispatch_secret = p_secret
  ) then return false; end if;
  return exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.active
      and p.organization_id = 'f993c345-a8ed-4ea4-a91d-b0f7f7946151'::uuid
  );
end;
$$;
revoke all on function public.is_catalog_notification_member(uuid,text) from public, anon, authenticated;
grant execute on function public.is_catalog_notification_member(uuid,text) to anon, authenticated, service_role;
