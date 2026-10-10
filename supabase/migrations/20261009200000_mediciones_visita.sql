-- Cuaderno de mediciones asociado al borrador de cada visita.
-- Se conserva como JSONB porque forma parte del documento de trabajo de la visita
-- y debe poder evolucionar sin perder la transcripcion ni las correcciones humanas.

alter table public.visitas_presupuesto
  add column if not exists mediciones jsonb not null default '[]'::jsonb;

alter table public.visitas_presupuesto
  drop constraint if exists visitas_presupuesto_mediciones_array_check;

alter table public.visitas_presupuesto
  add constraint visitas_presupuesto_mediciones_array_check
  check (jsonb_typeof(mediciones) = 'array');

comment on column public.visitas_presupuesto.mediciones is
  'Mediciones estructuradas extraidas de la transcripcion o introducidas manualmente, con formula, procedencia y estado de revision.';
