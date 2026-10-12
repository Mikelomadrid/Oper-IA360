-- Tarifa interna ordinaria acordada para el control de costes de obra.
-- Las horas extra, festivas y nocturnas conservan sus tarifas especificas.

alter table public.empleados
  alter column costo_por_hora set default 27.00;

update public.empleados
set costo_por_hora = 27.00
where costo_por_hora is distinct from 27.00;

update public.costes_horarios
set coste_hora = 27.00,
    updated_at = now()
where tipo_hora = 'ordinaria'
  and coste_hora is distinct from 27.00;

alter table public.sistema_rendimiento_mano_obra
  alter column coste_hora_referencia set default 27.00;

update public.sistema_rendimiento_mano_obra
set coste_hora_referencia = 27.00,
    updated_at = now()
where coste_hora_referencia is null
   or coste_hora_referencia = 0;

comment on column public.empleados.costo_por_hora is
  'Coste interno ordinario por hora utilizado para imputar mano de obra a las obras. Base vigente: 27 EUR/h.';
