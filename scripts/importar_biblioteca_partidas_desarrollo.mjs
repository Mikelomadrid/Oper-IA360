import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const projectRoot = path.resolve(import.meta.dirname, '..');

const readEnv = (fileName) => Object.fromEntries(
  fs.readFileSync(path.join(projectRoot, fileName), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
      return [key, value];
    }),
);

const development = readEnv('.env.development.local');
const credentials = readEnv('.env.test-user.local');
if (!development.VITE_SUPABASE_URL || !development.VITE_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Falta la configuración de Supabase de desarrollo.');
}
if (!credentials.TEST_USER_EMAIL || !credentials.TEST_USER_PASSWORD) {
  throw new Error('Faltan las credenciales del usuario de pruebas.');
}
if (!development.VITE_SUPABASE_URL.includes(development.VITE_EXPECTED_SUPABASE_REF)) {
  throw new Error('La URL configurada no coincide con el proyecto de desarrollo esperado.');
}

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

const workbook = XLSX.readFile(path.join(projectRoot, 'docs', 'biblioteca-partidas', 'biblioteca_partidas_maestra.xlsx'));
const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Partidas, { defval: '' });
const clean = (value) => String(value ?? '').trim();
const partidas = rows.map((row) => {
  const capitulo = clean(row['Capítulo']);
  return {
    codigo: clean(row['Código']),
    nombre: clean(row.Partida),
    categoria: categoryByChapter.get(capitulo) || 'otros',
    unidad_base: clean(row.Unidad) || 'ud',
    descripcion: clean(row['Descripción normalizada']) || null,
    capitulo: capitulo || null,
    categoria_detalle: clean(row['Categoría']) || null,
    grupo: clean(row.Grupo) || null,
    origen: 'biblioteca_facturas_2025_2026',
    estado: 'borrador',
    version: 1,
    activo: true,
  };
}).filter((row) => row.codigo && row.nombre);

const supabase = createClient(
  development.VITE_SUPABASE_URL,
  development.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { error: signInError } = await supabase.auth.signInWithPassword({
  email: credentials.TEST_USER_EMAIL,
  password: credentials.TEST_USER_PASSWORD,
});
if (signInError) throw signInError;

const { data: existing, error: existingError } = await supabase
  .from('sistemas_rendimiento')
  .select('codigo');
if (existingError) throw existingError;

const existingCodes = new Set((existing || []).map((row) => clean(row.codigo).toLowerCase()));
const pending = partidas.filter((row) => !existingCodes.has(row.codigo.toLowerCase()));

let inserted = 0;
for (let index = 0; index < pending.length; index += 50) {
  const batch = pending.slice(index, index + 50);
  const { error } = await supabase.from('sistemas_rendimiento').insert(batch);
  if (error) throw error;
  inserted += batch.length;
}

const { count, error: countError } = await supabase
  .from('sistemas_rendimiento')
  .select('id', { count: 'exact', head: true })
  .eq('origen', 'biblioteca_facturas_2025_2026');
if (countError) throw countError;

await supabase.auth.signOut();
console.log(JSON.stringify({ fuente: partidas.length, existentes: partidas.length - pending.length, insertadas: inserted, verificadas: count }, null, 2));
