alter table public.visitas_presupuesto
  add column if not exists ajustes_comerciales jsonb not null
  default '{"gastos_generales_pct": 0, "margen_pct": 0, "iva_pct": 21}'::jsonb;

alter table public.visitas_presupuesto
  drop constraint if exists visitas_presupuesto_ajustes_comerciales_object_check;

alter table public.visitas_presupuesto
  add constraint visitas_presupuesto_ajustes_comerciales_object_check
  check (jsonb_typeof(ajustes_comerciales) = 'object');

comment on column public.visitas_presupuesto.ajustes_comerciales is
  'Porcentajes editables de gastos generales, margen sobre coste e IVA del borrador de presupuesto.';
