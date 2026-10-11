import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';


function readEnv(fileName) {
  const entries = {};
  const filePath = path.resolve(process.cwd(), fileName);
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}


const development = readEnv('.env.development.local');
const testUser = readEnv('.env.test-user.local');
const testTechnician = readEnv('.env.test-technician.local');
const url = development.VITE_SUPABASE_URL;
const key = development.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url?.includes('obigqojehfxxgfluygdg') || !key) {
  throw new Error('Configuración de desarrollo segura incompleta o proyecto incorrecto.');
}

const pdfPath = path.resolve(process.cwd(), 'output/pdf/Abono_prueba_A26-00573.pdf');
const image = `data:application/pdf;base64,${fs.readFileSync(pdfPath).toString('base64')}`;
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const candidates = [
  { label: 'usuario_pruebas', email: testUser.TEST_USER_EMAIL, password: testUser.TEST_USER_PASSWORD },
  { label: 'tecnico_pruebas', email: testTechnician.TEST_TECHNICIAN_EMAIL, password: testTechnician.TEST_TECHNICIAN_PASSWORD },
].filter((candidate) => candidate.email && candidate.password);

let signIn;
let signedInAs;
for (const candidate of candidates) {
  const result = await supabase.auth.signInWithPassword({ email: candidate.email, password: candidate.password });
  if (!result.error && result.data.session?.access_token) {
    signIn = result.data;
    signedInAs = candidate.label;
    break;
  }
}
if (!signIn?.session?.access_token) {
  throw new Error('No se pudo iniciar ninguna sesión local de pruebas.');
}

const response = await fetch(`${url}/functions/v1/analyze-invoice`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${signIn.session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ image }),
});

const body = await response.json().catch(() => ({}));
const { data: canManage, error: roleError } = await supabase.rpc('app_is_admin_or_encargado');
console.log(JSON.stringify({
  signedInAs,
  status: response.status,
  ok: response.ok,
  canManage: roleError ? null : canManage,
  body,
}, null, 2));
process.exit(0);
