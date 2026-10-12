-- Sesiones reales de trabajo por empleado y tarea.
-- Complementan el fichaje laboral: el fichaje indica la obra y esta tabla indica
-- en que partida concreta se invirtio el tiempo.

create table if not exists public.tarea_sesiones_trabajo (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  fecha_trabajo date not null default ((timezone('Europe/Madrid', now()))::date),
  estado text not null default 'en_curso',
  inicio_at timestamp with time zone not null default now(),
  ultimo_inicio_at timestamp with time zone,
  fin_at timestamp with time zone,
  minutos_acumulados integer not null default 0,
  motivo_pausa text,
  cantidad_reportada numeric(12,3),
  unidad_reportada text,
  notas text,
  registrado_por uuid references public.empleados(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint tarea_sesiones_estado_check
    check (estado in ('en_curso', 'pausada', 'finalizada')),
  constraint tarea_sesiones_minutos_check
    check (minutos_acumulados >= 0),
  constraint tarea_sesiones_cantidad_check
    check (cantidad_reportada is null or cantidad_reportada >= 0)
);

create unique index if not exists tarea_sesiones_un_activo_por_empleado
  on public.tarea_sesiones_trabajo (empleado_id)
  where estado = 'en_curso';

create index if not exists tarea_sesiones_proyecto_fecha_idx
  on public.tarea_sesiones_trabajo (proyecto_id, fecha_trabajo, empleado_id);

create index if not exists tarea_sesiones_tarea_idx
  on public.tarea_sesiones_trabajo (tarea_id, empleado_id, created_at desc);

alter table public.tarea_sesiones_trabajo enable row level security;

drop policy if exists tarea_sesiones_lectura_equipo on public.tarea_sesiones_trabajo;
create policy tarea_sesiones_lectura_equipo
on public.tarea_sesiones_trabajo
for select
to authenticated
using (
  exists (
    select 1
    from public.empleados e
    where e.auth_user_id = auth.uid()
      and (
        e.id = tarea_sesiones_trabajo.empleado_id
        or e.rol::text in ('admin', 'encargado')
      )
  )
);

-- Las escrituras se realizan exclusivamente mediante la funcion transaccional.
revoke insert, update, delete on public.tarea_sesiones_trabajo from authenticated;
grant select on public.tarea_sesiones_trabajo to authenticated, service_role;

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
  v_ahora timestamp with time zone := now();
  v_hoy date := (timezone('Europe/Madrid', now()))::date;
begin
  select e.id, e.rol::text
    into v_actor_id, v_actor_rol
  from public.empleados e
  where e.auth_user_id = auth.uid()
  limit 1;

  if v_actor_id is null then
    raise exception 'No existe un perfil de empleado asociado a la sesion.';
  end if;

  v_empleado_id := coalesce(p_empleado_id, v_actor_id);

  if v_empleado_id <> v_actor_id
     and v_actor_rol not in ('admin', 'encargado') then
    raise exception 'No puedes registrar tiempos para otro empleado.';
  end if;

  select t.proyecto_id, t.unidad_medible
    into v_proyecto_id, v_unidad
  from public.tareas t
  where t.id = p_tarea_id;

  if v_proyecto_id is null then
    raise exception 'La tarea no existe.';
  end if;

  if not exists (
    select 1 from public.tarea_empleados te
    where te.tarea_id = p_tarea_id and te.empleado_id = v_empleado_id
  ) and not exists (
    select 1 from public.tareas t
    where t.id = p_tarea_id and t.empleado_asignado_id = v_empleado_id
  ) then
    raise exception 'El empleado no esta asignado a esta tarea.';
  end if;

  if p_accion = 'iniciar' then
    select * into v_sesion
    from public.tarea_sesiones_trabajo
    where tarea_id = p_tarea_id
      and empleado_id = v_empleado_id
      and estado = 'en_curso'
    order by created_at desc
    limit 1;

    if v_sesion.id is not null then
      return jsonb_build_object(
        'ok', true,
        'sesion_id', v_sesion.id,
        'estado', v_sesion.estado,
        'empleado_id', v_empleado_id,
        'tarea_id', p_tarea_id,
        'minutos_acumulados', v_sesion.minutos_acumulados
      );
    end if;

    -- Cambiar de tarea pausa la intervencion anterior sin perder minutos.
    update public.tarea_sesiones_trabajo
       set minutos_acumulados = minutos_acumulados + coalesce(greatest(
             floor(extract(epoch from (v_ahora - ultimo_inicio_at)) / 60)::integer, 0
           ), 0),
           estado = 'pausada',
           ultimo_inicio_at = null,
           motivo_pausa = 'Cambio de tarea',
           updated_at = v_ahora
     where empleado_id = v_empleado_id
       and estado = 'en_curso'
       and tarea_id <> p_tarea_id;

    v_sesion := null;
    select * into v_sesion
    from public.tarea_sesiones_trabajo
    where tarea_id = p_tarea_id
      and empleado_id = v_empleado_id
      and estado = 'pausada'
    order by created_at desc
    limit 1
    for update;

    if v_sesion.id is null then
      insert into public.tarea_sesiones_trabajo (
        tarea_id, proyecto_id, empleado_id, fecha_trabajo, estado,
        inicio_at, ultimo_inicio_at, registrado_por
      ) values (
        p_tarea_id, v_proyecto_id, v_empleado_id, v_hoy, 'en_curso',
        v_ahora, v_ahora, v_actor_id
      ) returning * into v_sesion;
    else
      update public.tarea_sesiones_trabajo
         set estado = 'en_curso',
             ultimo_inicio_at = v_ahora,
             motivo_pausa = null,
             updated_at = v_ahora,
             registrado_por = v_actor_id
       where id = v_sesion.id
       returning * into v_sesion;
    end if;

    update public.tareas
       set estado = 'en_progreso',
           fecha_inicio_real = coalesce(fecha_inicio_real, v_ahora),
           motivo_pausa = null
     where id = p_tarea_id
       and estado not in ('pendiente_revision', 'completada', 'completada_validada');

  elsif p_accion = 'pausar' then
    update public.tarea_sesiones_trabajo
       set minutos_acumulados = minutos_acumulados + greatest(
             floor(extract(epoch from (v_ahora - ultimo_inicio_at)) / 60)::integer,
             0
           ),
           estado = 'pausada',
           ultimo_inicio_at = null,
           motivo_pausa = nullif(trim(p_motivo), ''),
           updated_at = v_ahora,
           registrado_por = v_actor_id
     where tarea_id = p_tarea_id
       and empleado_id = v_empleado_id
       and estado = 'en_curso'
     returning * into v_sesion;

    if v_sesion.id is null then
      raise exception 'No hay una intervencion activa que pausar.';
    end if;

  elsif p_accion = 'finalizar' then
    select * into v_sesion
    from public.tarea_sesiones_trabajo
    where tarea_id = p_tarea_id
      and empleado_id = v_empleado_id
      and estado in ('en_curso', 'pausada')
    order by created_at desc
    limit 1
    for update;

    if v_sesion.id is null then
      raise exception 'No hay una intervencion abierta que finalizar.';
    end if;

    update public.tarea_sesiones_trabajo
       set minutos_acumulados = minutos_acumulados + case
             when estado = 'en_curso' and ultimo_inicio_at is not null
             then greatest(floor(extract(epoch from (v_ahora - ultimo_inicio_at)) / 60)::integer, 0)
             else 0
           end,
           estado = 'finalizada',
           ultimo_inicio_at = null,
           fin_at = v_ahora,
           notas = nullif(trim(p_notas), ''),
           cantidad_reportada = p_cantidad,
           unidad_reportada = case when p_cantidad is not null then v_unidad else null end,
           updated_at = v_ahora,
           registrado_por = v_actor_id
     where id = v_sesion.id
     returning * into v_sesion;
  else
    raise exception 'Accion no valida. Usa iniciar, pausar o finalizar.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'sesion_id', v_sesion.id,
    'estado', v_sesion.estado,
    'empleado_id', v_empleado_id,
    'tarea_id', p_tarea_id,
    'minutos_acumulados', v_sesion.minutos_acumulados
  );
end;
$$;

revoke all on function public.registrar_accion_tarea(uuid, text, uuid, text, text, numeric) from public;
grant execute on function public.registrar_accion_tarea(uuid, text, uuid, text, text, numeric)
  to authenticated, service_role;

comment on table public.tarea_sesiones_trabajo is
  'Intervenciones reales por empleado y tarea para medir rendimientos sin sustituir el fichaje laboral.';
comment on column public.tarea_sesiones_trabajo.cantidad_reportada is
  'Cantidad informativa declarada al cerrar la intervencion; requiere validacion antes de sumar a produccion.';
comment on function public.registrar_accion_tarea(uuid, text, uuid, text, text, numeric) is
  'Inicia, pausa, reanuda o finaliza la intervencion de un empleado en una tarea asignada.';
