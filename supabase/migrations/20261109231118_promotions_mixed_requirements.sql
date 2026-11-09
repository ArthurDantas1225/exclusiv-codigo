create or replace function public.save_promotions(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  organization uuid := public.my_org();
  expected_version bigint := (p->>'expected_version')::bigint;
  stored jsonb := '{}'::jsonb;
  campaigns jsonb := p->'campaigns';
  campaign jsonb;
  tier jsonb;
  requirement jsonb;
  old_campaign jsonb;
  previous_quantity integer;
  quantity integer;
  requirement_kind text;
  requirement_value text;
  campaign_id text;
  campaign_type text;
  channels jsonb;
  products jsonb;
  categories jsonb;
  requirements jsonb;
  campaign_ids text[] := '{}';
  normalized jsonb := '[]'::jsonb;
  campaign_count integer := 0;
  saved_id uuid;
  new_version bigint;
begin
  if actor is null or organization is null or not public.is_admin() then raise exception 'Acesso administrativo necessário'; end if;
  if expected_version is null or expected_version < 0 or jsonb_typeof(campaigns) <> 'array' then raise exception 'Configuração de promoções inválida'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(organization::text, 0));
  select coalesce(a.value::jsonb, '{}'::jsonb) into stored from public.app_settings a where a.organization_id = organization and a.key = 'promotions';
  stored := coalesce(stored, '{}'::jsonb);
  new_version := coalesce((stored->>'version')::bigint, 0);
  if expected_version <> new_version then raise exception 'Promoções alteradas por outra pessoa. Recarregue antes de salvar.'; end if;
  if jsonb_array_length(campaigns) > 20 then raise exception 'O limite é de 20 promoções cadastradas'; end if;

  for campaign in select value from jsonb_array_elements(campaigns) loop
    campaign_count := campaign_count + 1;
    campaign_id := campaign->>'id';
    campaign_type := campaign->>'type';
    channels := campaign->'channels';
    products := coalesce(campaign->'productIds', '[]'::jsonb);
    categories := coalesce(campaign->'categories', '[]'::jsonb);
    requirements := coalesce(campaign->'requirements', '[]'::jsonb);
    if jsonb_typeof(campaign) is distinct from 'object' or campaign_id is null or campaign_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or campaign_id = any(campaign_ids) or length(trim(coalesce(campaign->>'name', ''))) not between 1 and 80
      or jsonb_typeof(campaign->'active') is distinct from 'boolean'
      or jsonb_typeof(channels) is distinct from 'array' or jsonb_array_length(coalesce(channels, '[]'::jsonb)) not between 1 and 2
      or (select count(distinct value) from jsonb_array_elements_text(coalesce(channels, '[]'::jsonb)) value) <> jsonb_array_length(coalesce(channels, '[]'::jsonb))
      or exists(select 1 from jsonb_array_elements_text(channels) c where c not in ('app', 'catalog'))
      or jsonb_typeof(products) is distinct from 'array' or jsonb_array_length(products) > 200
      or jsonb_typeof(categories) is distinct from 'array' or jsonb_array_length(categories) > 50
      or exists(select 1 from jsonb_array_elements(categories) c where jsonb_typeof(c) <> 'string')
      or exists(select 1 from jsonb_array_elements_text(categories) c where length(trim(c)) not between 1 and 80)
      or jsonb_typeof(requirements) is distinct from 'array' or jsonb_array_length(requirements) = 1 or jsonb_array_length(requirements) > 10
      or (jsonb_array_length(requirements) > 0 and (jsonb_array_length(products) > 0 or jsonb_array_length(categories) > 0))
      or exists(select 1 from jsonb_array_elements(requirements) item where jsonb_typeof(item) is distinct from 'object'
        or item->>'kind' not in ('category','subcategory','product')
        or length(trim(coalesce(item->>'value',''))) not between 1 and 80
        or coalesce((item->>'quantity')::integer, 0) not between 1 and 2000)
      or (select count(*) <> count(distinct lower(item->>'kind') || ':' || lower(item->>'value')) from jsonb_array_elements(requirements) item)
      or coalesce((campaign->>'priority')::integer, -1) not between 0 and 100000
      or campaign_type is null or campaign_type not in ('percent_tiers', 'fixed', 'bundle', 'buy_get') then
      raise exception 'Revise os dados de cada promoção';
    end if;
    campaign_ids := array_append(campaign_ids, campaign_id);
    if exists(select 1 from jsonb_array_elements_text(products) product where product !~* '^[0-9a-f-]{36}$') then raise exception 'Produto inválido na promoção'; end if;
    if (select count(*) from public.products pr where pr.organization_id = organization and pr.id::text in (select jsonb_array_elements_text(products))) <> jsonb_array_length(products) then
      raise exception 'Um produto selecionado não pertence a esta loja';
    end if;
    if exists(select 1 from jsonb_array_elements_text(categories) category where not exists(select 1 from public.products pr where pr.organization_id = organization and lower(pr.category) = lower(category))) then raise exception 'Uma categoria selecionada não existe nesta loja'; end if;
    for requirement in select value from jsonb_array_elements(requirements) loop
      requirement_kind := requirement->>'kind';
      requirement_value := trim(requirement->>'value');
      if requirement_kind = 'product' then
        if requirement_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          or not exists(select 1 from public.products pr where pr.organization_id = organization and pr.id::text = requirement_value) then
          raise exception 'Um produto da composição não pertence a esta loja';
        end if;
      elsif requirement_kind = 'category' then
        if not exists(select 1 from public.products pr where pr.organization_id = organization and lower(trim(pr.category)) = lower(requirement_value)) then
          raise exception 'Uma categoria da composição não existe nesta loja';
        end if;
      elsif requirement_kind = 'subcategory' then
        if not exists(select 1 from public.products pr where pr.organization_id = organization and lower(trim(pr.subcategory)) = lower(requirement_value)) then
          raise exception 'Uma subcategoria da composição não existe nesta loja';
        end if;
      end if;
    end loop;
    if nullif(campaign->>'startsAt', '') is not null and campaign->>'startsAt' !~ '^\d{4}-\d{2}-\d{2}$'
      or nullif(campaign->>'endsAt', '') is not null and campaign->>'endsAt' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data de promoção inválida'; end if;
    if nullif(campaign->>'startsAt', '') is not null and nullif(campaign->>'endsAt', '') is not null
      and (campaign->>'startsAt')::date > (campaign->>'endsAt')::date then raise exception 'A data final deve ser posterior ao início'; end if;
    if campaign_type = 'percent_tiers' then
      if jsonb_typeof(campaign->'tiers') is distinct from 'array' or jsonb_array_length(coalesce(campaign->'tiers', '[]'::jsonb)) not between 1 and 10 then raise exception 'Informe de 1 a 10 faixas de quantidade'; end if;
      previous_quantity := 0;
      for tier in select value from jsonb_array_elements(campaign->'tiers') loop
        quantity := coalesce((tier->>'quantity')::integer, 0);
        if quantity <= previous_quantity or coalesce((tier->>'percent')::numeric, 0) not between 1 and 90 then raise exception 'Faixas devem ter quantidades crescentes e desconto entre 1 e 90%%'; end if;
        previous_quantity := quantity;
      end loop;
    elsif campaign_type = 'fixed' then
      if coalesce((campaign->>'minQuantity')::integer, 0) not between 1 and 2000 or coalesce((campaign->>'discountCents')::bigint, 0) not between 1 and 100000000 then raise exception 'Quantidade ou desconto fixo inválido'; end if;
    elsif campaign_type = 'bundle' then
      if coalesce((campaign->>'bundleQuantity')::integer, 0) not between 2 and 2000 or coalesce((campaign->>'bundlePriceCents')::bigint, -1) not between 0 and 100000000 then raise exception 'Quantidade ou preço do grupo inválido'; end if;
    elsif campaign_type = 'buy_get' then
      if coalesce((campaign->>'buyQuantity')::integer, 0) < 1 or coalesce((campaign->>'freeQuantity')::integer, 0) < 1 or (campaign->>'buyQuantity')::integer + (campaign->>'freeQuantity')::integer > 10 then raise exception 'Compre e ganhe deve ter de 1 a 10 peças por grupo'; end if;
    end if;
    select value into old_campaign from jsonb_array_elements(coalesce(stored->'campaigns', '[]'::jsonb)) value where value->>'id' = campaign_id limit 1;
    normalized := normalized || jsonb_build_array(campaign || jsonb_build_object('createdAt', coalesce(old_campaign->'createdAt', to_jsonb(now()))));
  end loop;
  new_version := new_version + 1;
  insert into public.app_settings(organization_id, key, value)
  values (organization, 'promotions', jsonb_build_object('version', new_version, 'campaigns', normalized)::text)
  on conflict (organization_id, key) do update set value = excluded.value returning id into saved_id;
  return jsonb_build_object('id', saved_id, 'version', new_version, 'campaign_count', campaign_count);
end;
$$;

revoke all on function public.save_promotions(jsonb) from public, anon;
grant execute on function public.save_promotions(jsonb) to authenticated;
