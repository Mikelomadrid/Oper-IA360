// Taxonomía controlada para clasificar obras (proyectos) y poder analizar
// márgenes por tipo de trabajo, oficio dominante y tamaño operativo.
//
// IMPORTANTE: estos valores deben coincidir exactamente con los CHECK
// constraints de la migración `add_clasificacion_rentabilidad_proyectos`
// aplicada sobre la tabla `proyectos`. Si se añade/quita un valor aquí,
// hay que actualizar también los CHECK en base de datos.

export const TIPOS_PRINCIPALES_TRABAJO = [
  { value: 'reforma_integral', label: 'Reforma integral' },
  { value: 'reforma_parcial', label: 'Reforma parcial' },
  { value: 'bano', label: 'Baño' },
  { value: 'cocina', label: 'Cocina' },
  { value: 'electricidad', label: 'Electricidad' },
  { value: 'fontaneria', label: 'Fontanería' },
  { value: 'pintura', label: 'Pintura' },
  { value: 'albanileria', label: 'Albañilería' },
  { value: 'pladur_techos', label: 'Pladur / Techos' },
  { value: 'climatizacion', label: 'Climatización' },
  { value: 'cerrajeria', label: 'Cerrajería' },
  { value: 'mantenimiento_aviso', label: 'Mantenimiento / Aviso' },
  { value: 'inspeccion_ite_oca', label: 'Inspección ITE / OCA' },
  { value: 'suministro_instalacion', label: 'Suministro e instalación' },
  { value: 'otro', label: 'Otro' },
];

export const OFICIOS_DOMINANTES = [
  { value: 'electricidad', label: 'Electricidad' },
  { value: 'fontaneria', label: 'Fontanería' },
  { value: 'pintura', label: 'Pintura' },
  { value: 'albanileria', label: 'Albañilería' },
  { value: 'pladur_techos', label: 'Pladur / Techos' },
  { value: 'climatizacion', label: 'Climatización' },
  { value: 'coordinacion_multioficio', label: 'Coordinación multioficio' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
];

export const OFICIOS_SECUNDARIOS = [
  { value: 'electricidad', label: 'Electricidad' },
  { value: 'fontaneria', label: 'Fontanería' },
  { value: 'pintura', label: 'Pintura' },
  { value: 'albanileria', label: 'Albañilería' },
  { value: 'pladur_techos', label: 'Pladur / Techos' },
  { value: 'climatizacion', label: 'Climatización' },
  { value: 'limpieza_desescombro', label: 'Limpieza / Desescombro' },
  { value: 'compras_logistica', label: 'Compras / Logística' },
  { value: 'coordinacion', label: 'Coordinación' },
];

export const TAMANOS_OPERATIVOS = [
  { value: 'parte_pequeno', label: 'Parte pequeño' },
  { value: 'trabajo_pequeno', label: 'Trabajo pequeño' },
  { value: 'obra_media', label: 'Obra media' },
  { value: 'obra_grande', label: 'Obra grande' },
  { value: 'obra_multioficio', label: 'Obra multioficio' },
  { value: 'obra_critica', label: 'Obra crítica' },
];

export const ESTADOS_VALIDEZ_ANALISIS = [
  { value: 'valida', label: 'Válida' },
  { value: 'incompleta', label: 'Incompleta' },
  { value: 'viva', label: 'Viva' },
  { value: 'fantasma', label: 'Fantasma' },
  { value: 'cuadrada_terceros', label: 'Cuadrada con terceros' },
  { value: 'garantia_remate', label: 'Garantía / Remate' },
  { value: 'revisar', label: 'Revisar' },
];

export const ETIQUETAS_RENTABILIDAD = [
  { value: 'margen_alto', label: 'Margen alto' },
  { value: 'margen_correcto', label: 'Margen correcto' },
  { value: 'margen_bajo', label: 'Margen bajo' },
  { value: 'margen_negativo', label: 'Margen negativo' },
  { value: 'intensiva_personal', label: 'Intensiva en personal' },
  { value: 'intensiva_material', label: 'Intensiva en material' },
  { value: 'datos_no_fiables', label: 'Datos no fiables' },
];

export const labelFor = (list, value) => list.find((i) => i.value === value)?.label || value;

// Regla de negocio: al crear una obra, estado_validez_analisis por defecto es
// 'viva' si la obra nace activa/en espera, o 'revisar' si no se puede determinar.
export const defaultEstadoValidezAnalisis = (estadoProyecto) => {
  if (estadoProyecto === 'activo' || estadoProyecto === 'en_espera') return 'viva';
  return 'revisar';
};

// Color-código ligero para el badge de estado_validez_analisis en la vista detalle.
export const ESTADO_VALIDEZ_BADGE_CLASSES = {
  valida: 'bg-green-100 text-green-800 border-green-200',
  cuadrada_terceros: 'bg-green-100 text-green-800 border-green-200',
  viva: 'bg-blue-100 text-blue-800 border-blue-200',
  garantia_remate: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  incompleta: 'bg-amber-100 text-amber-800 border-amber-200',
  revisar: 'bg-amber-100 text-amber-800 border-amber-200',
  fantasma: 'bg-red-100 text-red-800 border-red-200',
};
