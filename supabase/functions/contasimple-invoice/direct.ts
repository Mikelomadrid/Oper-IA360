import { createClient } from 'npm:@supabase/supabase-js@2';

const API_BASE = 'https://api.contasimple.com/api/v2';
const ACTIONS = new Set(['preview', 'create']);
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
const message = (error: unknown) => error instanceof Error ? error.message : String(error || 'Error desconocido');
const normalized = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function text(value: unknown, label: string) {
  const result = String(value || '').trim();
  if (!result) throw new Error(`Falta ${label}.`);
  return result;
}

function number(value: unknown, label: string) {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`${label} no es un número válido.`);
  return result;
}

function apiDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('La fecha de la factura no es válida.');
  return `${value}T00:00:00`;
}

function periodFromDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error('La fecha de la factura no es válida.');
  return `${date.getUTCFullYear()}-${Math.floor(date.getUTCMonth() / 3) + 1}T`;
}

function rows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data as Array<Record<string, unknown>>;
  return [];
}

function data(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  return record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : record;
}

async function token(apiKey: string) {
  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authentication_key', key: apiKey }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) throw new Error(`ContaSimple rechazó la autenticación (${response.status}).`);
  return payload.access_token as string;
}

async function call(accessToken: string, endpoint: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept-Language', 'es-ES');
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE}${endpoint}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.errorMessage || payload?.message || payload?.error || `HTTP ${response.status}`;
    const code = payload?.errorCode || payload?.code;
    throw new Error(`ContaSimple devolvió un error: ${detail}${code ? ` (código ${String(code)})` : ''}`);
  }
  return payload;
}

