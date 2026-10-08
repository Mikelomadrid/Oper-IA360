-- IA360 · Facturas rectificativas/abonos de proveedor desde el escáner OCR.
-- Un abono vinculado cierra la devolución pendiente sin volver a descontar
-- cantidades ni coste de la obra. Un abono directo conserva sus asignaciones
-- negativas y sí afecta al balance una sola vez.

begin;

create index if not exists idx_devoluciones_proveedor_proveedor_estado
  on public.devoluciones_proveedor(proveedor_id, estado, created_at desc);

-- La entrada distribuida debe aceptar importes con signo negativo para abonos.
do $$
declare
  v_oid oid;
  v_definition text;
  v_updated text;
begin
  select p.oid into v_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'ia360_registrar_factura_distribuida_desde_ocr'
  order by p.oid desc
  limit 1;

  if v_oid is null then
    raise exception 'No se encontró ia360_registrar_factura_distribuida_desde_ocr';
  end if;

  v_definition := pg_get_functiondef(v_oid);
  v_updated := replace(
    v_definition,
    'coalesce(p_base_imponible, 0) <= 0',
    'coalesce(p_base_imponible, 0) = 0'
  );
  if v_updated = v_definition then
    raise exception 'No se encontró la validación esperada de base imponible';
  end if;

  v_definition := v_updated;
  v_updated := replace(
    v_definition,
    'coalesce(p_total, 0) <= 0',
    'coalesce(p_total, 0) = 0'
  );
  if v_updated = v_definition then
    raise exception 'No se encontró la validación esperada de total';
  end if;

  execute v_updated;
end;
$$;

-- La cabecera OCR base también debe conservar el signo rectificativo.
do $$
declare
  v_oid oid;
  v_definition text;
  v_updated text;
begin
  select p.oid into v_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'flopy_guardar_ocr_factura_gasto'
  order by p.oid desc
  limit 1;

  if v_oid is null then
    raise exception 'No se encontró flopy_guardar_ocr_factura_gasto';
  end if;

  v_definition := pg_get_functiondef(v_oid);
  v_updated := replace(
    v_definition,
    'p_total is null or p_total <= 0',
    'p_total is null or p_total = 0'
  );
  if v_updated = v_definition then
    raise exception 'No se encontró la validación esperada del total OCR';
  end if;

  execute v_updated;
end;
$$;

-- El tipo de IVA también debe calcularse cuando base e IVA son negativos.
do $$
declare
  v_oid oid;
  v_definition text;
  v_updated text;
begin
  select p.oid into v_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'flopy_contabilizar_factura_gasto_en_gastos'
  order by p.oid desc
  limit 1;

  if v_oid is null then
    raise exception 'No se encontró flopy_contabilizar_factura_gasto_en_gastos';
  end if;

  v_definition := pg_get_functiondef(v_oid);
  v_updated := replace(
    v_definition,
    'when v_ocr.base_imponible > 0 then',
    'when v_ocr.base_imponible <> 0 then'
  );
  if v_updated = v_definition then
    raise exception 'No se encontró el cálculo esperado del tipo de IVA';
  end if;

  execute v_updated;
end;
$$;

create or replace view public.v_devoluciones_proveedor_pendientes_abono
with (security_invoker = true) as
select
  d.id,
  d.factura_origen_id,
  d.gasto_origen_id,
  d.obra_id,
  p.nombre_proyecto as obra_nombre,
  d.proveedor_id,
  pr.nombre as proveedor_nombre,
  pr.cif as proveedor_cif,
  d.motivo,
  d.importe_base_estimado,
  d.created_at,
  o.numero_factura as numero_factura_origen,
  o.fecha_factura as fecha_factura_origen,
  count(l.id)::integer as numero_lineas,
  coalesce(sum(l.cantidad), 0) as unidades_devueltas
