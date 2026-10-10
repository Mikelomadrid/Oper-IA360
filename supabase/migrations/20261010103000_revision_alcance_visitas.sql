-- Decisiones del revisor de alcance de una visita.
-- Se guardan en la cabecera para poder recalcular las reglas sin duplicar partidas.

alter table public.visitas_presupuesto
  add column if not exists revision_alcance jsonb not null default '[]'::jsonb;

alter table public.visitas_presupuesto
  drop constraint if exists visitas_presupuesto_revision_alcance_array_check;

alter table public.visitas_presupuesto
  add constraint visitas_presupuesto_revision_alcance_array_check
  check (jsonb_typeof(revision_alcance) = 'array');

comment on column public.visitas_presupuesto.revision_alcance is
  'Decisiones del usuario sobre reglas preventivas del alcance: aceptada, descartada o pendiente.';
