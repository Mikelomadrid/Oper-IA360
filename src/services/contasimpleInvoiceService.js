import { supabase } from '@/lib/customSupabaseClient';

const FUNCTION_NAME = 'contasimple-invoice';

async function invoke(action, facturaId) {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: { action, facturaId },
  });
  if (error) {
    let payload = null;
    try {
      payload = error.context instanceof Response ? await error.context.json() : null;
    } catch {
      payload = null;
    }
    const failure = new Error(payload?.message || error.message || 'No se pudo conectar con ContaSimple.');
    failure.code = payload?.code;
    failure.state = payload?.state;
    throw failure;
  }
  if (data?.ok === false) {
    const failure = new Error(data.message || 'ContaSimple devolvió un error.');
    failure.code = data.code;
    failure.state = data.state;
    throw failure;
  }
  return data;
}

export function previewReceivedInvoice(facturaId) {
  return invoke('preview', facturaId);
}

export function createReceivedInvoice(facturaId) {
  return invoke('create', facturaId);
}
