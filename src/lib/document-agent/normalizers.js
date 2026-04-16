import { DOCUMENT_AGENT_TYPES } from './schemas';

function normalizeString(value, fallback = '') {
  if (value == null) return fallback;
  return String(value).trim();
}

function toNumber(value, fallback = 0) {
  if (typeof value === 'string') {
    const normalized = value
      .replace(/€/g, '')
      .replace(/\s/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePercent(value, fallback = 0) {
  const numeric = toNumber(value, fallback);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric > 1 ? numeric : numeric * 100;
}

function normalizeDate(value) {
  const text = normalizeString(value, '');
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return text;

  const esMatch = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (!esMatch) return text;

  const day = esMatch[1].padStart(2, '0');
  const month = esMatch[2].padStart(2, '0');
  const year = esMatch[3].length === 2 ? `20${esMatch[3]}` : esMatch[3];
  return `${year}-${month}-${day}`;
}

function normalizeInvoiceLines(lines) {
  if (!Array.isArray(lines)) return [];

  return lines
    .map((line) => ({
      reference: normalizeString(line.reference || line.referencia),
      description: normalizeString(line.description || line.descripcion || line.nombre),
      quantity: toNumber(line.quantity ?? line.cantidad, 1),
      unit: normalizeString(line.unit || line.unidad, 'ud'),
      unit_price: toNumber(line.unit_price ?? line.precio_unitario),
      line_total: toNumber(line.line_total ?? line.total ?? line.total_linea),
      category: normalizeString(line.category || line.categoria, 'materiales'),
    }))
    .filter((line) => line.description || line.reference || line.line_total > 0);
}

export function normalizeDocumentResult(type, data = {}) {
  switch (type) {
    case DOCUMENT_AGENT_TYPES.invoice:
      return {
        type,
        supplier_name: normalizeString(data.supplier_name || data.proveedor || data.proveedor_nombre),
        supplier_tax_id: normalizeString(data.supplier_tax_id || data.nif_proveedor || data.proveedor_cif),
        invoice_number: normalizeString(data.invoice_number || data.numero_factura || data.numero),
        issue_date: normalizeDate(data.issue_date || data.fecha),
        due_date: normalizeDate(data.due_date || data.fecha_vencimiento),
        currency: normalizeString(data.currency, 'EUR'),
        subtotal: toNumber(data.subtotal ?? data.base_imponible ?? data.monto_bruto),
        tax_rate: normalizePercent(data.tax_rate ?? data.iva_porcentaje ?? data.iva, 21),
        tax_amount: toNumber(data.tax_amount ?? data.iva_importe),
        total: toNumber(data.total ?? data.total_con_iva),
        summary: normalizeString(data.summary || data.concepto || data.descripcion),
        lines: normalizeInvoiceLines(data.lines || data.lineas),
        confidence: toNumber(data.confidence, 0),
        warnings: Array.isArray(data.warnings) ? data.warnings.map((item) => normalizeString(item)).filter(Boolean) : [],
      };

    case DOCUMENT_AGENT_TYPES.budget:
      return {
        type,
        title: normalizeString(data.title || data.titulo),
        customer_name: normalizeString(data.customer_name || data.cliente),
        issue_date: normalizeDate(data.issue_date || data.fecha),
        currency: normalizeString(data.currency, 'EUR'),
        total: toNumber(data.total),
        sections: Array.isArray(data.sections) ? data.sections : [],
        confidence: toNumber(data.confidence, 0),
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
      };

    case DOCUMENT_AGENT_TYPES.measurement:
      return {
        type,
title: normalizeString(data.title),
        project_name: normalizeString(data.project_name || data.obra),
        items: Array.isArray(data.items || data.partidas) ? (data.items || data.partidas).map((item) => ({
          code: normalizeString(item.code || item.codigo),
          description: normalizeString(item.description || item.descripcion),
          unit: normalizeString(item.unit || item.unidad, 'ud'),
          quantity: toNumber(item.quantity ?? item.cantidad_total ?? item.cantidad),
          unit_price: item.unit_price == null ? null : toNumber(item.unit_price ?? item.precio_unitario),
        })) : [],
        confidence: toNumber(data.confidence, 0),
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
      };

    default:
      return {
        ...data,
        type,
        confidence: toNumber(data.confidence, 0),
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
      };
  }
}
