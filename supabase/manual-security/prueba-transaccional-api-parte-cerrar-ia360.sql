-- Prueba reversible del cierre seguro de partes.
-- Requiere el escenario ficticio IA360 en desarrollo-seguro.

begin;

-- Estado inicial controlado.
update public.partes
set estado = 'nuevo',
    tecnico_asignado_id = 'b462e3c5-42d6-4c9e-b64f-ec9fb66b280e'::uuid,
    deleted_at = null,
    descripcion_cierre = null,
    firma_cliente_url = null,
    firma_tecnico_url = null,
    fecha_cierre = null,
    closed_by = null
where id = '10000000-0000-4000-8000-000000000005'::uuid;

-- Técnico asignado: cierre permitido con evidencia ficticia y sin tocar Storage.
select set_config('request.jwt.claim.sub', '5e7b2042-2c82-4004-a850-4b0cc30d3d62', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.api_parte_cerrar(
  '10000000-0000-4000-8000-000000000005'::uuid,
  '[PRUEBA IA360] Trabajo finalizado correctamente.',
  'Cliente ficticio IA360',
  'firmas/10000000-0000-4000-8000-000000000005/cliente_prueba.png',
  null,
  jsonb_build_object(
    'path', 'archivos/10000000-0000-4000-8000-000000000005/evidencia_prueba.jpg',
    'name', 'evidencia_prueba.jpg',
    'type', 'image/jpeg',
    'comment', '[PRUEBA IA360] Evidencia reversible',
    'registrar_archivo', true
  )
);

do $test$
begin
  if not exists (
    select 1 from public.partes
    where id = '10000000-0000-4000-8000-000000000005'::uuid
      and estado = 'realizado'
      and closed_by = 'b462e3c5-42d6-4c9e-b64f-ec9fb66b280e'::uuid
  ) then
    raise exception 'FALLO_PRUEBA: el cierre válido no se guardó correctamente';
  end if;
end;
$test$;

reset role;

-- Restaurar estado dentro de la misma transacción para probar un usuario no asignado.
update public.partes
set estado = 'nuevo',
    descripcion_cierre = null,
    firma_cliente_url = null,
    fecha_cierre = null,
    closed_by = null
where id = '10000000-0000-4000-8000-000000000005'::uuid;

-- Colaborador autenticado no asignado: debe quedar bloqueado.
-- Se reutiliza el usuario colaborador ficticio creado en el escenario IA360.
select set_config('request.jwt.claim.sub', '95885a9b-1743-4b28-b5ec-55f0d8eed061', true);
set local role authenticated;

do $test$
begin
  begin
    perform public.api_parte_cerrar(
      '10000000-0000-4000-8000-000000000005'::uuid,
      '[PRUEBA IA360] Intento no autorizado.',
      'Cliente ficticio IA360',
      'firmas/10000000-0000-4000-8000-000000000005/cliente_ajeno.png',
      null,
      null
    );
    raise exception 'FALLO_PRUEBA: un usuario no autorizado pudo cerrar el parte';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$test$;

reset role;

select
  has_function_privilege('authenticated', 'public.api_parte_cerrar(uuid,text,text,text,text,jsonb)', 'EXECUTE') as authenticated_puede,
  not has_function_privilege('anon', 'public.api_parte_cerrar(uuid,text,text,text,text,jsonb)', 'EXECUTE') as anon_bloqueado,
  not has_function_privilege('public', 'public.api_parte_cerrar(uuid,text,text,text,text,jsonb)', 'EXECUTE') as public_bloqueado;

rollback;

select
  (select count(*) from public.partes_archivos
   where archivo_url = 'archivos/10000000-0000-4000-8000-000000000005/evidencia_prueba.jpg')
  +
  (select count(*) from public.partes_actividad
   where contenido like '%evidencia_prueba.jpg%') as residuos_temporales;

