-- Operativa diaria de obra dirigida por el encargado.
-- El técnico ficha presencia, pero no escoge tareas ni manipula cronómetros.

create table if not exists public.ordenes_trabajo_diarias (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  tarea_id uuid not null references public.tareas(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  fichaje_id uuid references public.control_horario(id) on delete set null,
  fecha_asignacion date not null default ((timezone('Europe/Madrid', now()))::date),
  orden integer not null default 0,
  estado text not null default 'asignada',
  horas_previstas numeric(8,2),
  notas_encargado text,
  resultado_notas text,
  asignada_por uuid references public.empleados(id) on delete set null,
  asignada_at timestamptz not null default now(),
  iniciada_at timestamptz,
  cerrada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ordenes_trabajo_diarias_estado_check check (
    estado in ('asignada', 'activa', 'pendiente_continuar', 'completada', 'no_realizada', 'cancelada')
  ),
  constraint ordenes_trabajo_diarias_horas_check check (
    horas_previstas is null or horas_previstas >= 0
  )
);

create index if not exists ordenes_trabajo_diarias_obra_fecha_idx
  on public.ordenes_trabajo_diarias (proyecto_id, fecha_asignacion, orden, asignada_at);
create index if not exists ordenes_trabajo_diarias_empleado_estado_idx
  on public.ordenes_trabajo_diarias (empleado_id, estado, fecha_asignacion desc);
create unique index if not exists ordenes_trabajo_diarias_abierta_unica_idx
  on public.ordenes_trabajo_diarias (tarea_id, empleado_id)
  where estado in ('asignada', 'activa', 'pendiente_continuar');

create table if not exists public.traslados_personal (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  fichaje_origen_id uuid references public.control_horario(id) on delete set null,
  proyecto_origen_id uuid references public.proyectos(id) on delete set null,
  proyecto_destino_id uuid references public.proyectos(id) on delete set null,
  centro_destino_id uuid references public.centros_coste_internos(id) on delete set null,
  fichaje_destino_id uuid references public.control_horario(id) on delete set null,
  motivo text not null,
  imputacion_tipo text not null,
  notas text,
  estado text not null default 'pendiente_salida',
  ordenado_por uuid references public.empleados(id) on delete set null,
  ordenado_at timestamptz not null default now(),
  salida_at timestamptz,
  llegada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint traslados_personal_estado_check check (
    estado in ('pendiente_salida', 'en_desplazamiento', 'finalizado', 'cancelado')
  ),
  constraint traslados_personal_imputacion_check check (
    imputacion_tipo in ('obra_origen', 'obra_destino', 'logistica_interna', 'gastos_generales')
  ),
  constraint traslados_personal_destino_check check (
    proyecto_destino_id is not null or centro_destino_id is not null
  )
);

create index if not exists traslados_personal_empleado_estado_idx
  on public.traslados_personal (empleado_id, estado, ordenado_at desc);

alter table public.ordenes_trabajo_diarias enable row level security;
alter table public.traslados_personal enable row level security;

drop policy if exists ordenes_trabajo_diarias_lectura on public.ordenes_trabajo_diarias;
create policy ordenes_trabajo_diarias_lectura
on public.ordenes_trabajo_diarias for select to authenticated
using (
  exists (
    select 1 from public.empleados e
    where e.auth_user_id = auth.uid()
      and (e.id = empleado_id or e.rol::text in ('admin', 'encargado'))
  )
);

drop policy if exists traslados_personal_lectura on public.traslados_personal;
create policy traslados_personal_lectura
on public.traslados_personal for select to authenticated
using (
  exists (
    select 1 from public.empleados e
    where e.auth_user_id = auth.uid()
      and (e.id = empleado_id or e.rol::text in ('admin', 'encargado'))
  )
);

revoke insert, update, delete on public.ordenes_trabajo_diarias from authenticated;
revoke insert, update, delete on public.traslados_personal from authenticated;
grant select on public.ordenes_trabajo_diarias to authenticated, service_role;
grant select on public.traslados_personal to authenticated, service_role;

create or replace function public.listar_personal_presente_obra(p_proyecto_id uuid)
returns table (
  fichaje_id uuid,
  empleado_id uuid,
  proyecto_id uuid,
  hora_entrada timestamp without time zone
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin_or_encargado() then
    raise exception 'Solo administración o el encargado pueden consultar el personal presente.';
  end if;
  return query
  select ch.id, ch.empleado_id, ch.proyecto_id, ch.hora_entrada
  from public.control_horario ch
  where ch.proyecto_id = p_proyecto_id and ch.hora_salida is null
  order by ch.hora_entrada;
end;
$$;

create or replace function public.obtener_contexto_fichaje_actual()
returns table (
  fichaje_id uuid,
  proyecto_id uuid,
  centro_coste_interno_id uuid,
  hora_entrada timestamp without time zone
)
language sql
security definer
set search_path = public
as $$
  select ch.id, ch.proyecto_id, ch.centro_coste_interno_id, ch.hora_entrada
  from public.control_horario ch
  join public.empleados e on e.id = ch.empleado_id
  where e.auth_user_id = auth.uid() and ch.hora_salida is null
  order by ch.hora_entrada desc
  limit 1
$$;

create or replace function public.asignar_orden_trabajo(
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

  select id into v_actor_id from public.empleados where auth_user_id = auth.uid() limit 1;
  select orden into v_orden from public.tareas
   where id = p_tarea_id and proyecto_id = p_proyecto_id;
  if not found then raise exception 'La tarea no pertenece a esta obra.'; end if;

  select id into v_fichaje_id
  from public.control_horario
  where empleado_id = p_empleado_id
    and proyecto_id = p_proyecto_id
    and hora_salida is null
  order by hora_entrada desc limit 1;
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
  where tarea_id = p_tarea_id and empleado_id = p_empleado_id
    and estado in ('asignada', 'activa', 'pendiente_continuar')
  order by asignada_at desc limit 1 for update;

  if v_resultado.id is null then
    insert into public.ordenes_trabajo_diarias (
      proyecto_id, tarea_id, empleado_id, fichaje_id, fecha_asignacion,
      orden, estado, horas_previstas, notas_encargado, asignada_por,
      iniciada_at
    ) values (
      p_proyecto_id, p_tarea_id, p_empleado_id, v_fichaje_id,
      (timezone('Europe/Madrid', now()))::date, coalesce(v_orden, 0),
      'activa', p_horas_previstas, nullif(trim(p_notas), ''), v_actor_id, now()
    ) returning * into v_resultado;
  else
    update public.ordenes_trabajo_diarias
    set fichaje_id = v_fichaje_id,
        fecha_asignacion = (timezone('Europe/Madrid', now()))::date,
        orden = coalesce(v_orden, orden),
        estado = 'activa',
        horas_previstas = coalesce(p_horas_previstas, horas_previstas),
        notas_encargado = coalesce(nullif(trim(p_notas), ''), notas_encargado),
        asignada_por = v_actor_id,
        asignada_at = now(),
        iniciada_at = coalesce(iniciada_at, now()),
        cerrada_at = null,
        updated_at = now()
    where id = v_resultado.id returning * into v_resultado;
  end if;

  perform public.registrar_accion_tarea(p_tarea_id, 'iniciar', p_empleado_id, null, null, null);
  return v_resultado;
end;
$$;

create or replace function public.cerrar_orden_trabajo(
  p_orden_id uuid,
  p_resultado text,
  p_notas text default null
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
  v_ahora timestamptz := now();
begin
  if p_resultado not in ('completada', 'pendiente_continuar', 'no_realizada') then
    raise exception 'Resultado de jornada no válido.';
  end if;
  select id, rol::text into v_actor_id, v_actor_rol
  from public.empleados where auth_user_id = auth.uid() limit 1;
  select * into v_orden from public.ordenes_trabajo_diarias
  where id = p_orden_id for update;
  if v_orden.id is null then raise exception 'No se encontró la orden de trabajo.'; end if;
  if v_actor_id <> v_orden.empleado_id and v_actor_rol not in ('admin', 'encargado') then
    raise exception 'No puedes cerrar la orden de otro empleado.';
  end if;

  update public.tarea_sesiones_trabajo
  set minutos_acumulados = minutos_acumulados + case
        when estado = 'en_curso' and ultimo_inicio_at is not null
        then greatest(floor(extract(epoch from (v_ahora - ultimo_inicio_at)) / 60)::integer, 0)
        else 0 end,
      estado = case when p_resultado = 'pendiente_continuar' then 'pausada' else 'finalizada' end,
      ultimo_inicio_at = null,
      fin_at = case when p_resultado = 'pendiente_continuar' then fin_at else v_ahora end,
      motivo_pausa = case when p_resultado = 'pendiente_continuar' then 'Fin de jornada' else motivo_pausa end,
      notas = coalesce(nullif(trim(p_notas), ''), notas),
      updated_at = v_ahora,
      registrado_por = v_actor_id
  where tarea_id = v_orden.tarea_id and empleado_id = v_orden.empleado_id
    and estado in ('en_curso', 'pausada');

  update public.ordenes_trabajo_diarias
  set estado = p_resultado,
      resultado_notas = nullif(trim(p_notas), ''),
      cerrada_at = case when p_resultado = 'pendiente_continuar' then null else v_ahora end,
      updated_at = v_ahora
  where id = p_orden_id returning * into v_orden;

  if p_resultado = 'completada' and not exists (
    select 1 from public.ordenes_trabajo_diarias o
    where o.tarea_id = v_orden.tarea_id
      and o.id <> v_orden.id
      and o.estado in ('asignada', 'activa', 'pendiente_continuar')
  ) then
    update public.tareas set estado = 'pendiente_revision'
    where id = v_orden.tarea_id
      and estado not in ('completada', 'completada_validada');
  end if;
  return v_orden;
end;
$$;

create or replace function public.registrar_traslado_personal(
  p_fichaje_id uuid,
  p_motivo text,
  p_proyecto_destino_id uuid default null,
  p_centro_destino_id uuid default null,
  p_imputacion_tipo text default 'obra_destino',
  p_notas text default null
)
returns public.traslados_personal
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_fichaje public.control_horario%rowtype;
  v_resultado public.traslados_personal%rowtype;
begin
  if not public.app_is_admin_or_encargado() then
    raise exception 'Solo administración o el encargado pueden ordenar un traslado.';
  end if;
  if p_proyecto_destino_id is null and p_centro_destino_id is null then
    raise exception 'Selecciona el destino del traslado.';
  end if;
  if p_imputacion_tipo not in ('obra_origen', 'obra_destino', 'logistica_interna', 'gastos_generales') then
    raise exception 'La imputación del traslado no es válida.';
  end if;
  select id into v_actor_id from public.empleados where auth_user_id = auth.uid() limit 1;
  select * into v_fichaje from public.control_horario where id = p_fichaje_id and hora_salida is null;
  if v_fichaje.id is null then raise exception 'El fichaje de origen ya no está activo.'; end if;

  update public.traslados_personal set estado = 'cancelado', updated_at = now()
  where empleado_id = v_fichaje.empleado_id and estado in ('pendiente_salida', 'en_desplazamiento');

  insert into public.traslados_personal (
    empleado_id, fichaje_origen_id, proyecto_origen_id, proyecto_destino_id,
    centro_destino_id, motivo, imputacion_tipo, notas, ordenado_por
  ) values (
    v_fichaje.empleado_id, v_fichaje.id, v_fichaje.proyecto_id,
    p_proyecto_destino_id, p_centro_destino_id, trim(p_motivo),
    p_imputacion_tipo, nullif(trim(p_notas), ''), v_actor_id
  ) returning * into v_resultado;
  return v_resultado;
end;
$$;

create or replace function public.cerrar_operativa_por_salida_fichaje()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.hora_salida is null and new.hora_salida is not null then
    update public.tarea_sesiones_trabajo
    set minutos_acumulados = minutos_acumulados + case
          when ultimo_inicio_at is not null
          then greatest(floor(extract(epoch from (new.hora_salida - ultimo_inicio_at)) / 60)::integer, 0)
          else 0 end,
        estado = 'pausada', ultimo_inicio_at = null,
        motivo_pausa = 'Salida de la obra', updated_at = new.hora_salida
    where empleado_id = new.empleado_id and estado = 'en_curso'
      and (new.proyecto_id is null or proyecto_id = new.proyecto_id);

    update public.ordenes_trabajo_diarias
    set estado = 'pendiente_continuar', updated_at = new.hora_salida
    where fichaje_id = new.id and estado = 'activa';

    update public.traslados_personal
    set estado = 'en_desplazamiento', salida_at = new.hora_salida, updated_at = new.hora_salida
    where fichaje_origen_id = new.id and estado = 'pendiente_salida';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cerrar_operativa_por_salida on public.control_horario;
create trigger trg_cerrar_operativa_por_salida
after update of hora_salida on public.control_horario
for each row execute function public.cerrar_operativa_por_salida_fichaje();

create or replace function public.cerrar_traslado_por_entrada_fichaje()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.traslados_personal
  set estado = 'finalizado', fichaje_destino_id = new.id,
      llegada_at = new.hora_entrada, updated_at = new.hora_entrada
  where id = (
    select tr.id from public.traslados_personal tr
    where tr.empleado_id = new.empleado_id and tr.estado = 'en_desplazamiento'
      and ((tr.proyecto_destino_id is not null and tr.proyecto_destino_id = new.proyecto_id)
        or (tr.centro_destino_id is not null and tr.centro_destino_id = new.centro_coste_interno_id))
    order by tr.salida_at desc nulls last limit 1
  );
  return new;
end;
$$;

drop trigger if exists trg_cerrar_traslado_por_entrada on public.control_horario;
create trigger trg_cerrar_traslado_por_entrada
after insert on public.control_horario
for each row execute function public.cerrar_traslado_por_entrada_fichaje();

revoke all on function public.asignar_orden_trabajo(uuid, uuid, uuid, numeric, text) from public;
revoke all on function public.cerrar_orden_trabajo(uuid, text, text) from public;
revoke all on function public.registrar_traslado_personal(uuid, text, uuid, uuid, text, text) from public;
grant execute on function public.asignar_orden_trabajo(uuid, uuid, uuid, numeric, text) to authenticated, service_role;
grant execute on function public.cerrar_orden_trabajo(uuid, text, text) to authenticated, service_role;
grant execute on function public.registrar_traslado_personal(uuid, text, uuid, uuid, text, text) to authenticated, service_role;
revoke all on function public.listar_personal_presente_obra(uuid) from public;
revoke all on function public.obtener_contexto_fichaje_actual() from public;
grant execute on function public.listar_personal_presente_obra(uuid) to authenticated, service_role;
grant execute on function public.obtener_contexto_fichaje_actual() to authenticated, service_role;

comment on table public.ordenes_trabajo_diarias is
  'Órdenes liberadas por el encargado para cada técnico; el técnico no accede al cronograma completo.';
comment on table public.traslados_personal is
  'Reasignaciones entre obras, nave y servicios para separar tiempo productivo y desplazamiento.';
