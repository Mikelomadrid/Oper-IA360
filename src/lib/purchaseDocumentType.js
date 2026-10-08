import { normalizeSpanishTaxId } from '@/lib/spanishTaxId';

export const ORKALED_FISCAL_IDENTITY = Object.freeze({
  name: 'ORKALED INSTALACIONES S.L.U.',
  taxId: 'B88219837',
});

export const PURCHASE_DOCUMENT_TYPES = Object.freeze({
  RECEIVED_INVOICE: 'factura_recibida',
  EXPENSE: 'gasto',
  REVIEW: 'revisar',
});

const normalizeName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9]/gi, '')
  .toUpperCase();

export function classifyPurchaseDocument({ recipientName, recipientTaxId } = {}) {
  const normalizedTaxId = normalizeSpanishTaxId(recipientTaxId);
  const normalizedName = normalizeName(recipientName);
  const hasRecipient = Boolean(normalizedTaxId || normalizedName);

  if (normalizedTaxId === ORKALED_FISCAL_IDENTITY.taxId) {
    return {
      type: PURCHASE_DOCUMENT_TYPES.RECEIVED_INVOICE,
      reason: 'El destinatario coincide con el CIF de ORKALED.',
    };
  }

  if (!hasRecipient) {
    return {
      type: PURCHASE_DOCUMENT_TYPES.EXPENSE,
      reason: 'El documento no identifica a ORKALED como destinatario.',
    };
  }

  if (normalizedName.includes('ORKALED')) {
    return {
      type: PURCHASE_DOCUMENT_TYPES.REVIEW,
      reason: 'Aparece ORKALED, pero falta confirmar o corregir su CIF.',
    };
  }

  return {
    type: PURCHASE_DOCUMENT_TYPES.REVIEW,
    reason: 'El documento contiene un destinatario distinto de ORKALED.',
  };
}

export async function buildInternalTicketNumber({ file, date, providerTaxId, total }) {
  const compactDate = String(date || new Date().toISOString().slice(0, 10)).replace(/\D/g, '').slice(0, 8);
  const providerSuffix = normalizeSpanishTaxId(providerTaxId).slice(-5) || 'SINID';
  const cents = Math.max(0, Math.round(Number(total || 0) * 100));
  let fingerprint = 'MANUAL';

  if (file?.arrayBuffer && globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    fingerprint = Array.from(new Uint8Array(digest).slice(0, 4))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  return `TKT-${compactDate}-${providerSuffix}-${cents}-${fingerprint}`;
}
