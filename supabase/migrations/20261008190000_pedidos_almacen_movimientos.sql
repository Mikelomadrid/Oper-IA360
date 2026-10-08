-- IA360 · Conecta el circuito existente de Pedidos con el libro de almacén.
-- Preparar un material sigue siendo la única acción que mueve stock.

begin;

alter table public.almacen_material_movimientos
  add column if not exists solicitud_detalle_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'almacen_material_movimientos_solicitud_detalle_id_fkey'
  ) then
    alter table public.almacen_material_movimientos
      add constraint almacen_material_movimientos_solicitud_detalle_id_fkey
      foreign key (solicitud_detalle_id)
      references public.detalles_solicitud(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_almacen_mov_solicitud_detalle
  on public.almacen_material_movimientos(solicitud_detalle_id, created_at)
  where solicitud_detalle_id is not null;

create or replace function public.ia360_sincronizar_gasto_pedido_detalle(
  p_detalle_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_detalle public.detalles_solicitud%rowtype;
  v_solicitud public.solicitudes_material%rowtype;
  v_material public.materiales%rowtype;
  v_proveedor_interno_id uuid;
  v_gasto_id uuid;
begin
  select * into v_detalle
  from public.detalles_solicitud
  where id = p_detalle_id
  for update;

  if v_detalle.id is null or v_detalle.material_id is null then
    return;
  end if;

  select * into v_solicitud
  from public.solicitudes_material
  where id = v_detalle.solicitud_id;

  select * into v_material
  from public.materiales
  where id = v_detalle.material_id;

  if not v_detalle.preparada then
    if v_detalle.gasto_id is not null then
      update public.detalles_solicitud
      set gasto_id = null
      where id = v_detalle.id;
      delete from public.gastos where id = v_detalle.gasto_id;
    end if;
    return;
  end if;

  if v_solicitud.estado_solicitud::text not in ('gestionada', 'entregada', 'recibido')
     or v_detalle.gasto_id is not null then
    return;
  end if;

  select id into v_proveedor_interno_id
  from public.proveedores
  where lower(trim(nombre)) = 'almacén interno'
     or lower(trim(nombre)) = 'almacen interno'
  order by fecha_creacion nulls last
  limit 1;

  insert into public.gastos (
    proyecto_id, proveedor_id, numero_factura, fecha_emision,
    monto_bruto, iva, estado_pago, concepto,
    fecha_creacion, gasto_nave_taller
  ) values (
    v_solicitud.proyecto_id,
    v_proveedor_interno_id,
    'CONSUMO-' || substr(v_detalle.id::text, 1, 8),
    current_date,
    round(v_detalle.cantidad_solicitada * coalesce(v_material.precio_coste, 0), 2),
    0,
    'pagada',
    'Consumo Stock: ' || coalesce(v_material.nombre, v_material.descripcion, 'Material'),
    now(),
    v_solicitud.proyecto_id is null
  ) returning id into v_gasto_id;

  update public.detalles_solicitud
  set gasto_id = v_gasto_id
  where id = v_detalle.id;
end;
$$;

create or replace function public.api_toggle_item_preparado(
  p_detalle_id uuid,
  p_preparada boolean,
  p_force boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_detalle public.detalles_solicitud%rowtype;
  v_solicitud public.solicitudes_material%rowtype;
  v_material public.materiales%rowtype;
  v_empleado_id uuid;
  v_valor numeric;
begin
  if auth.role() <> 'service_role' and not public.app_is_admin_or_encargado() then
    raise exception 'Solo administradores o encargados pueden preparar pedidos de material';
  end if;

  select * into v_detalle
  from public.detalles_solicitud
  where id = p_detalle_id
  for update;

  if v_detalle.id is null then
    raise exception 'Item no encontrado';
  end if;

  select * into v_solicitud
  from public.solicitudes_material
  where id = v_detalle.solicitud_id
  for update;

  if v_detalle.preparada = p_preparada then
    return;
  end if;

  v_empleado_id := public.app_current_empleado_id();

  if v_detalle.material_id is not null then
    select * into v_material
    from public.materiales
    where id = v_detalle.material_id
    for update;

    if v_material.id is null then
      raise exception 'El material vinculado al pedido ya no existe';
    end if;

    v_valor := round(v_detalle.cantidad_solicitada * coalesce(v_material.precio_coste, 0), 2);

    if p_preparada then
      if not p_force and coalesce(v_material.stock_actual, 0) < v_detalle.cantidad_solicitada then
        raise exception 'Stock insuficiente: hay % %', v_material.stock_actual, v_material.unidad_medida;
      end if;

      update public.materiales
      set stock_actual = coalesce(stock_actual, 0) - v_detalle.cantidad_solicitada
      where id = v_material.id;

      insert into public.almacen_material_movimientos (
        material_id, tipo, cantidad, coste_unitario, valor_total,
        solicitud_detalle_id, obra_destino_id, realizado_por,
        observaciones, created_at
      ) values (
        v_material.id,
        'salida_obra',
        v_detalle.cantidad_solicitada,
        coalesce(v_material.precio_coste, 0),
        v_valor,
        v_detalle.id,
        v_solicitud.proyecto_id,
        v_empleado_id,
        'Salida preparada desde pedido ' || substr(v_solicitud.id::text, 1, 8),
        now()
      );
    else
      update public.materiales
      set stock_actual = coalesce(stock_actual, 0) + v_detalle.cantidad_solicitada
      where id = v_material.id;

      insert into public.almacen_material_movimientos (
        material_id, tipo, cantidad, coste_unitario, valor_total,
        solicitud_detalle_id, obra_origen_id, realizado_por,
        observaciones, created_at
      ) values (
        v_material.id,
        'devolucion_obra',
        v_detalle.cantidad_solicitada,
        coalesce(v_material.precio_coste, 0),
        v_valor,
        v_detalle.id,
        v_solicitud.proyecto_id,
        v_empleado_id,
        'Reversión de preparación del pedido ' || substr(v_solicitud.id::text, 1, 8),
        now()
      );
    end if;
  end if;

  update public.detalles_solicitud
  set
    preparada = p_preparada,
    preparada_at = case when p_preparada then now() else null end
  where id = v_detalle.id;

  perform public.ia360_sincronizar_gasto_pedido_detalle(v_detalle.id);
end;
$$;

create or replace function public.api_actualizar_solicitud_material_estado(
  p_solicitud_id uuid,
  p_estado public.request_status,
  p_notas text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_detalle record;
begin
  if auth.role() <> 'service_role' and not public.app_is_admin_or_encargado() then
    raise exception 'Solo administradores o encargados pueden actualizar el estado de las solicitudes de material';
  end if;

  perform 1
  from public.solicitudes_material
  where id = p_solicitud_id
  for update;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  update public.solicitudes_material
  set
    estado_solicitud = p_estado,
    notas = coalesce(p_notas, notas),
    empleado_encargado_id = public.app_current_empleado_id()
  where id = p_solicitud_id;

  if p_estado::text = 'cancelada' then
    for v_detalle in
      select id
      from public.detalles_solicitud
      where solicitud_id = p_solicitud_id
        and preparada = true
      order by id
    loop
      perform public.api_toggle_item_preparado(v_detalle.id, false, true);
    end loop;
  elsif p_estado::text in ('gestionada', 'entregada', 'recibido') then
    for v_detalle in
      select id
      from public.detalles_solicitud
      where solicitud_id = p_solicitud_id
        and preparada = true
      order by id
    loop
      perform public.ia360_sincronizar_gasto_pedido_detalle(v_detalle.id);
    end loop;
  end if;
end;
$$;

-- Incorpora al libro los pedidos ya preparados sin volver a tocar su stock.
insert into public.almacen_material_movimientos (
  material_id, tipo, cantidad, coste_unitario, valor_total,
  solicitud_detalle_id, obra_destino_id, realizado_por,
  observaciones, created_at
)
select
  d.material_id,
  'salida_obra',
  d.cantidad_solicitada,
  coalesce(m.precio_coste, 0),
  round(d.cantidad_solicitada * coalesce(m.precio_coste, 0), 2),
  d.id,
  s.proyecto_id,
  s.empleado_encargado_id,
  'Salida histórica incorporada desde Pedidos',
  coalesce(d.preparada_at, s.fecha_solicitud, now())
from public.detalles_solicitud d
join public.solicitudes_material s on s.id = d.solicitud_id
join public.materiales m on m.id = d.material_id
where d.preparada = true
  and not exists (
    select 1
    from public.almacen_material_movimientos amm
    where amm.solicitud_detalle_id = d.id
      and amm.tipo = 'salida_obra'
  );

revoke all on function public.ia360_sincronizar_gasto_pedido_detalle(uuid) from public, anon, authenticated;
revoke all on function public.api_toggle_item_preparado(uuid, boolean, boolean) from public, anon;
revoke all on function public.api_actualizar_solicitud_material_estado(uuid, public.request_status, text) from public, anon;

grant execute on function public.api_toggle_item_preparado(uuid, boolean, boolean) to authenticated, service_role;
grant execute on function public.api_actualizar_solicitud_material_estado(uuid, public.request_status, text) to authenticated, service_role;
grant execute on function public.ia360_sincronizar_gasto_pedido_detalle(uuid) to service_role;

comment on function public.api_toggle_item_preparado(uuid, boolean, boolean) is
  'Prepara o revierte una linea de pedido: mueve stock, registra el movimiento y sincroniza el coste interno de la obra.';

commit;
