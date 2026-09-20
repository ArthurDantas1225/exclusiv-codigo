-- Private product media. Object name starts with organization UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('products','products',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy product_read on storage.objects for select to authenticated using(bucket_id='products' and (storage.foldername(name))[1]=public.my_org()::text);
create policy product_upload on storage.objects for insert to authenticated with check(bucket_id='products' and (storage.foldername(name))[1]=public.my_org()::text and public.is_admin());
create policy product_delete on storage.objects for delete to authenticated using(bucket_id='products' and (storage.foldername(name))[1]=public.my_org()::text and public.is_admin());
