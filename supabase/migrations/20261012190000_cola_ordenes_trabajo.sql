-- Cola de trabajo del técnico.
-- Distingue una tarea que debe empezar ahora de las siguientes tareas todavía
-- no iniciadas. Las órdenes en cola conservan el estado `asignada`.

create or replace function public.encolar_orden_trabajo(
  p_proyecto_id uuid,
  p_tarea_id uuid,
  p_empleado_id uuid,
  p_horas_previstas numeric default null,
  p_notas text default null
)
returns public.ordenes_trabajo_diarias
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_fichaje_id uuid;
  v_orden integer;
  v_resultado public.ordenes_trabajo_diarias%rowtype;
begin
  if not public.app_is_admin_or_encargado() then
    raise exception 'Solo administración o el encargado pueden asignar trabajo.';
  end if;

  select id into v_actor_id
  from public.empleados
  where auth_user_id = auth.uid()
  limit 1;

  select orden into v_orden
  from public.tareas
  where id = p_tarea_id and proyecto_id = p_proyecto_id;
  if not found then
    raise exception 'La tarea no pertenece a esta obra.';
  end if;

  select id into v_fichaje_id
  from public.control_horario
  where empleado_id = p_empleado_id
    and proyecto_id = p_proyecto_id
    and hora_salida is null
  order by hora_entrada desc
  limit 1;
  if v_fichaje_id is null then
    raise exception 'El empleado no está fichado actualmente en esta obra.';
  end if;

  insert into public.tarea_empleados (tarea_id, empleado_id)
  values (p_tarea_id, p_empleado_id)
  on conflict (tarea_id, empleado_id) do nothing;

  select * into v_resultado
  from public.ordenes_trabajo_diarias
  where tarea_id = p_tarea_id
    and empleado_id = p_empleado_id
    and estado in ('asignada', 'activa', 'pendiente_continuar')
  order by asignada_at desc
  limit 1
  for update;

  if v_resultado.id is null then
    insert into public.ordenes_trabajo_diarias (
      proyecto_id, tarea_id, empleado_id, fichaje_id, fecha_asignacion,
      orden, estado, horas_previstas, notas_encargado, asignada_por
    ) values (
      p_proyecto_id, p_tarea_id, p_empleado_id, v_fichaje_id,
      (timezone('Europe/Madrid', now()))::date, coalesce(v_orden, 0),
      'asignada', p_horas_previstas, nullif(trim(p_notas), ''), v_actor_id
    ) returning * into v_resultado;
  else
    update public.ordenes_trabajo_diarias
    set fichaje_id = v_fichaje_id,
        fecha_asignacion = (timezone('Europe/Madrid', now()))::date,
        orden = coalesce(v_orden, orden),
        estado = case when v_resultado.estado = 'activa' then 'activa' else 'asignada' end,
        horas_previstas = coalesce(p_horas_previstas, horas_previstas),
        notas_encargado = coalesce(nullif(trim(p_notas), ''), notas_encargado),
        asignada_por = v_actor_id,
        asignada_at = now(),
        iniciada_at = case when v_resultado.estado = 'activa' then iniciada_at else null end,
        cerrada_at = null,
        updated_at = now()
    where id = v_resultado.id
    returning * into v_resultado;
  end if;

  return v_resultado;
end;
$$;

revoke all on function public.encolar_orden_trabajo(uuid, uuid, uuid, numeric, text) from public;
grant execute on function public.encolar_orden_trabajo(uuid, uuid, uuid, numeric, text) to authenticated, service_role;

comment on function public.encolar_orden_trabajo(uuid, uuid, uuid, numeric, text) is
  'Añade una tarea futura a la cola del técnico sin iniciarla ni alterar la tarea actual.';
