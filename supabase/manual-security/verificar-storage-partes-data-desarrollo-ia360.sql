-- Verificacion de metadatos para desarrollo-seguro.
-- Es de solo lectura: no crea objetos ni sube archivos.

with bucket as (
  select
    id,
    public,
    file_size_limit,
    allowed_mime_types
  from storage.buckets
  where id = 'partes-data'
), policies as (
  select
    count(*) filter (where policyname = 'partes_data_select_relacionado' and cmd = 'SELECT') as select_ok,
    count(*) filter (where policyname = 'partes_data_insert_relacionado' and cmd = 'INSERT') as insert_ok,
    count(*) filter (where policyname = 'partes_data_update_relacionado' and cmd = 'UPDATE') as update_ok,
    count(*) filter (where policyname = 'partes_data_delete_relacionado' and cmd = 'DELETE') as delete_ok,
    bool_and(roles = array['authenticated']::name[]) as solo_authenticated
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname like 'partes_data_%_relacionado'
), functions as (
  select
    to_regprocedure('public.app_storage_parte_id(text)') is not null as parser_ok,
    to_regprocedure('public.app_can_access_parte_storage(text,boolean)') is not null as acceso_ok
), checks as (
select
  exists(select 1 from bucket) as bucket_existe,
  coalesce((select not public from bucket), false) as bucket_privado,
  coalesce((select file_size_limit = 20971520 from bucket), false) as limite_20_mib,
  coalesce((select 'image/*' = any(allowed_mime_types) from bucket), false) as imagenes_permitidas,
  coalesce((select 'application/pdf' = any(allowed_mime_types) from bucket), false) as pdf_permitido,
  policies.select_ok = 1 as politica_select,
  policies.insert_ok = 1 as politica_insert,
  policies.update_ok = 1 as politica_update,
  policies.delete_ok = 1 as politica_delete,
  coalesce(policies.solo_authenticated, false) as solo_authenticated,
  functions.parser_ok,
  functions.acceso_ok,
  public.app_storage_parte_id('archivos/00000000-0000-0000-0000-000000000001/foto.jpg')
    = '00000000-0000-0000-0000-000000000001' as ruta_archivos_ok,
  public.app_storage_parte_id('firmas/00000000-0000-0000-0000-000000000001/cliente.png')
    = '00000000-0000-0000-0000-000000000001' as ruta_firmas_ok,
  public.app_storage_parte_id('00000000-0000-0000-0000-000000000001/foto.jpg')
    = '00000000-0000-0000-0000-000000000001' as ruta_historica_ok
from policies
cross join functions
)
select
  (select bool_and(value::boolean) from jsonb_each_text(to_jsonb(checks))) as todos_controles_ok,
  checks.*
from checks;

