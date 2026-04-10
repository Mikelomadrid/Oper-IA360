export const FORM_STATUS_OPTIONS = [
    { value: 'nuevo', label: 'NUEVO', description: 'Lead recién creado, sin contacto.' },
    { value: 'contactado', label: 'CONTACTADO', description: 'Se ha establecido comunicación inicial.' },
    { value: 'visita_agendada', label: 'AGENDADA VISITA', description: 'Fecha de visita confirmada.' },
    { value: 'visitado', label: 'VISITADO', description: 'Visita realizada, pendiente de presupuesto.' },
    { value: 'presupuestado', label: 'PRESUPUESTADO', description: 'Presupuesto enviado al cliente.' },
    { value: 'aceptado', label: 'ACEPTADO', description: 'Cliente ha aceptado el presupuesto.' },
    { value: 'rechazado', label: 'RECHAZADO', description: 'Cliente no interesado o perdido.' },
    { value: 'cancelado', label: 'CANCELADO', description: 'Lead descartado por nuestra parte.' },
    { value: 'anulado', label: 'ANULADO', description: 'Lead anulado administrativamente.' }
];

export const ESTADO_OPTIONS = FORM_STATUS_OPTIONS.map(opt => opt.value);

export const ESTADO_LABELS = FORM_STATUS_OPTIONS.reduce((acc, opt) => {
    acc[opt.value] = opt.label;
    return acc;
}, {});

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
    contactado:      '#0ea5e9', // sky-500
    visita_agendada: '#8b5cf6', // violet-500
    visitado:        '#d946ef', // fuchsia-500
    presupuestado:   '#f59e0b', // amber-500
    aceptado:        '#10b981', // emerald-500
    rechazado:       '#ef4444', // red-500
    cancelado:       '#64748b', // slate-500
    anulado:         '#9ca3af', // gray-400
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
    contactado:      { bg: '#f0f9ff', text: STATUS_COLORS.contactado,      br: STATUS_COLORS.contactado },
    visita_agendada: { bg: '#f5f3ff', text: STATUS_COLORS.visita_agendada, br: STATUS_COLORS.visita_agendada },
    visitado:        { bg: '#fdf4ff', text: STATUS_COLORS.visitado,        br: STATUS_COLORS.visitado },
    presupuestado:   { bg: '#fffbeb', text: STATUS_COLORS.presupuestado,   br: STATUS_COLORS.presupuestado },
    aceptado:        { bg: '#ecfdf5', text: STATUS_COLORS.aceptado,        br: STATUS_COLORS.aceptado },
    rechazado:       { bg: '#fef2f2', text: STATUS_COLORS.rechazado,       br: STATUS_COLORS.rechazado },
    cancelado:       { bg: '#f8fafc', text: STATUS_COLORS.cancelado,       br: STATUS_COLORS.cancelado },
    anulado:         { bg: '#f3f4f6', text: STATUS_COLORS.anulado,         br: STATUS_COLORS.anulado },
    default:         { bg: '#f1f5f9', text: STATUS_COLORS.default,         br: STATUS_COLORS.default }
};