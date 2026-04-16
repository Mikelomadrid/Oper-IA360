import { supabase } from '@/lib/customSupabaseClient';
import { getDocumentAgentPrompt } from './schemas';
import { normalizeDocumentResult } from './normalizers';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

function extractJsonBlock(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('La respuesta del analizador ha llegado vacía');
  }

  const clean = text.replace(/```json|```/gi, '').trim();
  const candidates = [];

  const firstObject = clean.indexOf('{');
  const lastObject = clean.lastIndexOf('}');
  if (firstObject !== -1 && lastObject !== -1 && lastObject > firstObject) {
    candidates.push(clean.slice(firstObject, lastObject + 1));
  }

  const firstArray = clean.indexOf('[');
  const lastArray = clean.lastIndexOf(']');
  if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
    candidates.push(clean.slice(firstArray, lastArray + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // seguir con el siguiente intento
    }
  }

  throw new Error('No se pudo extraer un JSON válido de la respuesta del analizador');
}

function buildAgentError(error, providerData) {
  const providerMessage = providerData?.error || providerData?.providerError?.error?.message;
  return new Error(providerMessage || error?.message || 'Error de conexión con document-agent');
}

export async function analyzeDocumentWithAgent({ file, type, metadata = {} }) {
  if (!file) throw new Error('Falta archivo');
  if (!type) throw new Error('Falta tipo de documento');

  const fileData = await fileToDataUrl(file);
  const prompt = getDocumentAgentPrompt(type);

  const { data, error } = await supabase.functions.invoke('document-agent', {
    body: {
      file: fileData,
      fileName: file.name,
      mediaType: file.type || 'application/octet-stream',
      type,
      prompt,
      metadata,
    },
  });

  if (error) throw buildAgentError(error, data);
  if (!data?.ok && !data?.text) throw buildAgentError(error, data);

  const parsed = extractJsonBlock(data?.text || '');
  const normalized = normalizeDocumentResult(type, parsed);

  return {
    ...normalized,
    _meta: {
      model: data?.model || null,
      rawText: data?.text || '',
      raw: data?.raw || null,
    },
  };
}

export async function analyzeInvoiceWithDocumentAgent(file) {
  const result = await analyzeDocumentWithAgent({ file, type: 'invoice' });
  return {
    proveedor_nombre: result.supplier_name,
    proveedor_cif: result.supplier_tax_id,
    numero_factura: result.invoice_number,
    fecha: result.issue_date,
    fecha_vencimiento: result.due_date,
    subtotal: result.subtotal,
    iva_porcentaje: result.tax_rate,
    iva_importe: result.tax_amount,
    total: result.total,
    concepto: result.summary,
    moneda: result.currency,
    confidence: result.confidence,
    warnings: result.warnings,
    _meta: result._meta,
    lineas: result.lines?.map((line) => ({
      referencia: line.reference,
      nombre: line.description,
      cantidad: line.quantity,
      unidad: line.unit,
      precio_unitario: line.unit_price,
      total_linea: line.line_total,
      categoria: line.category,
    })) || [],
  };
}