from public.devoluciones_proveedor d
join public.proyectos p on p.id = d.obra_id
left join public.proveedores pr on pr.id = d.proveedor_id
left join public.devolucion_proveedor_lineas l on l.devolucion_id = d.id
left join lateral (
  select numero_factura, fecha_factura
  from public.facturas_gastos_ocr
  where factura_id = d.factura_origen_id
  order by created_at desc
  limit 1
) o on true
where d.estado = 'pendiente_abono'
group by d.id, p.nombre_proyecto, pr.nombre, pr.cif, o.numero_factura, o.fecha_factura;

create or replace function public.ia360_registrar_abono_vinculado_desde_ocr(
  p_subido_por uuid,
  p_proveedor_id uuid,
  p_imagen_url text,
  p_proveedor_nombre text,
  p_proveedor_nif text,
  p_numero_factura text,
  p_fecha_factura date,
  p_base_imponible numeric,
  p_iva_importe numeric,
  p_total numeric,
  p_json_ocr jsonb,
  p_lineas jsonb,
  p_devolucion_id uuid,
  p_factura_original_numero text default null,
  p_confianza_ocr numeric default null,
  p_motor_ocr text default 'openai_vision'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_devolucion public.devoluciones_proveedor%rowtype;
  v_resultado jsonb;
  v_factura_abono_id uuid;
  v_numero_origen text;
  v_diferencia numeric;
begin
  if not public.app_is_admin_or_encargado() then
    raise exception 'No tienes permiso para registrar abonos de proveedor';
  end if;
  if p_devolucion_id is null then raise exception 'Selecciona la devolución pendiente'; end if;
  if coalesce(p_base_imponible, 0) >= 0 or coalesce(p_total, 0) >= 0 then
    raise exception 'El abono debe registrarse con base y total negativos';
  end if;
  if coalesce((p_json_ocr->>'es_abono')::boolean, false) is not true then
    raise exception 'El documento no está confirmado como abono';
  end if;

  select * into v_devolucion
  from public.devoluciones_proveedor
  where id = p_devolucion_id
  for update;

  if v_devolucion.id is null then raise exception 'La devolución seleccionada no existe'; end if;
  if v_devolucion.estado <> 'pendiente_abono' then
    raise exception 'La devolución ya no está pendiente de abono';
  end if;
  if v_devolucion.proveedor_id is not null and v_devolucion.proveedor_id <> p_proveedor_id then
    raise exception 'El proveedor del abono no coincide con la devolución';
  end if;

  select numero_factura into v_numero_origen
  from public.facturas_gastos_ocr
  where factura_id = v_devolucion.factura_origen_id
  order by created_at desc
  limit 1;

  if nullif(btrim(p_factura_original_numero), '') is not null
     and nullif(btrim(v_numero_origen), '') is not null
     and upper(regexp_replace(p_factura_original_numero, '[^a-zA-Z0-9]', '', 'g'))
         <> upper(regexp_replace(v_numero_origen, '[^a-zA-Z0-9]', '', 'g')) then
    raise exception 'La factura original indicada (%) no coincide con la devolución seleccionada (%)',
      p_factura_original_numero, v_numero_origen;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lineas) linea,
         jsonb_array_elements(linea->'asignaciones') asignacion
    where asignacion->>'destino_tipo' <> 'obra'
       or nullif(asignacion->>'obra_id', '')::uuid <> v_devolucion.obra_id
  ) then
    raise exception 'Un abono vinculado solo puede asignarse a la obra de la devolución seleccionada';
  end if;

  v_resultado := public.ia360_registrar_factura_distribuida_desde_ocr(
    p_subido_por,
    p_proveedor_id,
    p_imagen_url,
    p_proveedor_nombre,
    p_proveedor_nif,
    p_numero_factura,
    p_fecha_factura,
    p_base_imponible,
    p_iva_importe,
    p_total,
    coalesce(p_json_ocr, '{}'::jsonb) || jsonb_build_object(
      'es_abono', true,
      'devolucion_proveedor_id', p_devolucion_id,
      'factura_original_numero', coalesce(nullif(btrim(p_factura_original_numero), ''), v_numero_origen)
    ),
    p_lineas,
    p_confianza_ocr,
    p_motor_ocr
  );

  if coalesce((v_resultado->>'ok')::boolean, false) is not true then
    return v_resultado;
  end if;

  v_factura_abono_id := nullif(v_resultado->>'factura_id', '')::uuid;
  v_diferencia := round(abs(p_base_imponible) - v_devolucion.importe_base_estimado, 2);

  update public.devoluciones_proveedor
  set estado = 'abonada',
      factura_abono_id = v_factura_abono_id,
      abonada_at = now(),
      updated_at = now(),
      observaciones = concat_ws(
        E'\n',
        observaciones,
        format('Abono %s vinculado desde OCR. Diferencia sobre base estimada: %s EUR.', p_numero_factura, v_diferencia)
      )
  where id = v_devolucion.id;

  return v_resultado || jsonb_build_object(
    'tipo_documento_fiscal', 'factura_rectificativa',
    'devolucion_proveedor_id', v_devolucion.id,
    'devolucion_estado', 'abonada',
    'factura_origen_id', v_devolucion.factura_origen_id,
    'doble_descuento_evitado', true,
    'diferencia_base_estimado', v_diferencia
  );
