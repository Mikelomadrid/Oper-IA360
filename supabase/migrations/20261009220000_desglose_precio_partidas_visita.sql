-- Desglose técnico de precios para partidas compuestas.

alter table public.visita_presupuesto_partidas
  add column if not exists desglose_precio jsonb not null default '[]'::jsonb;

alter table public.visita_presupuesto_partidas
  drop constraint if exists visita_partida_desglose_precio_array_check;

alter table public.visita_presupuesto_partidas
  add constraint visita_partida_desglose_precio_array_check
  check (jsonb_typeof(desglose_precio) = 'array');

-- Prepara el desglose de la partida existente de líneas de fuerza. La línea de
-- 6 mm² se conserva como alternativa y, con cantidad 0, no suma al presupuesto.
update public.visita_presupuesto_partidas
set desglose_precio = jsonb_build_array(
  jsonb_build_object(
    'id', 'linea-25mm',
    'concepto', 'Línea eléctrica con conductores de 2,5 mm²',
    'cantidad', 4,
    'unidad', 'ud',
    'precio_unitario', null,
    'es_alternativa', false
  ),
  jsonb_build_object(
    'id', 'linea-4mm',
    'concepto', 'Línea para vitrocerámica con conductores de 4 mm²',
    'cantidad', 1,
    'unidad', 'ud',
    'precio_unitario', null,
    'es_alternativa', false
  ),
  jsonb_build_object(
    'id', 'linea-6mm',
    'concepto', 'Línea compartida de vitrocerámica y horno con conductores de 6 mm²',
    'cantidad', 0,
    'unidad', 'ud',
    'precio_unitario', null,
    'es_alternativa', true
  )
)
where codigo_snapshot = '1.7.15'
  and desglose_precio = '[]'::jsonb;

comment on column public.visita_presupuesto_partidas.desglose_precio is
  'Componentes de valoración de una partida compuesta: concepto, cantidad, unidad, precio unitario y condición de alternativa.';
