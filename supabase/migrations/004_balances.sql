create function public.balances() returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('customers',coalesce((select jsonb_object_agg(customer_id,b) from (select customer_id,sum(amount) b from public.ledger where organization_id=public.my_org() and customer_id is not null and kind in ('debt','receipt','credit','credit_use') group by customer_id) q),'{}'), 'cash',coalesce((select jsonb_object_agg(id,b) from (select c.id,c.opening+coalesce((select sum(case when l.kind='receipt' then -l.amount else l.amount end) from public.ledger l where l.cash_session_id=c.id and l.method='Dinheiro' and l.kind not in ('debt','credit')),0) b from public.cash_sessions c where organization_id=public.my_org()) q),'{}'));
$$;
revoke all on function public.balances() from public,anon;
grant execute on function public.balances() to authenticated;
