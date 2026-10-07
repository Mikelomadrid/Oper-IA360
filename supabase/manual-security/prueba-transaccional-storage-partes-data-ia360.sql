-- IA360 | Prueba reversible de RLS para storage.objects
-- Requiere el escenario ficticio ya creado en desarrollo-seguro.
-- No sube bytes: solo crea metadatos ficticios dentro de una transaccion y hace ROLLBACK.

begin;

-- Usuario ficticio: tecnico asignado al parte ficticio.
select set_config('request.jwt.claim.sub', '5e7b2042-2c82-4004-a850-4b0cc30d3d62', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $test$
begin
  if not public.app_can_access_parte_storage(
    'archivos/10000000-0000-4000-8000-000000000005/prueba_storage_ia360.txt',
    true
  ) then
    raise exception 'FALLO_PRUEBA: el tecnico asignado no tiene escritura';
  end if;

  if not public.app_can_access_parte_storage(
    'firmas/10000000-0000-4000-8000-000000000005/cliente_prueba_storage.png',
    false
  ) then
    raise exception 'FALLO_PRUEBA: el tecnico asignado no tiene lectura';
  end if;
end;
$test$;

-- INSERT, SELECT y UPDATE pasan por las politicas reales de storage.objects.
-- Supabase impide DELETE directo en sus tablas internas: el borrado fisico se
-- debe validar mediante la API de Storage en la prueba end-to-end posterior.
insert into storage.objects (bucket_id, name, metadata)
values (
  'partes-data',
  'archivos/10000000-0000-4000-8000-000000000005/prueba_storage_ia360.txt',
  jsonb_build_object('mimetype', 'text/plain', 'size', 0, 'prueba', true)
);

do $test$
begin
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'partes-data'
      and name = 'archivos/10000000-0000-4000-8000-000000000005/prueba_storage_ia360.txt'
  ) then
    raise exception 'FALLO_PRUEBA: SELECT no ve el objeto ficticio';
  end if;
end;
$test$;

update storage.objects
set metadata = metadata || jsonb_build_object('update_ok', true)
where bucket_id = 'partes-data'
  and name = 'archivos/10000000-0000-4000-8000-000000000005/prueba_storage_ia360.txt';

do $test$
begin
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'partes-data'
      and name = 'archivos/10000000-0000-4000-8000-000000000005/prueba_storage_ia360.txt'
      and metadata @> jsonb_build_object('update_ok', true)
  ) then
    raise exception 'FALLO_PRUEBA: UPDATE no modifico el objeto ficticio';
  end if;
end;
$test$;

reset role;

-- Usuario ficticio: colaborador ajeno al parte. Debe quedar bloqueado.
select set_config('request.jwt.claim.sub', '95885a9b-1743-4b28-b5ec-55f0d8eed061', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $test$
begin
  if public.app_can_access_parte_storage(
    'archivos/10000000-0000-4000-8000-000000000005/intento_ajeno_ia360.txt',
    false
  ) then
    raise exception 'FALLO_PRUEBA: el colaborador ajeno obtuvo lectura';
  end if;

  if public.app_can_access_parte_storage(
    'archivos/10000000-0000-4000-8000-000000000005/intento_ajeno_ia360.txt',
    true
  ) then
    raise exception 'FALLO_PRUEBA: el colaborador ajeno obtuvo escritura';
  end if;

  begin
    insert into storage.objects (bucket_id, name, metadata)
    values (
      'partes-data',
      'archivos/10000000-0000-4000-8000-000000000005/intento_ajeno_ia360.txt',
      jsonb_build_object('mimetype', 'text/plain', 'size', 0, 'prueba', true)
    );
    raise exception 'FALLO_PRUEBA: la politica permitio insertar al colaborador ajeno';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$test$;

reset role;
rollback;

select
  not exists (
    select 1
    from storage.objects
    where bucket_id = 'partes-data'
      and name in (
        'archivos/10000000-0000-4000-8000-000000000005/prueba_storage_ia360.txt',
        'archivos/10000000-0000-4000-8000-000000000005/intento_ajeno_ia360.txt'
      )
  ) as rollback_sin_residuos,
  true as tecnico_insert_select_update_permitido,
  true as colaborador_ajeno_bloqueado;

