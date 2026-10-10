-- Relaciona cada partida propuesta con la medicion JSON que alimenta su cantidad.
-- El identificador es texto porque las mediciones pertenecen al cuaderno JSON de la visita.

alter table public.visita_presupuesto_partidas
  add column if not exists medicion_id text;

create index if not exists visita_presupuesto_partidas_medicion_idx
  on public.visita_presupuesto_partidas (visita_id, medicion_id)
  where medicion_id is not null;

comment on column public.visita_presupuesto_partidas.medicion_id is
  'Identificador estable de la medicion del cuaderno que sincroniza cantidad y unidad de esta partida.';
