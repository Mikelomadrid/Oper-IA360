begin;

alter table public.almacen_material_movimientos
  add column if not exists asignacion_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'almacen_material_movimientos_asignacion_id_fkey'
  ) then
    alter table public.almacen_material_movimientos
      add constraint almacen_material_movimientos_asignacion_id_fkey
      foreign key (asignacion_id)
      references public.factura_gasto_linea_asignaciones(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_almacen_mov_asignacion
  on public.almacen_material_movimientos(asignacion_id)
  where asignacion_id is not null;

create or replace view public.v_obra_materiales_devolucion_disponible
with (security_invoker = true) as
select
  a.id as asignacion_id,
  a.obra_id,
  a.factura_id,
  a.linea_ocr_id,
  a.producto_catalogo_id,
  a.material_almacen_id,
  a.descripcion,
  a.referencia,
  a.unidad,
  a.precio_unitario,
  a.cantidad as cantidad_comprada,
  coalesce(sum(m.cantidad) filter (where m.tipo = 'devolucion_obra'), 0) as cantidad_devuelta,
  a.cantidad - coalesce(sum(m.cantidad) filter (where m.tipo = 'devolucion_obra'), 0) as cantidad_disponible,
  o.numero_factura,
  o.fecha_factura,
  o.proveedor_nombre
from public.factura_gasto_linea_asignaciones a
left join public.almacen_material_movimientos m
  on m.asignacion_id = a.id
left join lateral (
  select numero_factura, fecha_factura, proveedor_nombre
  from public.facturas_gastos_ocr
  where factura_id = a.factura_id
  order by created_at desc
  limit 1
) o on true
where a.destino_tipo = 'obra'
group by
  a.id, a.obra_id, a.factura_id, a.linea_ocr_id,
  a.producto_catalogo_id, a.material_almacen_id,
  a.descripcion, a.referencia, a.unidad, a.precio_unitario,
  a.cantidad, o.numero_factura, o.fecha_factura, o.proveedor_nombre;

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

  union all

  select
    m.obra_origen_id,
    a.producto_catalogo_id,
    m.material_id,
    coalesce(a.descripcion, mat.descripcion),
    coalesce(a.referencia, mat.codigo),
    coalesce(a.unidad, mat.unidad_medida, 'ud'),
    0::numeric,
    0::numeric,
    m.cantidad,
    0::numeric,
    0::numeric,
    m.valor_total,
    m.created_at
  from public.almacen_material_movimientos m
  left join public.factura_gasto_linea_asignaciones a on a.id = m.asignacion_id
  join public.materiales mat on mat.id = m.material_id
  where m.tipo = 'devolucion_obra'
    and m.obra_origen_id is not null

  union all

  select
    m.obra_destino_id,
    null::uuid,
    m.material_id,
    mat.descripcion,
    mat.codigo,
    coalesce(mat.unidad_medida, 'ud'),
    0::numeric,
    m.cantidad,
    0::numeric,
    0::numeric,
    m.valor_total,
    0::numeric,
    m.created_at
  from public.almacen_material_movimientos m
  join public.materiales mat on mat.id = m.material_id
  where m.tipo = 'salida_obra'
    and m.obra_destino_id is not null
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
group by
  obra_id, producto_catalogo_id, material_id,
  descripcion, referencia, unidad;

create or replace function public.ia360_devolver_material_obra_almacen(
  p_asignacion_id uuid,
  p_cantidad numeric,
  p_observaciones text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asig public.factura_gasto_linea_asignaciones%rowtype;
  v_factura public.facturas_gastos%rowtype;
  v_material public.materiales%rowtype;
  v_devuelto numeric;
  v_disponible numeric;
  v_codigo text;
  v_valor numeric;
  v_usuario uuid;
begin
  if not public.app_is_admin_or_encargado() then
    raise exception 'No tienes permiso para mover materiales de obra al almacén';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;

  v_usuario := public.app_current_empleado_id();

  select * into v_asig
  from public.factura_gasto_linea_asignaciones
  where id = p_asignacion_id
    and destino_tipo = 'obra'
  for update;

  if v_asig.id is null then
    raise exception 'No se encontró la asignación de material a la obra';
  end if;

  select coalesce(sum(cantidad), 0) into v_devuelto
  from public.almacen_material_movimientos
  where asignacion_id = v_asig.id
    and tipo = 'devolucion_obra';

  v_disponible := v_asig.cantidad - v_devuelto;
  if p_cantidad > v_disponible then
    raise exception 'Solo quedan % % disponibles para devolver', v_disponible, v_asig.unidad;
  end if;

  select * into v_factura from public.facturas_gastos where id = v_asig.factura_id;
  v_codigo := coalesce(nullif(btrim(v_asig.referencia), ''), 'OCR-' || left(v_asig.id::text, 8));
  v_valor := round(p_cantidad * v_asig.precio_unitario, 2);

  if v_asig.material_almacen_id is not null then
    select * into v_material from public.materiales where id = v_asig.material_almacen_id for update;
  else
    select * into v_material from public.materiales where codigo = v_codigo for update;
  end if;

  if v_material.id is null then
    insert into public.materiales (
      codigo, descripcion, nombre, unidad_medida, stock_actual,
      stock_inicial, precio_coste, proveedor_id, created_by
    ) values (
      v_codigo, v_asig.descripcion, v_asig.descripcion, v_asig.unidad,
      p_cantidad, 0, v_asig.precio_unitario, v_factura.proveedor_id, v_usuario
    ) returning * into v_material;
  else
    update public.materiales
    set
      precio_coste = case
        when coalesce(stock_actual, 0) + p_cantidad = 0 then v_asig.precio_unitario
        else round(
          ((coalesce(stock_actual, 0) * coalesce(precio_coste, 0)) + v_valor)
          / (coalesce(stock_actual, 0) + p_cantidad), 4
        )
      end,
      stock_actual = coalesce(stock_actual, 0) + p_cantidad,
      proveedor_id = coalesce(proveedor_id, v_factura.proveedor_id)
    where id = v_material.id
    returning * into v_material;
  end if;

  update public.factura_gasto_linea_asignaciones
  set material_almacen_id = v_material.id
  where id = v_asig.id;

  insert into public.almacen_material_movimientos (
    material_id, tipo, cantidad, coste_unitario, valor_total,
    factura_id, linea_ocr_id, asignacion_id, obra_origen_id,
    realizado_por, observaciones
  ) values (
    v_material.id, 'devolucion_obra', p_cantidad,
    v_asig.precio_unitario, v_valor, v_asig.factura_id,
    v_asig.linea_ocr_id, v_asig.id, v_asig.obra_id,
    v_usuario, nullif(btrim(p_observaciones), '')
  );

  return jsonb_build_object(
    'ok', true,
    'asignacion_id', v_asig.id,
    'obra_id', v_asig.obra_id,
    'material_id', v_material.id,
    'cantidad_devuelta', p_cantidad,
    'cantidad_pendiente_obra', v_disponible - p_cantidad,
    'coste_descontado_obra', v_valor,
    'stock_almacen', v_material.stock_actual
  );
end;
$$;

create or replace function public.ia360_sacar_material_almacen_a_obra(
  p_material_id uuid,
  p_obra_id uuid,
  p_cantidad numeric,
  p_observaciones text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material public.materiales%rowtype;
  v_valor numeric;
  v_usuario uuid;
begin
  if not public.app_is_admin_or_encargado() then
    raise exception 'No tienes permiso para sacar materiales del almacén';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;
  if not exists (select 1 from public.proyectos where id = p_obra_id) then
    raise exception 'La obra no existe';
  end if;

  v_usuario := public.app_current_empleado_id();
  select * into v_material from public.materiales where id = p_material_id for update;
  if v_material.id is null then raise exception 'El material no existe en almacén'; end if;
  if coalesce(v_material.stock_actual, 0) < p_cantidad then
    raise exception 'Stock insuficiente: hay % %', v_material.stock_actual, v_material.unidad_medida;
  end if;

  v_valor := round(p_cantidad * v_material.precio_coste, 2);
  update public.materiales
  set stock_actual = stock_actual - p_cantidad
  where id = v_material.id;

  insert into public.almacen_material_movimientos (
    material_id, tipo, cantidad, coste_unitario, valor_total,
    obra_destino_id, realizado_por, observaciones
  ) values (
    v_material.id, 'salida_obra', p_cantidad, v_material.precio_coste,
    v_valor, p_obra_id, v_usuario, nullif(btrim(p_observaciones), '')
  );

  return jsonb_build_object(
    'ok', true,
    'material_id', v_material.id,
    'obra_id', p_obra_id,
    'cantidad_imputada', p_cantidad,
    'coste_imputado_obra', v_valor,
    'stock_almacen', v_material.stock_actual - p_cantidad
  );
end;
$$;

revoke all on function public.ia360_devolver_material_obra_almacen(uuid, numeric, text) from public, anon;
revoke all on function public.ia360_sacar_material_almacen_a_obra(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.ia360_devolver_material_obra_almacen(uuid, numeric, text) to authenticated, service_role;
grant execute on function public.ia360_sacar_material_almacen_a_obra(uuid, uuid, numeric, text) to authenticated, service_role;

grant select on public.v_obra_materiales_devolucion_disponible to authenticated, service_role;
grant select on public.v_obra_materiales_balance to authenticated, service_role;
grant select on public.materiales to authenticated, service_role;

comment on view public.v_obra_materiales_balance is
  'Balance operativo por obra: compras directas + salidas de almacén - devoluciones a almacén, en unidades y coste sin IVA.';

commit;
