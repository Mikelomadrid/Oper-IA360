-- Separa la estimacion del encargado de las horas reales calculadas por fichajes.
alter table public.tareas
  add column if not exists duracion_planificada_horas numeric(7,2),
  add column if not exists inicio_planificado_at timestamp with time zone,
  add column if not exists fin_planificado_at timestamp with time zone;

alter table public.tareas
  drop constraint if exists tareas_duracion_planificada_horas_check;
alter table public.tareas
  add constraint tareas_duracion_planificada_horas_check
  check (duracion_planificada_horas is null or duracion_planificada_horas > 0);

comment on column public.tareas.duracion_planificada_horas is
  'Duracion prevista por el encargado. No representa horas reales fichadas.';
comment on column public.tareas.inicio_planificado_at is
  'Inicio horario calculado para el cronograma operativo.';
comment on column public.tareas.fin_planificado_at is
  'Fin horario calculado para el cronograma operativo.';
