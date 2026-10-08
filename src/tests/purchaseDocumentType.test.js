import { describe, expect, it } from 'vitest';
import {
  PURCHASE_DOCUMENT_TYPES,
  classifyPurchaseDocument,
} from '@/lib/purchaseDocumentType';

describe('classifyPurchaseDocument', () => {
  it('clasifica como factura cuando el destinatario tiene el CIF de ORKALED', () => {
    expect(classifyPurchaseDocument({ recipientTaxId: 'B-88219837' }).type)
      .toBe(PURCHASE_DOCUMENT_TYPES.RECEIVED_INVOICE);
  });

  it('clasifica como gasto cuando no consta destinatario', () => {
    expect(classifyPurchaseDocument({}).type).toBe(PURCHASE_DOCUMENT_TYPES.EXPENSE);
  });

  it('envía a revisión un destinatario distinto', () => {
    expect(classifyPurchaseDocument({ recipientName: 'OTRA EMPRESA', recipientTaxId: 'B88219838' }).type)
      .toBe(PURCHASE_DOCUMENT_TYPES.REVIEW);
  });

  it('envía a revisión una mención a ORKALED sin CIF verificable', () => {
    expect(classifyPurchaseDocument({ recipientName: 'Orkaled Instalaciones SLU' }).type)
      .toBe(PURCHASE_DOCUMENT_TYPES.REVIEW);
  });
});
