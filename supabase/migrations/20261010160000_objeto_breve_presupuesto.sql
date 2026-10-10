alter table public.visitas_presupuesto
  add column if not exists objeto_presupuesto text;

comment on column public.visitas_presupuesto.objeto_presupuesto is
  'Descripción breve y editable que se muestra como objeto en el presupuesto entregable al cliente.';
