-- Almacenamiento privado para los documentos originales de facturas OCR.
-- La ruta esperada es materiales/{empleado_id}/{archivo}.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'facturas_ocr',
  'facturas_ocr',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists facturas_ocr_select_autorizado on storage.objects;
drop policy if exists facturas_ocr_insert_autorizado on storage.objects;
drop policy if exists facturas_ocr_delete_autorizado on storage.objects;

create policy facturas_ocr_select_autorizado
on storage.objects for select to authenticated
using (
  bucket_id = 'facturas_ocr'
  and (storage.foldername(name))[1] = 'materiales'
  and (
    public.es_admin(auth.uid())
    or exists (
      select 1
      from public.empleados e
      where e.auth_user_id = auth.uid()
        and e.id::text = (storage.foldername(name))[2]
    )
  )
);

create policy facturas_ocr_insert_autorizado
on storage.objects for insert to authenticated
with check (
  bucket_id = 'facturas_ocr'
  and (storage.foldername(name))[1] = 'materiales'
  and (
    public.es_admin(auth.uid())
    or exists (
      select 1
      from public.empleados e
      where e.auth_user_id = auth.uid()
        and e.id::text = (storage.foldername(name))[2]
    )
  )
);

create policy facturas_ocr_delete_autorizado
on storage.objects for delete to authenticated
using (
  bucket_id = 'facturas_ocr'
  and (storage.foldername(name))[1] = 'materiales'
  and (
    public.es_admin(auth.uid())
    or exists (
      select 1
      from public.empleados e
      where e.auth_user_id = auth.uid()
        and e.id::text = (storage.foldername(name))[2]
    )
  )
);

commit;
