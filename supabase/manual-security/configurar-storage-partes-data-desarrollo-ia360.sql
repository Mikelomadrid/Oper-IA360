-- IA360 | Storage privado para partes (solo desarrollo-seguro)
-- Proyecto permitido: obigqojehfxxgfluygdg
-- No ejecutar en produccion sin una revision y despliegue independientes.

begin;

-- El bucket se crea vacio. Este script no copia ningun objeto de produccion.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'partes-data',
  'partes-data',
  false,
  20971520, -- 20 MiB
  array[
    'image/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Extrae el id del parte de los tres formatos que actualmente usa el ERP:
--   archivos/{parteId}/archivo.ext
--   firmas/{parteId}/firma.png
--   {parteId}/archivo.ext                 (formato historico de alta de partes)
create or replace function public.app_storage_parte_id(p_object_name text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select case
    when split_part(p_object_name, '/', 1) in ('archivos', 'firmas')
      and split_part(p_object_name, '/', 2) <> ''
      and split_part(p_object_name, '/', 3) <> ''
      then split_part(p_object_name, '/', 2)
    when split_part(p_object_name, '/', 1) not in ('archivos', 'firmas')
      and split_part(p_object_name, '/', 1) <> ''
      and split_part(p_object_name, '/', 2) <> ''
      then split_part(p_object_name, '/', 1)
    else null
  end
$$;

-- La funcion SECURITY DEFINER evita depender de las politicas RLS de partes al
-- evaluar storage.objects. Solo devuelve true para un empleado activo relacionado.
create or replace function public.app_can_access_parte_storage(
  p_object_name text,
  p_write boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(exists (
    select 1
    from public.empleados e
    join public.partes p
      on p.id::text = public.app_storage_parte_id(p_object_name)
    where e.auth_user_id = auth.uid()
      and e.activo = true
      and (not p_write or coalesce(e.solo_lectura, false) = false)
      and p.deleted_at is null
      and (
        e.rol::text in ('admin', 'encargado')
        or (e.rol::text = 'tecnico' and p.tecnico_asignado_id = e.id)
        or (
          e.rol::text = 'finca_admin'
          and (p.administrador_finca_id = e.id or p.created_by = e.id)
        )
      )
  ), false)
$$;

revoke all on function public.app_storage_parte_id(text) from public;
revoke all on function public.app_can_access_parte_storage(text, boolean) from public;
grant execute on function public.app_storage_parte_id(text) to authenticated;
grant execute on function public.app_can_access_parte_storage(text, boolean) to authenticated;

drop policy if exists partes_data_select_relacionado on storage.objects;
drop policy if exists partes_data_insert_relacionado on storage.objects;
drop policy if exists partes_data_update_relacionado on storage.objects;
drop policy if exists partes_data_delete_relacionado on storage.objects;

create policy partes_data_select_relacionado
on storage.objects
for select
to authenticated
using (
  bucket_id = 'partes-data'
  and public.app_can_access_parte_storage(name, false)
);

create policy partes_data_insert_relacionado
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'partes-data'
  and public.app_can_access_parte_storage(name, true)
);

-- Necesaria para los uploads con upsert de las firmas de cierre.
create policy partes_data_update_relacionado
on storage.objects
for update
to authenticated
using (
  bucket_id = 'partes-data'
  and public.app_can_access_parte_storage(name, true)
)
with check (
  bucket_id = 'partes-data'
  and public.app_can_access_parte_storage(name, true)
);

create policy partes_data_delete_relacionado
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'partes-data'
  and public.app_can_access_parte_storage(name, true)
);

commit;

