-- IA360 · Devoluciones de material a proveedor pendientes de factura de abono.
-- La devolución reduce inmediatamente unidades y coste de la obra, pero no mueve
-- stock del almacén ni genera ningún asiento/envío a Contasimple.

begin;

create table if not exists public.devoluciones_proveedor (
  id uuid primary key default gen_random_uuid(),
  factura_origen_id uuid not null references public.facturas_gastos(id) on delete restrict,
  gasto_origen_id uuid references public.gastos(id) on delete set null,
  obra_id uuid not null references public.proyectos(id) on delete restrict,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  estado text not null default 'pendiente_abono',
  motivo text not null,
  importe_base_estimado numeric(14,2) not null default 0,
  factura_abono_id uuid references public.facturas_gastos(id) on delete set null,
  creado_por uuid references public.empleados(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  abonada_at timestamptz,
  cancelada_at timestamptz,
  observaciones text,
  constraint devoluciones_proveedor_estado_chk
    check (estado in ('pendiente_abono', 'abonada', 'rechazada', 'cancelada')),
  constraint devoluciones_proveedor_importe_chk
    check (importe_base_estimado >= 0)
);

create table if not exists public.devolucion_proveedor_lineas (
  id uuid primary key default gen_random_uuid(),
  devolucion_id uuid not null references public.devoluciones_proveedor(id) on delete cascade,
  asignacion_id uuid not null references public.factura_gasto_linea_asignaciones(id) on delete restrict,
  cantidad numeric(14,3) not null,
  unidad text not null default 'ud',
  precio_unitario numeric(14,4) not null default 0,
  importe_base numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint devolucion_proveedor_lineas_cantidad_chk check (cantidad > 0),
  constraint devolucion_proveedor_lineas_precio_chk check (precio_unitario >= 0),
  constraint devolucion_proveedor_lineas_importe_chk check (importe_base >= 0),
  constraint devolucion_proveedor_lineas_unica unique (devolucion_id, asignacion_id)
);

create index if not exists idx_devoluciones_proveedor_factura
  on public.devoluciones_proveedor(factura_origen_id, obra_id, estado);
create index if not exists idx_devoluciones_proveedor_pendientes
  on public.devoluciones_proveedor(created_at)
  where estado = 'pendiente_abono';
create index if not exists idx_devolucion_proveedor_lineas_asignacion
  on public.devolucion_proveedor_lineas(asignacion_id);

alter table public.devoluciones_proveedor enable row level security;
alter table public.devolucion_proveedor_lineas enable row level security;

drop policy if exists devoluciones_proveedor_gestion on public.devoluciones_proveedor;
create policy devoluciones_proveedor_gestion
on public.devoluciones_proveedor
to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

drop policy if exists devolucion_proveedor_lineas_gestion on public.devolucion_proveedor_lineas;
create policy devolucion_proveedor_lineas_gestion
on public.devolucion_proveedor_lineas
to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

grant select, insert, update on public.devoluciones_proveedor to authenticated, service_role;
grant select, insert, update on public.devolucion_proveedor_lineas to authenticated, service_role;

create or replace view public.v_devolucion_proveedor_lineas_disponibles
with (security_invoker = true) as
with dev_almacen as (
  select asignacion_id, sum(cantidad) as cantidad
  from public.almacen_material_movimientos
  where tipo = 'devolucion_obra'
    and asignacion_id is not null
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
where a.destino_tipo = 'obra';

create or replace view public.v_devoluciones_proveedor_resumen_factura
with (security_invoker = true) as
select
  d.factura_origen_id as factura_id,
  d.gasto_origen_id,
  d.obra_id,
  count(*) filter (where d.estado = 'pendiente_abono')::integer as devoluciones_pendientes,
  coalesce(sum(d.importe_base_estimado) filter (where d.estado = 'pendiente_abono'), 0) as importe_pendiente_abono,
  count(*) filter (where d.estado = 'abonada')::integer as devoluciones_abonadas,
  coalesce(sum(d.importe_base_estimado) filter (where d.estado = 'abonada'), 0) as importe_abonado,
  max(d.created_at) as ultima_devolucion_at
from public.devoluciones_proveedor d
where d.estado in ('pendiente_abono', 'abonada')
group by d.factura_origen_id, d.gasto_origen_id, d.obra_id;

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
  a.cantidad_devuelta_almacen + a.cantidad_devuelta_proveedor as cantidad_devuelta,
  a.cantidad_disponible,
  o.numero_factura,
  o.fecha_factura,
  o.proveedor_nombre,
  a.cantidad_devuelta_almacen,
  a.cantidad_devuelta_proveedor
from public.v_devolucion_proveedor_lineas_disponibles a
left join lateral (
  select numero_factura, fecha_factura, proveedor_nombre
  from public.facturas_gastos_ocr
  where factura_id = a.factura_id
  order by created_at desc
  limit 1
) o on true;

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
    0::numeric, 0::numeric, m.cantidad,
    0::numeric, 0::numeric, m.valor_total,
    m.created_at
  from public.almacen_material_movimientos m
  left join public.factura_gasto_linea_asignaciones a on a.id = m.asignacion_id
  join public.materiales mat on mat.id = m.material_id
  where m.tipo = 'devolucion_obra'
    and m.obra_origen_id is not null

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
group by obra_id, producto_catalogo_id, material_id, descripcion, referencia, unidad;

create or replace function public.ia360_crear_devolucion_proveedor(
  p_factura_id uuid,
  p_obra_id uuid,
  p_motivo text,
  p_lineas jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_factura public.facturas_gastos%rowtype;
  v_asig public.factura_gasto_linea_asignaciones%rowtype;
  v_linea jsonb;
  v_devolucion_id uuid;
  v_cantidad numeric;
  v_dev_almacen numeric;
  v_dev_proveedor numeric;
  v_disponible numeric;
  v_total numeric := 0;
  v_num_lineas integer := 0;
begin
  if not public.app_is_admin_or_encargado() then
    raise exception 'No tienes permiso para registrar devoluciones a proveedor';
  end if;
  if p_factura_id is null or p_obra_id is null then
    raise exception 'La factura y la obra son obligatorias';
  end if;
  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Indica el motivo de la devolución';
  end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Selecciona al menos una línea para devolver';
  end if;

  select * into v_factura from public.facturas_gastos where id = p_factura_id;
  if v_factura.id is null then raise exception 'La factura de origen no existe'; end if;
  if not exists (select 1 from public.proyectos where id = p_obra_id) then
    raise exception 'La obra no existe';
  end if;

  insert into public.devoluciones_proveedor (
    factura_origen_id, gasto_origen_id, obra_id, proveedor_id,
    estado, motivo, creado_por
  ) values (
    v_factura.id, v_factura.gasto_id, p_obra_id, v_factura.proveedor_id,
    'pendiente_abono', btrim(p_motivo), public.app_current_empleado_id()
  ) returning id into v_devolucion_id;

  for v_linea in select value from jsonb_array_elements(p_lineas)
  loop
    v_cantidad := nullif(v_linea->>'cantidad', '')::numeric;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Todas las cantidades deben ser mayores que cero';
    end if;

    select * into v_asig
    from public.factura_gasto_linea_asignaciones
    where id = (v_linea->>'asignacion_id')::uuid
    for update;

    if v_asig.id is null
       or v_asig.factura_id <> p_factura_id
       or v_asig.obra_id <> p_obra_id
       or v_asig.destino_tipo <> 'obra' then
      raise exception 'Una línea no pertenece a esta factura y obra';
    end if;

    select coalesce(sum(cantidad), 0) into v_dev_almacen
    from public.almacen_material_movimientos
    where asignacion_id = v_asig.id and tipo = 'devolucion_obra';

    select coalesce(sum(l.cantidad), 0) into v_dev_proveedor
    from public.devolucion_proveedor_lineas l
    join public.devoluciones_proveedor d on d.id = l.devolucion_id
    where l.asignacion_id = v_asig.id
      and d.estado in ('pendiente_abono', 'abonada');

    v_disponible := v_asig.cantidad - v_dev_almacen - v_dev_proveedor;
    if v_cantidad > v_disponible then
      raise exception 'Solo quedan % % disponibles de %', v_disponible, v_asig.unidad, v_asig.descripcion;
    end if;

    insert into public.devolucion_proveedor_lineas (
      devolucion_id, asignacion_id, cantidad, unidad,
      precio_unitario, importe_base
    ) values (
      v_devolucion_id, v_asig.id, v_cantidad, v_asig.unidad,
      v_asig.precio_unitario, round(v_cantidad * v_asig.precio_unitario, 2)
    );

    v_total := v_total + round(v_cantidad * v_asig.precio_unitario, 2);
    v_num_lineas := v_num_lineas + 1;
  end loop;

  update public.devoluciones_proveedor
  set importe_base_estimado = v_total, updated_at = now()
  where id = v_devolucion_id;

  return jsonb_build_object(
    'ok', true,
    'devolucion_id', v_devolucion_id,
    'estado', 'pendiente_abono',
    'lineas', v_num_lineas,
    'importe_pendiente_abono', v_total,
    'stock_modificado', false,
    'contasimple_modificado', false
  );
end;
$$;

create or replace function public.ia360_cancelar_devolucion_proveedor(
  p_devolucion_id uuid,
  p_observaciones text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_devolucion public.devoluciones_proveedor%rowtype;
begin
  if not public.app_is_admin_or_encargado() then
    raise exception 'No tienes permiso para cancelar devoluciones a proveedor';
  end if;
  select * into v_devolucion
  from public.devoluciones_proveedor
  where id = p_devolucion_id
  for update;
  if v_devolucion.id is null then raise exception 'La devolución no existe'; end if;
  if v_devolucion.estado <> 'pendiente_abono' then
    raise exception 'Solo se pueden cancelar devoluciones pendientes de abono';
  end if;

  update public.devoluciones_proveedor
  set estado = 'cancelada', cancelada_at = now(), updated_at = now(),
      observaciones = coalesce(nullif(btrim(p_observaciones), ''), observaciones)
  where id = p_devolucion_id;

  return jsonb_build_object('ok', true, 'devolucion_id', p_devolucion_id, 'estado', 'cancelada');
end;
$$;

-- Evita que una línea ya enviada al proveedor pueda devolverse también al almacén.
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
  v_devuelto_almacen numeric;
  v_devuelto_proveedor numeric;
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
  where id = p_asignacion_id and destino_tipo = 'obra'
  for update;
  if v_asig.id is null then raise exception 'No se encontró la asignación de material a la obra'; end if;

  select coalesce(sum(cantidad), 0) into v_devuelto_almacen
  from public.almacen_material_movimientos
  where asignacion_id = v_asig.id and tipo = 'devolucion_obra';
  select coalesce(sum(l.cantidad), 0) into v_devuelto_proveedor
  from public.devolucion_proveedor_lineas l
  join public.devoluciones_proveedor d on d.id = l.devolucion_id
  where l.asignacion_id = v_asig.id
    and d.estado in ('pendiente_abono', 'abonada');

  v_disponible := v_asig.cantidad - v_devuelto_almacen - v_devuelto_proveedor;
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
    set precio_coste = case
          when coalesce(stock_actual, 0) + p_cantidad = 0 then v_asig.precio_unitario
          else round(((coalesce(stock_actual, 0) * coalesce(precio_coste, 0)) + v_valor)
                     / (coalesce(stock_actual, 0) + p_cantidad), 4)
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

revoke all on function public.ia360_crear_devolucion_proveedor(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.ia360_cancelar_devolucion_proveedor(uuid, text) from public, anon;
grant execute on function public.ia360_crear_devolucion_proveedor(uuid, uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.ia360_cancelar_devolucion_proveedor(uuid, text) to authenticated, service_role;

grant select on public.v_devolucion_proveedor_lineas_disponibles to authenticated, service_role;
grant select on public.v_devoluciones_proveedor_resumen_factura to authenticated, service_role;
grant select on public.v_obra_materiales_devolucion_disponible to authenticated, service_role;
grant select on public.v_obra_materiales_balance to authenticated, service_role;

comment on table public.devoluciones_proveedor is
  'Devoluciones físicas a proveedor. Pendiente_abono reduce el coste de obra, sin stock ni Contasimple.';
comment on function public.ia360_crear_devolucion_proveedor(uuid, uuid, text, jsonb) is
  'Registra una devolución a proveedor pendiente de abono y reduce el balance de materiales de la obra.';

commit;
