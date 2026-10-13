-- Refuerza la conversión automática presupuesto -> partida -> tarea.
-- El técnico recibe un título operativo corto; el alcance contractual completo
-- y su contexto permanecen en la descripción de la tarea.

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
  v_nombre_sistema text;
  v_titulo_operativo text;
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
    select *
    from public.obras_partidas
    where obra_id = p_proyecto_id
      and activa is true
    order by orden, creado_at, id
  loop
    if exists (select 1 from public.tareas where obra_partida_id = v_partida.id) then
      v_omitidas := v_omitidas + 1;
      continue;
    end if;

    select nullif(btrim(sr.nombre), '')
      into v_nombre_sistema
    from public.sistemas_rendimiento sr
    where sr.id = v_partida.sistema_id;

    v_titulo_operativo := left(
      concat_ws(
        ' · ',
        nullif(btrim(v_partida.codigo), ''),
        coalesce(v_nombre_sistema, nullif(btrim(v_partida.descripcion), ''), 'Trabajo pendiente de clasificar')
      ),
      255
    );

    insert into public.tareas (
      proyecto_id, empleado_asignado_id, titulo, descripcion, estado,
      fecha_inicio, fecha_limite, orden, cantidad_medible, unidad_medible,
      obra_partida_id, origen_generacion, duracion_planificada_horas,
      inicio_planificado_at, fin_planificado_at
    ) values (
      p_proyecto_id,
      null,
      v_titulo_operativo,
      concat_ws(E'\n',
        nullif(btrim(v_partida.descripcion), ''),
        case when nullif(btrim(v_partida.capitulo), '') is not null
          then 'Capítulo: ' || btrim(v_partida.capitulo) end,
        case when nullif(btrim(v_partida.zona), '') is not null
          then 'Estancia o zona: ' || btrim(v_partida.zona) end,
        case when nullif(btrim(v_partida.fase_ejecucion), '') is not null
          then 'Fase de ejecución: ' || btrim(v_partida.fase_ejecucion) end,
        case when v_partida.cantidad_total is not null
          then 'Medición prevista: ' || trim(to_char(v_partida.cantidad_total, 'FM999999990.####'))
            || case when nullif(btrim(v_partida.unidad), '') is not null
              then ' ' || btrim(v_partida.unidad) else '' end end,
        'Origen: partida del presupuesto aceptado. Pendiente de asignar equipo y horas.'
      ),
      'pendiente',
      null,
      null,
      coalesce(v_partida.orden, 0),
      v_partida.cantidad_total,
      v_partida.unidad,
      v_partida.id,
      'presupuesto_aceptado',
      null,
      null,
      null
    ) returning id into v_tarea_id;

    insert into public.subtareas (
      tarea_id, descripcion_subtarea, orden, duracion_horas, origen, notas
    )
    select
      v_tarea_id,
      left(f.nombre, 255),
      f.orden,
      null,
      'ia',
      concat_ws(E'\n', f.descripcion, f.control_calidad)
    from public.sistema_rendimiento_fases f
    where f.sistema_id = v_partida.sistema_id
      and f.obligatoria is true
    order by f.orden;

    get diagnostics v_fases = row_count;
    if v_fases = 0 then
      insert into public.subtareas (
        tarea_id, descripcion_subtarea, orden, origen, notas
      ) values (
        v_tarea_id,
        'Ejecutar la partida según el alcance aprobado',
        1,
        'ia',
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
    'success', true,
    'proyecto_id', p_proyecto_id,
    'tareas_creadas', v_creadas,
    'tareas_omitidas', v_omitidas,
    'fecha_inicio', null,
    'fecha_fin', null
  );
end;
$$;

-- Acorta únicamente títulos automáticos que todavía conservan exactamente el
-- texto generado originalmente. Los títulos modificados por el encargado no
-- se sobrescriben.
update public.tareas t
set titulo = left(
  concat_ws(
    ' · ',
    nullif(btrim(op.codigo), ''),
    coalesce(nullif(btrim(sr.nombre), ''), nullif(btrim(op.descripcion), ''), t.titulo)
  ),
  255
)
from public.obras_partidas op
left join public.sistemas_rendimiento sr on sr.id = op.sistema_id
where t.obra_partida_id = op.id
  and t.origen_generacion = 'presupuesto_aceptado'
  and t.titulo = left(concat_ws(' · ', nullif(op.codigo, ''), op.descripcion), 255);

comment on function public.generar_plan_obra_desde_partidas(uuid, date) is
  'Crea tareas trazables desde partidas aceptadas: título operativo corto, alcance contractual completo, medición, contexto y fases técnicas.';