function invoiceLines(source: Array<Record<string, unknown>>) {
  if (!source.length) throw new Error('La factura no contiene líneas validadas.');
  return source.map((line, index) => {
    const quantity = number(line.cantidad ?? 1, `Cantidad de la línea ${index + 1}`);
    if (quantity === 0) throw new Error(`La cantidad de la línea ${index + 1} no puede ser cero.`);
    const storedBase = line.base_linea == null ? null : number(line.base_linea, `Base de la línea ${index + 1}`);
    const unitAmount = line.precio_unitario == null
      ? number((storedBase || 0) / quantity, `Precio de la línea ${index + 1}`)
      : number(line.precio_unitario, `Precio de la línea ${index + 1}`);
    const totalTaxableAmount = money(storedBase == null ? unitAmount * quantity : storedBase);
    const vatPercentage = number(line.iva_porcentaje ?? 0, `IVA de la línea ${index + 1}`);
    const vatAmount = money(line.iva_importe == null
      ? totalTaxableAmount * vatPercentage / 100
      : number(line.iva_importe, `Importe IVA de la línea ${index + 1}`));
    const reference = String(line.referencia || '').trim();
    const description = text(line.descripcion, `el concepto de la línea ${index + 1}`);
    return {
      concept: reference ? `${reference} · ${description}` : description,
      unitAmount: money(unitAmount),
      quantity,
      vatPercentage,
      vatAmount,
      rePercentage: 0,
      reAmount: 0,
      totalTaxableAmount,
      discountPercentage: 0,
      detailedDescription: line.unidad ? `Unidad ERP: ${String(line.unidad)}` : '',
    };
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply({ ok: false, code: 'method_not_allowed', message: 'Método no permitido.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return reply({ ok: false, code: 'unauthorized', message: 'Sesión requerida.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const apiKey = Deno.env.get('CONTASIMPLE_API_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey || !apiKey) {
      return reply({ ok: false, code: 'backend_not_configured', message: 'El conector no está configurado.' }, 503);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
    });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await userClient.auth.getUser(authorization.slice(7));
    if (authError || !authData.user) return reply({ ok: false, code: 'invalid_session', message: 'La sesión no es válida.' }, 401);

    let employeeResult = await admin.from('empleados').select('id, rol, activo, baja').eq('auth_user_id', authData.user.id).maybeSingle();
    if (!employeeResult.data && authData.user.email) {
      employeeResult = await admin.from('empleados').select('id, rol, activo, baja').ilike('email', authData.user.email.trim()).maybeSingle();
    }
    const employee = employeeResult.data;
    if (employeeResult.error || !employee || employee.activo === false || employee.baja === true || !['admin', 'encargado'].includes(employee.rol)) {
      return reply({ ok: false, code: 'forbidden', message: 'Usuario sin acceso administrativo al conector.' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === 'string' ? body.action : '';
    const facturaId = typeof body?.facturaId === 'string' ? body.facturaId : '';
    if (!ACTIONS.has(action)) return reply({ ok: false, code: 'invalid_action', message: 'Acción no válida.' }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(facturaId)) return reply({ ok: false, code: 'invalid_invoice', message: 'Factura no válida.' }, 400);

    const [invoiceResult, ocrResult, controlResult, linesResult] = await Promise.all([
      admin.from('facturas_gastos').select('id, proveedor_id, estado_contabilidad').eq('id', facturaId).maybeSingle(),
      admin.from('facturas_gastos_ocr').select('proveedor_nombre, proveedor_nif, numero_factura, fecha_factura, total, validacion_estado').eq('factura_id', facturaId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      admin.from('facturas_gastos_contasimple_control').select('*').eq('factura_id', facturaId).maybeSingle(),
      admin.from('facturas_gastos_lineas_ocr').select('numero_linea, referencia, descripcion, cantidad, unidad, precio_unitario, base_linea, iva_porcentaje, iva_importe, validacion_estado').eq('factura_id', facturaId).order('numero_linea'),
    ]);
    const queryError = invoiceResult.error || ocrResult.error || controlResult.error || linesResult.error;
    if (queryError) throw queryError;
    const invoice = invoiceResult.data;
    const ocr = ocrResult.data;
    const control = controlResult.data;
    const sourceLines = linesResult.data || [];
    if (!invoice || !ocr || !control) return reply({ ok: false, code: 'invoice_not_ready', message: 'No se encontró la factura completa o su control.' }, 404);
    if (control.estado !== 'lista_para_contasimple') return reply({ ok: false, code: 'invalid_state', message: 'La factura ya se registró o necesita revisión.', state: control.estado }, 409);
    if (control.contasimple_document_id || control.contasimple_ocr_request_id) return reply({ ok: false, code: 'already_sent', message: 'La factura ya tiene identificador de ContaSimple.' }, 409);
    if (ocr.validacion_estado !== 'validado') return reply({ ok: false, code: 'invoice_not_validated', message: 'La factura debe estar validada.' }, 409);
    if (sourceLines.some((line) => !['validada', 'no_material'].includes(String(line.validacion_estado)))) {
      return reply({ ok: false, code: 'lines_not_validated', message: 'Todas las líneas deben estar validadas.' }, 409);
    }

    const nif = text(ocr.proveedor_nif, 'el NIF del proveedor');
    const providerName = text(ocr.proveedor_nombre, 'el nombre del proveedor');
    const invoiceNumber = text(ocr.numero_factura, 'el número de factura');
    const invoiceDate = text(ocr.fecha_factura, 'la fecha de factura');
    const invoiceTotal = number(ocr.total, 'El total de la factura');
    let mappedLines = invoiceLines(sourceLines);
    const base = money(mappedLines.reduce((sum, line) => sum + line.totalTaxableAmount, 0));
    let vat = money(mappedLines.reduce((sum, line) => sum + line.vatAmount, 0));

    // El escáner antiguo conserva el IVA en la cabecera, pero no siempre lo
    // distribuye entre las líneas. Solo lo inferimos cuando todas las líneas
    // vienen sin IVA y el porcentaje resultante coincide con un tipo español
    // habitual; así evitamos inventar repartos en facturas con tipos mixtos.
    const headerVat = money(invoiceTotal - base);
    const linesHaveNoVat = mappedLines.every((line) =>
      Math.abs(line.vatAmount) <= 0.01 && Math.abs(line.vatPercentage) <= 0.01
    );
    if (Math.abs(base + vat - invoiceTotal) > 0.05 && linesHaveNoVat && Math.abs(base) > 0.01) {
      const inferredPercentage = Math.abs(headerVat / base * 100);
      const standardVatRates = [0, 4, 10, 21];
      const inferredVatRate = standardVatRates.find((rate) => Math.abs(rate - inferredPercentage) <= 0.05);
      if (inferredVatRate !== undefined) {
        let allocatedVat = 0;
        mappedLines = mappedLines.map((line, index) => {
          const vatAmount = index === mappedLines.length - 1
            ? money(headerVat - allocatedVat)
            : money(line.totalTaxableAmount * inferredVatRate / 100);
          allocatedVat = money(allocatedVat + vatAmount);
          return { ...line, vatPercentage: inferredVatRate, vatAmount };
        });
        vat = money(mappedLines.reduce((sum, line) => sum + line.vatAmount, 0));
      }
    }
    if (Math.abs(base + vat - invoiceTotal) > 0.05) {
      return reply({
        ok: false,
        code: 'totals_mismatch',
        message: 'La base y el IVA de las líneas no coinciden con el total. Revisa el IVA por línea, especialmente si la factura contiene tipos distintos.',
        totals: { base, vat, total: invoiceTotal },
      }, 409);
    }

    let localProvider: Record<string, unknown> | null = null;
    if (invoice.proveedor_id) {
      const providerResult = await admin.from('proveedores').select('nombre, cif, email, telefono, direccion, cp, ciudad, provincia, pais').eq('id', invoice.proveedor_id).maybeSingle();
      if (providerResult.error) throw providerResult.error;
      localProvider = providerResult.data;
    }

    const period = periodFromDate(invoiceDate);
    const accessToken = await token(apiKey);
    const duplicates = await call(accessToken, `/accounting/${encodeURIComponent(period)}/invoices/received?${new URLSearchParams({ startIndex: '0', numRows: '20', number: invoiceNumber, nif })}`);
    const duplicate = rows(duplicates).find((item) => {
      const issuer = item.issuer && typeof item.issuer === 'object' ? item.issuer as Record<string, unknown> : {};
      return normalized(item.number) === normalized(invoiceNumber) && normalized(issuer.nif ?? item.nif) === normalized(nif) && Math.abs(Number(item.totalAmount ?? 0) - invoiceTotal) <= 0.02;
    });
    if (duplicate) {
      if (action === 'create') await admin.from('facturas_gastos_contasimple_control').update({ estado: 'posible_duplicado_contasimple', observaciones: 'Coincidencia por NIF, número e importe antes del registro directo.', raw_contasimple: { duplicate }, updated_at: new Date().toISOString() }).eq('factura_id', facturaId);
      return reply({ ok: false, code: 'possible_duplicate', message: 'ContaSimple ya contiene una factura con el mismo proveedor, número e importe.' }, 409);
    }

    const providerSearch = await call(accessToken, `/entities/providers/search/nif?${new URLSearchParams({ query: nif, exactMatch: 'true' })}`);
    let remoteProvider = rows(providerSearch).find((item) => normalized(item.nif) === normalized(nif));
    const providerPayload = {
      type: 'Issuer', organization: String(localProvider?.nombre || providerName).trim(), nif,
      address: String(localProvider?.direccion || '').trim(), province: String(localProvider?.provincia || '').trim(),
      city: String(localProvider?.ciudad || '').trim(), country: String(localProvider?.pais || 'España').trim(),
      postalCode: String(localProvider?.cp || '').trim(), phone: String(localProvider?.telefono || '').trim(),
      email: String(localProvider?.email || '').trim(), notes: 'Proveedor sincronizado desde ERP IA360.', documentCulture: 'es-ES',
    };
    const invoiceBase = {
      imputation: 100, vatImputation: 100, isCashCriteria: false, number: invoiceNumber,
      date: apiDate(invoiceDate), operationDate: apiDate(invoiceDate), invoiceClass: 600,
      notes: `Registrada directamente desde ERP IA360 · ${facturaId}`, retentionPercentage: 0,
      operationType: 'Nacional', lines: mappedLines,
    };

    if (action === 'preview') return reply({
      ok: true, action, facturaId, period,
      provider: { action: remoteProvider ? 'reuse' : 'create', id: remoteProvider?.id || null, organization: providerPayload.organization, nif },
      invoice: { ...invoiceBase, issuerEntityId: remoteProvider?.id || null }, totals: { base, vat, total: invoiceTotal },
      uploadsFile: false, usesContasimpleOcr: false,
    });

    let providerCreated = false;
    if (!remoteProvider) {
      remoteProvider = data(await call(accessToken, '/entities/providers', { method: 'POST', body: JSON.stringify(providerPayload) })) || undefined;
      providerCreated = true;
    }
    const issuerEntityId = Number(remoteProvider?.id);
    if (!Number.isSafeInteger(issuerEntityId) || issuerEntityId <= 0) throw new Error('ContaSimple no devolvió un identificador válido para el proveedor.');

    const createdPayload = await call(accessToken, `/accounting/${encodeURIComponent(period)}/invoices/received?bypassInvoiceDuplicateValidation=false`, {
      method: 'POST', body: JSON.stringify({ ...invoiceBase, issuerEntityId }),
    });
    const created = data(createdPayload);
    const documentId = Number(created?.id);
    if (!Number.isSafeInteger(documentId) || documentId <= 0) throw new Error('ContaSimple no devolvió el identificador de la factura creada.');

    const registered = await admin.rpc('flopy_registrar_factura_directa_contasimple', {
      p_factura_id: facturaId, p_contasimple_document_id: documentId,
      p_contasimple_document_number: String(created?.number || invoiceNumber),
      p_contasimple_document_amount: Number(created?.totalAmount ?? invoiceTotal),
      p_contasimple_period: String(created?.period || period), p_usuario_id: employee.id,
      p_observaciones: providerCreated ? 'Factura y proveedor creados por API, sin OCR ni archivo.' : 'Factura creada por API, sin OCR ni archivo.',
      p_raw_contasimple: createdPayload,
    });
    if (registered.error) throw registered.error;
    if (registered.data?.ok === false) throw new Error(registered.data?.mensaje || registered.data?.error || 'No se pudo registrar el resultado en el ERP.');
    await admin.from('facturas_gastos').update({ contasimple_id: String(documentId), contasimple_error: null, estado_contabilidad: 'enviada' }).eq('id', facturaId);

    return reply({ ok: true, action, facturaId, documentId, documentNumber: created?.number || invoiceNumber,
      documentAmount: created?.totalAmount ?? invoiceTotal, period: created?.period || period,
      providerId: issuerEntityId, providerCreated, state: 'creada_en_contasimple', uploadsFile: false, usesContasimpleOcr: false });
  } catch (error) {
    console.error('contasimple-invoice:', message(error));
    return reply({ ok: false, code: 'internal_error', message: message(error) }, 500);
  }
});
