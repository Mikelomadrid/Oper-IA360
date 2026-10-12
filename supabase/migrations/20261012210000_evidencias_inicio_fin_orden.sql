-- Evidencias fotográficas obligatorias al iniciar/reanudar y finalizar trabajo.

create table if not exists public.ordenes_trabajo_evidencias (
  id uuid primary key default gen_random_uuid(),
  orden_trabajo_id uuid not null references public.ordenes_trabajo_diarias(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  tarea_id uuid not null references public.tareas(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  fichaje_id uuid references public.control_horario(id) on delete set null,
  momento text not null,
  archivo_path text not null,
  created_at timestamptz not null default now(),
  constraint ordenes_trabajo_evidencias_momento_check
    check (momento in ('inicio', 'finalizacion')),
  constraint ordenes_trabajo_evidencias_path_check
    check (length(trim(archivo_path)) > 0)
);

create index if not exists ordenes_trabajo_evidencias_orden_idx
  on public.ordenes_trabajo_evidencias (orden_trabajo_id, momento, created_at);
create index if not exists ordenes_trabajo_evidencias_tarea_idx
  on public.ordenes_trabajo_evidencias (tarea_id, created_at);

alter table public.ordenes_trabajo_evidencias enable row level security;

drop policy if exists ordenes_trabajo_evidencias_lectura on public.ordenes_trabajo_evidencias;
create policy ordenes_trabajo_evidencias_lectura
on public.ordenes_trabajo_evidencias for select to authenticated
using (
  exists (
    select 1
    from public.empleados e
    where e.auth_user_id = auth.uid()
      and (e.id = empleado_id or e.rol::text in ('admin', 'encargado'))
  )
);

revoke insert, update, delete on public.ordenes_trabajo_evidencias from authenticated;
grant select on public.ordenes_trabajo_evidencias to authenticated, service_role;

-- El encargado coloca una orden como siguiente trabajo, pero no la inicia.
-- El inicio real corresponde al técnico y exige la evidencia fotográfica.
create or replace function public.preparar_orden_trabajo(
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

  update public.ordenes_trabajo_diarias
  set estado = 'pendiente_continuar', updated_at = now()
  where empleado_id = p_empleado_id
    and estado = 'activa'
    and tarea_id <> p_tarea_id;

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
        estado = case when iniciada_at is null then 'asignada' else 'pendiente_continuar' end,
        horas_previstas = coalesce(p_horas_previstas, horas_previstas),
        notas_encargado = coalesce(nullif(trim(p_notas), ''), notas_encargado),
        asignada_por = v_actor_id,
        asignada_at = now(),
        cerrada_at = null,
        updated_at = now()
    where id = v_resultado.id
    returning * into v_resultado;
  end if;

  return v_resultado;
end;
$$;

create or replace function public.iniciar_orden_trabajo_con_evidencias(
  p_orden_id uuid,
  p_archivos text[]
)
returns public.ordenes_trabajo_diarias
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_orden public.ordenes_trabajo_diarias%rowtype;
  v_fichaje_id uuid;
  v_archivo text;
begin
  if coalesce(cardinality(p_archivos), 0) = 0 then
    raise exception 'Debes adjuntar al menos una foto del estado inicial.';
  end if;

  select id into v_actor_id
  from public.empleados
  where auth_user_id = auth.uid()
  limit 1;

  select * into v_orden
  from public.ordenes_trabajo_diarias
  where id = p_orden_id
  for update;

  if v_orden.id is null then
    raise exception 'No se encontró la orden de trabajo.';
  end if;
  if v_actor_id is null or v_actor_id <> v_orden.empleado_id then
    raise exception 'Solo el técnico asignado puede iniciar esta orden.';
  end if;
  if v_orden.estado not in ('asignada', 'pendiente_continuar') then
    raise exception 'La orden no está disponible para iniciar o continuar.';
  end if;

  select id into v_fichaje_id
  from public.control_horario
  where empleado_id = v_actor_id
    and proyecto_id = v_orden.proyecto_id
    and hora_salida is null
  order by hora_entrada desc
  limit 1;

  if v_fichaje_id is null then
    raise exception 'Debes estar fichado en esta obra para iniciar la tarea.';
  end if;

  update public.ordenes_trabajo_diarias
  set estado = 'pendiente_continuar', updated_at = now()
  where empleado_id = v_actor_id
    and id <> v_orden.id
    and estado = 'activa';

  foreach v_archivo in array p_archivos loop
    if nullif(trim(v_archivo), '') is not null then
      insert into public.ordenes_trabajo_evidencias (
        orden_trabajo_id, proyecto_id, tarea_id, empleado_id,
        fichaje_id, momento, archivo_path
      ) values (
        v_orden.id, v_orden.proyecto_id, v_orden.tarea_id, v_actor_id,
        v_fichaje_id, 'inicio', trim(v_archivo)
      );
    end if;
  end loop;

  update public.ordenes_trabajo_diarias
  set estado = 'activa',
      fichaje_id = v_fichaje_id,
      iniciada_at = coalesce(iniciada_at, now()),
      cerrada_at = null,
      updated_at = now()
  where id = v_orden.id
  returning * into v_orden;

  perform public.registrar_accion_tarea(
    v_orden.tarea_id, 'iniciar', v_actor_id, null, null, null
  );

  return v_orden;
end;
$$;

-- Inicio o reanudación sin fotografía. La evidencia se exige al fichar salida.
create or replace function public.iniciar_orden_trabajo(
  p_orden_id uuid
)
returns public.ordenes_trabajo_diarias
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_orden public.ordenes_trabajo_diarias%rowtype;
  v_fichaje_id uuid;
begin
  select id into v_actor_id
  from public.empleados
  where auth_user_id = auth.uid()
  limit 1;

  select * into v_orden
  from public.ordenes_trabajo_diarias
  where id = p_orden_id
  for update;

  if v_orden.id is null then
    raise exception 'No se encontró la orden de trabajo.';
  end if;
  if v_actor_id is null or v_actor_id <> v_orden.empleado_id then
    raise exception 'Solo el técnico asignado puede iniciar esta orden.';
  end if;
  if v_orden.estado not in ('asignada', 'pendiente_continuar') then
    raise exception 'La orden no está disponible para iniciar o continuar.';
  end if;

  select id into v_fichaje_id
  from public.control_horario
  where empleado_id = v_actor_id
    and proyecto_id = v_orden.proyecto_id
    and hora_salida is null
  order by hora_entrada desc
  limit 1;

  if v_fichaje_id is null then
    raise exception 'Debes estar fichado en esta obra para iniciar la tarea.';
  end if;

  update public.ordenes_trabajo_diarias
  set estado = 'pendiente_continuar', updated_at = now()
  where empleado_id = v_actor_id
    and id <> v_orden.id
    and estado = 'activa';

  update public.ordenes_trabajo_diarias
  set estado = 'activa',
      fichaje_id = v_fichaje_id,
      iniciada_at = coalesce(iniciada_at, now()),
      cerrada_at = null,
      updated_at = now()
  where id = v_orden.id
  returning * into v_orden;

  perform public.registrar_accion_tarea(
    v_orden.tarea_id, 'iniciar', v_actor_id, null, null, null
  );

  return v_orden;
end;
$$;

create or replace function public.cerrar_orden_trabajo_con_evidencias(
  p_orden_id uuid,
  p_resultado text,
  p_notas text default null,
  p_archivos text[] default array[]::text[]
)
returns public.ordenes_trabajo_diarias
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_rol text;
  v_orden public.ordenes_trabajo_diarias%rowtype;
  v_resultado public.ordenes_trabajo_diarias%rowtype;
  v_archivo text;
begin
  select id, rol::text into v_actor_id, v_actor_rol
  from public.empleados
  where auth_user_id = auth.uid()
  limit 1;

  select * into v_orden
  from public.ordenes_trabajo_diarias
  where id = p_orden_id;

  if v_orden.id is null then
    raise exception 'No se encontró la orden de trabajo.';
  end if;
  if v_actor_id <> v_orden.empleado_id and v_actor_rol not in ('admin', 'encargado') then
    raise exception 'No puedes cerrar la orden de otro empleado.';
  end if;
  if coalesce(cardinality(p_archivos), 0) = 0 then
    raise exception 'Debes adjuntar al menos una foto del estado en que queda el trabajo.';
  end if;

  foreach v_archivo in array p_archivos loop
    if nullif(trim(v_archivo), '') is not null then
      insert into public.ordenes_trabajo_evidencias (
        orden_trabajo_id, proyecto_id, tarea_id, empleado_id,
        fichaje_id, momento, archivo_path
      ) values (
        v_orden.id, v_orden.proyecto_id, v_orden.tarea_id, v_orden.empleado_id,
        v_orden.fichaje_id, 'finalizacion', trim(v_archivo)
      );
    end if;
  end loop;

  select * into v_resultado
  from public.cerrar_orden_trabajo(p_orden_id, p_resultado, p_notas);

  return v_resultado;
end;
$$;

revoke all on function public.iniciar_orden_trabajo_con_evidencias(uuid, text[]) from public;
revoke all on function public.iniciar_orden_trabajo(uuid) from public;
revoke all on function public.cerrar_orden_trabajo_con_evidencias(uuid, text, text, text[]) from public;
revoke all on function public.preparar_orden_trabajo(uuid, uuid, uuid, numeric, text) from public;
grant execute on function public.iniciar_orden_trabajo_con_evidencias(uuid, text[]) to authenticated, service_role;
grant execute on function public.iniciar_orden_trabajo(uuid) to authenticated, service_role;
grant execute on function public.cerrar_orden_trabajo_con_evidencias(uuid, text, text, text[]) to authenticated, service_role;
grant execute on function public.preparar_orden_trabajo(uuid, uuid, uuid, numeric, text) to authenticated, service_role;

comment on table public.ordenes_trabajo_evidencias is
  'Fotos del estado inicial y final aportadas por el técnico en cada intervención.';
