-- Permite abonos y devoluciones dentro de facturas de compra distribuidas.
-- El signo de la cantidad se conserva en la obra o gasto general y la suma de
-- destinos debe seguir coincidiendo exactamente con la línea OCR.

begin;

alter table public.factura_gasto_linea_asignaciones
  drop constraint if exists factura_linea_asignaciones_cantidad_chk;

alter table public.factura_gasto_linea_asignaciones
  add constraint factura_linea_asignaciones_cantidad_chk
  check (cantidad <> 0);

do $$
declare
  v_function_oid oid;
  v_definition text;
  v_updated text;
begin
  select p.oid
  into v_function_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'ia360_registrar_factura_distribuida_desde_ocr'
  order by p.oid desc
  limit 1;

  if v_function_oid is null then
    raise exception 'No se encontró ia360_registrar_factura_distribuida_desde_ocr';
  end if;

  v_definition := pg_get_functiondef(v_function_oid);
  v_updated := replace(
    v_definition,
    'coalesce(nullif(v_linea_input->>''cantidad'', '''')::numeric, 0) <= 0',
    'coalesce(nullif(v_linea_input->>''cantidad'', '''')::numeric, 0) = 0'
  );

  if v_updated = v_definition then
    raise exception 'No se encontró la validación de cantidad de línea esperada';
  end if;

  v_definition := v_updated;
  v_updated := replace(
    v_definition,
    'coalesce((a->>''cantidad'')::numeric, 0) <= 0',
    'coalesce((a->>''cantidad'')::numeric, 0) = 0'
  );

  if v_updated = v_definition then
    raise exception 'No se encontró la validación de cantidad de asignación esperada';
  end if;

  execute v_updated;
end;
$$;

comment on constraint factura_linea_asignaciones_cantidad_chk
  on public.factura_gasto_linea_asignaciones
  is 'Permite cantidades positivas de compra y negativas de abono; nunca cero.';

commit;
