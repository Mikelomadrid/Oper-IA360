begin;

alter table public.almacen_material_movimientos
  add column if not exists movimiento_origen_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'almacen_material_movimientos_movimiento_origen_id_fkey'
  ) then
    alter table public.almacen_material_movimientos
      add constraint almacen_material_movimientos_movimiento_origen_id_fkey
      foreign key (movimiento_origen_id)
      references public.almacen_material_movimientos(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_almacen_mov_movimiento_origen
  on public.almacen_material_movimientos(movimiento_origen_id, tipo)
  where movimiento_origen_id is not null;

create or replace view public.v_obra_materiales_devolucion_disponible
with (security_invoker = true) as
with compras as (
  select
    a.asignacion_id,
    a.obra_id,
    a.factura_id,
    a.linea_ocr_id,
    a.producto_catalogo_id,
    a.material_almacen_id,
    a.descripcion,
    a.referencia,
    a.unidad,
    a.precio_unitario,
    a.cantidad_comprada,
    a.cantidad_devuelta_almacen + a.cantidad_devuelta_proveedor as cantidad_devuelta,
    a.cantidad_disponible,
    o.numero_factura,
    o.fecha_factura,
    o.proveedor_nombre,
    a.cantidad_devuelta_almacen,
    a.cantidad_devuelta_proveedor,
    'compra'::text as origen_tipo,
    a.asignacion_id as origen_id
  from public.v_devolucion_proveedor_lineas_disponibles a
  left join lateral (
    select numero_factura, fecha_factura, proveedor_nombre
    from public.facturas_gastos_ocr
    where factura_id = a.factura_id
    order by created_at desc
    limit 1
  ) o on true
  where a.destino_tipo = 'obra'
),
salidas_almacen as (
  select
    null::uuid as asignacion_id,
    s.obra_destino_id as obra_id,
    null::uuid as factura_id,
    null::uuid as linea_ocr_id,
    null::uuid as producto_catalogo_id,
    s.material_id as material_almacen_id,
    coalesce(mat.nombre, mat.descripcion, 'Material de almacén') as descripcion,
    mat.codigo as referencia,
    coalesce(mat.unidad_medida, 'ud') as unidad,
    s.coste_unitario as precio_unitario,
    s.cantidad as cantidad_comprada,
    coalesce(sum(d.cantidad), 0) as cantidad_devuelta,
    s.cantidad - coalesce(sum(d.cantidad), 0) as cantidad_disponible,
    'SALIDA-' || left(s.id::text, 8) as numero_factura,
    s.created_at::date as fecha_factura,
    'Almacén interno'::text as proveedor_nombre,
    coalesce(sum(d.cantidad), 0) as cantidad_devuelta_almacen,
    0::numeric as cantidad_devuelta_proveedor,
    'almacen'::text as origen_tipo,
    s.id as origen_id
  from public.almacen_material_movimientos s
  join public.materiales mat on mat.id = s.material_id
  left join public.almacen_material_movimientos d
    on d.movimiento_origen_id = s.id
   and d.tipo = 'devolucion_obra'
  where s.tipo = 'salida_obra'
    and s.obra_destino_id is not null
  group by
    s.id, s.obra_destino_id, s.material_id, s.coste_unitario,
    s.cantidad, s.created_at, mat.nombre, mat.descripcion,
    mat.codigo, mat.unidad_medida
)
select * from compras
union all
select * from salidas_almacen;

create or replace function public.ia360_devolver_salida_obra_almacen(
  p_movimiento_salida_id uuid,
  p_cantidad numeric,
  p_observaciones text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_salida public.almacen_material_movimientos%rowtype;
  v_material public.materiales%rowtype;
  v_detalle public.detalles_solicitud%rowtype;
  v_devuelto numeric;
  v_disponible numeric;
  v_valor numeric;
  v_coste_pendiente numeric;
  v_gasto_id uuid;
  v_usuario uuid;
begin
  if not public.app_is_admin_or_encargado() then
    raise exception 'No tienes permiso para mover materiales de obra al almacén';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;

  v_usuario := public.app_current_empleado_id();

  select * into v_salida
  from public.almacen_material_movimientos
  where id = p_movimiento_salida_id
    and tipo = 'salida_obra'
    and obra_destino_id is not null
  for update;

  if v_salida.id is null then
    raise exception 'No se encontró la salida de almacén asignada a la obra';
  end if;

  select coalesce(sum(cantidad), 0) into v_devuelto
  from public.almacen_material_movimientos
  where movimiento_origen_id = v_salida.id
    and tipo = 'devolucion_obra';

  v_disponible := v_salida.cantidad - v_devuelto;
  if p_cantidad > v_disponible then
    raise exception 'Solo quedan % unidades disponibles para devolver', v_disponible;
  end if;

  select * into v_material
  from public.materiales
  where id = v_salida.material_id
  for update;

  if v_material.id is null then
    raise exception 'El material ya no existe en el almacén';
  end if;

  v_valor := round(p_cantidad * v_salida.coste_unitario, 2);

  update public.materiales
  set
    precio_coste = case
      when coalesce(stock_actual, 0) + p_cantidad = 0 then v_salida.coste_unitario
      else round(
        ((coalesce(stock_actual, 0) * coalesce(precio_coste, 0)) + v_valor)
        / (coalesce(stock_actual, 0) + p_cantidad), 4
      )
    end,
    stock_actual = coalesce(stock_actual, 0) + p_cantidad
  where id = v_material.id
  returning * into v_material;

  insert into public.almacen_material_movimientos (
    material_id, tipo, cantidad, coste_unitario, valor_total,
    solicitud_detalle_id, movimiento_origen_id, obra_origen_id,
    realizado_por, observaciones
  ) values (
    v_salida.material_id, 'devolucion_obra', p_cantidad,
    v_salida.coste_unitario, v_valor, v_salida.solicitud_detalle_id,
    v_salida.id, v_salida.obra_destino_id, v_usuario,
    nullif(btrim(p_observaciones), '')
  );

  if v_salida.solicitud_detalle_id is not null then
    select * into v_detalle
    from public.detalles_solicitud
    where id = v_salida.solicitud_detalle_id
    for update;

    v_gasto_id := v_detalle.gasto_id;
    if v_gasto_id is null then
      select g.id into v_gasto_id
      from public.gastos g
      where g.proyecto_id = v_salida.obra_destino_id
        and g.numero_factura = 'CONSUMO-' || substr(v_detalle.id::text, 1, 8)
      order by g.fecha_creacion desc
      limit 1;
    end if;

    select greatest(
      coalesce(sum(case
        when m.tipo = 'salida_obra' then m.valor_total
        when m.tipo = 'devolucion_obra' and m.movimiento_origen_id is not null then -m.valor_total
        else 0
      end), 0),
      0
    ) into v_coste_pendiente
    from public.almacen_material_movimientos m
    where m.solicitud_detalle_id = v_salida.solicitud_detalle_id;

    if v_gasto_id is not null then
      if v_coste_pendiente <= 0 then
        update public.detalles_solicitud
        set gasto_id = null
        where id = v_detalle.id;

        delete from public.gastos
        where id = v_gasto_id;
      else
        update public.gastos
        set monto_bruto = round(v_coste_pendiente, 2)
        where id = v_gasto_id;

        update public.detalles_solicitud
        set gasto_id = v_gasto_id
        where id = v_detalle.id
          and gasto_id is null;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'origen_tipo', 'almacen',
    'movimiento_salida_id', v_salida.id,
    'obra_id', v_salida.obra_destino_id,
    'material_id', v_material.id,
    'cantidad_devuelta', p_cantidad,
    'cantidad_pendiente_obra', v_disponible - p_cantidad,
    'coste_descontado_obra', v_valor,
    'stock_almacen', v_material.stock_actual
  );
end;
$$;

-- Reconcilia consumos internos ya devueltos antes de instalar esta versión.
with saldos as (
  select
    d.id as detalle_id,
    s.proyecto_id,
    greatest(coalesce(sum(case
      when m.tipo = 'salida_obra' then m.valor_total
      when m.tipo = 'devolucion_obra' and m.movimiento_origen_id is not null then -m.valor_total
      else 0
    end), 0), 0) as coste_pendiente
  from public.detalles_solicitud d
  join public.solicitudes_material s on s.id = d.solicitud_id
  join public.almacen_material_movimientos m on m.solicitud_detalle_id = d.id
  group by d.id, s.proyecto_id
)
update public.gastos g
set monto_bruto = round(s.coste_pendiente, 2)
from saldos s
where s.coste_pendiente > 0
  and g.proyecto_id = s.proyecto_id
  and g.numero_factura = 'CONSUMO-' || substr(s.detalle_id::text, 1, 8);

with saldos as (
  select
    d.id as detalle_id,
    s.proyecto_id,
    greatest(coalesce(sum(case
      when m.tipo = 'salida_obra' then m.valor_total
      when m.tipo = 'devolucion_obra' and m.movimiento_origen_id is not null then -m.valor_total
      else 0
    end), 0), 0) as coste_pendiente
  from public.detalles_solicitud d
  join public.solicitudes_material s on s.id = d.solicitud_id
  join public.almacen_material_movimientos m on m.solicitud_detalle_id = d.id
  group by d.id, s.proyecto_id
)
delete from public.gastos g
using saldos s
where s.coste_pendiente <= 0
  and g.proyecto_id = s.proyecto_id
  and g.numero_factura = 'CONSUMO-' || substr(s.detalle_id::text, 1, 8);

revoke all on function public.ia360_devolver_salida_obra_almacen(uuid, numeric, text) from public, anon;
grant execute on function public.ia360_devolver_salida_obra_almacen(uuid, numeric, text) to authenticated, service_role;
grant select on public.v_obra_materiales_devolucion_disponible to authenticated, service_role;

comment on function public.ia360_devolver_salida_obra_almacen(uuid, numeric, text) is
  'Devuelve total o parcialmente a almacén una salida imputada a obra y reduce su coste interno sin afectar ContaSimple.';

commit;
