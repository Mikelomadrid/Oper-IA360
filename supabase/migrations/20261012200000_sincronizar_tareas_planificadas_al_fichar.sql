-- Convierte la planificación de una obra en la cola diaria del técnico.
-- Se ejecuta desde la vista de fichaje y solo actúa sobre el empleado autenticado
-- y la obra en la que mantiene un fichaje abierto.

create or replace function public.sincronizar_ordenes_planificadas_fichaje()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empleado_id uuid;
  v_fichaje_id uuid;
  v_proyecto_id uuid;
  v_insertadas integer := 0;
begin
  select e.id
    into v_empleado_id
  from public.empleados e
  where e.auth_user_id = auth.uid()
  limit 1;

  if v_empleado_id is null then
    raise exception 'No se encontró el empleado autenticado.';
  end if;

  select ch.id, ch.proyecto_id
    into v_fichaje_id, v_proyecto_id
  from public.control_horario ch
  where ch.empleado_id = v_empleado_id
    and ch.hora_salida is null
    and ch.proyecto_id is not null
  order by ch.hora_entrada desc
  limit 1;

  if v_fichaje_id is null or v_proyecto_id is null then
    return 0;
  end if;

  insert into public.ordenes_trabajo_diarias (
    proyecto_id,
    tarea_id,
    empleado_id,
    fichaje_id,
    fecha_asignacion,
    orden,
    estado,
    horas_previstas,
    asignada_por
  )
  select
    t.proyecto_id,
    t.id,
    v_empleado_id,
    v_fichaje_id,
    (timezone('Europe/Madrid', now()))::date,
    coalesce(t.orden, 0),
    'asignada',
    t.duracion_planificada_horas,
    null
  from public.tareas t
  where t.proyecto_id = v_proyecto_id
    and t.estado not in ('pendiente_revision', 'completada', 'completada_validada', 'cancelada')
    and (
      t.empleado_asignado_id = v_empleado_id
      or exists (
        select 1
        from public.tarea_empleados te
        where te.tarea_id = t.id
          and te.empleado_id = v_empleado_id
      )
    )
    and not exists (
      select 1
      from public.ordenes_trabajo_diarias otd
      where otd.tarea_id = t.id
        and otd.empleado_id = v_empleado_id
        and otd.estado <> 'cancelada'
    )
  order by coalesce(t.orden, 0), t.fecha_creacion, t.id;

  get diagnostics v_insertadas = row_count;

  -- Si una orden abierta procede de un fichaje anterior, la vinculamos al actual
  -- sin alterar su estado ni sus horas acumuladas.
  update public.ordenes_trabajo_diarias otd
  set fichaje_id = v_fichaje_id,
      fecha_asignacion = (timezone('Europe/Madrid', now()))::date,
      updated_at = now()
  where otd.empleado_id = v_empleado_id
    and otd.proyecto_id = v_proyecto_id
    and otd.estado in ('asignada', 'activa', 'pendiente_continuar')
    and otd.fichaje_id is distinct from v_fichaje_id;

  return v_insertadas;
end;
$$;

revoke all on function public.sincronizar_ordenes_planificadas_fichaje() from public;
grant execute on function public.sincronizar_ordenes_planificadas_fichaje() to authenticated, service_role;

comment on function public.sincronizar_ordenes_planificadas_fichaje() is
  'Materializa en la cola diaria las tareas ya planificadas para el técnico fichado, sin recrear tareas cerradas o aprobadas.';
