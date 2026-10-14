insert into public.catalog_settings(id, shop_name, whatsapp, instagram, headline)
values ('exclusiv', 'EXCLUSIV', '5584996008220', '@exclusiv_streetwear', 'Escolha suas peças exclusivas')
on conflict (id) do nothing;
