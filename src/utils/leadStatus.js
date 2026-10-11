export const FORM_STATUS_OPTIONS = [
    { value: 'nuevo',           label: 'NUEVO',           description: 'Lead recién creado, sin contacto.' },
    { value: 'visita_agendada', label: 'VISITA AGENDADA', description: 'Fecha de visita confirmada.' },
    { value: 'visitado',        label: 'VISITADO',        description: 'Visita realizada, pendiente de presupuesto.' },
    { value: 'presupuestado',   label: 'PRESUPUESTADO',   description: 'Presupuesto enviado al cliente.' },
    { value: 'aceptado',        label: 'ACEPTADO',        description: 'Cliente ha aceptado el presupuesto.' },
    { value: 'rechazado',       label: 'RECHAZADO',       description: 'Cliente no interesado o perdido.' },
    { value: 'cancelado',       label: 'CANCELADO',       description: 'Lead descartado o cancelado.' }
    // NOTA: 'parte' se deja fuera a propósito. Es un estado de archivo/informativo
    // que se asigna automáticamente al convertir el lead en parte de trabajo
    // (ver convert_lead_to_parte en BD); no debe poder elegirse manualmente aquí.
];

export const ESTADO_OPTIONS = FORM_STATUS_OPTIONS.map(opt => opt.value);

export const ESTADO_LABELS = FORM_STATUS_OPTIONS.reduce((acc, opt) => {
    acc[opt.value] = opt.label;
    return acc;
}, {});
// Etiqueta de 'parte' añadida aparte, sin pasar por FORM_STATUS_OPTIONS (ver nota arriba).
ESTADO_LABELS.parte = 'PARTE';

export const getStatusLabel = (status) => {
    if (!status) return 'DESCONOCIDO';
    return ESTADO_LABELS[status] || 'DESCONOCIDO';
};

/**
 * STATUS_COLORS
 * Centralized color palette matching the Donut Chart (LeadsStatistics.jsx).
 * These are the exact hex codes used for visualization.
 */
export const STATUS_COLORS = {
    nuevo:           '#3b82f6', // blue-500
    visita_agendada: '#8b5cf6', // violet-500
    visitado:        '#d946ef', // fuchsia-500
    presupuestado:   '#f59e0b', // amber-500
    aceptado:        '#10b981', // emerald-500
    rechazado:       '#ef4444', // red-500
    cancelado:       '#64748b', // slate-500
    parte:           '#4f46e5', // indigo-600 (lead convertido en parte de trabajo)
    default:         '#cbd5e1'  // slate-300
};

/**
 * estadoMap
 * Defines styles for badges and text based on STATUS_COLORS.
 * bg: lighter background version matching the hue
 * text: solid color (STATUS_COLORS)
 * br: border color (STATUS_COLORS)
 */
export const estadoMap = {
    nuevo:           { bg: '#eff6ff', text: STATUS_COLORS.nuevo,           br: STATUS_COLORS.nuevo },
    visita_agendada: { bg: '#f5f3ff', text: STATUS_COLORS.visita_agendada, br: STATUS_COLORS.visita_agendada },
    visitado:        { bg: '#fdf4ff', text: STATUS_COLORS.visitado,        br: STATUS_COLORS.visitado },
    presupuestado:   { bg: '#fffbeb', text: STATUS_COLORS.presupuestado,   br: STATUS_COLORS.presupuestado },
    aceptado:        { bg: '#ecfdf5', text: STATUS_COLORS.aceptado,        br: STATUS_COLORS.aceptado },
    rechazado:       { bg: '#fef2f2', text: STATUS_COLORS.rechazado,       br: STATUS_COLORS.rechazado },
    cancelado:       { bg: '#f8fafc', text: STATUS_COLORS.cancelado,       br: STATUS_COLORS.cancelado },
    parte:           { bg: '#eef2ff', text: STATUS_COLORS.parte,           br: STATUS_COLORS.parte },
    default:         { bg: '#f1f5f9', text: STATUS_COLORS.default,         br: STATUS_COLORS.default }
};