end;
$$;

-- Las asignaciones negativas del abono vinculado quedan como trazabilidad
-- fiscal, pero no vuelven a afectar al balance: ya lo hizo la devolución.
create or replace view public.v_devolucion_proveedor_lineas_disponibles
with (security_invoker = true) as
with dev_almacen as (
  select asignacion_id, sum(cantidad) as cantidad
  from public.almacen_material_movimientos
  where tipo = 'devolucion_obra' and asignacion_id is not null
  group by asignacion_id
),
dev_proveedor as (
  select l.asignacion_id, sum(l.cantidad) as cantidad
  from public.devolucion_proveedor_lineas l
  join public.devoluciones_proveedor d on d.id = l.devolucion_id
  where d.estado in ('pendiente_abono', 'abonada')
  group by l.asignacion_id
)
select
  a.id as asignacion_id,
  a.factura_id,
  a.linea_ocr_id,
  a.obra_id,
  a.producto_catalogo_id,
  a.material_almacen_id,
  a.descripcion,
  a.referencia,
  a.unidad,
  a.precio_unitario,
  a.importe_base,
  a.cantidad as cantidad_comprada,
  coalesce(da.cantidad, 0) as cantidad_devuelta_almacen,
  coalesce(dp.cantidad, 0) as cantidad_devuelta_proveedor,
  greatest(a.cantidad - coalesce(da.cantidad, 0) - coalesce(dp.cantidad, 0), 0) as cantidad_disponible
from public.factura_gasto_linea_asignaciones a
left join dev_almacen da on da.asignacion_id = a.id
left join dev_proveedor dp on dp.asignacion_id = a.id
where a.destino_tipo = 'obra'
  and not exists (
    select 1 from public.devoluciones_proveedor d
    where d.factura_abono_id = a.factura_id and d.estado = 'abonada'
  );

