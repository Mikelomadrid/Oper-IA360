-- Un fichaje de obra solo puede estar abierto mientras el técnico tiene una tarea activa.
-- Si no hay trabajo preparado, se registra una solicitud para el encargado sin iniciar
-- horas ni costes. Las entradas a nave/taller mantienen su flujo independiente.

create table if not exists public.solicitudes_asignacion_trabajo (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  estado text not null default 'pendiente',
  solicitada_at timestamptz not null default now(),
  resuelta_at timestamptz,
  constraint solicitudes_asignacion_trabajo_estado_check
    check (estado in ('pendiente', 'asignada', 'resuelta', 'cancelada'))
);

create unique index if not exists solicitudes_asignacion_trabajo_pendiente_idx
  on public.solicitudes_asignacion_trabajo (empleado_id, proyecto_id)
  where estado = 'pendiente';

alter table public.solicitudes_asignacion_trabajo enable row level security;

drop policy if exists solicitudes_asignacion_trabajo_lectura on public.solicitudes_asignacion_trabajo;
create policy solicitudes_asignacion_trabajo_lectura
on public.solicitudes_asignacion_trabajo for select to authenticated
using (
  exists (
    select 1
    from public.empleados e
    where e.auth_user_id = auth.uid()
      and (e.id = empleado_id or e.rol::text in ('admin', 'encargado'))
  )
);

revoke insert, update, delete on public.solicitudes_asignacion_trabajo from authenticated;
grant select on public.solicitudes_asignacion_trabajo to authenticated, service_role;

-- Permite al encargado preparar una tarea aunque el técnico aún no haya fichado.
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
    set fichaje_id = coalesce(v_fichaje_id, fichaje_id),
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

  update public.solicitudes_asignacion_trabajo
  set estado = 'asignada', resuelta_at = now()
  where empleado_id = p_empleado_id
    and proyecto_id = p_proyecto_id
    and estado = 'pendiente';

  return v_resultado;
end;
$$;

revoke all on function public.encolar_orden_trabajo(uuid, uuid, uuid, numeric, text) from public;
grant execute on function public.encolar_orden_trabajo(uuid, uuid, uuid, numeric, text) to authenticated, service_role;

create or replace function public.asegurar_tarea_activa_fichaje()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empleado_id uuid;
  v_fichaje_id uuid;
  v_proyecto_id uuid;
  v_orden public.ordenes_trabajo_diarias%rowtype;
  v_titulo text;
  v_salida text;
begin
  select e.id into v_empleado_id
  from public.empleados e
  where e.auth_user_id = auth.uid()
  limit 1;

  select ch.id, ch.proyecto_id into v_fichaje_id, v_proyecto_id
  from public.control_horario ch
  where ch.empleado_id = v_empleado_id
    and ch.hora_salida is null
  order by ch.hora_entrada desc
  limit 1;

  if v_fichaje_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SIN_FICHAJE');
  end if;
  if v_proyecto_id is null then
    return jsonb_build_object('ok', true, 'codigo', 'DESTINO_INTERNO');
  end if;

  perform public.sincronizar_ordenes_planificadas_fichaje();

  select * into v_orden
  from public.ordenes_trabajo_diarias otd
  where otd.empleado_id = v_empleado_id
    and otd.proyecto_id = v_proyecto_id
    and otd.estado = 'activa'
  order by otd.iniciada_at desc nulls last, otd.orden, otd.asignada_at
  limit 1;

  if v_orden.id is null then
    select * into v_orden
    from public.ordenes_trabajo_diarias otd
    where otd.empleado_id = v_empleado_id
      and otd.proyecto_id = v_proyecto_id
      and otd.estado in ('pendiente_continuar', 'asignada')
    order by case when otd.estado = 'pendiente_continuar' then 0 else 1 end,
             otd.orden, otd.asignada_at
    limit 1;

    if v_orden.id is not null then
      perform public.iniciar_orden_trabajo(v_orden.id);
    end if;
  end if;

  if v_orden.id is not null then
    select t.titulo into v_titulo from public.tareas t where t.id = v_orden.tarea_id;
    update public.solicitudes_asignacion_trabajo
    set estado = 'resuelta', resuelta_at = now()
    where empleado_id = v_empleado_id
      and proyecto_id = v_proyecto_id
      and estado in ('pendiente', 'asignada');
    return jsonb_build_object(
      'ok', true,
      'codigo', case when v_orden.estado = 'activa' then 'ACTIVA' else 'INICIADA' end,
      'orden_id', v_orden.id,
      'tarea_titulo', v_titulo
    );
  end if;

  insert into public.solicitudes_asignacion_trabajo (empleado_id, proyecto_id, estado, solicitada_at)
  values (v_empleado_id, v_proyecto_id, 'pendiente', now())
  on conflict (empleado_id, proyecto_id) where estado = 'pendiente'
  do update set solicitada_at = excluded.solicitada_at;

  v_salida := public.fichar_salida(
    p_latitud := null::numeric,
    p_longitud := null::numeric,
    p_custom_time := null::text
  );

  return jsonb_build_object(
    'ok', false,
    'codigo', 'ESPERANDO_ASIGNACION',
    'mensaje', 'No tienes una tarea asignada. No se ha iniciado el cómputo de horas; el encargado debe preparar tu siguiente trabajo.',
    'salida', v_salida
  );
