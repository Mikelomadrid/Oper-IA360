import { describe, expect, it } from 'vitest';
import { normalizeSpanishTaxId, validateSpanishTaxId } from '@/lib/spanishTaxId';

describe('validateSpanishTaxId', () => {
  it('valida NIF y NIE con su letra de control', () => {
    expect(validateSpanishTaxId('12345678Z').valid).toBe(true);
    expect(validateSpanishTaxId('12345678A').valid).toBe(false);
    expect(validateSpanishTaxId('X1234567L').valid).toBe(true);
  });

  it('valida el dígito de control de un CIF', () => {
    expect(validateSpanishTaxId('B88219837').valid).toBe(true);
    expect(validateSpanishTaxId('B88219838').valid).toBe(false);
  });

  it('normaliza espacios, separadores y el prefijo europeo', () => {
    expect(normalizeSpanishTaxId(' ES-B88219837 ')).toBe('B88219837');
    expect(validateSpanishTaxId(' ES-B88219837 ').valid).toBe(true);
  });

  it('rechaza valores vacíos o con formato desconocido', () => {
    expect(validateSpanishTaxId('').valid).toBe(false);
    expect(validateSpanishTaxId('ABC123').valid).toBe(false);
  });
});
