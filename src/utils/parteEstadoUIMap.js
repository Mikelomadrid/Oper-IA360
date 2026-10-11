/**
 * Utility para mapear los estados internos de la BD (slugs) <-> etiquetas de UI.
 *
 * Modelo canónico 1:1 (alineado con la vista v_partes_estado_ui y la columna partes.estado):
 *
 *   slug BD            etiqueta UI
 *   ----------------   ----------------
 *   nuevo              NUEVO
 *   contactado         CONTACTADO
 *   visita_agendada    VISITA AGENDADA
 *   visitado           VISITADO
 *   presupuestado      PRESUPUESTADO
 *   realizado          REALIZADO
 *   aceptado           ACEPTADO
 *   rechazado          RECHAZADO
 *   cancelado          CANCELADO
 *   facturado          FACTURADO
 *   cobrado            COBRADO
 *   cerrado            CERRADO
 *
 * IMPORTANTE: 'cobrado' es el estado siguiente a 'facturado'. Un parte facturado
 * se queda visible en Activos hasta que se marca manualmente como cobrado (botón
 * "Marcar como Cobrado" en ParteDetail.jsx cuando estado === 'facturado'); en ese
 * momento pasa a Archivo Histórico. FACTURADO ya NO archiva automáticamente.
 *
 * 'cerrado' y 'cancelado' eran antes slugs "legacy" que se plegaban a VISITADO y
 * RECHAZADO respectivamente. Ahora son estados canónicos propios (parte cerrado
 * sin facturar / parte cancelado por la empresa), así que esos alias legacy se
 * han eliminado para no pisarse con el nuevo significado real.
 *
 * Los demás slugs legacy (pendiente, en_curso, archivado, etc.) se mantienen
 * contemplados en mapInternalToUI por robustez, por si quedara algún registro
 * antiguo o llegara un valor inesperado.
 */

// Lista canónica de etiquetas de UI, en orden de embudo.
export const PARTE_UI_STATES = [
  'NUEVO',
  'CONTACTADO',
  'VISITA AGENDADA',
  'VISITADO',
  'PRESUPUESTADO',
  'REALIZADO',
  'ACEPTADO',
  'RECHAZADO',
  'CANCELADO',
  'FACTURADO',
  'COBRADO',
  'CERRADO',
];

/**
 * Maps internal database state string -> etiqueta de UI.
 * Contempla los 12 estados canónicos + slugs legacy (no conflictivos) por robustez.
 */
export const mapInternalToUI = (internalState) => {
  if (!internalState) return 'NUEVO';

  const lower = String(internalState).toLowerCase().trim();

  switch (lower) {
    // --- NUEVO ---
    case 'nuevo':
    case 'pendiente':       // legacy
      return 'NUEVO';

    // --- CONTACTADO ---
    case 'contactado':
      return 'CONTACTADO';

    // --- VISITA AGENDADA ---
    case 'visita_agendada':
    case 'agendada_visita': // legacy
    case 'en_curso':        // legacy: antiguamente se usaba al agendar visita
      return 'VISITA AGENDADA';

    // --- VISITADO ---
    case 'visitado':
      return 'VISITADO';

    // --- PRESUPUESTADO ---
    case 'presupuestado':
    case 'en_preparacion':  // legacy
      return 'PRESUPUESTADO';

    // --- REALIZADO ---
    case 'realizado':
    case 'completado':      // legacy
    case 'finalizado':      // legacy
      return 'REALIZADO';

    // --- ACEPTADO ---
    case 'aceptado':
      return 'ACEPTADO';

    // --- RECHAZADO ---
    case 'rechazado':
    case 'anulado':         // legacy
    case 'archivado':       // legacy
      return 'RECHAZADO';

    // --- CANCELADO --- (estado canónico propio: cancelado por la empresa)
    case 'cancelado':
      return 'CANCELADO';

    // --- FACTURADO ---
    case 'facturado':
      return 'FACTURADO';

    // --- COBRADO --- (estado canónico propio: facturado y ya cobrado)
    case 'cobrado':
      return 'COBRADO';

    // --- CERRADO --- (estado canónico propio: cerrado sin facturar)
    case 'cerrado':
      return 'CERRADO';

    default:
      return 'NUEVO';
  }
};

/**
 * Maps etiqueta de UI -> slug interno de la BD (1:1).
 */
export const mapUIToInternal = (uiState) => {
  switch (uiState) {
    case 'NUEVO':           return 'nuevo';
    case 'CONTACTADO':      return 'contactado';
    case 'VISITA AGENDADA': return 'visita_agendada';
    case 'VISITADO':        return 'visitado';
    case 'PRESUPUESTADO':   return 'presupuestado';
    case 'REALIZADO':       return 'realizado';
    case 'ACEPTADO':        return 'aceptado';
    case 'RECHAZADO':       return 'rechazado';
    case 'CANCELADO':       return 'cancelado';
    case 'FACTURADO':       return 'facturado';
    case 'COBRADO':         return 'cobrado';
    case 'CERRADO':         return 'cerrado';
    default:                return 'nuevo';
  }
};
