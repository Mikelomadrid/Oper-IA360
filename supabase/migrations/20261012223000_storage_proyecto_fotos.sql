-- Storage privado compartido por las fotografías de obra y sus evidencias.

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'proyecto_fotos',
  'proyecto_fotos',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'proyecto_fotos_select_personal'
  ) then
    create policy proyecto_fotos_select_personal
      on storage.objects for select to authenticated
      using (
        bucket_id = 'proyecto_fotos'
        and exists (
          select 1 from public.empleados e
          where e.auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'proyecto_fotos_insert_personal'
  ) then
    create policy proyecto_fotos_insert_personal
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'proyecto_fotos'
        and exists (
          select 1 from public.empleados e
          where e.auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'proyecto_fotos_update_propias'
  ) then
    create policy proyecto_fotos_update_propias
      on storage.objects for update to authenticated
      using (
        bucket_id = 'proyecto_fotos'
        and (
          owner_id = auth.uid()::text
          or public.app_is_admin_or_encargado()
        )
      )
      with check (
        bucket_id = 'proyecto_fotos'
        and (
          owner_id = auth.uid()::text
          or public.app_is_admin_or_encargado()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'proyecto_fotos_delete_propias'
  ) then
    create policy proyecto_fotos_delete_propias
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'proyecto_fotos'
        and (
          owner_id = auth.uid()::text
          or public.app_is_admin_or_encargado()
        )
      );
  end if;
end;
$$;