create or replace view public.v_obra_materiales_balance
with (security_invoker = true) as
with movimientos as (
  select
    a.obra_id,
    a.producto_catalogo_id,
    a.material_almacen_id as material_id,
    a.descripcion,
    a.referencia,
    a.unidad,
    a.cantidad as cantidad_comprada,
    0::numeric as cantidad_desde_almacen,
    0::numeric as cantidad_devuelta,
    a.importe_base as coste_compra,
    0::numeric as coste_desde_almacen,
    0::numeric as coste_devuelto,
    a.created_at as fecha_movimiento
  from public.factura_gasto_linea_asignaciones a
  where a.destino_tipo = 'obra'
    and not exists (
      select 1 from public.devoluciones_proveedor d
      where d.factura_abono_id = a.factura_id and d.estado = 'abonada'
    )

  union all

  select
    m.obra_origen_id,
    a.producto_catalogo_id,
    m.material_id,
    coalesce(a.descripcion, mat.descripcion),
    coalesce(a.referencia, mat.codigo),
    coalesce(a.unidad, mat.unidad_medida, 'ud'),
    0::numeric, 0::numeric, m.cantidad,
    0::numeric, 0::numeric, m.valor_total,
    m.created_at
  from public.almacen_material_movimientos m
  left join public.factura_gasto_linea_asignaciones a on a.id = m.asignacion_id
  join public.materiales mat on mat.id = m.material_id
  where m.tipo = 'devolucion_obra' and m.obra_origen_id is not null

  union all

  select
    d.obra_id,
    a.producto_catalogo_id,
    a.material_almacen_id,
    a.descripcion,
    a.referencia,
    a.unidad,
    0::numeric, 0::numeric, l.cantidad,
    0::numeric, 0::numeric, l.importe_base,
    d.created_at
  from public.devolucion_proveedor_lineas l
  join public.devoluciones_proveedor d on d.id = l.devolucion_id
  join public.factura_gasto_linea_asignaciones a on a.id = l.asignacion_id
  where d.estado in ('pendiente_abono', 'abonada')

  union all

  select
    m.obra_destino_id,
    null::uuid,
    m.material_id,
    mat.descripcion,
    mat.codigo,
    coalesce(mat.unidad_medida, 'ud'),
    0::numeric, m.cantidad, 0::numeric,
    0::numeric, m.valor_total, 0::numeric,
    m.created_at
  from public.almacen_material_movimientos m
  join public.materiales mat on mat.id = m.material_id
  where m.tipo = 'salida_obra' and m.obra_destino_id is not null
)
select
  obra_id,
  producto_catalogo_id,
  material_id,
  descripcion,
  referencia,
  unidad,
  sum(cantidad_comprada) as cantidad_comprada,
  sum(cantidad_desde_almacen) as cantidad_desde_almacen,
  sum(cantidad_devuelta) as cantidad_devuelta,
  sum(cantidad_comprada + cantidad_desde_almacen - cantidad_devuelta) as cantidad_neta,
  round(sum(coste_compra), 2) as coste_compra,
  round(sum(coste_desde_almacen), 2) as coste_desde_almacen,
  round(sum(coste_devuelto), 2) as coste_devuelto,
  round(sum(coste_compra + coste_desde_almacen - coste_devuelto), 2) as coste_neto,
  count(*)::integer as movimientos,
  max(fecha_movimiento) as ultimo_movimiento
from movimientos
group by obra_id, producto_catalogo_id, material_id, descripcion, referencia, unidad;

revoke all on function public.ia360_registrar_abono_vinculado_desde_ocr(
  uuid, uuid, text, text, text, text, date, numeric, numeric, numeric,
  jsonb, jsonb, uuid, text, numeric, text
) from public, anon;
grant execute on function public.ia360_registrar_abono_vinculado_desde_ocr(
  uuid, uuid, text, text, text, text, date, numeric, numeric, numeric,
  jsonb, jsonb, uuid, text, numeric, text
) to authenticated, service_role;

grant select on public.v_devoluciones_proveedor_pendientes_abono to authenticated, service_role;
grant select on public.v_devolucion_proveedor_lineas_disponibles to authenticated, service_role;
grant select on public.v_obra_materiales_balance to authenticated, service_role;

comment on function public.ia360_registrar_abono_vinculado_desde_ocr(
  uuid, uuid, text, text, text, text, date, numeric, numeric, numeric,
  jsonb, jsonb, uuid, text, numeric, text
) is 'Registra un abono OCR y cierra atómicamente una devolución pendiente sin duplicar el descuento en obra.';

commit;
