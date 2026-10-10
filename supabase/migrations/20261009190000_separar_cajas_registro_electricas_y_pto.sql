-- Mantiene separadas las cajas eléctricas habituales de la caja destinada a alojar una PTO.
-- La manipulación de la fibra y de la propia PTO queda fuera del alcance de OrkaLED.

insert into public.sistemas_rendimiento (
  codigo,
  nombre,
  categoria,
  unidad_base,
  descripcion,
  capitulo,
  categoria_detalle,
  grupo,
  origen,
  estado,
  version,
  activo
)
values (
  '1.9.03',
  'Caja de registro para alojar PTO de fibra óptica',
  'electricidad',
  'ud',
  'Suministro e instalación de caja de registro empotrada para alojar posteriormente la PTO de fibra óptica, incluyendo apertura de hueco, colocación, recibido, fijación y remates. No incluye desconexión, manipulación ni reconexión de la fibra, ni traslado o colocación de la PTO, trabajos a cargo de la compañía de telecomunicaciones.',
  '1. Electricidad',
  '1.9 Telecomunicaciones y datos',
  'Cajas y registros de telecomunicaciones',
  'manual_validado',
  'validado',
  1,
  true
)
on conflict ((lower(btrim(codigo)))) do update set
  nombre = excluded.nombre,
  categoria = excluded.categoria,
  unidad_base = excluded.unidad_base,
  descripcion = excluded.descripcion,
  capitulo = excluded.capitulo,
  categoria_detalle = excluded.categoria_detalle,
  grupo = excluded.grupo,
  origen = excluded.origen,
  estado = excluded.estado,
  activo = excluded.activo,
  updated_at = now();

comment on table public.sistemas_rendimiento is
  'Biblioteca editable de sistemas, partidas y rendimientos de producción.';
