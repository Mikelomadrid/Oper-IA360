/**
 * Utility for mapping Partes Internal DB States <-> UI Dropdown States
 * Enforces the 8-state strict UI requirement while handling legacy DB values.
 * Updated to ensure simple, robust mapping for display.
 */

export const PARTE_UI_STATES = [
  'NUEVO',
  'CONTACTADO',
  'VISITA AGENDADA',
  'VISITADO',
  'PRESUPUESTADO',
  'ACEPTADO',
  'RECHAZADO',
  'CANCELADO'
];

/**
 * Maps internal database state string to one of the 8 UI States.
 * Handles legacy values (pendiente, en_curso, etc.)
 */
export const mapInternalToUI = (internalState) => {
  if (!internalState) return 'NUEVO';
  
  // Normalize
  const lower = String(internalState).toLowerCase().trim().replace(/\s+/g, '_');

  switch (lower) {
    // --- NUEVO ---
    case 'nuevo':
    case 'pendiente':
      return 'NUEVO';

    // --- CONTACTADO ---
    case 'contactado':
      return 'CONTACTADO';

    // --- VISITA AGENDADA ---
    case 'visita_agendada':
    case 'agendada_visita':
      return 'VISITA AGENDADA';

    // --- VISITADO ---
    case 'visitado':
    case 'cerrado': 
    case 'en_curso': 
      return 'VISITADO'; 

    // --- PRESUPUESTADO ---
    case 'presupuestado':
    case 'en_preparacion':
      return 'PRESUPUESTADO';

    // --- ACEPTADO ---
    case 'aceptado':
    case 'finalizado':
    case 'facturado': 
    case 'completado':
    case 'garantia':
      return 'ACEPTADO';

    // --- RECHAZADO ---
    case 'rechazado':
      return 'RECHAZADO';

    // --- CANCELADO ---
    case 'cancelado':
    case 'anulado':
    case 'archivado':
      return 'CANCELADO';

    default:
      return 'NUEVO';
  }
};

/**
 * Maps UI State string back to internal database value.
 */
export const mapUIToInternal = (uiState) => {
  switch (uiState) {
    case 'NUEVO':           return 'nuevo';
    case 'CONTACTADO':      return 'contactado';
    case 'VISITA AGENDADA': return 'visita_agendada';
    case 'VISITADO':        return 'cerrado'; 
    case 'PRESUPUESTADO':   return 'presupuestado';
    case 'ACEPTADO':        return 'aceptado';
    case 'RECHAZADO':       return 'rechazado';
    case 'CANCELADO':       return 'cancelado';
    default:                return 'nuevo';
  }
};