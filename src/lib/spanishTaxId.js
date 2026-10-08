const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const CIF_CONTROL_LETTERS = 'JABCDEFGHI';

export const normalizeSpanishTaxId = (value) => {
  const normalized = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  return normalized.startsWith('ES') && normalized.length === 11
    ? normalized.slice(2)
    : normalized;
};

const result = (valid, normalized, type = null, reason = '') => ({
  valid,
  normalized,
  type,
  reason,
});

export const validateSpanishTaxId = (value) => {
  const normalized = normalizeSpanishTaxId(value);
  if (!normalized) {
    return result(false, normalized, null, 'El CIF/NIF es obligatorio.');
  }

  const dni = normalized.match(/^(\d{8})([A-Z])$/);
  if (dni) {
    const expected = DNI_LETTERS[Number(dni[1]) % 23];
    return result(
      dni[2] === expected,
      normalized,
      'NIF',
      dni[2] === expected ? '' : `La letra de control debería ser ${expected}.`,
    );
  }

  const nie = normalized.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (nie) {
    const prefix = { X: '0', Y: '1', Z: '2' }[nie[1]];
    const expected = DNI_LETTERS[Number(`${prefix}${nie[2]}`) % 23];
    return result(
      nie[3] === expected,
      normalized,
      'NIE',
      nie[3] === expected ? '' : `La letra de control debería ser ${expected}.`,
    );
  }

  const cif = normalized.match(/^([ABCDEFGHJKLMNPQRSUVW])(\d{7})([0-9A-J])$/);
  if (cif) {
    const digits = cif[2].split('').map(Number);
    const evenSum = digits[1] + digits[3] + digits[5];
    const oddSum = [digits[0], digits[2], digits[4], digits[6]]
      .reduce((sum, digit) => {
        const doubled = digit * 2;
        return sum + Math.floor(doubled / 10) + (doubled % 10);
      }, 0);
    const controlDigit = (10 - ((evenSum + oddSum) % 10)) % 10;
    const controlLetter = CIF_CONTROL_LETTERS[controlDigit];
    const suppliedControl = cif[3];
    const digitOnly = 'ABEH'.includes(cif[1]);
    const letterOnly = 'KPQS'.includes(cif[1]);
    const valid = digitOnly
      ? suppliedControl === String(controlDigit)
      : letterOnly
        ? suppliedControl === controlLetter
        : suppliedControl === String(controlDigit) || suppliedControl === controlLetter;
    const expected = digitOnly
      ? String(controlDigit)
      : letterOnly
        ? controlLetter
        : `${controlDigit} o ${controlLetter}`;

    return result(
      valid,
      normalized,
      'CIF',
      valid ? '' : `El carácter de control debería ser ${expected}.`,
    );
  }

  return result(
    false,
    normalized,
    null,
    'El formato no corresponde a un CIF, NIF o NIE español válido.',
  );
};
