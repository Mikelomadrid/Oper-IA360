-- Guarda el cronograma y sus equipos en una única transacción.
-- Evita planes parcialmente guardados cuando una obra tiene muchas tareas.
create or replace function public.guardar_planificacion_tareas(
  p_proyecto_id uuid,
  p_plan jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_tarea_id uuid;
  v_guardadas integer := 0;
begin
  if public.get_user_role() not in ('admin'::public.app_role, 'encargado'::public.app_role) then
    raise exception 'Solo administración o el encargado pueden guardar la planificación'
      using errcode = '42501';
  end if;

  if p_proyecto_id is null or jsonb_typeof(p_plan) <> 'array' then
    raise exception 'La planificación recibida no es válida'
      using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_plan)
  loop
    v_tarea_id := nullif(v_item ->> 'tarea_id', '')::uuid;

    if v_tarea_id is null or not exists (
      select 1
      from public.tareas
      where id = v_tarea_id
        and proyecto_id = p_proyecto_id
    ) then
      raise exception 'La tarea % no pertenece a esta obra', coalesce(v_item ->> 'tarea_id', 'sin identificar')
        using errcode = '22023';
    end if;

    update public.tareas
    set empleado_asignado_id = nullif(v_item ->> 'empleado_principal_id', '')::uuid,
        fecha_inicio = nullif(v_item ->> 'fecha_inicio', '')::date,
        fecha_limite = nullif(v_item ->> 'fecha_limite', '')::date,
        duracion_planificada_horas = nullif(v_item ->> 'duracion_planificada_horas', '')::numeric,
        inicio_planificado_at = nullif(v_item ->> 'inicio_planificado_at', '')::timestamptz,
        fin_planificado_at = nullif(v_item ->> 'fin_planificado_at', '')::timestamptz
    where id = v_tarea_id;

    delete from public.tarea_empleados
    where tarea_id = v_tarea_id;

    insert into public.tarea_empleados (tarea_id, empleado_id)
    select v_tarea_id, empleado_id::uuid
    from jsonb_array_elements_text(coalesce(v_item -> 'empleado_ids', '[]'::jsonb)) as empleados(empleado_id)
    on conflict (tarea_id, empleado_id) do nothing;

    v_guardadas := v_guardadas + 1;
  end loop;

  update public.proyectos
  set fecha_inicio = (
        select min(nullif(item ->> 'fecha_inicio', '')::date)
        from jsonb_array_elements(p_plan) as plan_items(item)
      ),
      fecha_fin_estimada = (
        select max(nullif(item ->> 'fecha_limite', '')::date)
        from jsonb_array_elements(p_plan) as plan_items(item)
      )
  where id = p_proyecto_id;

  return v_guardadas;
end;
$$;

revoke all on function public.guardar_planificacion_tareas(uuid, jsonb) from public;
grant execute on function public.guardar_planificacion_tareas(uuid, jsonb) to authenticated;

comment on function public.guardar_planificacion_tareas(uuid, jsonb) is
  'Guarda de forma atómica fechas, horas y empleados del cronograma de una obra.';
