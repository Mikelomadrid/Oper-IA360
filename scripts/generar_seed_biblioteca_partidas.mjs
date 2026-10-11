import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const projectRoot = path.resolve(import.meta.dirname, '..');
const workbookPath = path.join(projectRoot, 'docs', 'biblioteca-partidas', 'biblioteca_partidas_maestra.xlsx');
const outputPath = path.join(projectRoot, 'supabase', 'migrations', '20261009140000_importar_biblioteca_partidas_maestra.sql');

const workbook = XLSX.readFile(workbookPath, { cellDates: false });
const sheet = workbook.Sheets.Partidas;
if (!sheet) throw new Error('No existe la hoja Partidas en la biblioteca maestra.');

const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
const required = ['Capítulo', 'Categoría', 'Grupo', 'Código', 'Partida', 'Descripción normalizada', 'Unidad'];
for (const column of required) {
  if (!rows.some((row) => Object.hasOwn(row, column))) throw new Error(`Falta la columna obligatoria: ${column}`);
}

const clean = (value) => String(value ?? '').trim();
const sql = (value) => `'${clean(value).replaceAll("'", "''")}'`;
const categoryByChapter = new Map([
  ['1. Electricidad', 'electricidad'],
  ['2. Fontanería, saneamiento y baños', 'fontaneria_saneamiento_banos'],
  ['3. Cocinas', 'cocinas'],
  ['4. Albañilería', 'albanileria'],
  ['5. Pintura', 'pintura'],
  ['6. Carpintería y cerrajería', 'carpinteria_cerrajeria'],
  ['7. Cubiertas, impermeabilización y trabajos verticales', 'cubiertas_impermeabilizacion_verticales'],
  ['8. Climatización y calefacción', 'climatizacion_calefaccion'],
  ['9. Suelos y demoliciones', 'suelos_demoliciones'],
  ['10. Montajes, equipamiento, limpieza y jardinería', 'montajes_equipamiento_limpieza_jardineria'],
  ['11. Medios auxiliares, protecciones y residuos', 'medios_auxiliares_protecciones_residuos'],
  ['12. Mano de obra por horas y suministros', 'mano_obra_suministros'],
]);

const partidas = rows
  .map((row) => ({
    capitulo: clean(row['Capítulo']),
    categoriaDetalle: clean(row['Categoría']),
    grupo: clean(row.Grupo),
    codigo: clean(row['Código']),
    nombre: clean(row.Partida),
    descripcion: clean(row['Descripción normalizada']),
    unidad: clean(row.Unidad) || 'ud',
  }))
  .filter((row) => row.codigo && row.nombre);

const codes = new Set();
for (const partida of partidas) {
  const normalized = partida.codigo.toLowerCase();
  if (codes.has(normalized)) throw new Error(`Código duplicado: ${partida.codigo}`);
  codes.add(normalized);
}

const values = partidas.map((row) => `  (${[
  sql(row.codigo),
  sql(row.nombre),
  sql(categoryByChapter.get(row.capitulo) || 'otros'),
  sql(row.unidad),
  sql(row.descripcion),
  sql(row.capitulo),
  sql(row.categoriaDetalle),
  sql(row.grupo),
  sql('biblioteca_facturas_2025_2026'),
].join(', ')})`).join(',\n');

const migration = `-- Biblioteca maestra inicial de partidas extraída de las facturas 2025-2026.
-- Solo importa estructura técnica; los precios históricos se excluyen deliberadamente.

alter table public.sistemas_rendimiento
  add column if not exists capitulo text,
  add column if not exists categoria_detalle text,
  add column if not exists grupo text,
  add column if not exists origen text not null default 'manual';

create index if not exists sistemas_rendimiento_capitulo_idx
  on public.sistemas_rendimiento (capitulo, categoria_detalle, codigo);

comment on column public.sistemas_rendimiento.capitulo is
  'Capítulo principal de la biblioteca de partidas.';
comment on column public.sistemas_rendimiento.categoria_detalle is
  'Categoría técnica dentro del capítulo.';
comment on column public.sistemas_rendimiento.grupo is
  'Agrupación funcional de partidas equivalentes.';
comment on column public.sistemas_rendimiento.origen is
  'Procedencia de la ficha: manual, biblioteca histórica u otra importación controlada.';

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
values
${values}
on conflict ((lower(btrim(codigo)))) do update set
  nombre = excluded.nombre,
  categoria = excluded.categoria,
  unidad_base = excluded.unidad_base,
  descripcion = excluded.descripcion,
  capitulo = excluded.capitulo,
  categoria_detalle = excluded.categoria_detalle,
  grupo = excluded.grupo,
  origen = excluded.origen,
  updated_at = now();
`;

fs.writeFileSync(outputPath, migration, 'utf8');
console.log(JSON.stringify({ outputPath, partidas: partidas.length }, null, 2));
