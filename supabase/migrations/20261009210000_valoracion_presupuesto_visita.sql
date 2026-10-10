-- Valoracion economica manual del borrador de visita.
-- Los precios no se heredan de historicos ni de la biblioteca: deben revisarse
-- expresamente para cada presupuesto.

alter table public.visita_presupuesto_partidas
  add column if not exists precio_unitario numeric(14,4);

alter table public.visita_presupuesto_partidas
  drop constraint if exists visita_partida_precio_unitario_check;

alter table public.visita_presupuesto_partidas
  add constraint visita_partida_precio_unitario_check
  check (precio_unitario is null or precio_unitario >= 0);

comment on column public.visita_presupuesto_partidas.precio_unitario is
  'Precio unitario propuesto y revisado manualmente para esta visita. NULL significa pendiente de valorar.';
