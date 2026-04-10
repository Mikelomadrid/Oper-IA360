import { mapInternalToUI } from './parteEstadoUIMap';

export const getStatusColor = (status) => {
  if (!status) return '#94a3b8'; // Slate 400
  
  // Ensure we are working with the UI Label (Uppercase)
  // If we receive a raw DB state (lowercase), we map it first.
  let uiStatus = status;
  if (status === status.toLowerCase()) {
      uiStatus = mapInternalToUI(status);
  } else {
      uiStatus = status.toUpperCase();
  }

  // Simple, robust color mapping
  switch (uiStatus) {
    case 'NUEVO': return '#64748b'; // Slate 500 (Gray)
    case 'CONTACTADO': return '#3b82f6'; // Blue 500
    case 'VISITA AGENDADA': return '#6366f1'; // Indigo 500
    case 'VISITADO': return '#8b5cf6'; // Violet 500
    case 'PRESUPUESTADO': return '#f59e0b'; // Amber 500 (Orange/Yellow)
    case 'ACEPTADO': return '#10b981'; // Emerald 500 (Green)
    case 'RECHAZADO': return '#f43f5e'; // Rose 500 (Red)
    case 'CANCELADO': return '#ef4444'; // Red 500
    default: return '#94a3b8'; // Default Gray
  }
};

export const getStatusTextColor = (status) => {
  // CRITICAL FIX: Always return white text for colored badges to ensure visibility.
  // Previously this returned the same color as the background, making text invisible.
  return '#ffffff';
};

export const getStatusLabel = (status) => {
  if (!status) return 'Desconocido';
  // Use mapping to ensure 'cerrado' -> 'VISITADO', etc.
  return mapInternalToUI(status);
};