end;
$$;

revoke all on function public.asegurar_tarea_activa_fichaje() from public;
grant execute on function public.asegurar_tarea_activa_fichaje() to authenticated, service_role;

create or replace function public.fichar_entrada_obra_con_tarea(
  p_proyecto_id uuid,
  p_latitud numeric default null,
  p_longitud numeric default null,
  p_custom_time text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empleado_id uuid;
  v_tiene_trabajo boolean := false;
  v_resultado_fichaje text;
  v_resultado_tarea jsonb;
begin
  select e.id into v_empleado_id
  from public.empleados e
  where e.auth_user_id = auth.uid()
  limit 1;

  if v_empleado_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SIN_EMPLEADO', 'mensaje', 'No se encontró el perfil del empleado.');
  end if;
  if not exists (select 1 from public.proyectos p where p.id = p_proyecto_id) then
    return jsonb_build_object('ok', false, 'codigo', 'OBRA_INVALIDA', 'mensaje', 'La obra seleccionada no existe.');
  end if;

  select exists (
    select 1
    from public.ordenes_trabajo_diarias otd
    where otd.empleado_id = v_empleado_id
      and otd.proyecto_id = p_proyecto_id
      and otd.estado in ('asignada', 'activa', 'pendiente_continuar')
  ) or exists (
    select 1
    from public.tareas t
    where t.proyecto_id = p_proyecto_id
      and t.estado not in ('pendiente_revision', 'completada', 'completada_validada', 'cancelada')
      and (
        t.empleado_asignado_id = v_empleado_id
        or exists (
          select 1 from public.tarea_empleados te
          where te.tarea_id = t.id and te.empleado_id = v_empleado_id
        )
      )
      and not exists (
        select 1 from public.ordenes_trabajo_diarias anterior
        where anterior.tarea_id = t.id
          and anterior.empleado_id = v_empleado_id
          and anterior.estado <> 'cancelada'
      )
  ) into v_tiene_trabajo;

  if not v_tiene_trabajo then
    insert into public.solicitudes_asignacion_trabajo (empleado_id, proyecto_id, estado, solicitada_at)
    values (v_empleado_id, p_proyecto_id, 'pendiente', now())
    on conflict (empleado_id, proyecto_id) where estado = 'pendiente'
    do update set solicitada_at = excluded.solicitada_at;

    return jsonb_build_object(
      'ok', false,
      'codigo', 'SIN_TAREA',
      'mensaje', 'No tienes una tarea asignada. El encargado ha recibido la solicitud; vuelve a pulsar Entrar cuando te confirme el trabajo.'
    );
  end if;

  v_resultado_fichaje := public.fichar_entrada(
    p_latitud := p_latitud,
    p_longitud := p_longitud,
    p_proyecto_id := p_proyecto_id,
    p_centro_coste_interno_id := null::uuid,
    p_tipo := 'entrada_obra',
    p_custom_time := p_custom_time
  );

  if v_resultado_fichaje like 'ERROR:%' then
    return jsonb_build_object('ok', false, 'codigo', 'ERROR_FICHAJE', 'mensaje', replace(v_resultado_fichaje, 'ERROR: ', ''));
  end if;

  v_resultado_tarea := public.asegurar_tarea_activa_fichaje();
  return v_resultado_tarea || jsonb_build_object('fichaje', v_resultado_fichaje);
end;
$$;

revoke all on function public.fichar_entrada_obra_con_tarea(uuid, numeric, numeric, text) from public;
grant execute on function public.fichar_entrada_obra_con_tarea(uuid, numeric, numeric, text) to authenticated, service_role;

comment on function public.fichar_entrada_obra_con_tarea(uuid, numeric, numeric, text) is
  'Inicia un fichaje de obra únicamente si existe trabajo asignado y abre automáticamente la tarea prioritaria.';
