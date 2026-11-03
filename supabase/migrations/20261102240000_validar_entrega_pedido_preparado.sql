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

  if p_estado::text = 'entregada'
     and exists (
       select 1
       from public.detalles_solicitud
       where solicitud_id = p_solicitud_id
         and preparada is not true
     ) then
    raise exception 'No se puede marcar como entregado: todos los artículos deben estar preparados y descontados del stock';
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

revoke all on function public.api_actualizar_solicitud_material_estado(uuid, public.request_status, text) from public, anon;
grant execute on function public.api_actualizar_solicitud_material_estado(uuid, public.request_status, text) to authenticated, service_role;
