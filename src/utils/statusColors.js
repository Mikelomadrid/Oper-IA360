import { mapInternalToUI } from './parteEstadoUIMap';

export const getStatusColor = (status) => {
  if (!status) return '#94a3b8'; // Slate 400

  // Trabajamos siempre con la etiqueta de UI (mayúsculas).
  // Si llega un estado crudo de la BD (minúsculas), lo mapeamos primero.
  let uiStatus = status;
  if (status === status.toLowerCase()) {
    uiStatus = mapInternalToUI(status);
  } else {
    uiStatus = status.toUpperCase();
  }

  switch (uiStatus) {
    case 'NUEVO':            return '#64748b'; // Slate 500 (gris)
    case 'CONTACTADO':       return '#3b82f6'; // Blue 500
    case 'VISITA AGENDADA':  return '#6366f1'; // Indigo 500
    case 'VISITADO':         return '#8b5cf6'; // Violet 500
    case 'PRESUPUESTADO':    return '#f59e0b'; // Amber 500 (naranja)
    case 'REALIZADO':        return '#14b8a6'; // Teal 500 (trabajo hecho)
    case 'ACEPTADO':         return '#10b981'; // Emerald 500 (verde, pasa a obra)
    case 'RECHAZADO':        return '#f43f5e'; // Rose 500 (rojo, cliente rechaza presupuesto)
    case 'CANCELADO':        return '#dc2626'; // Red 600 (rojo más oscuro, cancelado por la empresa)
    case 'FACTURADO':        return '#0d9488'; // Teal 600 (facturado, pendiente de cobro)
    case 'COBRADO':          return '#047857'; // Emerald 700 (verde oscuro, cobrado de verdad)
    case 'CERRADO':          return '#475569'; // Slate 600 (gris oscuro, cerrado sin facturar)
    default:                 return '#94a3b8'; // Gris por defecto
  }
};

export const getStatusTextColor = (status) => {
  // Texto siempre blanco para que el badge de color sea legible.
  return '#ffffff';
};

export const getStatusLabel = (status) => {
  if (!status) return 'Desconocido';
  // Devuelve la etiqueta de UI (NUEVO, REALIZADO, FACTURADO, COBRADO, ...).
  return mapInternalToUI(status);
};
