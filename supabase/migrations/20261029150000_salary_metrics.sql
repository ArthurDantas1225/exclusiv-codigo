-- Salary is derived from immutable sale totals/costs and return ledger entries.
create or replace function public.salary_metrics(start_date date,end_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o uuid:=public.my_org(); r jsonb;
begin
 if o is null then raise exception 'Não autenticado'; end if;
 with return_progress as (
   select
     l.id,
     l.created_at,
     l.amount as revenue,
     l.cost_delta as cost,
     s.created_by as user_id,
     greatest(-l.amount+l.cost_delta,0::bigint) as returned_profit,
     greatest(s.total-s.cost,0::bigint) as original_profit,
     sum(greatest(-l.amount+l.cost_delta,0::bigint)) over (
       partition by l.sale_id order by l.created_at,l.id
     ) as cumulative_returned_profit
   from public.ledger l
   join public.sales s on s.id=l.sale_id and s.organization_id=l.organization_id
   where l.organization_id=o
     and s.status<>'cancelled'
     and l.kind in ('refund','credit')
     and l.description like 'Devolução:%'
 ), events as (
   select
     s.created_by as user_id,
     1::bigint as sales,
     s.total as revenue,
     s.cost,
     floor(greatest(s.total-s.cost,0::bigint)::numeric/2)::bigint as salary_delta
   from public.sales s
   where s.organization_id=o
     and s.status<>'cancelled'
     and (s.created_at at time zone 'America/Fortaleza')::date between start_date and end_date
   union all
   select
     rp.user_id,
     0::bigint,
     rp.revenue,
     rp.cost,
     floor(greatest(rp.original_profit-rp.cumulative_returned_profit,0::bigint)::numeric/2)::bigint
       - floor(greatest(rp.original_profit-(rp.cumulative_returned_profit-rp.returned_profit),0::bigint)::numeric/2)::bigint
   from return_progress rp
   where (rp.created_at at time zone 'America/Fortaleza')::date between start_date and end_date
 ), seller_totals as (
   select
     user_id,
     sum(sales)::bigint as sales,
     sum(revenue)::bigint as revenue,
     sum(cost)::bigint as cost,
     sum(revenue-cost)::bigint as gross_profit,
     sum(salary_delta)::bigint as salary
   from events
   group by user_id
 )
 select jsonb_build_object(
   'salary',coalesce((select sum(salary_delta) from events),0),
   'seller_salary',coalesce((
     select jsonb_agg(jsonb_build_object(
       'user_id',st.user_id,
       'name',p.name,
       'sales',st.sales,
       'revenue',st.revenue,
       'cost',st.cost,
       'gross_profit',st.gross_profit,
       'salary',st.salary
     ) order by p.name)
     from seller_totals st
     join public.profiles p on p.id=st.user_id and p.organization_id=o
   ),'[]'::jsonb)
 ) into r;
 return r;
end $$;

revoke all on function public.salary_metrics(date,date) from public,anon;
grant execute on function public.salary_metrics(date,date) to authenticated;

create or replace function public.metrics(start_date date,end_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o uuid:=public.my_org(); r jsonb;
begin
 if o is null then raise exception 'Não autenticado'; end if;
 select jsonb_build_object(
 'revenue',coalesce(sum(total),0), 'gross',coalesce(sum(gross),0),'discount',coalesce(sum(discount),0),'cost',coalesce(sum(cost),0)+(select coalesce(sum(cost_delta),0) from public.ledger where organization_id=o and (created_at at time zone 'America/Fortaleza')::date between start_date and end_date),'count',count(*),
 'expenses',(select coalesce(-sum(amount),0) from public.ledger where organization_id=o and kind='expense' and description not like 'Mercadoria:%' and (created_at at time zone 'America/Fortaleza')::date between start_date and end_date),
 'refunds',(select coalesce(-sum(amount),0) from public.ledger where organization_id=o and kind in ('refund','credit') and description like 'Devolução:%' and (created_at at time zone 'America/Fortaleza')::date between start_date and end_date),
 'receivable',(select coalesce(sum(greatest(b,0)),0) from (select sum(amount) b from public.ledger where organization_id=o and kind in ('debt','receipt','credit','credit_use') group by customer_id) q),
 'low_stock',(select count(*) from public.product_variants where organization_id=o and stock<=minimum),
 'units',(select coalesce(sum(stock),0) from public.product_variants where organization_id=o),
 'stock_cost',(select coalesce(sum(stock*cost),0) from public.product_variants where organization_id=o),
 'daily',(select coalesce(jsonb_agg(d),'[]') from (select (created_at at time zone 'America/Fortaleza')::date as day,sum(total) revenue,count(*) sales from public.sales where organization_id=o and status<>'cancelled' and (created_at at time zone 'America/Fortaleza')::date between start_date and end_date group by 1 order by 1) d),
 'monthly',(select coalesce(jsonb_agg(m),'[]') from (select extract(month from created_at at time zone 'America/Fortaleza')::int as month,sum(total) revenue,count(*) sales,sum(cost) cost from public.sales where organization_id=o and status<>'cancelled' and extract(year from created_at at time zone 'America/Fortaleza')=extract(year from start_date) group by 1 order by 1) m),
 'payments',(select coalesce(jsonb_agg(m),'[]') from (select sp.method,sum(sp.amount) amount from public.sale_payments sp join public.sales s on s.id=sp.sale_id where s.organization_id=o and s.status<>'cancelled' and (s.created_at at time zone 'America/Fortaleza')::date between start_date and end_date group by sp.method) m)
 ) || public.salary_metrics(start_date,end_date) into r
 from public.sales where organization_id=o and status<>'cancelled' and (created_at at time zone 'America/Fortaleza')::date between start_date and end_date;
 return r;
end $$;

revoke all on function public.metrics(date,date) from public,anon;
grant execute on function public.metrics(date,date) to authenticated;
