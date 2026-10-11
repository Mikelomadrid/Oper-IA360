-- Genera el plan operativo inicial al convertir un presupuesto aceptado en obra.
-- Cada partida se convierte en una tarea y sus fases tecnicas en subtareas.

alter table public.tareas
  add column if not exists obra_partida_id uuid
    references public.obras_partidas(id) on delete set null,
  add column if not exists origen_generacion text not null default 'manual';

alter table public.tareas
  drop constraint if exists tareas_origen_generacion_check;
alter table public.tareas
  add constraint tareas_origen_generacion_check
  check (origen_generacion in ('manual', 'presupuesto_aceptado'));

create unique index if not exists tareas_obra_partida_uniq
  on public.tareas (obra_partida_id)
  where obra_partida_id is not null;

create or replace function public.sumar_dias_laborables(
  p_inicio date,
  p_dias integer
)
returns date
language plpgsql
immutable
set search_path = public
as $$
declare
  v_fecha date := p_inicio;
  v_restantes integer := greatest(coalesce(p_dias, 0), 0);
begin
  while extract(isodow from v_fecha) in (6, 7) loop
    v_fecha := v_fecha + 1;
  end loop;

  while v_restantes > 0 loop
    v_fecha := v_fecha + 1;
    if extract(isodow from v_fecha) not in (6, 7) then
      v_restantes := v_restantes - 1;
    end if;
  end loop;

  return v_fecha;
end;
$$;

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
  v_cursor date;
  v_fin date;
  v_horas_unidad numeric;
  v_horas_totales numeric;
  v_duracion integer;
  v_fases integer;
  v_creadas integer := 0;
  v_omitidas integer := 0;
  v_inicio_plan date;
  v_fin_plan date;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion para generar el plan de obra.';
  end if;

  if not public.app_is_admin_or_encargado() then
    raise exception 'No tienes permiso para generar el plan de obra.';
  end if;

  if not exists (select 1 from public.proyectos where id = p_proyecto_id) then
    raise exception 'No se encontro la obra.';
  end if;

  select coalesce(p_fecha_inicio, fecha_inicio::date, current_date)
  into v_cursor
  from public.proyectos
  where id = p_proyecto_id;

  v_cursor := public.sumar_dias_laborables(v_cursor, 0);
  v_inicio_plan := v_cursor;

  for v_partida in
    select *
    from public.obras_partidas
    where obra_id = p_proyecto_id
      and activa is true
    order by orden, creado_at, id
  loop
    if exists (
      select 1 from public.tareas
      where obra_partida_id = v_partida.id
    ) then
      v_omitidas := v_omitidas + 1;
      continue;
    end if;

    select coalesce(
      nullif((
        select sum(f.horas_por_unidad)
        from public.sistema_rendimiento_fases f
        where f.sistema_id = v_partida.sistema_id
          and f.obligatoria is true
      ), 0),
      nullif((
        select sum(m.horas_por_unidad)
        from public.sistema_rendimiento_mano_obra m
        where m.sistema_id = v_partida.sistema_id
      ), 0),
      0
    ) into v_horas_unidad;

    v_horas_totales := v_horas_unidad * greatest(coalesce(v_partida.cantidad_total, 0), 1);
    v_duracion := case
      when v_horas_totales > 0 then greatest(1, ceil(v_horas_totales / 8.0)::integer)
      else 1
    end;
    v_fin := public.sumar_dias_laborables(v_cursor, v_duracion - 1);

    insert into public.tareas (
      proyecto_id,
      empleado_asignado_id,
      titulo,
      descripcion,
      estado,
      fecha_inicio,
      fecha_limite,
      orden,
      cantidad_medible,
      unidad_medible,
      obra_partida_id,
      origen_generacion
    ) values (
      p_proyecto_id,
      null,
      left(concat_ws(' · ', nullif(v_partida.codigo, ''), v_partida.descripcion), 255),
      concat_ws(E'\n',
        v_partida.descripcion,
        case when v_partida.capitulo is not null then 'Capitulo: ' || v_partida.capitulo end,
        case when v_partida.zona is not null then 'Zona: ' || v_partida.zona end,
        'Generada desde el presupuesto aceptado. Planificacion inicial editable.'
      ),
      'pendiente',
      v_cursor,
      v_fin,
      coalesce(v_partida.orden, 0),
      v_partida.cantidad_total,
      v_partida.unidad,
      v_partida.id,
      'presupuesto_aceptado'
    )
    returning id into v_tarea_id;

    insert into public.subtareas (
      tarea_id,
      descripcion_subtarea,
      orden,
      duracion_horas,
      origen,
      notas
    )
    select
      v_tarea_id,
      left(f.nombre, 255),
      f.orden,
      case
        when f.horas_por_unidad > 0
          then f.horas_por_unidad * greatest(coalesce(v_partida.cantidad_total, 0), 1)
        else null
      end,
      'ia',
      concat_ws(E'\n', f.descripcion, f.control_calidad)
    from public.sistema_rendimiento_fases f
    where f.sistema_id = v_partida.sistema_id
      and f.obligatoria is true
    order by f.orden;

    get diagnostics v_fases = row_count;

    if v_fases = 0 then
      insert into public.subtareas (
        tarea_id,
        descripcion_subtarea,
        orden,
        origen,
        notas
      ) values (
        v_tarea_id,
        'Ejecutar la partida segun el alcance aprobado',
        1,
        'ia',
        'Fases tecnicas pendientes de completar en la biblioteca de rendimientos.'
      );
    end if;

    v_creadas := v_creadas + 1;
    v_fin_plan := v_fin;
    v_cursor := public.sumar_dias_laborables(v_fin, 1);
  end loop;

  return jsonb_build_object(
    'success', true,
    'proyecto_id', p_proyecto_id,
    'tareas_creadas', v_creadas,
    'tareas_omitidas', v_omitidas,
    'fecha_inicio', v_inicio_plan,
    'fecha_fin', v_fin_plan
  );
end;
$$;

revoke all on function public.generar_plan_obra_desde_partidas(uuid, date) from public;
grant execute on function public.generar_plan_obra_desde_partidas(uuid, date)
  to authenticated, service_role;

-- El cronograma consume esta vista para combinar tareas y datos de empleado.
-- El grant se declara aquí para que los entornos nuevos no dependan de
-- permisos heredados o configurados manualmente.
grant select on public.v_tareas_ui, public.v_subtareas_ui
  to authenticated, service_role;

create or replace function public.generar_plan_al_convertir_presupuesto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.proyecto_id is not null
     and old.proyecto_id is distinct from new.proyecto_id then
    perform public.generar_plan_obra_desde_partidas(new.proyecto_id, null);
  end if;
  return new;
end;
$$;

drop trigger if exists presupuesto_emision_generar_plan_obra
  on public.presupuesto_emisiones;
create trigger presupuesto_emision_generar_plan_obra
after update of proyecto_id on public.presupuesto_emisiones
for each row execute function public.generar_plan_al_convertir_presupuesto();

comment on column public.tareas.obra_partida_id is
  'Partida contractual que origino la tarea operativa.';
comment on column public.tareas.origen_generacion is
  'Distingue tareas manuales de las generadas desde un presupuesto aceptado.';
comment on function public.generar_plan_obra_desde_partidas(uuid, date) is
  'Crea de forma idempotente tareas, subtareas y fechas iniciales desde las partidas de una obra.';
