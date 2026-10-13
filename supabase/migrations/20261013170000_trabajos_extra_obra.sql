-- Trabajos extra y desviaciones de obra.
-- Se mantienen separados del presupuesto original y solo generan una tarea
-- operativa cuando el encargado/admin registra la aprobacion del cliente.

create table if not exists public.proyecto_trabajos_extra (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  titulo text not null check (length(btrim(titulo)) > 0),
  descripcion text not null check (length(btrim(descripcion)) > 0),
  estancia text,
  causa text not null check (causa in ('cambio_cliente', 'vicio_oculto', 'error_ejecucion', 'imprevisto')),
  urgencia text not null default 'normal' check (urgencia in ('normal', 'alta', 'inmediata')),
  estado text not null default 'pendiente_valoracion'
    check (estado in ('pendiente_valoracion', 'pendiente_cliente', 'aprobado', 'rechazado')),
  importe_venta numeric(12,2) check (importe_venta is null or importe_venta >= 0),
  coste_estimado numeric(12,2) check (coste_estimado is null or coste_estimado >= 0),
  observaciones text,
  tarea_id uuid references public.tareas(id) on delete set null,
  creado_por uuid not null default auth.uid(),
  aprobado_por uuid,
  aprobado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proyecto_trabajos_extra_fotos (
  id uuid primary key default gen_random_uuid(),
  trabajo_extra_id uuid not null references public.proyecto_trabajos_extra(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  archivo_path text not null,
  nombre_archivo text,
  subido_por uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_trabajos_extra_proyecto_estado
  on public.proyecto_trabajos_extra(proyecto_id, estado, created_at desc);
create index if not exists idx_trabajos_extra_fotos_extra
  on public.proyecto_trabajos_extra_fotos(trabajo_extra_id, created_at);

alter table public.proyecto_trabajos_extra enable row level security;
alter table public.proyecto_trabajos_extra_fotos enable row level security;

grant select, insert, update, delete on public.proyecto_trabajos_extra to authenticated;
grant select, insert, update, delete on public.proyecto_trabajos_extra_fotos to authenticated;

drop policy if exists trabajos_extra_gestion on public.proyecto_trabajos_extra;
create policy trabajos_extra_gestion
on public.proyecto_trabajos_extra
for all to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

drop policy if exists trabajos_extra_fotos_gestion on public.proyecto_trabajos_extra_fotos;
create policy trabajos_extra_fotos_gestion
on public.proyecto_trabajos_extra_fotos
for all to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

-- Las tareas procedentes de un extra deben quedar identificadas para no
-- mezclarlas con las que nacieron del presupuesto aceptado.
alter table public.tareas drop constraint if exists tareas_origen_generacion_check;
alter table public.tareas
  add constraint tareas_origen_generacion_check
  check (origen_generacion in ('manual', 'presupuesto_aceptado', 'trabajo_extra'));

create or replace function public.aprobar_trabajo_extra(p_trabajo_extra_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_extra public.proyecto_trabajos_extra%rowtype;
  v_tarea_id uuid;
  v_orden integer;
begin
  if auth.uid() is null or not public.app_is_admin_or_encargado() then
    raise exception 'No tienes permiso para aprobar trabajos extra.';
  end if;

  select * into v_extra
  from public.proyecto_trabajos_extra
  where id = p_trabajo_extra_id
  for update;

  if not found then raise exception 'No se encontro el trabajo extra.'; end if;
  if v_extra.estado = 'rechazado' then raise exception 'El trabajo extra esta rechazado.'; end if;
  if coalesce(v_extra.importe_venta, 0) <= 0 then
    raise exception 'Debes indicar el importe aprobado por el cliente.';
  end if;

  if v_extra.tarea_id is not null then
    update public.proyecto_trabajos_extra
    set estado = 'aprobado', aprobado_por = auth.uid(), aprobado_at = coalesce(aprobado_at, now()), updated_at = now()
    where id = v_extra.id;
    return jsonb_build_object('success', true, 'tarea_id', v_extra.tarea_id, 'ya_existia', true);
  end if;

  select coalesce(max(orden), 0) + 1 into v_orden
  from public.tareas where proyecto_id = v_extra.proyecto_id;

  insert into public.tareas (
    proyecto_id, empleado_asignado_id, titulo, descripcion, estado,
    fecha_inicio, fecha_limite, orden, cantidad_medible, unidad_medible,
    obra_partida_id, origen_generacion, duracion_planificada_horas,
    inicio_planificado_at, fin_planificado_at
  ) values (
    v_extra.proyecto_id,
    null,
    left('[EXTRA] ' || btrim(v_extra.titulo), 255),
    concat_ws(E'\n',
      btrim(v_extra.descripcion),
      case when nullif(btrim(v_extra.estancia), '') is not null then 'Estancia o zona: ' || btrim(v_extra.estancia) end,
      'Causa: ' || replace(v_extra.causa, '_', ' '),
      'Trabajo adicional aprobado por el cliente. Pendiente de asignar equipo y horas.'
    ),
    'pendiente', null, null, v_orden, 1, 'ud', null, 'trabajo_extra', null, null, null
  ) returning id into v_tarea_id;

  update public.proyecto_trabajos_extra
  set estado = 'aprobado', tarea_id = v_tarea_id,
      aprobado_por = auth.uid(), aprobado_at = now(), updated_at = now()
  where id = v_extra.id;

  update public.proyectos
  set estado_planificacion = 'sin_planificar',
      planificacion_confirmada_at = null,
      planificacion_confirmada_por = null
  where id = v_extra.proyecto_id;

  return jsonb_build_object('success', true, 'tarea_id', v_tarea_id, 'ya_existia', false);
end;
$$;

grant execute on function public.aprobar_trabajo_extra(uuid) to authenticated;

comment on table public.proyecto_trabajos_extra is
  'Trabajos adicionales y desviaciones separados del alcance y presupuesto originales.';
comment on function public.aprobar_trabajo_extra(uuid) is
  'Registra la aprobacion del cliente y solo entonces crea la tarea operativa vinculada.';
