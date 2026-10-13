const STRUCTURED_SCHEMA = 'orkaled_visita_1.0';

const PHASE_BY_ORDER = {
  1: 'protecciones',
  2: 'contenedor',
  3: 'demoliciones',
  4: 'albanileria',
  5: 'instalaciones',
  6: 'cerramientos',
  7: 'impermeabilizacion',
  8: 'revestimientos',
  9: 'carpinteria',
  10: 'carpinteria',
  11: 'acabados',
  12: 'pruebas_limpieza',
};

const STOP_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'con', 'para', 'por', 'un', 'una',
  'existente', 'existentes', 'nuevo', 'nueva', 'obra', 'trabajo', 'trabajos', 'suministro',
  'instalacion', 'colocacion', 'completa', 'completo', 'cocina', 'office', 'general',
]);

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const tokens = (value) => new Set(normalizeText(value)
  .split(/\s+/)
  .filter((token) => token.length > 2 && !STOP_WORDS.has(token)));

const overlapScore = (left, right) => {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const common = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return common / Math.min(leftTokens.size, rightTokens.size);
};

const extractBalancedObject = (text, startIndex) => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(startIndex, index + 1);
    }
  }
  return null;
};

const findStructuredJson = (text) => {
  const schemaIndex = text.indexOf(`"schema_version"`);
  if (schemaIndex < 0 || !text.includes(STRUCTURED_SCHEMA)) return null;
  const startIndex = text.lastIndexOf('{', schemaIndex);
  if (startIndex < 0) return null;
  return extractBalancedObject(text, startIndex);
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const validatePayload = (payload) => {
  if (!payload || payload.schema_version !== STRUCTURED_SCHEMA) {
    throw new Error('El archivo no contiene el esquema estructurado de ORKALED esperado.');
  }
  if (!Array.isArray(payload.partidas)) {
    throw new Error('El bloque estructurado no contiene el listado de partidas.');
  }
  return {
    ...payload,
    mediciones: asArray(payload.mediciones),
    decisiones_pendientes: asArray(payload.decisiones_pendientes),
    trabajos_excluidos: asArray(payload.trabajos_excluidos),
    trabajos_terceros: asArray(payload.trabajos_terceros),
    partidas_sugeridas: asArray(payload.partidas_sugeridas),
    materiales_calidades: asArray(payload.materiales_calidades),
    contradicciones: asArray(payload.contradicciones),
    referencias_economicas: asArray(payload.referencias_economicas),
  };
};

export const parsePlaudStructuredMarkdown = (text) => {
  const source = String(text || '');
  const detected = source.includes(STRUCTURED_SCHEMA);
  if (!detected) return { detected: false, payload: null, warnings: [] };

  const jsonText = findStructuredJson(source);
  if (!jsonText) throw new Error('Se detectó el bloque ORKALED, pero no se pudo localizar un objeto JSON completo.');

  let payload;
  try {
    payload = validatePayload(JSON.parse(jsonText));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`El bloque JSON de PLAUD no es válido: ${error.message}`);
    }
    throw error;
  }

  const warnings = [];
  const jsonFenceIndex = source.lastIndexOf('```json', source.indexOf(jsonText));
  if (jsonFenceIndex >= 0 && source.indexOf('```', jsonFenceIndex + 7) < 0) {
    warnings.push('PLAUD no cerró el bloque Markdown, pero el JSON se ha podido leer correctamente.');
  }

  const reportClient = source.match(/(?:^|\n)-\s*\*\*Cliente:\*\*\s*([^\n]+)/i)?.[1]?.trim();
  const jsonClient = payload.visita?.cliente?.trim();
  if (reportClient && jsonClient && normalizeText(reportClient) !== normalizeText(jsonClient)) {
    warnings.push(`Revisar cliente: el informe indica “${reportClient}” y el bloque estructurado “${jsonClient}”.`);
  }

  return { detected: true, payload, warnings, jsonText };
};

