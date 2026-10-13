-- Muestras reales de rendimiento obtenidas exclusivamente de tareas aprobadas.
-- La composicion del equipo se captura por dia: cualquier combinacion distinta
-- de empleados constituye un equipo distinto, sin etiquetas de cargo.

create table if not exists public.tarea_ejecuciones_reales (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null unique references public.tareas(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  obra_partida_id uuid references public.obras_partidas(id) on delete set null,
  sistema_id uuid references public.sistemas_rendimiento(id) on delete set null,
  revision_id uuid not null references public.tarea_revisiones(id) on delete restrict,
  titulo_snapshot text not null,
  oficio_snapshot text not null default 'otros',
  partida_snapshot text not null,
  cantidad_prevista numeric(14,3),
  cantidad_ejecutada numeric(14,3) not null,
  unidad text not null,
  total_minutos_persona integer not null default 0,
  coste_mano_obra numeric(14,2) not null default 0,
  condiciones text[] not null default '{}',
  incidencias text,
  observaciones text,
  aprobada_por uuid not null references public.empleados(id) on delete restrict,
  aprobada_at timestamptz not null default now(),
  autoaprobada boolean not null default false,
  utilizable_biblioteca boolean not null default true,
  motivo_no_utilizable text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tarea_ejecucion_cantidad_positiva check (cantidad_ejecutada > 0),
  constraint tarea_ejecucion_minutos_validos check (total_minutos_persona >= 0),
  constraint tarea_ejecucion_coste_valido check (coste_mano_obra >= 0)
);

create table if not exists public.tarea_ejecucion_participantes (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid not null references public.tarea_ejecuciones_reales(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete restrict,
  empleado_nombre text not null,
  minutos integer not null default 0,
  coste_hora_snapshot numeric(12,2) not null default 27,
  coste_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (ejecucion_id, empleado_id),
  constraint tarea_ejecucion_participante_minutos check (minutos >= 0),
  constraint tarea_ejecucion_participante_costes check (coste_hora_snapshot >= 0 and coste_total >= 0)
);

create table if not exists public.tarea_ejecucion_equipos (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid not null references public.tarea_ejecuciones_reales(id) on delete cascade,
  fecha_trabajo date not null,
  equipo_clave text not null,
  equipo_nombre text not null,
  minutos_persona integer not null default 0,
  minutos_equipo integer not null default 0,
  cantidad_ejecutada numeric(14,3) not null,
  unidad text not null,
  cantidad_origen text not null default 'confirmada',
  created_at timestamptz not null default now(),
  unique (ejecucion_id, fecha_trabajo, equipo_clave),
  constraint tarea_ejecucion_equipo_minutos check (minutos_persona >= 0 and minutos_equipo >= 0),
  constraint tarea_ejecucion_equipo_cantidad check (cantidad_ejecutada >= 0),
  constraint tarea_ejecucion_equipo_origen check (cantidad_origen in ('confirmada', 'prorrateada'))
);

create table if not exists public.tarea_ejecucion_equipo_participantes (
  equipo_ejecucion_id uuid not null references public.tarea_ejecucion_equipos(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete restrict,
  empleado_nombre text not null,
  minutos integer not null default 0,
  coste_hora_snapshot numeric(12,2) not null default 27,
  coste_total numeric(14,2) not null default 0,
  primary key (equipo_ejecucion_id, empleado_id),
  constraint tarea_equipo_participante_minutos check (minutos >= 0),
  constraint tarea_equipo_participante_costes check (coste_hora_snapshot >= 0 and coste_total >= 0)
);

create index if not exists tarea_ejecuciones_sistema_idx
  on public.tarea_ejecuciones_reales (sistema_id, aprobada_at desc)
  where utilizable_biblioteca is true;
create index if not exists tarea_ejecuciones_oficio_idx
  on public.tarea_ejecuciones_reales (oficio_snapshot, aprobada_at desc);
create index if not exists tarea_ejecucion_equipos_clave_idx
  on public.tarea_ejecucion_equipos (equipo_clave, fecha_trabajo desc);

alter table public.tarea_ejecuciones_reales enable row level security;
alter table public.tarea_ejecucion_participantes enable row level security;
alter table public.tarea_ejecucion_equipos enable row level security;
alter table public.tarea_ejecucion_equipo_participantes enable row level security;

create policy tarea_ejecuciones_lectura_gestion
on public.tarea_ejecuciones_reales for select to authenticated
using (public.app_is_admin_or_encargado());
create policy tarea_ejecucion_participantes_lectura_gestion
on public.tarea_ejecucion_participantes for select to authenticated
using (public.app_is_admin_or_encargado());
create policy tarea_ejecucion_equipos_lectura_gestion
on public.tarea_ejecucion_equipos for select to authenticated
using (public.app_is_admin_or_encargado());
create policy tarea_ejecucion_equipo_participantes_lectura_gestion
on public.tarea_ejecucion_equipo_participantes for select to authenticated
using (public.app_is_admin_or_encargado());

revoke insert, update, delete on public.tarea_ejecuciones_reales from authenticated;
revoke insert, update, delete on public.tarea_ejecucion_participantes from authenticated;
revoke insert, update, delete on public.tarea_ejecucion_equipos from authenticated;
revoke insert, update, delete on public.tarea_ejecucion_equipo_participantes from authenticated;
grant select on public.tarea_ejecuciones_reales, public.tarea_ejecucion_participantes,
  public.tarea_ejecucion_equipos, public.tarea_ejecucion_equipo_participantes
  to authenticated, service_role;

-- Cada jornada produce una sesion independiente. Una tarea pausada ayer se
-- cierra y hoy se abre otra fila, evitando atribuir horas al equipo equivocado.
create or replace function public.registrar_accion_tarea(
  p_tarea_id uuid,
  p_accion text,
  p_empleado_id uuid default null,
  p_motivo text default null,
  p_notas text default null,
  p_cantidad numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_rol text;
  v_empleado_id uuid;
  v_proyecto_id uuid;
  v_unidad text;
  v_sesion public.tarea_sesiones_trabajo%rowtype;
  v_ahora timestamptz := now();
  v_hoy date := (timezone('Europe/Madrid', now()))::date;
begin
  select e.id, e.rol::text into v_actor_id, v_actor_rol
  from public.empleados e where e.auth_user_id = auth.uid() limit 1;
  if v_actor_id is null then raise exception 'No existe un perfil de empleado asociado a la sesion.'; end if;

  v_empleado_id := coalesce(p_empleado_id, v_actor_id);
  if v_empleado_id <> v_actor_id and v_actor_rol not in ('admin', 'encargado') then
    raise exception 'No puedes registrar tiempos para otro empleado.';
  end if;

  select t.proyecto_id, t.unidad_medible into v_proyecto_id, v_unidad
  from public.tareas t where t.id = p_tarea_id;
  if v_proyecto_id is null then raise exception 'La tarea no existe.'; end if;
  if not exists (select 1 from public.tarea_empleados te where te.tarea_id = p_tarea_id and te.empleado_id = v_empleado_id)
     and not exists (select 1 from public.tareas t where t.id = p_tarea_id and t.empleado_asignado_id = v_empleado_id) then
    raise exception 'El empleado no esta asignado a esta tarea.';
  end if;

  if p_accion = 'iniciar' then
    select * into v_sesion from public.tarea_sesiones_trabajo
    where tarea_id = p_tarea_id and empleado_id = v_empleado_id and estado = 'en_curso'
    order by created_at desc limit 1;
    if v_sesion.id is not null then
      return jsonb_build_object('ok', true, 'sesion_id', v_sesion.id, 'estado', v_sesion.estado,
        'empleado_id', v_empleado_id, 'tarea_id', p_tarea_id, 'minutos_acumulados', v_sesion.minutos_acumulados);
    end if;

    update public.tarea_sesiones_trabajo
       set estado = 'finalizada', fin_at = coalesce(fin_at, v_ahora), ultimo_inicio_at = null,
           motivo_pausa = coalesce(motivo_pausa, 'Cierre automatico al iniciar nueva jornada'), updated_at = v_ahora
     where tarea_id = p_tarea_id and empleado_id = v_empleado_id
       and estado = 'pausada' and fecha_trabajo < v_hoy;

    update public.tarea_sesiones_trabajo
       set minutos_acumulados = minutos_acumulados + coalesce(greatest(floor(extract(epoch from (v_ahora - ultimo_inicio_at)) / 60)::integer, 0), 0),
           estado = 'pausada', ultimo_inicio_at = null, motivo_pausa = 'Cambio de tarea', updated_at = v_ahora
     where empleado_id = v_empleado_id and estado = 'en_curso' and tarea_id <> p_tarea_id;

    v_sesion := null;
    select * into v_sesion from public.tarea_sesiones_trabajo
    where tarea_id = p_tarea_id and empleado_id = v_empleado_id
      and estado = 'pausada' and fecha_trabajo = v_hoy
    order by created_at desc limit 1 for update;

    if v_sesion.id is null then
      insert into public.tarea_sesiones_trabajo
        (tarea_id, proyecto_id, empleado_id, fecha_trabajo, estado, inicio_at, ultimo_inicio_at, registrado_por)
      values (p_tarea_id, v_proyecto_id, v_empleado_id, v_hoy, 'en_curso', v_ahora, v_ahora, v_actor_id)
      returning * into v_sesion;
    else
      update public.tarea_sesiones_trabajo
         set estado = 'en_curso', ultimo_inicio_at = v_ahora, motivo_pausa = null,
             updated_at = v_ahora, registrado_por = v_actor_id
       where id = v_sesion.id returning * into v_sesion;
    end if;

    update public.tareas set estado = 'en_progreso', fecha_inicio_real = coalesce(fecha_inicio_real, v_ahora), motivo_pausa = null
    where id = p_tarea_id and estado not in ('pendiente_revision', 'completada', 'completada_validada');
  elsif p_accion = 'pausar' then
    update public.tarea_sesiones_trabajo
       set minutos_acumulados = minutos_acumulados + greatest(floor(extract(epoch from (v_ahora - ultimo_inicio_at)) / 60)::integer, 0),
           estado = 'pausada', ultimo_inicio_at = null, motivo_pausa = nullif(trim(p_motivo), ''),
           updated_at = v_ahora, registrado_por = v_actor_id
     where tarea_id = p_tarea_id and empleado_id = v_empleado_id and estado = 'en_curso'
     returning * into v_sesion;
    if v_sesion.id is null then raise exception 'No hay una intervencion activa que pausar.'; end if;
  elsif p_accion = 'finalizar' then
    select * into v_sesion from public.tarea_sesiones_trabajo
    where tarea_id = p_tarea_id and empleado_id = v_empleado_id and estado in ('en_curso', 'pausada')
    order by created_at desc limit 1 for update;
    if v_sesion.id is null then raise exception 'No hay una intervencion abierta que finalizar.'; end if;
    update public.tarea_sesiones_trabajo
       set minutos_acumulados = minutos_acumulados + case when estado = 'en_curso' and ultimo_inicio_at is not null
             then greatest(floor(extract(epoch from (v_ahora - ultimo_inicio_at)) / 60)::integer, 0) else 0 end,
           estado = 'finalizada', ultimo_inicio_at = null, fin_at = v_ahora,
           notas = nullif(trim(p_notas), ''), cantidad_reportada = p_cantidad,
           unidad_reportada = case when p_cantidad is not null then v_unidad else null end,
           updated_at = v_ahora, registrado_por = v_actor_id
     where id = v_sesion.id returning * into v_sesion;
  else
    raise exception 'Accion no valida. Usa iniciar, pausar o finalizar.';
  end if;

  return jsonb_build_object('ok', true, 'sesion_id', v_sesion.id, 'estado', v_sesion.estado,
    'empleado_id', v_empleado_id, 'tarea_id', p_tarea_id, 'minutos_acumulados', v_sesion.minutos_acumulados);
end;
$$;

create or replace function public.admin_guardar_revision_tarea_v2(
  p_tarea_id uuid,
  p_resultado public.tarea_revision_result,
  p_comentario text,
  p_cantidad_ejecutada numeric default null,
  p_unidad text default null,
  p_condiciones text[] default '{}',
  p_incidencias text default null,
  p_equipos jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revisor_id uuid;
  v_revision_id uuid;
  v_ejecucion_id uuid;
  v_equipo_id uuid;
  v_evidencias integer := 0;
  v_tarea record;
  v_total_minutos integer := 0;
  v_total_coste numeric := 0;
  v_total_segmentos numeric := 0;
  v_dias integer := 0;
  v_segmento record;
  v_cantidad_dia numeric;
  v_origen text;
begin
  if auth.role() <> 'service_role' and not public.app_is_admin_or_encargado() then raise exception 'No autorizado'; end if;
  select e.id into v_revisor_id from public.empleados e where e.auth_user_id = auth.uid() limit 1;
  if v_revisor_id is null and auth.role() <> 'service_role' then raise exception 'Usuario actual no vinculado a empleados'; end if;

  select t.*, op.sistema_id, op.cantidad_total as partida_cantidad, op.unidad as partida_unidad,
         op.descripcion as partida_descripcion, coalesce(sr.categoria, 'otros') as oficio,
         coalesce(sr.nombre, op.descripcion, t.titulo) as partida_nombre
    into v_tarea
  from public.tareas t
  left join public.obras_partidas op on op.id = t.obra_partida_id
  left join public.sistemas_rendimiento sr on sr.id = op.sistema_id
  where t.id = p_tarea_id for update of t;
  if v_tarea.id is null then raise exception 'La tarea no existe.'; end if;

  if p_resultado = 'aprobada' then
    if p_cantidad_ejecutada is null or p_cantidad_ejecutada <= 0 then raise exception 'Confirma una cantidad ejecutada mayor que cero.'; end if;
    if nullif(trim(coalesce(p_unidad, v_tarea.unidad_medible, v_tarea.partida_unidad)), '') is null then raise exception 'Confirma la unidad ejecutada.'; end if;
    select (select count(*) from public.ordenes_trabajo_evidencias where tarea_id = p_tarea_id)
         + (select count(*) from public.evidencias_tarea et join public.subtareas st on st.id = et.subtarea_id where st.tarea_id = p_tarea_id)
      into v_evidencias;
    if coalesce(v_evidencias, 0) < 1 then raise exception 'No se puede aprobar la tarea sin al menos una evidencia fotografica.'; end if;
  elsif nullif(trim(p_comentario), '') is null then
    raise exception 'Debes indicar que debe corregirse antes de devolver la tarea.';
  end if;

  insert into public.tarea_revisiones (tarea_id, revisor_empleado_id, resultado, aprobado, comentario)
  values (p_tarea_id, v_revisor_id, p_resultado, p_resultado = 'aprobada', nullif(trim(p_comentario), ''))
  returning id into v_revision_id;

  if p_resultado = 'aprobada' then
    update public.tareas set estado = 'completada_validada'::public.tarea_status, revisada_por = v_revisor_id,
      fecha_revision = now(), comentario_revision = nullif(trim(p_comentario), ''), fecha_validacion = now(), validado_por = v_revisor_id
    where id = p_tarea_id;

    select coalesce(sum(s.minutos_acumulados), 0)::integer,
           coalesce(sum((s.minutos_acumulados / 60.0) * coalesce(e.costo_por_hora, 27)), 0)
      into v_total_minutos, v_total_coste
    from public.tarea_sesiones_trabajo s join public.empleados e on e.id = s.empleado_id
    where s.tarea_id = p_tarea_id;
    if v_total_minutos <= 0 then
      raise exception 'No se puede crear una muestra de rendimiento sin tiempo real registrado.';
    end if;

    insert into public.tarea_ejecuciones_reales
      (tarea_id, proyecto_id, obra_partida_id, sistema_id, revision_id, titulo_snapshot, oficio_snapshot,
       partida_snapshot, cantidad_prevista, cantidad_ejecutada, unidad, total_minutos_persona, coste_mano_obra,
       condiciones, incidencias, observaciones, aprobada_por, aprobada_at, autoaprobada, updated_at)
    values
      (p_tarea_id, v_tarea.proyecto_id, v_tarea.obra_partida_id, v_tarea.sistema_id, v_revision_id,
       v_tarea.titulo, v_tarea.oficio, v_tarea.partida_nombre, coalesce(v_tarea.cantidad_medible, v_tarea.partida_cantidad),
       p_cantidad_ejecutada, trim(coalesce(p_unidad, v_tarea.unidad_medible, v_tarea.partida_unidad)), v_total_minutos,
       round(v_total_coste, 2), coalesce(p_condiciones, '{}'), nullif(trim(p_incidencias), ''), nullif(trim(p_comentario), ''),
       v_revisor_id, now(), exists(select 1 from public.tarea_sesiones_trabajo s where s.tarea_id = p_tarea_id and s.empleado_id = v_revisor_id), now())
    on conflict (tarea_id) do update set revision_id = excluded.revision_id, cantidad_ejecutada = excluded.cantidad_ejecutada,
      unidad = excluded.unidad, total_minutos_persona = excluded.total_minutos_persona, coste_mano_obra = excluded.coste_mano_obra,
      condiciones = excluded.condiciones, incidencias = excluded.incidencias, observaciones = excluded.observaciones,
      aprobada_por = excluded.aprobada_por, aprobada_at = excluded.aprobada_at, autoaprobada = excluded.autoaprobada, updated_at = now()
    returning id into v_ejecucion_id;

    delete from public.tarea_ejecucion_participantes where ejecucion_id = v_ejecucion_id;
    delete from public.tarea_ejecucion_equipos where ejecucion_id = v_ejecucion_id;
    insert into public.tarea_ejecucion_participantes
      (ejecucion_id, empleado_id, empleado_nombre, minutos, coste_hora_snapshot, coste_total)
    select v_ejecucion_id, e.id, trim(concat_ws(' ', e.nombre, nullif(e.apellidos, 'Sin Apellidos'))),
      sum(s.minutos_acumulados)::integer, coalesce(e.costo_por_hora, 27),
      round(sum(s.minutos_acumulados) / 60.0 * coalesce(e.costo_por_hora, 27), 2)
    from public.tarea_sesiones_trabajo s join public.empleados e on e.id = s.empleado_id
    where s.tarea_id = p_tarea_id group by e.id, e.nombre, e.apellidos, e.costo_por_hora;

    select count(distinct fecha_trabajo) into v_dias from public.tarea_sesiones_trabajo where tarea_id = p_tarea_id;
    for v_segmento in
      with por_persona as (
        select s.fecha_trabajo, s.empleado_id, sum(s.minutos_acumulados)::integer as minutos
        from public.tarea_sesiones_trabajo s
        where s.tarea_id = p_tarea_id
        group by s.fecha_trabajo, s.empleado_id
      )
      select s.fecha_trabajo,
        string_agg(s.empleado_id::text, ':' order by s.empleado_id::text) as equipo_clave,
        string_agg(trim(concat_ws(' ', e.nombre, nullif(e.apellidos, 'Sin Apellidos'))), ' + '
          order by trim(concat_ws(' ', e.nombre, nullif(e.apellidos, 'Sin Apellidos')))) as equipo_nombre,
        sum(s.minutos)::integer as minutos_persona,
        max(s.minutos)::integer as minutos_equipo
      from por_persona s join public.empleados e on e.id = s.empleado_id
      group by s.fecha_trabajo order by s.fecha_trabajo
    loop
      select nullif(x->>'cantidad', '')::numeric into v_cantidad_dia
      from jsonb_array_elements(coalesce(p_equipos, '[]'::jsonb)) x
      where (x->>'fecha')::date = v_segmento.fecha_trabajo limit 1;
      if v_cantidad_dia is null then
        v_cantidad_dia := case when v_total_minutos > 0 then p_cantidad_ejecutada * v_segmento.minutos_persona / v_total_minutos else p_cantidad_ejecutada / greatest(v_dias, 1) end;
        v_origen := 'prorrateada';
      else v_origen := 'confirmada'; end if;
      v_total_segmentos := v_total_segmentos + v_cantidad_dia;
      insert into public.tarea_ejecucion_equipos
        (ejecucion_id, fecha_trabajo, equipo_clave, equipo_nombre, minutos_persona, minutos_equipo, cantidad_ejecutada, unidad, cantidad_origen)
      values (v_ejecucion_id, v_segmento.fecha_trabajo, v_segmento.equipo_clave, v_segmento.equipo_nombre,
        v_segmento.minutos_persona, v_segmento.minutos_equipo, round(v_cantidad_dia, 3), trim(coalesce(p_unidad, v_tarea.unidad_medible, v_tarea.partida_unidad)), v_origen)
      returning id into v_equipo_id;
      insert into public.tarea_ejecucion_equipo_participantes
        (equipo_ejecucion_id, empleado_id, empleado_nombre, minutos, coste_hora_snapshot, coste_total)
      select v_equipo_id, e.id, trim(concat_ws(' ', e.nombre, nullif(e.apellidos, 'Sin Apellidos'))),
        sum(s.minutos_acumulados)::integer, coalesce(e.costo_por_hora, 27),
        round(sum(s.minutos_acumulados) / 60.0 * coalesce(e.costo_por_hora, 27), 2)
      from public.tarea_sesiones_trabajo s join public.empleados e on e.id = s.empleado_id
      where s.tarea_id = p_tarea_id and s.fecha_trabajo = v_segmento.fecha_trabajo
      group by e.id, e.nombre, e.apellidos, e.costo_por_hora;
    end loop;
    if v_dias > 0 and abs(v_total_segmentos - p_cantidad_ejecutada) > 0.02 then
      raise exception 'La suma de cantidades por equipo (%) no coincide con la cantidad total (%).', v_total_segmentos, p_cantidad_ejecutada;
    end if;
  else
    update public.tareas set estado = 'en_progreso'::public.tarea_status, revisada_por = v_revisor_id,
      fecha_revision = now(), comentario_revision = trim(p_comentario), fecha_validacion = null, validado_por = null
    where id = p_tarea_id;
    update public.subtareas set completada = false, fecha_completado = null where tarea_id = p_tarea_id;
    update public.ordenes_trabajo_diarias otd set estado = 'pendiente_continuar', cerrada_at = null,
      resultado_notas = concat_ws(E'\n', nullif(trim(otd.resultado_notas), ''), 'Correccion solicitada por el encargado: ' || trim(p_comentario)), updated_at = now()
    where otd.id in (select distinct on (empleado_id) id from public.ordenes_trabajo_diarias
      where tarea_id = p_tarea_id and estado = 'completada' order by empleado_id, cerrada_at desc nulls last, asignada_at desc);
  end if;

  return jsonb_build_object('ok', true, 'tarea_id', p_tarea_id, 'resultado', p_resultado,
    'revision_id', v_revision_id, 'ejecucion_id', v_ejecucion_id, 'evidencias', v_evidencias);
end;
$$;

revoke all on function public.admin_guardar_revision_tarea_v2(uuid, public.tarea_revision_result, text, numeric, text, text[], text, jsonb) from public;
grant execute on function public.admin_guardar_revision_tarea_v2(uuid, public.tarea_revision_result, text, numeric, text, text[], text, jsonb)
  to authenticated, service_role;

create or replace view public.v_rendimiento_individual
with (security_invoker = true) as
select er.sistema_id, er.oficio_snapshot as oficio, er.partida_snapshot as partida,
  ep.empleado_id, ep.empleado_nombre, count(*) as muestras,
  sum(er.cantidad_ejecutada) as cantidad_ejecutada, er.unidad,
  sum(ep.minutos) as minutos, round(sum(ep.minutos) / 60.0, 2) as horas,
  round(sum(er.cantidad_ejecutada) / nullif(sum(ep.minutos) / 60.0, 0), 3) as unidades_hora
from public.tarea_ejecuciones_reales er join public.tarea_ejecucion_participantes ep on ep.ejecucion_id = er.id
where er.utilizable_biblioteca is true
group by er.sistema_id, er.oficio_snapshot, er.partida_snapshot, ep.empleado_id, ep.empleado_nombre, er.unidad;

create or replace view public.v_rendimiento_equipos
with (security_invoker = true) as
select er.sistema_id, er.oficio_snapshot as oficio, er.partida_snapshot as partida,
  ee.equipo_clave, ee.equipo_nombre, count(*) as muestras,
  sum(ee.cantidad_ejecutada) as cantidad_ejecutada, ee.unidad,
  sum(ee.minutos_persona) as minutos_persona, sum(ee.minutos_equipo) as minutos_equipo,
  round(sum(ee.cantidad_ejecutada) / nullif(sum(ee.minutos_equipo) / 60.0, 0), 3) as unidades_hora_equipo,
  round(sum(ee.cantidad_ejecutada) / nullif(sum(ee.minutos_persona) / 60.0, 0), 3) as unidades_hora_persona
from public.tarea_ejecuciones_reales er join public.tarea_ejecucion_equipos ee on ee.ejecucion_id = er.id
where er.utilizable_biblioteca is true
group by er.sistema_id, er.oficio_snapshot, er.partida_snapshot, ee.equipo_clave, ee.equipo_nombre, ee.unidad;

create or replace view public.v_rendimiento_global
with (security_invoker = true) as
select sistema_id, oficio_snapshot as oficio, partida_snapshot as partida, count(*) as muestras,
  sum(cantidad_ejecutada) as cantidad_ejecutada, unidad,
  sum(total_minutos_persona) as minutos_persona, round(sum(total_minutos_persona) / 60.0, 2) as horas_persona,
  round(sum(cantidad_ejecutada) / nullif(sum(total_minutos_persona) / 60.0, 0), 3) as unidades_hora_persona,
  round(sum(coste_mano_obra) / nullif(sum(cantidad_ejecutada), 0), 2) as coste_mano_obra_unidad
from public.tarea_ejecuciones_reales where utilizable_biblioteca is true
group by sistema_id, oficio_snapshot, partida_snapshot, unidad;

grant select on public.v_rendimiento_individual, public.v_rendimiento_equipos, public.v_rendimiento_global
  to authenticated, service_role;

comment on table public.tarea_ejecuciones_reales is 'Muestras aprobadas que nutren la biblioteca con cantidades, tiempos y costes reales.';
comment on table public.tarea_ejecucion_equipos is 'Rendimiento diario por combinacion exacta de empleados; Fran se almacena por su nombre, sin etiqueta de cargo.';
comment on function public.admin_guardar_revision_tarea_v2(uuid, public.tarea_revision_result, text, numeric, text, text[], text, jsonb) is
  'Aprueba o devuelve una tarea y, al aprobar, congela su rendimiento individual, de equipo y global.';
