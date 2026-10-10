alter table public.visitas_presupuesto
  add column if not exists notas_cabecera_presupuesto text;

comment on column public.visitas_presupuesto.notas_cabecera_presupuesto is
  'Notas manuales opcionales que se muestran en la cabecera del presupuesto antes de las partidas.';
