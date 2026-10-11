-- Separa la aceptación comercial de la planificación operativa.
-- La obra nace pendiente con una fecha de comienzo, mientras que las tareas
-- se crean en orden de ejecución pero sin fechas hasta que el encargado
-- define equipo y horas.

alter table public.proyectos
  add column if not exists estado_planificacion text not null default 'sin_planificar',
  add column if not exists planificacion_confirmada_at timestamptz,
  add column if not exists planificacion_confirmada_por uuid references auth.users(id) on delete set null;

alter table public.proyectos drop constraint if exists proyectos_estado_planificacion_check;
alter table public.proyectos add constraint proyectos_estado_planificacion_check
  check (estado_planificacion in ('sin_planificar', 'borrador', 'confirmado'));

-- Los cronogramas que ya tenían franjas guardadas antes de esta migración son
-- borradores existentes, no obras sin planificar.
update public.proyectos p
set estado_planificacion = 'borrador'
where p.estado_planificacion = 'sin_planificar'
  and exists (
    select 1
    from public.tareas t
    where t.proyecto_id = p.id
      and t.inicio_planificado_at is not null
      and t.fin_planificado_at is not null
  );

create or replace function public.generar_plan_obra_desde_partidas(
  p_proyecto_id uuid,
  p_fecha_inicio date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partida public.obras_partidas%rowtype;
  v_tarea_id uuid;
  v_fases integer;
  v_creadas integer := 0;
  v_omitidas integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para preparar las partidas de la obra.';
  end if;
  if not public.app_is_admin_or_encargado() then
    raise exception 'No tienes permiso para preparar las partidas de la obra.';
  end if;
  if not exists (select 1 from public.proyectos where id = p_proyecto_id) then
    raise exception 'No se encontró la obra.';
  end if;

  for v_partida in
    select * from public.obras_partidas
    where obra_id = p_proyecto_id and activa is true
    order by orden, creado_at, id
  loop
    if exists (select 1 from public.tareas where obra_partida_id = v_partida.id) then
      v_omitidas := v_omitidas + 1;
      continue;
    end if;

    insert into public.tareas (
      proyecto_id, empleado_asignado_id, titulo, descripcion, estado,
      fecha_inicio, fecha_limite, orden, cantidad_medible, unidad_medible,
      obra_partida_id, origen_generacion, duracion_planificada_horas,
      inicio_planificado_at, fin_planificado_at
    ) values (
      p_proyecto_id, null,
      left(concat_ws(' · ', nullif(v_partida.codigo, ''), v_partida.descripcion), 255),
      concat_ws(E'\n',
        v_partida.descripcion,
        case when v_partida.capitulo is not null then 'Capítulo: ' || v_partida.capitulo end,
        case when v_partida.zona is not null then 'Zona: ' || v_partida.zona end,
        'Generada desde el presupuesto aceptado. Pendiente de asignar equipo y horas.'
      ),
      'pendiente', null, null, coalesce(v_partida.orden, 0),
      v_partida.cantidad_total, v_partida.unidad, v_partida.id,
      'presupuesto_aceptado', null, null, null
    ) returning id into v_tarea_id;

    insert into public.subtareas (
      tarea_id, descripcion_subtarea, orden, duracion_horas, origen, notas
    )
    select v_tarea_id, left(f.nombre, 255), f.orden, null, 'ia',
      concat_ws(E'\n', f.descripcion, f.control_calidad)
    from public.sistema_rendimiento_fases f
    where f.sistema_id = v_partida.sistema_id and f.obligatoria is true
    order by f.orden;

    get diagnostics v_fases = row_count;
    if v_fases = 0 then
      insert into public.subtareas (
        tarea_id, descripcion_subtarea, orden, origen, notas
      ) values (
        v_tarea_id, 'Ejecutar la partida según el alcance aprobado', 1, 'ia',
        'Fases técnicas pendientes de completar en la biblioteca de rendimientos.'
      );
    end if;
    v_creadas := v_creadas + 1;
  end loop;

  update public.proyectos
  set estado_planificacion = 'sin_planificar',
      planificacion_confirmada_at = null,
      planificacion_confirmada_por = null
  where id = p_proyecto_id;

  return jsonb_build_object(
    'success', true, 'proyecto_id', p_proyecto_id,
    'tareas_creadas', v_creadas, 'tareas_omitidas', v_omitidas,
    'fecha_inicio', null, 'fecha_fin', null
  );
end;
$$;

comment on function public.generar_plan_obra_desde_partidas(uuid, date) is
  'Crea tareas y subtareas en orden de ejecución, sin generar cronograma hasta asignar equipo y horas.';

create or replace function public.convertir_presupuesto_aceptado_a_obra(
  p_emision_id uuid,
  p_descripcion text,
  p_fecha_inicio date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resultado jsonb;
  v_proyecto_id uuid;
begin
  if p_fecha_inicio is null then
    raise exception 'Indica la fecha prevista de comienzo de la obra.';
  end if;

  select public.convertir_presupuesto_aceptado_a_obra(p_emision_id, p_descripcion)::jsonb
  into v_resultado;
  v_proyecto_id := nullif(v_resultado ->> 'proyecto_id', '')::uuid;
  if v_proyecto_id is null then
    raise exception 'La conversión no devolvió el identificador de la obra.';
  end if;

  update public.proyectos
  set fecha_inicio = p_fecha_inicio::timestamp,
      estado = 'en_espera'::public.project_status,
      estado_planificacion = 'sin_planificar',
      planificacion_confirmada_at = null,
      planificacion_confirmada_por = null
  where id = v_proyecto_id;

  return v_resultado || jsonb_build_object(
    'fecha_inicio', p_fecha_inicio, 'estado', 'en_espera',
    'estado_planificacion', 'sin_planificar'
  );
end;
$$;

revoke all on function public.convertir_presupuesto_aceptado_a_obra(uuid, text) from authenticated;
revoke all on function public.convertir_presupuesto_aceptado_a_obra(uuid, text, date) from public;
grant execute on function public.convertir_presupuesto_aceptado_a_obra(uuid, text, date) to authenticated, service_role;

create or replace function public.convertir_lead_a_obra_pendiente(
  p_lead_id uuid,
  p_proyecto_descripcion text,
  p_cliente_id uuid,
  p_fecha_inicio date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resultado jsonb;
  v_proyecto_id uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión para crear la obra.'; end if;
  if not public.app_is_admin_or_encargado() then raise exception 'No tienes permiso para crear la obra.'; end if;
  if p_fecha_inicio is null then raise exception 'Indica la fecha prevista de comienzo de la obra.'; end if;

  select public.approve_lead_to_proyecto_v2(
    p_lead_id, p_proyecto_descripcion, p_cliente_id
  )::jsonb into v_resultado;
  if coalesce((v_resultado ->> 'success')::boolean, false) is not true then
    raise exception '%', coalesce(v_resultado ->> 'error', 'No se pudo crear la obra.');
  end if;

  v_proyecto_id := nullif(v_resultado ->> 'proyecto_id', '')::uuid;
  update public.proyectos
  set fecha_inicio = p_fecha_inicio::timestamp,
      estado = 'en_espera'::public.project_status,
      estado_planificacion = 'sin_planificar',
      planificacion_confirmada_at = null,
      planificacion_confirmada_por = null
  where id = v_proyecto_id;

  return v_resultado || jsonb_build_object(
    'fecha_inicio', p_fecha_inicio, 'estado', 'en_espera',
    'estado_planificacion', 'sin_planificar'
  );
end;
$$;

revoke all on function public.convertir_lead_a_obra_pendiente(uuid, text, uuid, date) from public;
grant execute on function public.convertir_lead_a_obra_pendiente(uuid, text, uuid, date) to authenticated, service_role;

create or replace function public.activar_obras_por_fecha_inicio()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_actualizadas integer;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión para actualizar el tablero.'; end if;
  update public.proyectos
  set estado = 'activo'::public.project_status
  where estado = 'en_espera'::public.project_status
    and fecha_inicio is not null
    and fecha_inicio::date <= current_date;
  get diagnostics v_actualizadas = row_count;
  return v_actualizadas;
end;
$$;

revoke all on function public.activar_obras_por_fecha_inicio() from public;
grant execute on function public.activar_obras_por_fecha_inicio() to authenticated, service_role;

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
    raise exception 'Solo administración o el encargado pueden guardar la planificación' using errcode = '42501';
  end if;
  if p_proyecto_id is null or jsonb_typeof(p_plan) <> 'array' then
    raise exception 'La planificación recibida no es válida' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_plan)
  loop
    v_tarea_id := nullif(v_item ->> 'tarea_id', '')::uuid;
    if v_tarea_id is null or not exists (
      select 1 from public.tareas where id = v_tarea_id and proyecto_id = p_proyecto_id
    ) then
      raise exception 'La tarea % no pertenece a esta obra', coalesce(v_item ->> 'tarea_id', 'sin identificar') using errcode = '22023';
    end if;

    update public.tareas
    set empleado_asignado_id = nullif(v_item ->> 'empleado_principal_id', '')::uuid,
        fecha_inicio = nullif(v_item ->> 'fecha_inicio', '')::date,
        fecha_limite = nullif(v_item ->> 'fecha_limite', '')::date,
        duracion_planificada_horas = nullif(v_item ->> 'duracion_planificada_horas', '')::numeric,
        inicio_planificado_at = nullif(v_item ->> 'inicio_planificado_at', '')::timestamptz,
        fin_planificado_at = nullif(v_item ->> 'fin_planificado_at', '')::timestamptz
    where id = v_tarea_id;

    delete from public.tarea_empleados where tarea_id = v_tarea_id;
    insert into public.tarea_empleados (tarea_id, empleado_id)
    select v_tarea_id, empleado_id::uuid
    from jsonb_array_elements_text(coalesce(v_item -> 'empleado_ids', '[]'::jsonb)) as empleados(empleado_id)
    on conflict (tarea_id, empleado_id) do nothing;
    v_guardadas := v_guardadas + 1;
  end loop;

  update public.proyectos
  set fecha_fin_estimada = (
        select max(nullif(item ->> 'fecha_limite', '')::date)
        from jsonb_array_elements(p_plan) as plan_items(item)
      ),
      estado_planificacion = 'borrador',
      planificacion_confirmada_at = null,
      planificacion_confirmada_por = null
  where id = p_proyecto_id;
  return v_guardadas;
end;
$$;

create or replace function public.confirmar_planificacion_obra(p_proyecto_id uuid)
returns public.proyectos
language plpgsql
security definer
set search_path = public
as $$
declare v_resultado public.proyectos%rowtype;
begin
  if not public.app_is_admin_or_encargado() then
    raise exception 'Solo administración o el encargado pueden confirmar la planificación.';
  end if;
  if not exists (select 1 from public.tareas where proyecto_id = p_proyecto_id) then
    raise exception 'La obra todavía no tiene partidas operativas.';
  end if;
  if exists (
    select 1 from public.tareas t
    where t.proyecto_id = p_proyecto_id
      and (t.inicio_planificado_at is null or t.fin_planificado_at is null
        or not exists (select 1 from public.tarea_empleados te where te.tarea_id = t.id))
  ) then
    raise exception 'Asigna equipo y horas a todas las tareas antes de confirmar el cronograma.';
  end if;

  update public.proyectos
  set estado_planificacion = 'confirmado',
      planificacion_confirmada_at = now(),
      planificacion_confirmada_por = auth.uid()
  where id = p_proyecto_id returning * into v_resultado;
  if not found then raise exception 'No se encontró la obra.'; end if;
  return v_resultado;
end;
$$;

revoke all on function public.confirmar_planificacion_obra(uuid) from public;
grant execute on function public.confirmar_planificacion_obra(uuid) to authenticated, service_role;

comment on column public.proyectos.estado_planificacion is
  'Estado operativo del cronograma: sin_planificar, borrador o confirmado.';
