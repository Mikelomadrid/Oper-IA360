-- La revisión del encargado debe basarse en evidencias y, si se devuelve,
-- la orden debe volver a estar disponible para el equipo.

create or replace function public.admin_guardar_revision_tarea(
  p_tarea_id uuid,
  p_resultado public.tarea_revision_result,
  p_comentario text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revisor_id uuid;
  v_evidencias integer := 0;
begin
  if not public.is_admin_or_encargado() then
    raise exception 'No autorizado';
  end if;

  select e.id into v_revisor_id
  from public.empleados e
  where e.auth_user_id = auth.uid();

  if v_revisor_id is null then
    raise exception 'Usuario actual no vinculado a empleados';
  end if;

  if p_resultado = 'aprobada' then
    select
      (select count(*) from public.ordenes_trabajo_evidencias ote where ote.tarea_id = p_tarea_id)
      +
      (select count(*)
         from public.evidencias_tarea et
         join public.subtareas st on st.id = et.subtarea_id
        where st.tarea_id = p_tarea_id)
    into v_evidencias;

    if coalesce(v_evidencias, 0) < 1 then
      raise exception 'No se puede aprobar la tarea sin al menos una evidencia fotográfica.';
    end if;
  elsif nullif(trim(p_comentario), '') is null then
    raise exception 'Debes indicar qué debe corregirse antes de devolver la tarea.';
  end if;

  insert into public.tarea_revisiones (tarea_id, revisor_empleado_id, resultado, aprobado, comentario)
  values (
    p_tarea_id,
    v_revisor_id,
    p_resultado,
    case when p_resultado = 'aprobada' then true else false end,
    nullif(trim(p_comentario), '')
  );

  if p_resultado = 'aprobada' then
    update public.tareas
       set estado = 'completada_validada'::public.tarea_status,
           revisada_por = v_revisor_id,
           fecha_revision = now(),
           comentario_revision = nullif(trim(p_comentario), ''),
           fecha_validacion = now(),
           validado_por = v_revisor_id
     where id = p_tarea_id;
  else
    update public.tareas
       set estado = 'en_progreso'::public.tarea_status,
           revisada_por = v_revisor_id,
           fecha_revision = now(),
           comentario_revision = trim(p_comentario),
           fecha_validacion = null,
           validado_por = null
     where id = p_tarea_id;

    update public.subtareas
       set completada = false,
           fecha_completado = null
     where tarea_id = p_tarea_id;

    -- Reabrir solo la orden finalizada más reciente de cada empleado.
    -- Así la corrección vuelve a su bandeja sin crear duplicados abiertos.
    update public.ordenes_trabajo_diarias otd
       set estado = 'pendiente_continuar',
           cerrada_at = null,
           resultado_notas = concat_ws(
             E'\n',
             nullif(trim(otd.resultado_notas), ''),
             'Corrección solicitada por el encargado: ' || trim(p_comentario)
           ),
           updated_at = now()
     where otd.id in (
       select distinct on (empleado_id) id
       from public.ordenes_trabajo_diarias
       where tarea_id = p_tarea_id
         and estado = 'completada'
       order by empleado_id, cerrada_at desc nulls last, asignada_at desc
     );
  end if;

  return json_build_object(
    'ok', true,
    'tarea_id', p_tarea_id,
    'resultado', p_resultado,
    'evidencias', v_evidencias
  );
end;
$$;

revoke all on function public.admin_guardar_revision_tarea(uuid, public.tarea_revision_result, text) from public;
grant execute on function public.admin_guardar_revision_tarea(uuid, public.tarea_revision_result, text)
  to authenticated, service_role;

comment on function public.admin_guardar_revision_tarea(uuid, public.tarea_revision_result, text) is
  'Aprueba tareas con evidencia o las devuelve con comentario, reabriendo la última orden del equipo.';
