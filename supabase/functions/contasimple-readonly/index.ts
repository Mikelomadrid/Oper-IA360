import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ACTIONS = new Set([
  'test',
  'invoices',
  'expenses',
  'summary',
  'estimates',
  'products',
]);

const CONTASIMPLE_API_BASE = 'https://api.contasimple.com/api/v2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function getContasimpleToken(apiKey: string) {
  const response = await fetch(`${CONTASIMPLE_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authentication_key',
      key: apiKey,
    }),
  });

  if (!response.ok) {
    throw new Error(`Contasimple rechazó la autenticación (${response.status}).`);
  }

  const payload = await response.json();
  if (!payload?.access_token) {
    throw new Error('Contasimple no devolvió un token de acceso.');
  }

  return payload.access_token as string;
}

async function callContasimple(token: string, endpoint: string) {
  const response = await fetch(`${CONTASIMPLE_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`La consulta a Contasimple falló (${response.status}).`);
  }

  return response.json();
}

function normalizeRows(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const candidates = [record.data, record.items, record.results, record.invoices, record.rows];
  return candidates.find(Array.isArray) || [];
}

async function readInvoicePages(token: string, resource: 'issued' | 'received', fromDate: string) {
  const pageSize = 50;
  const maxPages = 20;
  const rows: unknown[] = [];
  const seenIds = new Set<string>();
  let pagesRead = 0;
  let truncated = false;
  let truncatedReason: 'repeated_page' | 'safety_limit' | null = null;

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await callContasimple(
      token,
      `/accounting/invoices/${resource}/from?date=${encodeURIComponent(fromDate)}&page=${page}&pageSize=${pageSize}`,
    );
    const pageRows = normalizeRows(result);
    pagesRead = page;

    const uniqueRows = pageRows.filter((row) => {
      const rawId = row && typeof row === 'object' ? (row as Record<string, unknown>).id : null;
      if (rawId === null || rawId === undefined || rawId === '') return true;
      const id = String(rawId);
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    if (pageRows.length > 0 && uniqueRows.length === 0) {
      truncated = true;
      truncatedReason = 'repeated_page';
      break;
    }

    rows.push(...uniqueRows);

    if (pageRows.length < pageSize) break;
    if (page === maxPages) {
      truncated = true;
      truncatedReason = 'safety_limit';
    }
  }

  return { rows, pagesRead, truncated, truncatedReason };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, code: 'method_not_allowed', message: 'Método no permitido.' }, 405);
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ ok: false, code: 'unauthorized', message: 'Sesión requerida.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ ok: false, code: 'backend_not_configured', message: 'El backend no está configurado.' }, 503);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });

    const userAccessToken = authorization.slice('Bearer '.length);
    const { data: userData, error: userError } = await supabase.auth.getUser(userAccessToken);
    if (userError || !userData.user) {
      return json({ ok: false, code: 'invalid_session', message: 'La sesión no es válida.' }, 401);
    }

    const { data: employee, error: employeeError } = await supabase
      .from('empleados')
      .select('rol, activo')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();

    if (employeeError || !employee || employee.activo === false) {
      return json({ ok: false, code: 'forbidden', message: 'Usuario sin acceso al conector.' }, 403);
    }

    if (!['admin', 'encargado'].includes(employee.rol)) {
      return json({ ok: false, code: 'forbidden', message: 'Solo administración puede consultar Contasimple.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === 'string' ? body.action : 'test';

    if (!ALLOWED_ACTIONS.has(action)) {
      return json({ ok: false, code: 'read_only', message: 'Acción bloqueada por el modo solo lectura.' }, 403);
    }

    const apiKey = Deno.env.get('CONTASIMPLE_API_KEY');

    if (!apiKey) {
      return json({
        ok: false,
        code: 'missing_api_key',
        message: 'Falta configurar la clave de Contasimple.',
      }, 503);
    }

    const contasimpleToken = await getContasimpleToken(apiKey);

    if (action === 'test') {
      return json({
        ok: true,
        provider: 'contasimple',
        mode: 'read_only',
        configured: true,
        connected: true,
        keyExposed: false,
        message: 'Conexión segura con Contasimple verificada.',
      });
    }

    const fromDate = typeof body?.fromDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.fromDate)
      ? body.fromDate
      : `${new Date().getUTCFullYear()}-01-01`;

    if (action === 'invoices' || action === 'expenses') {
      const resource = action === 'invoices' ? 'issued' : 'received';
      const result = await readInvoicePages(contasimpleToken, resource, fromDate);

      return json({
        ok: true,
        provider: 'contasimple',
        mode: 'read_only',
        action,
        data: result.rows,
        meta: {
          fromDate,
          count: result.rows.length,
          pagesRead: result.pagesRead,
          truncated: result.truncated,
          complete: !result.truncated,
          truncatedReason: result.truncatedReason,
        },
      });
    }

    // No se consulta todavía la API externa hasta confirmar con Contasimple la
    // URL base, el esquema de autenticación y los endpoints oficiales.
    return json({
      ok: false,
      code: 'endpoint_pending',
      mode: 'read_only',
      message: 'Esta consulta todavía no está habilitada en el conector de solo lectura.',
    }, 501);
  } catch (error) {
    console.error('contasimple-readonly:', error instanceof Error ? error.message : error);
    return json({ ok: false, code: 'internal_error', message: 'No se pudo comprobar la conexión.' }, 500);
  }
});