const inferMeasurementElement = (value) => {
  const normalized = normalizeText(value);
  if (/techo/.test(normalized)) return 'techo';
  if (/rodapie|perimetro/.test(normalized)) return 'rodapie';
  if (/tabique/.test(normalized)) return 'tabique';
  if (/pared|paramento|alicat/.test(normalized)) return 'paredes';
  if (/puerta/.test(normalized)) return 'puerta';
  if (/ventana/.test(normalized)) return 'ventana';
  if (/suelo|pavimento|solado/.test(normalized)) return 'suelo';
  return 'otro';
};

const systemCandidate = (system, score) => ({
  system_id: system.id,
  codigo: system.codigo || null,
  nombre: system.nombre || 'Partida sin nombre',
  capitulo: system.capitulo || system.categoria_detalle || null,
  unidad: system.unidad_base || null,
  score: Math.min(Math.max(score, 0), 1),
});

export const rankSystemCandidates = (partida, systems, limit = 3) => {
  const sourceText = `${partida.titulo || ''} ${partida.descripcion || ''} ${partida.oficio || ''} ${partida.capitulo || ''}`;
  const normalizedSource = normalizeText(sourceText);
  const sourceUnit = normalizeText(partida.unidad);

  return asArray(systems).map((system) => {
    const systemText = `${system.nombre || ''} ${system.capitulo || ''} ${system.categoria_detalle || ''}`;
    const normalizedSystem = normalizeText(system.nombre || '');
    let score = overlapScore(sourceText, systemText);
    if (normalizedSystem.length > 8 && normalizedSource.includes(normalizedSystem)) score += 0.75;
    if (normalizeText(partida.capitulo) && normalizeText(partida.capitulo) === normalizeText(system.capitulo)) score += 0.15;
    if (normalizeText(partida.oficio) && (
      normalizeText(system.capitulo).includes(normalizeText(partida.oficio))
      || normalizeText(system.categoria_detalle).includes(normalizeText(partida.oficio))
    )) score += 0.1;
    if (sourceUnit && sourceUnit === normalizeText(system.unidad_base)) score += 0.12;
    return systemCandidate(system, score);
  })
    .filter((candidate) => candidate.score >= 0.25)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
};

const findMeasurementId = (partida, measurements) => {
  if (!partida.medicion_pendiente && Number(partida.cantidad) > 0) {
    const exact = measurements.find((measurement) => (
      measurement.resultado === Number(partida.cantidad)
      && normalizeText(measurement.unidad) === normalizeText(partida.unidad)
      && overlapScore(`${partida.titulo} ${partida.descripcion}`, `${measurement.elemento} ${measurement.uso_previsto}`) >= 0.2
    ));
    return exact?.id || null;
  }

  let best = null;
  let score = 0;
  measurements.forEach((measurement) => {
    const current = overlapScore(
      `${partida.titulo || ''} ${partida.descripcion || ''} ${partida.estancia || ''}`,
      `${measurement.elemento || ''} ${asArray(measurement.uso_previsto).join(' ')} ${measurement.estancia || ''}`,
    );
    if (current > score) {
      best = measurement;
      score = current;
    }
  });
  return score >= 0.25 ? best?.id || null : null;
};

const joinObservation = (label, values) => {
  const items = asArray(values).map((value) => typeof value === 'string' ? value : value?.trabajo || value?.fragmento).filter(Boolean);
  return items.length ? `${label}: ${items.join(' · ')}` : null;
};

