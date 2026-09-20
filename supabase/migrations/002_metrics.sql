-- Aggregates run in PostgreSQL and never depend on list pagination.
create function public.metrics(start_date date,end_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
 ) into r from public.sales where organization_id=o and status<>'cancelled' and (created_at at time zone 'America/Fortaleza')::date between start_date and end_date;
 return r;
end $$;
revoke all on function public.metrics(date,date) from public,anon;
grant execute on function public.metrics(date,date) to authenticated;
