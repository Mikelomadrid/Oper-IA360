import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function readEnv(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);
  const entries = {};
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

const url = development.VITE_SUPABASE_URL;
const key = development.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || !testUser.TEST_USER_EMAIL || !testUser.TEST_USER_PASSWORD) {
  throw new Error('Falta configuración local para la prueba segura.');
}

if (!url.includes('obigqojehfxxgfluygdg')) {
  throw new Error('Prueba bloqueada: la URL no corresponde a desarrollo-seguro.');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
  email: testUser.TEST_USER_EMAIL,
  password: testUser.TEST_USER_PASSWORD,
});

if (signInError || !signIn.session?.access_token) {
  throw new Error(`No se pudo iniciar la sesión de pruebas: ${signInError?.message || 'sin sesión'}`);
}

function normalizeRows(payload) {
  const candidates = [payload?.data, payload?.items, payload?.results, payload?.invoices, payload?.rows, payload];
  return candidates.find(Array.isArray) || [];
}

async function invoke(action) {
  const response = await fetch(`${url}/functions/v1/contasimple-readonly`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${signIn.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, fromDate: `${new Date().getUTCFullYear()}-01-01` }),
  });
  const payload = await response.json().catch(() => ({}));
  const rows = normalizeRows(payload?.data);
  return {
    action,
    httpStatus: response.status,
    ok: payload.ok === true,
    connected: payload.connected === true,
    configured: payload.configured === true,
    mode: payload.mode || null,
    code: payload.code || null,
    message: payload.message || null,
    count: rows.length,
    uniqueCount: new Set(rows.map((row) => row?.id).filter(Boolean)).size,
    pagesRead: payload?.meta?.pagesRead ?? null,
    truncated: payload?.meta?.truncated ?? null,
    complete: payload?.meta?.complete ?? null,
    truncatedReason: payload?.meta?.truncatedReason ?? null,
    totalAvailable: payload?.meta?.totalAvailable ?? null,
    fields: rows[0] && typeof rows[0] === 'object' ? Object.keys(rows[0]).sort() : [],
  };
}

try {
  const results = [];
  const requestedActions = process.argv.slice(2);
  const actions = requestedActions.length > 0 ? requestedActions : ['test', 'invoices', 'expenses'];
  for (const action of actions) {
    results.push(await invoke(action));
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await supabase.auth.signOut();
}
