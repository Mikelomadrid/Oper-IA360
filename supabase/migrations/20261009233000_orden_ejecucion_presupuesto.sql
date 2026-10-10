-- Secuencia de actuación para presupuestos nacidos de una visita.

alter table public.visita_presupuesto_partidas
  add column if not exists fase_ejecucion text;

alter table public.visita_presupuesto_partidas
  add column if not exists orden_ejecucion integer;

alter table public.visita_presupuesto_partidas
  drop constraint if exists visita_partida_fase_ejecucion_check;

alter table public.visita_presupuesto_partidas
  add constraint visita_partida_fase_ejecucion_check
  check (fase_ejecucion is null or fase_ejecucion in (
    'protecciones', 'contenedor', 'demoliciones', 'albanileria',
    'instalaciones', 'cerramientos', 'impermeabilizacion', 'revestimientos',
    'carpinteria', 'acabados', 'remates', 'pruebas_limpieza', 'pendiente'
  ));

alter table public.visita_presupuesto_partidas
  drop constraint if exists visita_partida_orden_ejecucion_check;

alter table public.visita_presupuesto_partidas
  add constraint visita_partida_orden_ejecucion_check
  check (orden_ejecucion is null or orden_ejecucion >= 0);

update public.visita_presupuesto_partidas
set
  fase_ejecucion = case
    when codigo_snapshot in ('11.1.01', '11.1.02') then 'protecciones'
    when codigo_snapshot in ('11.1.03', '11.1.04', '11.1.05') then 'contenedor'
    when codigo_snapshot like '9.2%' then 'demoliciones'
    when codigo_snapshot like '4.4%' then 'albanileria'
    when codigo_snapshot like '4.2%' then 'cerramientos'
    when codigo_snapshot = '4.1.04' then 'impermeabilizacion'
    when codigo_snapshot like '4.1%' then 'revestimientos'
    when codigo_snapshot like '6.%' then 'carpinteria'
    when codigo_snapshot like '5.%' then 'acabados'
    when codigo_snapshot like '1.%' or codigo_snapshot like '2.%' then 'instalaciones'
    else 'pendiente'
  end,
  orden_ejecucion = case
    when codigo_snapshot in ('11.1.01', '11.1.02') then 10
    when codigo_snapshot in ('11.1.03', '11.1.04', '11.1.05') then 20
    when codigo_snapshot like '9.2%' then 30
    when codigo_snapshot like '4.4%' then 40
    when codigo_snapshot like '1.%' or codigo_snapshot like '2.%' then 50
    when codigo_snapshot like '4.2%' then 60
    when codigo_snapshot = '4.1.04' then 70
    when codigo_snapshot like '4.1%' then 80
    when codigo_snapshot like '6.%' then 90
    when codigo_snapshot like '5.%' then 100
    else 999
  end
where fase_ejecucion is null or orden_ejecucion is null;

create index if not exists visita_presupuesto_partidas_ejecucion_idx
  on public.visita_presupuesto_partidas (visita_id, orden_ejecucion, orden);

comment on column public.visita_presupuesto_partidas.fase_ejecucion is
  'Fase editable que determina el orden real de actuación de la partida dentro de la obra.';

comment on column public.visita_presupuesto_partidas.orden_ejecucion is
  'Orden numérico de la fase de ejecución; no sustituye al capítulo técnico de la biblioteca.';