export const mapPlaudPayloadToBudget = (payload, systems = []) => {
  const data = validatePayload(payload);
  const measurements = data.mediciones.map((measurement, index) => ({
    id: measurement.id_temporal || `plaud-medicion-${index + 1}`,
    estancia: measurement.estancia || '',
    elemento: inferMeasurementElement(measurement.elemento),
    largo: measurement.largo ?? '',
    ancho: measurement.ancho ?? '',
    alto: measurement.alto ?? '',
    resultado: measurement.cantidad ?? '',
    unidad: measurement.unidad || '',
    formula: measurement.formula || '',
    acabado: '',
    texto_origen: measurement.texto_origen || 'Extraída del informe estructurado de PLAUD',
    fuente: 'transcripcion',
    estado_revision: measurement.estado === 'confirmada' ? 'confirmada' : 'pendiente',
    observaciones: asArray(measurement.uso_previsto).join(' · '),
    uso_previsto: asArray(measurement.uso_previsto),
  }));

  const lines = data.partidas.map((partida, index) => {
    const candidates = rankSystemCandidates(partida, systems);
    const suggested = candidates[0] || null;
    return {
      sistema_id: null,
      sistema_sugerido_id: suggested?.system_id || null,
      candidatos_biblioteca: candidates,
      vinculacion_confirmada: false,
      codigo: null,
      capitulo: partida.capitulo || suggested?.capitulo || null,
      descripcion: partida.descripcion || partida.titulo || 'Partida pendiente de definir',
      titulo_origen: partida.titulo || null,
      zona: partida.estancia || '',
      unidad: partida.unidad || suggested?.unidad || '',
      cantidad: partida.cantidad ?? '',
      medicion_id: findMeasurementId(partida, measurements),
      precio_unitario: '',
      desglose_precio: [],
      texto_origen: partida.texto_origen || 'Extraída del bloque estructurado de PLAUD',
      confianza: Number.isFinite(Number(partida.confianza)) ? Number(partida.confianza) : null,
      estado_revision: partida.estado === 'excluida'
        ? 'descartada'
        : 'sin_coincidencia',
      fase_ejecucion: PHASE_BY_ORDER[Number(partida.fase_orden)] || 'pendiente',
      orden: Number(partida.secuencia) || index + 1,
      oficio_origen: partida.oficio || null,
      suministra_origen: partida.suministra ?? null,
      instala_origen: partida.instala ?? null,
      nivel_confirmacion: partida.nivel_confirmacion || 'no',
      pregunta_confirmacion: partida.pregunta_confirmacion || null,
    };
  });

  const observations = [
    ...asArray(data.partidas).flatMap((partida) => asArray(partida.observaciones)),
    joinObservation('Trabajos excluidos', data.trabajos_excluidos),
    joinObservation('Trabajos de terceros', data.trabajos_terceros),
    joinObservation('Contradicciones detectadas', data.contradicciones),
  ].filter(Boolean);

  const pendingDecisions = data.decisiones_pendientes
    .filter((decision) => decision?.pregunta)
    .map((decision, index) => ({
      id: decision.id_temporal || `plaud-decision-${index + 1}`,
      texto: decision.pregunta,
      estado: 'pendiente',
      decidido_at: null,
      nivel: decision.nivel || 'importante',
      motivo: decision.motivo || null,
      partidas_afectadas: asArray(decision.partidas_afectadas),
    }));

  return {
    result: {
      objeto_presupuesto: data.visita?.objeto_trabajos || '',
      notas_cabecera_presupuesto: '',
      resumen: data.visita?.objeto_trabajos || '',
      necesidades_cliente: data.partidas
        .filter((partida) => partida.estado === 'confirmada')
        .map((partida) => partida.titulo || partida.descripcion)
        .filter(Boolean),
      datos_pendientes: pendingDecisions,
      observaciones: observations,
      mediciones: measurements,
      partidas: lines,
      revision_alcance: [],
    },
    summary: {
      partidas: lines.length,
      mediciones: measurements.length,
      decisiones: pendingDecisions.length,
      sugeridas: data.partidas_sugeridas.length,
      excluidas: data.trabajos_excluidos.length,
      terceros: data.trabajos_terceros.length,
      contradicciones: data.contradicciones.length,
      sistemasVinculados: 0,
      sistemasConCandidatos: lines.filter((line) => line.estado_revision !== 'descartada' && line.candidatos_biblioteca.length > 0).length,
      sistemasPendientes: lines.filter((line) => line.estado_revision !== 'descartada' && !line.sistema_id).length,
    },
    structured: data,
  };
};

export { STRUCTURED_SCHEMA };
