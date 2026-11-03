const SOURCE_WEB = 'Web';
const SOURCE_MAESTRO = 'Maestro Fontanero';

const clean = (value = '') => String(value)
  .replace(/\u00a0/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .trim();

const stripHtml = (value = '') => String(value)
  .replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<\/p\s*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&');

const firstMatch = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return null;
};

export const classifyLeadSource = ({ subject = '', from = '', body = '' } = {}) => {
  const haystack = `${subject}\n${from}\n${body}`.toLocaleLowerCase('es-ES');

  // OYRSA is intentionally mapped to Maestro Fontanero: it arrived through
  // that website and must count under that commercial origin in the ERP.
  if (/(maestro\s*fontanero|maestrofontanero\.es|oyrsa(?:\.es)?)/i.test(haystack)) {
    return SOURCE_MAESTRO;
  }

  if (/(orkaled\.com|reformas\s+orkaled|solicitud\s+de\s+presupuesto\s+web)/i.test(haystack)) {
    return SOURCE_WEB;
  }

  return null;
};

const extractBodyMessage = (body) => {
  const match = body.match(/(?:Cuerpo\s+del\s+mensaje|En\s+qu[eé]\s+podemos\s+ayudarte)\s*:\s*([\s\S]*?)(?:\n\s*(?:Pol[ií]ticas\s+de\s+privacidad|--+)\s*:?[\s\S]*|$)/i);
  return clean(match?.[1] || body);
};

const normalizePhone = (value) => clean(value).replace(/[^\d+]/g, '');

const phoneLooksSuspicious = (phone) => {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 9 && !/^(?:\+34|0034)/.test(phone)) return true;
  if (/^(\d)\1{7,}$/.test(digits)) return true;
  if (/^\+(?!34)/.test(phone) || /^00(?!34)/.test(phone)) return true;
  return false;
};

const bodyLooksLikeSpam = (text) => {
  const value = text.toLocaleLowerCase('en-US');
  const englishSignals = [
    'seo services', 'crypto', 'casino', 'loan offer', 'backlink',
    'guest post', 'dear sir', 'click here', 'digital marketing agency',
    'google rankings', 'checked your website', 'proposal with pricing',
    'tailored for your business growth', 'regards',
  ];
  return englishSignals.filter((signal) => value.includes(signal)).length >= 1;
};

const attachmentKind = ({ filename = '', mime = '' } = {}) => {
  if (/^image\//i.test(mime) || /\.(jpe?g|png|gif|webp|heic|avif|tiff?)$/i.test(filename)) {
    return 'foto';
  }
  return 'doc';
};

const isIgnorableAttachment = ({ filename = '', mime = '', contentDisposition = '' } = {}) =>
  /(?:firma|signature|logo|disclaimer|social)/i.test(filename)
  || /^image001\.(gif|png)$/i.test(filename)
  || (/^image\//i.test(mime) && /inline/i.test(contentDisposition) && /\.(png|gif|jpe?g)$/i.test(filename));

export const parseLeadEmail = ({
  subject = '',
  from = '',
  date = null,
  body = '',
  html = '',
  attachments = [],
  messageId = null,
} = {}) => {
  const normalizedBody = stripHtml(body || html);
  const source = classifyLeadSource({ subject, from, body: normalizedBody });
  const message = extractBodyMessage(normalizedBody);
  const nombreContacto = firstMatch(normalizedBody, [
    /(?:^|\n)\s*De\s*:\s*(.+?)(?=\s*(?:\n|Correo\s*:))/i,
    /(?:^|\n)\s*Nombre\s*:\s*(.+)$/im,
  ]);
  const email = firstMatch(normalizedBody, [
    /(?:^|\n)\s*Correo\s*:\s*([^\s\n<>]+@[^\s\n<>]+)/i,
    /(?:^|\n)\s*D[eé]janos\s+tu\s+mejor\s+email\s*:\s*([^\s\n<>]+@[^\s\n<>]+)/i,
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i,
  ]);
  const telefono = normalizePhone(firstMatch(normalizedBody, [
    /(?:^|\n)\s*Tel[eé]fono\s*:\s*([^\n]+)/i,
    /(?:^|\n)\s*Tel[eé]fono\s+de\s+contacto\s*:\s*([^\n]+)/i,
    /(?:^|\n)\s*Tel\.?\s*:\s*([^\n]+)/i,
  ]) || '');
  const direccion = firstMatch(normalizedBody, [
    /(?:^|\n)\s*Direcci[oó]n\s*:\s*(.+)$/im,
    /(?:^|\n)\s*(CP\s+\d{5}.+)$/im,
  ]);
  const normalizedAttachments = attachments.filter((attachment) => !isIgnorableAttachment(attachment)).map((attachment) => ({
    filename: clean(attachment.filename || attachment.name || 'archivo'),
    mime: attachment.mime || attachment.contentType || null,
    sizeBytes: attachment.sizeBytes ?? attachment.size ?? null,
    tipo: attachmentKind(attachment),
  }));

  const reviewReasons = [];
  if (!source) reviewReasons.push('origen_no_identificado');
  if (!email && !telefono) reviewReasons.push('sin_email_ni_telefono');
  if (phoneLooksSuspicious(telefono)) reviewReasons.push('telefono_sospechoso');
  if (/^re\s*:/i.test(subject)) reviewReasons.push('posible_respuesta');
  if (bodyLooksLikeSpam(`${subject}\n${from}\n${normalizedBody}`)) reviewReasons.push('posible_spam');

  const spam = reviewReasons.includes('posible_spam');
  const status = spam ? 'spam' : reviewReasons.length > 0 ? 'revision' : 'listo';
  const dedupeKey = messageId || [clean(subject), clean(from), clean(email || ''), telefono, date || ''].join('|');

  return {
    source,
    nombre_contacto: nombreContacto,
    email,
    telefono: telefono || null,
    direccion,
    comentario: message,
    asunto: clean(subject),
    remitente: clean(from),
    fecha: date,
    estado_importacion: status,
    motivos_revision: reviewReasons,
    tiene_adjuntos: normalizedAttachments.length > 0,
    adjuntos: normalizedAttachments,
    dedupe_key: dedupeKey,
  };
};

export const leadEmailSources = { SOURCE_WEB, SOURCE_MAESTRO };
