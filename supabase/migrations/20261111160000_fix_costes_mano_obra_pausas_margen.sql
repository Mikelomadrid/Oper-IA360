-- Unifica el cálculo de costes de mano de obra con el cálculo efectivo de fichajes.
-- Regla: horas netas = fichaje bruto - pausas; el margen diario de 45 minutos no se imputa
-- como coste ni se considera hora extra.

create or replace view public.ui_v_proyecto_mano_obra_detalle_v2 as
with pausas_por_fichaje as (
  select
    p.fichaje_id,
    coalesce(sum(greatest(extract(epoch from (coalesce(p.hora_fin_pausa, now()) - p.hora_inicio_pausa)), 0)), 0) as pausa_segundos
  from public.pausas p
  group by p.fichaje_id
), fichajes_efectivos as (
  select
    ch.id as fichaje_id,
    date(coalesce(ch.hora_entrada_madrid, ch.hora_entrada)) as dia,
    ch.proyecto_id,
    ch.empleado_id,
    greatest(
      extract(epoch from (coalesce(ch.hora_salida_madrid, now() at time zone 'Europe/Madrid') - ch.hora_entrada_madrid))
      - coalesce(pp.pausa_segundos, 0),
      0
    ) / 3600.0 as horas_net
  from public.control_horario ch
  left join pausas_por_fichaje pp on pp.fichaje_id = ch.id
), resumen_dia as (
  select
    dia,
    empleado_id,
    sum(horas_net) as horas_net_dia,
    case
      when extract(isodow from dia) in (6, 7) then 0.0
      when extract(isodow from dia) between 1 and 4 then 8.5
      when public.es_jornada_intensiva(dia) then 7.0
      when extract(isodow from dia) = 5 then 6.0
      else 0.0
    end as jornada_objetivo,
    0.75::numeric as margen_horas
  from fichajes_efectivos
  group by dia, empleado_id
), por_proyecto_dia as (
  select
    f.dia,
    f.proyecto_id,
    f.empleado_id,
    sum(f.horas_net) as horas_net_proyecto,
    d.horas_net_dia,
    d.jornada_objetivo,
    d.margen_horas,
    least(d.horas_net_dia, d.jornada_objetivo) as horas_normales_dia,
    case
      when d.horas_net_dia - d.jornada_objetivo >= 1.0
        then d.horas_net_dia - d.jornada_objetivo
      else 0
    end as horas_extras_dia
  from fichajes_efectivos f
  join resumen_dia d on d.dia = f.dia and d.empleado_id = f.empleado_id
  where f.proyecto_id is not null
  group by
    f.dia, f.proyecto_id, f.empleado_id,
    d.horas_net_dia, d.jornada_objetivo, d.margen_horas
), tarifas as (
  select
    e.id as empleado_id,
    e.nombre as empleado,
    coalesce(e.costo_por_hora, 0)::numeric as coste_hora_normal,
    case when e.nombre ilike 'FRAN%' then 17.40 else 14.19 end::numeric as coste_hora_extra
  from public.empleados e
)
select
  p.dia,
  p.proyecto_id,
  p.empleado_id,
  t.empleado,
  round(
    case when p.horas_net_dia > 0 then
      (p.horas_normales_dia + p.horas_extras_dia) * p.horas_net_proyecto / p.horas_net_dia
    else 0 end,
    2
  ) as horas_totales,
  round(case when p.horas_net_dia > 0 then p.horas_normales_dia * p.horas_net_proyecto / p.horas_net_dia else 0 end, 2) as horas_normales,
  round(case when p.horas_net_dia > 0 then p.horas_extras_dia * p.horas_net_proyecto / p.horas_net_dia else 0 end, 2) as horas_extras,
  round(t.coste_hora_normal, 2) as coste_hora_normal,
  round(t.coste_hora_extra, 2) as coste_hora_extra,
  round((case when p.horas_net_dia > 0 then p.horas_normales_dia * p.horas_net_proyecto / p.horas_net_dia else 0 end) * t.coste_hora_normal, 2) as coste_horas_normales,
  round((case when p.horas_net_dia > 0 then p.horas_extras_dia * p.horas_net_proyecto / p.horas_net_dia else 0 end) * t.coste_hora_extra, 2) as coste_horas_extras,
  round(
    (case when p.horas_net_dia > 0 then p.horas_normales_dia * p.horas_net_proyecto / p.horas_net_dia else 0 end) * t.coste_hora_normal
    + (case when p.horas_net_dia > 0 then p.horas_extras_dia * p.horas_net_proyecto / p.horas_net_dia else 0 end) * t.coste_hora_extra,
    2
  ) as coste_total_dia
from por_proyecto_dia p
join tarifas t on t.empleado_id = p.empleado_id;

create or replace view public.ui_v_proyecto_mano_obra_totales_v2 as
select
  proyecto_id,
  round(coalesce(sum(horas_totales), 0), 2) as total_horas,
  round(coalesce(sum(coste_total_dia), 0), 2) as coste_total_mano_obra
from public.ui_v_proyecto_mano_obra_detalle_v2
group by proyecto_id;

-- Vistas antiguas que todavía pueden alimentar cuadros de mando históricos.
create or replace view public.v_coste_mano_obra_por_proyecto as
select
  proyecto_id,
  round(coalesce(sum(horas_totales), 0), 2) as total_horas,
  round(coalesce(sum(coste_total_dia), 0), 2) as coste_total_mano_obra,
  count(distinct empleado_id) as empleados_distintos
from public.ui_v_proyecto_mano_obra_detalle_v2
group by proyecto_id;

create or replace view public.v_proyecto_mano_obra_totales as
select
  proyecto_id,
  total_horas,
  coste_total_mano_obra
from public.ui_v_proyecto_mano_obra_totales_v2;

create or replace view public.v_proyecto_mano_obra_por_empleado as
select
  d.proyecto_id,
  p.nombre_proyecto,
  d.empleado_id,
  coalesce(e.nombre || coalesce(' ' || e.apellidos, ''), e.email) as empleado,
  round(coalesce(sum(d.horas_totales), 0), 2)::numeric(12,2) as total_horas,
  round(coalesce(sum(d.coste_total_dia), 0), 2)::numeric(12,2) as coste_total
from public.ui_v_proyecto_mano_obra_detalle_v2 d
join public.proyectos p on p.id = d.proyecto_id
left join public.empleados e on e.id = d.empleado_id
group by d.proyecto_id, p.nombre_proyecto, d.empleado_id, e.nombre, e.apellidos, e.email
order by p.nombre_proyecto, empleado;
