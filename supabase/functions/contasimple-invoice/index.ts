import { createClient } from 'npm:@supabase/supabase-js@2';

const CONTASIMPLE_API_BASE = 'https://api.contasimple.com/api/v2';
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Error desconocido');
}

function normalizeText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase();
}

function periodFromDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error('La fecha de la factura no es válida.');
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-${quarter}T`;
}

function extractRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const data = record.data;
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (data && typeof data === 'object') {
    const nested = data as Record<string, unknown>;
    for (const key of ['items', 'rows', 'results', 'invoices']) {
      if (Array.isArray(nested[key])) return nested[key] as Array<Record<string, unknown>>;
    }
  }
  for (const key of ['items', 'rows', 'results', 'invoices']) {
    if (Array.isArray(record[key])) return record[key] as Array<Record<string, unknown>>;
  }
  return [];
}

function extractOcrRequest(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const candidate = record.data && typeof record.data === 'object'
    ? record.data as Record<string, unknown>
    : record;
  return candidate;
}

function safeFilename(sourceUrl: string, contentType: string) {
  const extensionByType: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  try {
    const raw = decodeURIComponent(new URL(sourceUrl).pathname.split('/').pop() || 'factura');
    if (/\.(pdf|jpe?g|png|webp)$/i.test(raw)) return raw.replace(/[^a-zA-Z0-9._-]/g, '_');
  } catch {
    // Se usa el nombre seguro por defecto.
  }
  return `factura.${extensionByType[contentType] || 'bin'}`;
}

function validateDocumentUrl(sourceUrl: string, supabaseUrl: string) {
  const source = new URL(sourceUrl);
  const project = new URL(supabaseUrl);
  const expectedPrefix = '/storage/v1/object/public/facturas_ocr/';
  if (source.origin !== project.origin || !source.pathname.startsWith(expectedPrefix)) {
    throw new Error('La factura no apunta al almacén autorizado facturas_ocr.');
  }
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
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(`ContaSimple rechazó la autenticación (${response.status}).`);
  }
  return payload.access_token as string;
}

async function callContasimple(token: string, endpoint: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept-Language', 'es-ES');
  const response = await fetch(`${CONTASIMPLE_API_BASE}${endpoint}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.errorMessage || payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(`ContaSimple devolvió un error: ${detail}`);
  }
  return payload;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const apiKey = Deno.env.get('CONTASIMPLE_API_KEY');
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !apiKey) {
      return json({ ok: false, code: 'backend_not_configured', message: 'El conector no está configurado.' }, 503);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const userAccessToken = authorization.slice('Bearer '.length);
    const { data: userData, error: userError } = await userClient.auth.getUser(userAccessToken);
    if (userError || !userData.user) {
      return json({ ok: false, code: 'invalid_session', message: 'La sesión no es válida.' }, 401);
    }

    let { data: employee, error: employeeError } = await adminClient
      .from('empleados')
      .select('id, rol, activo, baja')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();

    // Algunas cuentas antiguas pueden conservar el correo correcto aunque el
    // vínculo auth_user_id no se haya propagado todavía. El fallback sigue
    // exigiendo una cuenta autenticada y un empleado activo con rol permitido.
    if (!employee && !employeeError && userData.user.email) {
      const fallback = await adminClient
        .from('empleados')
        .select('id, rol, activo, baja')
        .ilike('email', userData.user.email.trim())
        .maybeSingle();
      employee = fallback.data;
      employeeError = fallback.error;
    }
    if (employeeError || !employee || employee.activo === false || employee.baja === true) {
      return json({ ok: false, code: 'forbidden', message: 'Usuario sin acceso al conector.' }, 403);
    }
    if (!['admin', 'encargado'].includes(employee.rol)) {
      return json({ ok: false, code: 'forbidden', message: 'Solo administración puede enviar facturas.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const facturaId = typeof body?.facturaId === 'string' ? body.facturaId : '';
    const action = body?.action;
    if (!['upload', 'status'].includes(action)) {
      return json({ ok: false, code: 'invalid_action', message: 'Acción no válida.' }, 400);
    }
    if (!/^[0-9a-f-]{36}$/i.test(facturaId)) {
      return json({ ok: false, code: 'invalid_invoice', message: 'Factura no válida.' }, 400);
    }

    const [{ data: invoice, error: invoiceError }, { data: ocr, error: ocrError }, { data: control, error: controlError }] = await Promise.all([
      adminClient.from('facturas_gastos').select('id, imagen_url, estado_contabilidad').eq('id', facturaId).maybeSingle(),
      adminClient.from('facturas_gastos_ocr')
        .select('proveedor_nombre, proveedor_nif, numero_factura, fecha_factura, total, validacion_estado')
        .eq('factura_id', facturaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminClient.from('facturas_gastos_contasimple_control').select('*').eq('factura_id', facturaId).maybeSingle(),
    ]);
    if (invoiceError || ocrError || controlError) throw invoiceError || ocrError || controlError;
    if (!invoice || !ocr || !control) {
      return json({ ok: false, code: 'invoice_not_ready', message: 'No se encontró la factura completa o su control de ContaSimple.' }, 404);
    }

    const token = await getContasimpleToken(apiKey);

    if (action === 'status') {
      if (!control.contasimple_ocr_request_id) {
        return json({ ok: false, code: 'request_not_found', message: 'La factura todavía no tiene un envío OCR.' }, 409);
      }
      const statusPayload = await callContasimple(token, `/ocr/${encodeURIComponent(String(control.contasimple_ocr_request_id))}`);
      const ocrRequest = extractOcrRequest(statusPayload);
      if (!ocrRequest?.status) throw new Error('ContaSimple no devolvió el estado de la petición OCR.');

      const { data: updated, error: updateError } = await adminClient.rpc('flopy_actualizar_resultado_ocr_contasimple', {
        p_factura_id: facturaId,
        p_contasimple_ocr_status: String(ocrRequest.status),
        p_contasimple_document_id: ocrRequest.createdDocumentId || null,
        p_contasimple_document_number: ocrRequest.createdDocumentNumber || null,
        p_contasimple_document_amount: ocrRequest.createdDocumentAmount || null,
        p_error: ocrRequest.errorMessage || null,
        p_raw_contasimple: statusPayload,
      });
      if (updateError) throw updateError;

      if (String(ocrRequest.status).toLowerCase() === 'done' && ocrRequest.createdDocumentId) {
        await adminClient.from('facturas_gastos').update({
          contasimple_id: String(ocrRequest.createdDocumentId),
          contasimple_error: null,
          estado_contabilidad: 'enviada',
        }).eq('id', facturaId);
      }

      return json({
        ok: true,
        action: 'status',
        facturaId,
        status: ocrRequest.status,
        documentId: ocrRequest.createdDocumentId || null,
        documentNumber: ocrRequest.createdDocumentNumber || null,
        documentAmount: ocrRequest.createdDocumentAmount || null,
        state: updated?.estado_nuevo || control.estado,
      });
    }

    if (control.estado !== 'lista_para_contasimple') {
      return json({
        ok: false,
        code: 'invalid_state',
        message: 'Esta factura ya se envió o necesita revisión antes de enviarla.',
        state: control.estado,
      }, 409);
    }
    if (control.contasimple_ocr_request_id || control.contasimple_document_id) {
      return json({ ok: false, code: 'already_sent', message: 'La factura ya tiene identificador de ContaSimple.' }, 409);
    }
    if (ocr.validacion_estado !== 'validado') {
      return json({ ok: false, code: 'invoice_not_validated', message: 'La factura debe estar validada antes de enviarla.' }, 409);
    }
    if (!ocr.proveedor_nif || !ocr.numero_factura || !ocr.fecha_factura || !ocr.total) {
      return json({ ok: false, code: 'missing_data', message: 'Faltan NIF, número, fecha o total de la factura.' }, 409);
    }

    const period = periodFromDate(ocr.fecha_factura);
    const duplicateQuery = new URLSearchParams({
      startIndex: '0',
      numRows: '20',
      number: ocr.numero_factura,
      nif: ocr.proveedor_nif,
    });
    const duplicatePayload = await callContasimple(token, `/accounting/${encodeURIComponent(period)}/invoices/received?${duplicateQuery}`);
    const duplicate = extractRows(duplicatePayload).find((row) => {
      const number = row.number ?? row.invoiceNumber ?? row.documentNumber;
      const nif = row.issuerNif ?? row.supplierNif ?? row.nif ?? row.entityNif;
      const total = Number(row.totalAmount ?? row.amount ?? row.total ?? 0);
      return normalizeText(number) === normalizeText(ocr.numero_factura)
        && normalizeText(nif) === normalizeText(ocr.proveedor_nif)
        && Math.abs(total - Number(ocr.total)) <= 0.02;
    });

    if (duplicate) {
      await adminClient.from('facturas_gastos_contasimple_control').update({
        estado: 'posible_duplicado_contasimple',
        observaciones: 'Coincidencia encontrada por NIF, número e importe antes del envío OCR.',
        raw_contasimple: { duplicate },
        updated_at: new Date().toISOString(),
      }).eq('factura_id', facturaId);
      return json({
        ok: false,
        code: 'possible_duplicate',
        message: 'ContaSimple ya contiene una factura con el mismo proveedor, número e importe.',
      }, 409);
    }

    validateDocumentUrl(invoice.imagen_url, supabaseUrl);
    const documentResponse = await fetch(invoice.imagen_url, { redirect: 'error' });
    if (!documentResponse.ok) throw new Error(`No se pudo descargar el documento original (${documentResponse.status}).`);
    const contentLength = Number(documentResponse.headers.get('content-length') || 0);
    if (contentLength > MAX_DOCUMENT_BYTES) throw new Error('El documento supera el máximo de 20 MB.');
    const documentBytes = new Uint8Array(await documentResponse.arrayBuffer());
    if (documentBytes.byteLength === 0 || documentBytes.byteLength > MAX_DOCUMENT_BYTES) {
      throw new Error('El documento está vacío o supera el máximo de 20 MB.');
    }
    const contentType = (documentResponse.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new Error(`Formato no permitido para OCR: ${contentType || 'desconocido'}.`);
    }

    const form = new FormData();
    form.append('file', new Blob([documentBytes], { type: contentType }), safeFilename(invoice.imagen_url, contentType));
    form.append('period', period);
    form.append('comments', `ERP IA360 · factura ${facturaId}`);

    const uploadPayload = await callContasimple(token, '/ocr/receivedInvoice', {
      method: 'POST',
      body: form,
    });
    const ocrRequest = extractOcrRequest(uploadPayload);
    if (!ocrRequest?.id) throw new Error('ContaSimple no devolvió el identificador de la petición OCR.');

    const { data: registered, error: registerError } = await adminClient.rpc('flopy_registrar_envio_ocr_contasimple', {
      p_factura_id: facturaId,
      p_contasimple_ocr_request_id: ocrRequest.id,
      p_contasimple_ocr_status: ocrRequest.status || 'Waiting',
      p_contasimple_document_type: 'receivedInvoice',
      p_contasimple_period: ocrRequest.period || period,
      p_usuario_id: employee.id,
      p_observaciones: 'Enviada desde la bandeja de administración del ERP IA360.',
      p_raw_contasimple: uploadPayload,
    });
    if (registerError) throw registerError;
    if (registered?.ok === false) {
      await adminClient.from('facturas_gastos_contasimple_control').update({
        estado: ['Processing', 'Uploading'].includes(String(ocrRequest.status))
          ? 'procesando_contasimple'
          : 'enviada_ocr_contasimple',
        contasimple_ocr_request_id: ocrRequest.id,
        contasimple_ocr_status: ocrRequest.status || 'Waiting',
        contasimple_document_type: 'receivedInvoice',
        contasimple_period: ocrRequest.period || period,
        enviado_a_contasimple_at: new Date().toISOString(),
        enviado_por: employee.id,
        observaciones: 'Envío realizado; recuperado por el conector tras una incidencia al registrar la respuesta.',
        raw_contasimple: uploadPayload,
        error: null,
        updated_at: new Date().toISOString(),
      }).eq('factura_id', facturaId);
    }

    return json({
      ok: true,
      action: 'upload',
      facturaId,
      requestId: ocrRequest.id,
      status: ocrRequest.status || 'Waiting',
      period: ocrRequest.period || period,
      state: registered?.estado_nuevo || 'enviada_ocr_contasimple',
    });
  } catch (error) {
    console.error('contasimple-invoice:', errorMessage(error));
    return json({ ok: false, code: 'internal_error', message: errorMessage(error) }, 500);
  }
});
