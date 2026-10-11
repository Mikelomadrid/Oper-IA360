import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileAudio2,
  FileText,
  HelpCircle,
  History,
  Eye,
  Link2,
  Loader2,
  Lock,
  PenLine,
  Plus,
  Ruler,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import html2pdf from 'html2pdf.js';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const emptyResult = () => ({
  objeto_presupuesto: '',
  notas_cabecera_presupuesto: '',
  resumen: '',
  necesidades_cliente: [],
  datos_pendientes: [],
  observaciones: [],
  mediciones: [],
  partidas: [],
  revision_alcance: [],
});

const defaultCommercialSettings = {
  gastos_generales_pct: 0,
  margen_pct: 0,
  iva_pct: 21,
};

const budgetScopeCondition = 'Única y exclusivamente se realizarán los trabajos especificados en este presupuesto. Si, por cualquier causa —cambios solicitados por el cliente, vicios ocultos o partidas no valoradas—, fuera necesario ejecutar trabajos no incluidos, estos se presupuestarán aparte.';

const budgetPaymentTerms = [
  { percentage: '50 %', description: 'A la aceptación del presupuesto, en concepto de señal y reserva de fecha en agenda.' },
  { percentage: '25 %', description: 'A la mitad de la ejecución de los trabajos.' },
  { percentage: '25 %', description: 'A la finalización de los trabajos.' },
];

const commercialStatusMeta = {
  emitido: { label: 'Emitido', className: 'border-slate-300 bg-slate-50 text-slate-700' },
  enviado: { label: 'Enviado', className: 'border-violet-300 bg-violet-50 text-violet-800' },
  aceptado: { label: 'Aceptado', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  cambios_solicitados: { label: 'Cambios solicitados', className: 'border-amber-300 bg-amber-50 text-amber-900' },
  rechazado: { label: 'Rechazado', className: 'border-red-300 bg-red-50 text-red-800' },
  anulado: { label: 'Anulado', className: 'border-slate-300 bg-slate-100 text-slate-600' },
};

const normalizeCommercialSettings = (settings = {}) => ({
  gastos_generales_pct: Math.max(0, Number(settings.gastos_generales_pct) || 0),
  margen_pct: Math.max(0, Number(settings.margen_pct) || 0),
  iva_pct: Math.max(0, Number(settings.iva_pct ?? 21) || 0),
});

const measurementOptions = [
  { value: 'suelo', label: 'Suelo' },
  { value: 'techo', label: 'Techo' },
  { value: 'paredes', label: 'Paredes de la estancia' },
  { value: 'pared', label: 'Paño de pared' },
  { value: 'tabique', label: 'Tabique' },
  { value: 'rodapie', label: 'Rodapié' },
  { value: 'puerta', label: 'Puerta' },
  { value: 'ventana', label: 'Ventana' },
  { value: 'otro', label: 'Otra medición' },
];

const executionPhases = [
  { value: 'protecciones', order: 10, label: 'Protecciones y tapado', description: 'Proteger zonas comunes, estancias y elementos que se conservan.' },
  { value: 'contenedor', order: 20, label: 'Contenedor y residuos', description: 'Implantar el contenedor y prever la gestión inicial de escombros.' },
  { value: 'demoliciones', order: 30, label: 'Demoliciones y desmontajes', description: 'Desmontar, demoler, levantar y retirar antes de reconstruir.' },
  { value: 'albanileria', order: 40, label: 'Albañilería y soportes', description: 'Rehacer fábricas, rozas, recrecidos y preparar los soportes.' },
  { value: 'instalaciones', order: 50, label: 'Instalaciones', description: 'Ejecutar canalizaciones y redes de electricidad, fontanería, clima y telecomunicaciones.' },
  { value: 'cerramientos', order: 60, label: 'Cerramientos y techos', description: 'Ejecutar tabiques, trasdosados y falsos techos.' },
  { value: 'impermeabilizacion', order: 70, label: 'Impermeabilización y nivelación', description: 'Impermeabilizar, regularizar y nivelar antes de revestir.' },
  { value: 'revestimientos', order: 80, label: 'Revestimientos', description: 'Colocar alicatados, solados, tarimas y otros revestimientos.' },
  { value: 'carpinteria', order: 90, label: 'Carpintería y equipamiento', description: 'Montar puertas, mobiliario y elementos de equipamiento.' },
  { value: 'acabados', order: 100, label: 'Acabados', description: 'Pintar, lacar y ejecutar terminaciones visibles.' },
  { value: 'remates', order: 110, label: 'Aparatos y remates', description: 'Colocar mecanismos, luminarias, sanitarios, griferías y remates finales.' },
  { value: 'pruebas_limpieza', order: 120, label: 'Pruebas y limpieza final', description: 'Probar, poner en servicio, repasar y entregar limpio.' },
  { value: 'pendiente', order: 999, label: 'Pendiente de ordenar', description: 'Revisar manualmente su posición en la secuencia de obra.' },
];

const executionPhaseMap = new Map(executionPhases.map((phase) => [phase.value, phase]));
const executionPhaseOptions = executionPhases.map((phase) => ({
  value: phase.value,
  label: `${String(phase.order / 10).padStart(2, '0')} · ${phase.label}`,
}));

const normalizeSearchText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const inferExecutionPhase = (line) => {
  if (line.fase_ejecucion && executionPhaseMap.has(line.fase_ejecucion)) return line.fase_ejecucion;
  const code = String(line.codigo || line.codigo_snapshot || '').trim();
  const text = normalizeSearchText(`${line.capitulo || line.capitulo_snapshot || ''} ${line.descripcion || ''}`);

  if (['11.1.01', '11.1.02'].includes(code) || /proteccion|proteger|tapado|tapar|cubrir/.test(text)) return 'protecciones';
  if (code === '11.1.03' || /alquiler.*contenedor|contenedor.*obra/.test(text)) return 'contenedor';
  if (['11.1.04', '11.1.05'].includes(code) || /telesaco|saca de escombro|gestion de residuo/.test(text)) return 'contenedor';
  if (code.startsWith('9.2') || /demolic|desmont|levantado|picado|retirada de (?:tabique|revestimiento|solado|alicatado)/.test(text)) return 'demoliciones';
  if (code.startsWith('4.4')) return 'albanileria';
  if (code.startsWith('4.2')) return 'cerramientos';
  if (code === '4.1.04') return 'impermeabilizacion';
  if (code.startsWith('4.1')) return 'revestimientos';
  if (code.startsWith('10.2')) return 'pruebas_limpieza';
  if (code.startsWith('6.')) return 'carpinteria';
  if (code.startsWith('5.')) return 'acabados';
  if (/impermeabili|nivelaci|regulariz|recrecido|solera/.test(text)) return 'impermeabilizacion';
  if (/alicat|solad|revestimiento|tarima|pavimento|rodapie/.test(text)) return 'revestimientos';
  if (/mecanismo|luminaria|sanitario|griferia|aparato|puesta en servicio|prueba final/.test(text)) return 'remates';
  if (/electric|fontan|saneamiento|climat|calefac|telecom|cable|tuberia|canalizacion|linea de/.test(text)) return 'instalaciones';
  if (/tabique|trasdosado|falso techo|placa de yeso|pladur|cerramiento/.test(text)) return 'cerramientos';
  if (/limpieza|repaso|entrega|pruebas/.test(text)) return 'pruebas_limpieza';
  if (/carpinter|puerta|ventana|mobiliario|encimera|equipamiento/.test(text)) return 'carpinteria';
  if (/pintura|pintado|lacado|barniz|acabado/.test(text)) return 'acabados';
  if (/albanil|fabrica de ladrillo|enfosc|guarnecido|enlucido|recibido|roza/.test(text)) return 'albanileria';
  return 'pendiente';
};

const orderExecutionLines = (lines) => lines
  .map((line, index) => ({ ...line, fase_ejecucion: inferExecutionPhase(line), __sourceIndex: index }))
  .sort((a, b) => {
    const phaseDifference = executionPhaseMap.get(a.fase_ejecucion).order - executionPhaseMap.get(b.fase_ejecucion).order;
    if (phaseDifference) return phaseDifference;
    return Number(a.orden ?? a.__sourceIndex) - Number(b.orden ?? b.__sourceIndex);
  })
  .map(({ __sourceIndex, ...line }) => line);

const ensureExecutionPlan = (lines, availableSystems) => {
  const normalized = (Array.isArray(lines) ? lines : []).map((line) => ({ ...line, fase_ejecucion: inferExecutionPhase(line) }));
  const hasDemolition = normalized.some((line) => line.estado_revision !== 'descartada' && line.fase_ejecucion === 'demoliciones');
  const hasContainer = normalized.some((line) => String(line.codigo || line.codigo_snapshot || '') === '11.1.03');
  const containerSystem = availableSystems.find((system) => system.codigo === '11.1.03');

  if (hasDemolition && !hasContainer && containerSystem) {
    normalized.push({
      sistema_id: containerSystem.id,
      codigo: containerSystem.codigo,
      capitulo: containerSystem.capitulo || containerSystem.categoria_detalle || null,
      descripcion: containerSystem.nombre,
      zona: 'Obra',
      unidad: containerSystem.unidad_base || 'ud',
      cantidad: 1,
      medicion_id: null,
      precio_unitario: '',
      desglose_precio: [],
      texto_origen: 'Añadida automáticamente al detectar trabajos de demolición.',
      confianza: 1,
      estado_revision: 'propuesta',
      fase_ejecucion: 'contenedor',
    });
  }

  return orderExecutionLines(normalized);
};

const scopeSeverity = {
  obligatoria: { label: 'Obligatorio', badge: 'border-red-200 bg-red-50 text-red-800' },
  recomendada: { label: 'Recomendado', badge: 'border-amber-200 bg-amber-50 text-amber-800' },
  confirmar: { label: 'Pendiente de confirmar', badge: 'border-blue-200 bg-blue-50 text-blue-800' },
};

const buildScopeChecks = (lines, notes, availableSystems, decisions = []) => {
  const activeLines = (Array.isArray(lines) ? lines : []).filter((line) => line.estado_revision !== 'descartada');
  const activeCodes = new Set(activeLines.map((line) => String(line.codigo || line.codigo_snapshot || '').trim()).filter(Boolean));
  const phases = new Set(activeLines.map(inferExecutionPhase));
  const lineText = normalizeSearchText(activeLines.map((line) => `${line.descripcion || ''} ${line.zona || ''}`).join(' '));
  const notesText = normalizeSearchText(notes || '');
  const budgetText = `${notesText} ${lineText}`;
  const decisionMap = new Map((Array.isArray(decisions) ? decisions : []).map((decision) => [decision.regla_id, decision]));
  const getSystem = (code) => availableSystems.find((system) => system.codigo === code) || null;
  const hasCodePrefix = (prefix) => Array.from(activeCodes).some((code) => code.startsWith(prefix));
  const disruptivePhases = ['demoliciones', 'albanileria', 'cerramientos', 'revestimientos', 'acabados'];
  const hasDisruptiveWork = disruptivePhases.some((phase) => phases.has(phase));
  const hasSeveralWorkPhases = disruptivePhases.filter((phase) => phases.has(phase)).length >= 2;
  const hasInstallations = phases.has('instalaciones');
  const hasWetArea = /bano|ducha|plato de ducha|zona humeda/.test(lineText);
  const hasCommonAreas = /zona(?:s)? comun|portal|rellano|ascensor|escalera|comunidad|finca/.test(budgetText);
  const checks = [];

  const addCheck = (check) => {
    const decision = decisionMap.get(check.id);
    checks.push({
      ...check,
      system: check.code ? getSystem(check.code) : null,
      decision: decision?.estado || null,
    });
  };

  if (phases.has('demoliciones')) {
    addCheck({
      id: 'residuos-demolicion',
      severity: 'obligatoria',
      code: '11.1.03',
      covered: activeCodes.has('11.1.03') || activeCodes.has('11.1.04'),
      title: 'Evacuación de escombros prevista',
      reason: 'Hay demoliciones. Debe existir contenedor o saca según el volumen y las condiciones de acceso.',
      question: 'Confirmar si corresponde contenedor de 7 m³ o telesaco y si necesita tasa de ocupación de vía pública.',
    });
  }

  if (hasDisruptiveWork) {
    addCheck({
      id: 'proteccion-zona-trabajo',
      severity: 'recomendada',
      code: '11.1.02',
      covered: activeCodes.has('11.1.02'),
      title: 'Protección de la zona de trabajo',
      reason: 'El presupuesto contiene trabajos que pueden generar polvo, manchas o daños en elementos que se conservan.',
      question: 'Definir cuántas estancias necesitan tapado de suelos, puertas, ventanas, mobiliario y enseres.',
    });
  }

  if (hasCommonAreas) {
    addCheck({
      id: 'proteccion-zonas-comunes',
      severity: 'recomendada',
      code: '11.1.01',
      covered: activeCodes.has('11.1.01'),
      title: 'Protección de accesos y zonas comunes',
      reason: 'Las notas mencionan portal, rellano, escalera, ascensor, comunidad o finca.',
      question: 'Confirmar el recorrido de entrada de materiales y retirada de escombros que debe protegerse.',
    });
  }

  if (hasInstallations) {
    addCheck({
      id: 'ayudas-albanileria-instalaciones',
      severity: 'recomendada',
      code: '4.3.02',
      covered: hasCodePrefix('4.3') || /roza|calo|recibido|tapado posterior/.test(budgetText),
      title: 'Ayudas de albañilería para instalaciones',
      reason: 'Hay instalaciones nuevas y pueden requerir rozas, calos, recibido de cajas o tapados posteriores.',
      question: 'Confirmar si las canalizaciones serán vistas o empotradas y quién realizará aperturas y cierres.',
    });

    addCheck({
      id: 'pruebas-instalaciones',
      severity: 'obligatoria',
      covered: /prueba|comprobacion|puesta en servicio|certific/.test(budgetText),
      title: 'Pruebas y puesta en servicio',
      reason: 'Las instalaciones deben presupuestarse con sus comprobaciones finales cuando no estén incluidas en la descripción.',
      question: 'Definir las pruebas, verificaciones o certificados que deben entregarse al finalizar.',
    });
  }

  if (hasWetArea && (phases.has('revestimientos') || phases.has('albanileria'))) {
    addCheck({
      id: 'impermeabilizacion-zona-humeda',
      severity: 'confirmar',
      covered: /impermeabili/.test(lineText),
      title: 'Impermeabilización de la zona húmeda',
      reason: 'Se ha detectado baño, ducha o zona húmeda, pero no una impermeabilización claramente presupuestada.',
      question: 'Confirmar si se actúa en ducha o suelo húmedo y qué sistema de impermeabilización debe incluirse.',
    });
  }

  if (phases.has('revestimientos')) {
    addCheck({
      id: 'estado-soportes-revestimientos',
      severity: 'confirmar',
      covered: phases.has('impermeabilizacion') || /nivelaci|regulariz|recrecido|solera|soporte preparado/.test(budgetText),
      title: 'Estado y preparación de los soportes',
      reason: 'Hay alicatados, solados u otros revestimientos y no consta si paredes y suelos están listos para recibirlos.',
      question: 'Comprobar planeidad, humedad, consistencia y necesidad de nivelación o regularización del soporte.',
    });
  }

  if (hasSeveralWorkPhases) {
    addCheck({
      id: 'limpieza-fin-obra',
      severity: 'recomendada',
      code: '10.2.02',
      covered: activeCodes.has('10.2.02') || /limpieza de fin de obra/.test(lineText),
      title: 'Limpieza de fin de obra',
      reason: 'El alcance combina varias fases de obra y conviene definir si la entrega incluye limpieza final.',
      question: 'Confirmar el nivel de limpieza y las zonas incluidas antes de entregar la obra.',
    });
  }

  return checks;
};

const newMeasurementId = () => globalThis.crypto?.randomUUID?.()
  || `medicion-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const newPriceComponentId = () => globalThis.crypto?.randomUUID?.()
  || `precio-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const newPendingDecisionId = () => globalThis.crypto?.randomUUID?.()
  || `pendiente-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizePendingDecision = (item) => {
  if (typeof item === 'string') {
    return {
      id: newPendingDecisionId(),
      texto: item,
      estado: 'pendiente',
      decidido_at: null,
    };
  }

  const allowedStates = new Set(['pendiente', 'confirmado', 'no_aplica']);
  return {
    id: item?.id || newPendingDecisionId(),
    texto: item?.texto || item?.descripcion || '',
    estado: allowedStates.has(item?.estado) ? item.estado : 'pendiente',
    decidido_at: item?.decidido_at || null,
  };
};

const normalizePendingDecisions = (items) => (Array.isArray(items) ? items : [])
  .map(normalizePendingDecision);

const decimal = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const formatMeasure = (value) => Number(value).toLocaleString('es-ES', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatMoney = (value) => Number(value || 0).toLocaleString('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const summarizeBudgetObject = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const beforeColon = text.split(':')[0]?.trim();
  const firstSentence = text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  const candidate = beforeColon && beforeColon.length >= 12 && beforeColon.length <= 120
    ? beforeColon
    : firstSentence || text;
  const shortened = candidate.length <= 180
    ? candidate
    : `${candidate.slice(0, 177).replace(/\s+\S*$/, '')}…`;
  return /[.!?…]$/.test(shortened) ? shortened : `${shortened}.`;
};

const normalizePriceBreakdown = (items) => (Array.isArray(items) ? items : []).map((item) => ({
  id: item.id || newPriceComponentId(),
  concepto: item.concepto || '',
  cantidad: item.cantidad ?? '',
  unidad: item.unidad || 'ud',
  precio_unitario: item.precio_unitario ?? '',
  es_alternativa: Boolean(item.es_alternativa),
}));

const getLinePricing = (line) => {
  const breakdown = normalizePriceBreakdown(line.desglose_precio);
  if (breakdown.length) {
    const active = breakdown.filter((item) => Number(item.cantidad) > 0);
    const pendingPrices = active.filter((item) => item.precio_unitario === ''
      || item.precio_unitario === null
      || !Number.isFinite(Number(item.precio_unitario))).length;
    const total = active.reduce((sum, item) => {
      const price = Number(item.precio_unitario);
      return sum + (Number.isFinite(price) ? Number(item.cantidad) * price : 0);
    }, 0);
    return { breakdown, pendingPrices, total, hasAnyPrice: active.some((item) => item.precio_unitario !== '' && item.precio_unitario !== null) };
  }
  const hasPrice = line.precio_unitario !== ''
    && line.precio_unitario !== null
    && Number.isFinite(Number(line.precio_unitario));
  return {
    breakdown,
    pendingPrices: hasPrice ? 0 : 1,
    total: Number(line.cantidad) > 0 && hasPrice ? Number(line.cantidad) * Number(line.precio_unitario) : 0,
    hasAnyPrice: hasPrice,
  };
};

const calculateMeasurement = (measurement) => {
  const largo = decimal(measurement.largo);
  const ancho = decimal(measurement.ancho);
  const alto = decimal(measurement.alto);
  if ((measurement.elemento === 'suelo' || measurement.elemento === 'techo') && largo && ancho) {
    return {
      resultado: Number((largo * ancho).toFixed(4)),
      unidad: 'm²',
      formula: `${formatMeasure(largo)} × ${formatMeasure(ancho)} = ${formatMeasure(largo * ancho)} m²`,
    };
  }
  if (measurement.elemento === 'paredes' && largo && ancho && alto) {
    const result = 2 * (largo + ancho) * alto;
    return {
      resultado: Number(result.toFixed(4)),
      unidad: 'm²',
      formula: `2 × (${formatMeasure(largo)} + ${formatMeasure(ancho)}) × ${formatMeasure(alto)} = ${formatMeasure(result)} m² brutos`,
    };
  }
  if ((measurement.elemento === 'pared' || measurement.elemento === 'tabique') && largo && alto) {
    const result = largo * alto;
    return {
      resultado: Number(result.toFixed(4)),
      unidad: 'm²',
      formula: `${formatMeasure(largo)} × ${formatMeasure(alto)} = ${formatMeasure(result)} m²`,
    };
  }
  return {};
};

const normalizeMeasurement = (measurement, index) => {
  const normalized = {
    id: measurement.id || `medicion-cargada-${index}`,
    estancia: measurement.estancia || '',
    elemento: measurement.elemento || 'otro',
    largo: measurement.largo ?? '',
    ancho: measurement.ancho ?? '',
    alto: measurement.alto ?? '',
    resultado: measurement.resultado ?? '',
    unidad: measurement.unidad || '',
    formula: measurement.formula || '',
    acabado: measurement.acabado || '',
    texto_origen: measurement.texto_origen || 'Añadida manualmente',
    fuente: measurement.fuente || 'manual',
    estado_revision: measurement.estado_revision || 'pendiente',
    observaciones: measurement.observaciones || '',
  };
  // La IA identifica la medida; el ERP realiza la aritmetica para evitar
  // resultados incoherentes aunque la formula textual sea correcta.
  return { ...normalized, ...calculateMeasurement(normalized) };
};

const toDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const isTextFile = (file) => /\.(txt|md|srt)$/i.test(file?.name || '');

export default function LeadVisitBudget({ leadId, canEdit, lead, navigate }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const budgetPreviewRef = useRef(null);
  const [notes, setNotes] = useState('');
  const [sourceFile, setSourceFile] = useState(null);
  const [result, setResult] = useState(emptyResult);
  const [commercialSettings, setCommercialSettings] = useState(defaultCommercialSettings);
  const [systems, setSystems] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [draftId, setDraftId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(null);
  const [pdfExportMode, setPdfExportMode] = useState(null);
  const [pdfEmission, setPdfEmission] = useState(null);
  const [emissions, setEmissions] = useState([]);
  const [emitting, setEmitting] = useState(false);
  const [emitDialogOpen, setEmitDialogOpen] = useState(false);
  const [commercialAction, setCommercialAction] = useState(null);
  const [commercialNotes, setCommercialNotes] = useState('');
  const [commercialUpdating, setCommercialUpdating] = useState(false);
  const [conversionEmission, setConversionEmission] = useState(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingDraft(true);
      const [systemsResponse, draftResponse, emissionsResponse] = await Promise.all([
        supabase
          .from('sistemas_rendimiento')
          .select('id,codigo,nombre,capitulo,categoria_detalle,unidad_base')
          .eq('activo', true)
          .neq('estado', 'inactivo')
          .order('codigo'),
        supabase
          .from('visitas_presupuesto')
          .select('*, partidas:visita_presupuesto_partidas(*)')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('presupuesto_emisiones')
          .select('id,visita_id,numero,version,estado,base_imponible,iva,total,emitido_at,enviado_at,respondido_at,respuesta_notas,proyecto_id')
          .eq('lead_id', leadId)
          .order('emitido_at', { ascending: false }),
      ]);
      if (!active) return;
      const loadedSystems = systemsResponse.error ? [] : (systemsResponse.data || []);
      const loadedSystemMap = new Map(loadedSystems.map((system) => [system.id, system]));
      if (!systemsResponse.error) setSystems(loadedSystems);
      if (!emissionsResponse.error) setEmissions(emissionsResponse.data || []);
      if (draftResponse.data) {
        const draft = draftResponse.data;
        setDraftId(draft.id);
        setNotes(draft.notas_originales || '');
        setCommercialSettings(normalizeCommercialSettings(draft.ajustes_comerciales));
        setResult({
          objeto_presupuesto: draft.objeto_presupuesto || summarizeBudgetObject(draft.resumen),
          notas_cabecera_presupuesto: draft.notas_cabecera_presupuesto || '',
          resumen: draft.resumen || '',
          necesidades_cliente: draft.necesidades_cliente || [],
          datos_pendientes: normalizePendingDecisions(draft.datos_pendientes),
          observaciones: draft.observaciones || [],
          mediciones: (draft.mediciones || []).map(normalizeMeasurement),
          revision_alcance: draft.revision_alcance || [],
          partidas: ensureExecutionPlan((draft.partidas || [])
            .sort((a, b) => a.orden - b.orden)
            .map((line) => {
              const linkedSystem = loadedSystemMap.get(line.sistema_id);
              return {
                ...line,
                codigo: line.codigo || line.codigo_snapshot || linkedSystem?.codigo || null,
                capitulo: line.capitulo || line.capitulo_snapshot || linkedSystem?.capitulo || linkedSystem?.categoria_detalle || null,
                cantidad: line.cantidad ?? '',
                precio_unitario: line.precio_unitario ?? '',
                desglose_precio: normalizePriceBreakdown(line.desglose_precio),
              };
            }), loadedSystems),
        });
      }
      setLoadingDraft(false);
    };
    load();
    return () => { active = false; };
  }, [leadId]);

  const systemMap = useMemo(() => new Map(systems.map((system) => [system.id, system])), [systems]);
  const systemCodeMap = useMemo(
    () => new Map(systems.map((system) => [system.codigo, system])),
    [systems],
  );
  const systemOptions = useMemo(() => systems.map((system) => ({
    value: system.id,
    label: `${system.codigo} · ${system.nombre} (${system.unidad_base})`,
  })), [systems]);
  const linkedMeasurementOptions = useMemo(() => result.mediciones.map((measurement, index) => ({
    value: measurement.id,
    label: `M-${String(index + 1).padStart(2, '0')} · ${measurement.estancia || 'Sin zona'} · ${measurementOptions.find((option) => option.value === measurement.elemento)?.label || 'Medición'} · ${measurement.resultado ? formatMeasure(measurement.resultado) : '—'} ${measurement.unidad || ''}`.trim(),
  })), [result.mediciones]);
  const measurementLabelMap = useMemo(
    () => new Map(linkedMeasurementOptions.map((option) => [option.value, option.label])),
    [linkedMeasurementOptions],
  );
  const orderedLineEntries = useMemo(() => result.partidas
    .map((line, index) => ({ line: { ...line, fase_ejecucion: inferExecutionPhase(line) }, index }))
    .sort((a, b) => {
      const phaseDifference = executionPhaseMap.get(a.line.fase_ejecucion).order - executionPhaseMap.get(b.line.fase_ejecucion).order;
      if (phaseDifference) return phaseDifference;
      return a.index - b.index;
    }), [result.partidas]);
  const budgetPhases = useMemo(() => {
    const phases = new Map(executionPhases.map((phase) => [phase.value, { ...phase, lines: [] }]));
    result.partidas.forEach((line, index) => {
      const phase = inferExecutionPhase(line);
      phases.get(phase).lines.push({ line: { ...line, fase_ejecucion: phase }, index });
    });
    return Array.from(phases.values()).filter((phase) => phase.lines.length > 0);
  }, [result.partidas]);
  const budgetSummary = useMemo(() => result.partidas.reduce((summary, line) => {
    if (line.estado_revision === 'descartada') return summary;
    summary.included += 1;
    const hasQuantity = Number(line.cantidad) > 0;
    const pricing = getLinePricing(line);
    summary.pendingPrices += pricing.pendingPrices;
    if (!hasQuantity) summary.pendingQuantities += 1;
    summary.base += pricing.total;
    return summary;
  }, { included: 0, pendingPrices: 0, pendingQuantities: 0, base: 0 }), [result.partidas]);
  const nextPendingPriceIndex = useMemo(() => result.partidas.findIndex((line) => (
    line.estado_revision !== 'descartada' && getLinePricing(line).pendingPrices > 0
  )), [result.partidas]);
  const commercialSummary = useMemo(() => {
    const settings = normalizeCommercialSettings(commercialSettings);
    const generalExpenses = budgetSummary.base * settings.gastos_generales_pct / 100;
    const costWithGeneralExpenses = budgetSummary.base + generalExpenses;
    const margin = costWithGeneralExpenses * settings.margen_pct / 100;
    const taxableBase = costWithGeneralExpenses + margin;
    const vat = taxableBase * settings.iva_pct / 100;
    return {
      ...settings,
      generalExpenses,
      costWithGeneralExpenses,
      margin,
      taxableBase,
      vat,
      total: taxableBase + vat,
    };
  }, [budgetSummary.base, commercialSettings]);
  const scopeChecks = useMemo(
    () => buildScopeChecks(result.partidas, notes, systems, result.revision_alcance),
    [result.partidas, notes, systems, result.revision_alcance],
  );
  const scopeSummary = useMemo(() => scopeChecks.reduce((summary, check) => {
    if (check.covered || check.decision === 'aceptada') summary.covered += 1;
    else if (check.decision === 'descartada') summary.dismissed += 1;
    else summary.pending += 1;
    return summary;
  }, { covered: 0, pending: 0, dismissed: 0 }), [scopeChecks]);
  const preparationChecks = useMemo(() => {
    const activeLines = result.partidas.filter((line) => line.estado_revision !== 'descartada');
    const unmatchedLines = activeLines.filter((line) => !line.sistema_id).length;
    const firstUnmatchedIndex = result.partidas.findIndex((line) => line.estado_revision !== 'descartada' && !line.sistema_id);
    const firstMissingQuantityIndex = result.partidas.findIndex((line) => line.estado_revision !== 'descartada' && !(Number(line.cantidad) > 0));
    const firstMissingPriceIndex = result.partidas.findIndex((line) => line.estado_revision !== 'descartada' && getLinePricing(line).pendingPrices > 0);
    const usedMeasurementIds = new Set(activeLines.map((line) => line.medicion_id).filter(Boolean));
    const pendingMeasurements = result.mediciones.filter((measurement) => (
      usedMeasurementIds.has(measurement.id) && measurement.estado_revision !== 'confirmada'
    )).length;
    const firstPendingMeasurementIndex = result.mediciones.findIndex((measurement) => (
      usedMeasurementIds.has(measurement.id) && measurement.estado_revision !== 'confirmada'
    ));
    const pendingData = normalizePendingDecisions(result.datos_pendientes)
      .filter((item) => item.estado === 'pendiente' && item.texto.trim()).length;

    return [
      {
        id: 'partidas',
        ok: budgetSummary.included > 0,
        title: 'Partidas incluidas',
        detail: budgetSummary.included > 0
          ? `${budgetSummary.included} partidas forman parte del presupuesto.`
          : 'Todavía no hay ninguna partida incluida.',
        targetId: 'partidas-propuestas',
      },
      {
        id: 'biblioteca',
        ok: unmatchedLines === 0,
        title: 'Partidas identificadas',
        detail: unmatchedLines === 0
          ? 'Todas las partidas están vinculadas con la biblioteca.'
          : `${unmatchedLines} partidas necesitan vincularse o definirse manualmente.`,
        targetId: firstUnmatchedIndex >= 0 ? `partida-propuesta-${firstUnmatchedIndex}` : 'partidas-propuestas',
      },
      {
        id: 'cantidades',
        ok: budgetSummary.pendingQuantities === 0,
        title: 'Cantidades completas',
        detail: budgetSummary.pendingQuantities === 0
          ? 'Todas las partidas incluidas tienen cantidad.'
          : `Faltan cantidades en ${budgetSummary.pendingQuantities} partidas.`,
        targetId: firstMissingQuantityIndex >= 0 ? `partida-propuesta-${firstMissingQuantityIndex}` : 'partidas-propuestas',
      },
      {
        id: 'precios',
        ok: budgetSummary.pendingPrices === 0,
        title: 'Precios completos',
        detail: budgetSummary.pendingPrices === 0
          ? 'Todas las partidas incluidas están valoradas.'
          : `Faltan ${budgetSummary.pendingPrices} precios o componentes de precio.`,
        targetId: firstMissingPriceIndex >= 0 ? `presupuesto-linea-${firstMissingPriceIndex}` : 'presupuesto-interno',
      },
      {
        id: 'mediciones',
        ok: pendingMeasurements === 0,
        title: 'Mediciones vinculadas confirmadas',
        detail: pendingMeasurements === 0
          ? 'Las mediciones utilizadas están confirmadas.'
          : `${pendingMeasurements} mediciones utilizadas siguen pendientes de confirmar.`,
        targetId: firstPendingMeasurementIndex >= 0 ? `medicion-${firstPendingMeasurementIndex}` : 'cuaderno-mediciones',
      },
      {
        id: 'alcance',
        ok: scopeSummary.pending === 0,
        title: 'Alcance revisado',
        detail: scopeSummary.pending === 0
          ? 'Todas las comprobaciones de alcance están cubiertas o decididas.'
          : `${scopeSummary.pending} ${scopeSummary.pending === 1 ? 'comprobación de alcance requiere' : 'comprobaciones de alcance requieren'} una decisión.`,
        targetId: 'revision-alcance',
      },
      {
        id: 'pendientes',
        ok: pendingData === 0,
        title: 'Datos por confirmar',
        detail: pendingData === 0
          ? 'No quedan datos abiertos antes de cerrar el presupuesto.'
          : `Quedan ${pendingData} datos por confirmar con el cliente o en el replanteo.`,
        targetId: pendingData > 0 ? 'dato-pendiente-0' : 'datos-pendientes',
      },
    ];
  }, [budgetSummary, result.datos_pendientes, result.mediciones, result.partidas, scopeSummary.pending]);
  const preparationSummary = useMemo(() => ({
    ready: preparationChecks.every((check) => check.ok),
    pending: preparationChecks.filter((check) => !check.ok).length,
  }), [preparationChecks]);
  const pendingDecisionSummary = useMemo(() => normalizePendingDecisions(result.datos_pendientes)
    .reduce((summary, item) => ({
      ...summary,
      [item.estado]: summary[item.estado] + 1,
    }), { pendiente: 0, confirmado: 0, no_aplica: 0 }), [result.datos_pendientes]);
  const latestEmission = emissions[0] || null;
  const documentReference = pdfExportMode === 'final' && pdfEmission
    ? `${pdfEmission.numero} · v${pdfEmission.version}`
    : latestEmission
      ? `${latestEmission.numero} · borrador v${latestEmission.version + 1}`
      : `PRE-${String(leadId || '').slice(0, 8).toUpperCase()} · borrador`;

  const reviewPreparationCheck = (check) => {
    const target = document.getElementById(check.targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const focusNextPendingPrice = () => {
    if (nextPendingPriceIndex < 0) return;
    const target = document.getElementById(`presupuesto-linea-${nextPendingPriceIndex}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      const pendingInput = target.querySelector('[data-price-input="true"]:not(:disabled)');
      pendingInput?.focus({ preventScroll: true });
    }, 450);
  };

  const openBudgetPreview = () => {
    setPreviewOpen(true);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById('presupuesto-vista-previa')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  };

  const downloadBudgetPdf = async (mode, emission = null) => {
    if (mode === 'final' && !preparationSummary.ready) {
      toast({ variant: 'destructive', title: 'El presupuesto todavía no está completo', description: `Revisa los ${preparationSummary.pending} grupos pendientes antes de generar el PDF definitivo.` });
      return;
    }

    setPdfGenerating(mode);
    setPdfExportMode(mode);
    setPdfEmission(mode === 'final' ? emission : null);
    setPreviewOpen(true);
    try {
      await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
      const element = budgetPreviewRef.current;
      if (!element) throw new Error('No se encontró la vista previa del presupuesto.');
      const clientName = lead?.nombre_empresa || lead?.nombre_contacto || 'Cliente';
      const safeClientName = clientName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Cliente';
      const date = new Date().toISOString().slice(0, 10);
      const emittedReference = emission || latestEmission;
      const filename = mode === 'final' && emittedReference
        ? `${emittedReference.numero}_v${emittedReference.version}_${safeClientName}.pdf`
        : `Presupuesto_${safeClientName}_${mode === 'draft' ? 'BORRADOR_' : ''}${date}.pdf`;
      await html2pdf().set({
        margin: [9, 9, 11, 9],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'], avoid: ['.pdf-avoid-break'] },
      }).from(element).save();
      toast({ title: mode === 'final' ? 'PDF definitivo generado' : 'PDF borrador generado', description: filename });
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo generar el PDF', description: error.message });
    } finally {
      setPdfExportMode(null);
      setPdfEmission(null);
      setPdfGenerating(null);
    }
  };

  const updateLine = (index, patch) => {
    setResult((current) => ({
      ...current,
      partidas: current.partidas.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line),
    }));
  };

  const updatePriceComponent = (lineIndex, componentIndex, patch) => {
    const line = result.partidas[lineIndex];
    const breakdown = normalizePriceBreakdown(line?.desglose_precio).map((item, index) => (
      index === componentIndex ? { ...item, ...patch } : item
    ));
    updateLine(lineIndex, { desglose_precio: breakdown, precio_unitario: '' });
  };

  const addPriceComponent = (lineIndex) => {
    const line = result.partidas[lineIndex];
    updateLine(lineIndex, {
      desglose_precio: [...normalizePriceBreakdown(line?.desglose_precio), {
        id: newPriceComponentId(),
        concepto: '',
        cantidad: 1,
        unidad: 'ud',
        precio_unitario: '',
        es_alternativa: false,
      }],
      precio_unitario: '',
    });
  };

  const removePriceComponent = (lineIndex, componentIndex) => {
    const line = result.partidas[lineIndex];
    updateLine(lineIndex, {
      desglose_precio: normalizePriceBreakdown(line?.desglose_precio).filter((_, index) => index !== componentIndex),
    });
  };

  const updateReviewItem = (field, index, value) => {
    setResult((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) => itemIndex === index ? value : item),
    }));
  };

  const removeReviewItem = (field, index) => {
    setResult((current) => ({
      ...current,
      [field]: current[field].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addReviewItem = (field) => {
    setResult((current) => ({
      ...current,
      [field]: [
        ...current[field],
        field === 'datos_pendientes'
          ? normalizePendingDecision({ texto: '', estado: 'pendiente' })
          : '',
      ],
    }));
  };

  const updatePendingDecision = (index, patch) => {
    setResult((current) => ({
      ...current,
      datos_pendientes: normalizePendingDecisions(current.datos_pendientes).map((item, itemIndex) => (
        itemIndex === index
          ? {
            ...item,
            ...patch,
            decidido_at: patch.estado && patch.estado !== 'pendiente'
              ? new Date().toISOString()
              : patch.estado === 'pendiente'
                ? null
                : item.decidido_at,
          }
          : item
      )),
    }));
  };

  const setScopeDecision = (ruleId, status) => {
    setResult((current) => ({
      ...current,
      revision_alcance: [
        ...(current.revision_alcance || []).filter((decision) => decision.regla_id !== ruleId),
        { regla_id: ruleId, estado: status, fecha: new Date().toISOString() },
      ],
    }));
  };

  const acceptScopeCheck = (check) => {
    if (check.system) {
      setResult((current) => {
        const alreadyIncluded = current.partidas.some((line) => (
          line.estado_revision !== 'descartada'
          && String(line.codigo || line.codigo_snapshot || '') === check.system.codigo
        ));
        const nextLines = alreadyIncluded ? current.partidas : [...current.partidas, {
          sistema_id: check.system.id,
          codigo: check.system.codigo,
          capitulo: check.system.capitulo || check.system.categoria_detalle || null,
          descripcion: check.system.nombre,
          zona: 'Obra',
          unidad: check.system.unidad_base || 'ud',
          cantidad: 1,
          medicion_id: null,
          precio_unitario: '',
          desglose_precio: [],
          texto_origen: `Añadida desde la revisión de alcance: ${check.reason}`,
          confianza: 1,
          estado_revision: 'propuesta',
          fase_ejecucion: inferExecutionPhase({ ...check.system, descripcion: check.system.nombre }),
        }];
        return {
          ...current,
          partidas: orderExecutionLines(nextLines),
          revision_alcance: [
            ...(current.revision_alcance || []).filter((decision) => decision.regla_id !== check.id),
            { regla_id: check.id, estado: 'aceptada', fecha: new Date().toISOString() },
          ],
        };
      });
      return;
    }

    setResult((current) => ({
      ...current,
      datos_pendientes: normalizePendingDecisions(current.datos_pendientes)
        .some((item) => item.texto === check.question)
        ? normalizePendingDecisions(current.datos_pendientes)
        : [...normalizePendingDecisions(current.datos_pendientes), normalizePendingDecision(check.question)],
      revision_alcance: [
        ...(current.revision_alcance || []).filter((decision) => decision.regla_id !== check.id),
        { regla_id: check.id, estado: 'aceptada', fecha: new Date().toISOString() },
      ],
    }));
  };

  const updateMeasurement = (index, patch, recalculate = false) => {
    setResult((current) => {
      let updatedMeasurement = null;
      const mediciones = current.mediciones.map((measurement, measurementIndex) => {
        if (measurementIndex !== index) return measurement;
        const updated = {
          ...measurement,
          ...patch,
          fuente: measurement.fuente === 'transcripcion' ? 'corregida' : measurement.fuente,
        };
        updatedMeasurement = recalculate ? { ...updated, ...calculateMeasurement(updated) } : updated;
        return updatedMeasurement;
      });
      const partidas = updatedMeasurement
        ? current.partidas.map((line) => line.medicion_id === updatedMeasurement.id ? {
          ...line,
          cantidad: updatedMeasurement.resultado || '',
          unidad: updatedMeasurement.unidad || line.unidad,
        } : line)
        : current.partidas;
      return { ...current, mediciones, partidas };
    });
  };

  const addMeasurement = () => {
    setResult((current) => ({
      ...current,
      mediciones: [...current.mediciones, normalizeMeasurement({
        id: newMeasurementId(),
        fuente: 'manual',
        texto_origen: 'Añadida manualmente',
      }, current.mediciones.length)],
    }));
  };

  const removeMeasurement = (index) => {
    setResult((current) => {
      const removedId = current.mediciones[index]?.id;
      return {
        ...current,
        mediciones: current.mediciones.filter((_, itemIndex) => itemIndex !== index),
        partidas: current.partidas.map((line) => line.medicion_id === removedId
          ? { ...line, medicion_id: null }
          : line),
      };
    });
  };

  const selectSystem = (index, systemId) => {
    const system = systemMap.get(systemId);
    const patch = system ? {
      sistema_id: system.id,
      codigo: system.codigo,
      capitulo: system.capitulo || system.categoria_detalle || null,
      descripcion: system.nombre,
      unidad: system.unidad_base,
      estado_revision: 'propuesta',
    } : { sistema_id: null, codigo: null, estado_revision: 'sin_coincidencia' };
    updateLine(index, {
      ...patch,
      fase_ejecucion: inferExecutionPhase({ ...result.partidas[index], ...patch, fase_ejecucion: null }),
    });
  };

  const selectMeasurement = (index, measurementId) => {
    const measurement = result.mediciones.find((item) => item.id === measurementId);
    if (!measurement) return;
    updateLine(index, {
      medicion_id: measurement.id,
      cantidad: measurement.resultado || '',
      unidad: measurement.unidad || '',
    });
  };

  const handleFile = async (file) => {
    if (!file) return;
    setDraftId(null);
    setResult(emptyResult());
    setCommercialSettings(defaultCommercialSettings);
    setSourceFile(file);
    if (isTextFile(file)) {
      const text = await file.text();
      setNotes(text);
    } else {
      setNotes('');
    }
  };

  const startNewVisit = () => {
    setDraftId(null);
    setNotes('');
    setSourceFile(null);
    setResult(emptyResult());
    setCommercialSettings(defaultCommercialSettings);
    if (fileRef.current) fileRef.current.value = '';
  };

  const analyze = async () => {
    if (!notes.trim() && !sourceFile) return;
    setAnalyzing(true);
    try {
      let file = null;
      if (sourceFile && !isTextFile(sourceFile)) file = await toDataUrl(sourceFile);
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session?.access_token) {
        throw new Error('La sesión no está disponible. Vuelve a iniciar sesión e inténtalo de nuevo.');
      }
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/analyze-visit-notes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          apikey: supabase.supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: notes.trim(), file, filename: sourceFile?.name || null }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `El análisis respondió con estado ${response.status}.`);
      if (data?.error) throw new Error(data.error);
      const normalizedLines = (data?.partidas || []).map((line) => {
        const matchedSystem = systemMap.get(line.sistema_id) || systemCodeMap.get(line.codigo);
        if (!matchedSystem) {
          return {
            ...line,
            sistema_id: null,
            codigo: null,
            estado_revision: 'sin_coincidencia',
          };
        }
        return {
          ...line,
          sistema_id: matchedSystem.id,
          codigo: matchedSystem.codigo,
          capitulo: matchedSystem.capitulo || matchedSystem.categoria_detalle || line.capitulo || null,
          unidad: line.unidad || matchedSystem.unidad_base,
          estado_revision: 'propuesta',
        };
      });
      setResult({
        ...emptyResult(),
        ...data,
        objeto_presupuesto: data?.objeto_presupuesto || summarizeBudgetObject(data?.resumen),
        notas_cabecera_presupuesto: data?.notas_cabecera_presupuesto || '',
        datos_pendientes: normalizePendingDecisions(data?.datos_pendientes),
        mediciones: (data?.mediciones || []).map(normalizeMeasurement),
        partidas: ensureExecutionPlan(normalizedLines, systems),
      });
      toast({
        title: 'Visita estructurada',
        description: 'Revisa las partidas y los datos pendientes antes de guardar el borrador.',
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo analizar la visita', description: error.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const saveDraft = async ({ silent = false } = {}) => {
    const sourceReference = notes.trim()
      || (sourceFile?.name ? `[Archivo PLAUD analizado: ${sourceFile.name}]` : '')
      || (result.mediciones.length ? '[Mediciones introducidas manualmente]' : '');
    if (!sourceReference) {
      toast({ variant: 'destructive', title: 'Falta la transcripción o las notas originales' });
      return null;
    }
    setSaving(true);
    try {
      const payload = {
        lead_id: leadId,
        titulo: sourceFile?.name ? `Visita · ${sourceFile.name}` : 'Visita a cliente',
        fuente_tipo: sourceFile ? 'plaud_transcripcion' : 'manual',
        fuente_nombre: sourceFile?.name || null,
        notas_originales: sourceReference,
        objeto_presupuesto: result.objeto_presupuesto?.trim() || summarizeBudgetObject(result.resumen) || null,
        notas_cabecera_presupuesto: result.notas_cabecera_presupuesto?.trim() || null,
        resumen: result.resumen || null,
        necesidades_cliente: result.necesidades_cliente || [],
        datos_pendientes: result.datos_pendientes || [],
        observaciones: result.observaciones || [],
        mediciones: result.mediciones || [],
        revision_alcance: result.revision_alcance || [],
        ajustes_comerciales: normalizeCommercialSettings(commercialSettings),
        estado: 'borrador',
        updated_at: new Date().toISOString(),
      };
      let visitId = draftId;
      if (draftId) {
        const { error } = await supabase.from('visitas_presupuesto').update(payload).eq('id', draftId);
        if (error) throw error;
        const { error: deleteError } = await supabase
          .from('visita_presupuesto_partidas')
          .delete()
          .eq('visita_id', draftId);
        if (deleteError) throw deleteError;
      } else {
        const { data, error } = await supabase.from('visitas_presupuesto').insert(payload).select('id').single();
        if (error) throw error;
        visitId = data.id;
        setDraftId(visitId);
      }
      const lines = orderExecutionLines(result.partidas).map((line, index) => {
        const linkedSystem = systemMap.get(line.sistema_id);
        return {
          visita_id: visitId,
          sistema_id: linkedSystem ? line.sistema_id : null,
          codigo_snapshot: line.codigo || linkedSystem?.codigo || null,
          capitulo_snapshot: line.capitulo || linkedSystem?.capitulo || linkedSystem?.categoria_detalle || null,
          descripcion: line.descripcion?.trim() || 'Partida pendiente de definir',
          zona: line.zona?.trim() || null,
          unidad: line.unidad?.trim() || null,
          cantidad: Number(line.cantidad) > 0 ? Number(line.cantidad) : null,
          texto_origen: line.texto_origen?.trim() || null,
          confianza: Number.isFinite(Number(line.confianza)) ? Number(line.confianza) : null,
          estado_revision: line.estado_revision || (linkedSystem ? 'propuesta' : 'sin_coincidencia'),
          medicion_id: line.medicion_id || null,
          precio_unitario: line.precio_unitario === '' || line.precio_unitario === null
            ? null
            : Math.max(0, Number(line.precio_unitario) || 0),
          desglose_precio: normalizePriceBreakdown(line.desglose_precio).map((item) => ({
            ...item,
            cantidad: Math.max(0, Number(item.cantidad) || 0),
            precio_unitario: item.precio_unitario === '' || item.precio_unitario === null
              ? null
              : Math.max(0, Number(item.precio_unitario) || 0),
          })),
          orden: index,
          fase_ejecucion: line.fase_ejecucion || inferExecutionPhase(line),
          orden_ejecucion: executionPhaseMap.get(line.fase_ejecucion || inferExecutionPhase(line)).order,
        };
      });
      if (lines.length) {
        const { error } = await supabase.from('visita_presupuesto_partidas').insert(lines);
        if (error) throw error;
      }
      if (!silent) toast({ title: 'Borrador guardado', description: 'No se ha creado ninguna obra ni enviado nada a ContaSimple.' });
      return visitId;
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo guardar el borrador', description: error.message });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const buildEmissionSnapshot = (visitId) => ({
    schema_version: 1,
    visita_id: visitId,
    lead: {
      id: leadId,
      nombre_contacto: lead?.nombre_contacto || null,
      nombre_empresa: lead?.nombre_empresa || null,
      cif: lead?.cif || null,
      telefono: lead?.telefono || null,
      email: lead?.email || null,
      direccion: lead?.direccion || null,
      codigo_postal: lead?.codigo_postal || null,
      municipio: lead?.municipio || null,
    },
    documento: {
      objeto_presupuesto: result.objeto_presupuesto?.trim() || summarizeBudgetObject(result.resumen),
      notas_cabecera_presupuesto: result.notas_cabecera_presupuesto?.trim() || null,
      resumen: result.resumen || null,
      condicion_alcance: budgetScopeCondition,
      forma_pago: budgetPaymentTerms,
    },
    ajustes_comerciales: normalizeCommercialSettings(commercialSettings),
    totales: {
      base_partidas: budgetSummary.base,
      gastos_generales: commercialSummary.generalExpenses,
      margen: commercialSummary.margin,
      base_imponible: commercialSummary.taxableBase,
      iva: commercialSummary.vat,
      total: commercialSummary.total,
    },
    mediciones: result.mediciones || [],
    partidas: orderExecutionLines(result.partidas)
      .filter((line) => line.estado_revision !== 'descartada')
      .map((line, index) => ({
        orden: index,
        sistema_id: line.sistema_id || null,
        codigo: line.codigo || null,
        capitulo: line.capitulo || null,
        descripcion: line.descripcion || '',
        zona: line.zona || null,
        unidad: line.unidad || null,
        cantidad: Number(line.cantidad),
        medicion_id: line.medicion_id || null,
        fase_ejecucion: line.fase_ejecucion || inferExecutionPhase(line),
        precio_unitario: line.precio_unitario === '' || line.precio_unitario === null ? null : Number(line.precio_unitario),
        desglose_precio: normalizePriceBreakdown(line.desglose_precio).map((item) => ({
          ...item,
          cantidad: Number(item.cantidad) || 0,
          precio_unitario: item.precio_unitario === '' || item.precio_unitario === null ? null : Number(item.precio_unitario),
        })),
      })),
  });

  const emitBudget = async () => {
    if (!preparationSummary.ready) {
      toast({ variant: 'destructive', title: 'El presupuesto todavía no puede emitirse', description: `Resuelve los ${preparationSummary.pending} grupos pendientes antes de crear una versión definitiva.` });
      return;
    }
    setEmitting(true);
    try {
      const visitId = await saveDraft({ silent: true });
      if (!visitId) return;
      const snapshot = buildEmissionSnapshot(visitId);
      const { data, error } = await supabase.rpc('emitir_presupuesto_visita', {
        p_visita_id: visitId,
        p_snapshot: snapshot,
        p_importes: {
          base_partidas: budgetSummary.base,
          gastos_generales: commercialSummary.generalExpenses,
          margen: commercialSummary.margin,
          base_imponible: commercialSummary.taxableBase,
          iva: commercialSummary.vat,
          total: commercialSummary.total,
        },
      });
      if (error) throw error;
      const emission = Array.isArray(data) ? data[0] : data;
      if (!emission?.id) throw new Error('Supabase no devolvió la emisión creada.');
      setEmissions((current) => [emission, ...current.filter((item) => item.id !== emission.id)]);
      setEmitDialogOpen(false);
      toast({ title: `${emission.numero} · versión ${emission.version} emitida`, description: 'La fotografía del presupuesto ha quedado guardada y no puede modificarse.' });
      await downloadBudgetPdf('final', emission);
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo emitir el presupuesto', description: error.message });
    } finally {
      setEmitting(false);
    }
  };

  const openCommercialAction = (emission, status) => {
    setCommercialAction({ emission, status });
    setCommercialNotes('');
  };

  const updateCommercialStatus = async () => {
    if (!commercialAction) return;
    const requiresReason = ['cambios_solicitados', 'rechazado'].includes(commercialAction.status);
    if (requiresReason && !commercialNotes.trim()) {
      toast({ variant: 'destructive', title: 'Añade el motivo', description: 'La explicación quedará asociada a esta versión del presupuesto.' });
      return;
    }
    setCommercialUpdating(true);
    try {
      const { data, error } = await supabase.rpc('registrar_estado_presupuesto', {
        p_emision_id: commercialAction.emission.id,
        p_estado: commercialAction.status,
        p_observaciones: commercialNotes.trim() || null,
      });
      if (error) throw error;
      const updated = Array.isArray(data) ? data[0] : data;
      if (!updated?.id) throw new Error('Supabase no devolvió la versión actualizada.');
      setEmissions((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setCommercialAction(null);
      setCommercialNotes('');
      toast({
        title: `${updated.numero} · v${updated.version}: ${commercialStatusMeta[updated.estado]?.label || updated.estado}`,
        description: updated.estado === 'cambios_solicitados'
          ? 'El borrador puede corregirse y emitirse como una versión nueva.'
          : 'El cambio ha quedado registrado en el historial comercial.',
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo actualizar el presupuesto', description: error.message });
    } finally {
      setCommercialUpdating(false);
    }
  };

  const convertAcceptedBudget = async () => {
    if (!conversionEmission) return;
    setConverting(true);
    try {
      const { data, error } = await supabase.rpc('convertir_presupuesto_aceptado_a_obra', {
        p_emision_id: conversionEmission.id,
        p_descripcion: result.objeto_presupuesto?.trim() || null,
      });
      if (error) throw error;
      const conversion = Array.isArray(data) ? data[0] : data;
      if (!conversion?.proyecto_id) throw new Error('Supabase no devolvió el identificador de la obra.');
      setEmissions((current) => current.map((item) => item.id === conversionEmission.id
        ? { ...item, proyecto_id: conversion.proyecto_id }
        : item));
      setConversionEmission(null);
      toast({ title: 'Obra creada desde el presupuesto aceptado', description: `${conversion.partidas_creadas ?? 0} partidas se han trasladado a producción.` });
      if (navigate) navigate(`/gestion/obras/${conversion.proyecto_id}?tab=produccion`);
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo crear la obra', description: error.message });
    } finally {
      setConverting(false);
    }
  };

  if (loadingDraft) {
    return <div className="flex min-h-[280px] items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />Cargando visita…</div>;
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <FileAudio2 className="h-4 w-4" /> Visita → presupuesto
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Preparar presupuesto desde la conversación</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Importa la transcripción de PLAUD o escribe tus notas. La IA propondrá partidas, pero nada se aprobará ni enviará sin tu revisión.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {draftId && <Badge variant="outline" className="w-fit border-amber-300 bg-amber-50 text-amber-800">Borrador guardado</Badge>}
          <Button type="button" variant="outline" onClick={startNewVisit} disabled={!canEdit || analyzing || saving}>
            <Plus className="mr-2 h-4 w-4" />Nueva visita
          </Button>
        </div>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" />Fuente de la visita</CardTitle>
          <CardDescription>PLAUD: exporta preferentemente la transcripción completa con interlocutores en TXT, SRT, DOCX o PDF.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".txt,.md,.srt,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={!canEdit || analyzing}>
              <FileAudio2 className="mr-2 h-4 w-4" />Importar desde PLAUD
            </Button>
            {sourceFile && (
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                <span className="max-w-[320px] truncate font-medium">{sourceFile.name}</span>
                <button type="button" onClick={() => setSourceFile(null)} className="text-muted-foreground hover:text-destructive" aria-label="Quitar archivo"><Trash2 className="h-4 w-4" /></button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="visit-notes">Transcripción o notas originales</Label>
            <Textarea
              id="visit-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={10}
              disabled={!canEdit || analyzing}
              placeholder="Ej.: Cliente: queremos renovar el baño… Técnico: la pared mide…"
              className="resize-y font-mono text-sm leading-relaxed"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={analyze} disabled={!canEdit || analyzing || (!notes.trim() && !sourceFile)}>
              {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {analyzing ? 'Analizando conversación…' : 'Extraer trabajos y partidas'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card id="cuaderno-mediciones" className="scroll-mt-24 overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-stone-50/60 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Ruler className="h-4 w-4 text-primary" />Cuaderno de mediciones</CardTitle>
              <CardDescription className="mt-1">La IA extrae las medidas de la conversación. También puedes introducirlas o corregirlas a mano.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {!!result.mediciones.length && <Badge variant="outline" className="bg-white font-mono">{result.mediciones.length} medidas</Badge>}
              <Button type="button" variant="outline" size="sm" onClick={addMeasurement} disabled={!canEdit}>
                <PenLine className="mr-2 h-4 w-4" />Añadir medición
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          {!result.mediciones.length && (
            <div className="rounded-lg border border-dashed border-border/70 bg-stone-50/40 px-5 py-7 text-center">
              <Ruler className="mx-auto h-7 w-7 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium text-foreground">Todavía no hay medidas registradas</p>
              <p className="mt-1 text-sm text-muted-foreground">Analiza una transcripción que contenga medidas o añádelas manualmente.</p>
            </div>
          )}
          {result.mediciones.map((measurement, index) => (
            <article id={`medicion-${index}`} key={measurement.id || index} className="scroll-mt-24 overflow-hidden rounded-lg border border-border/60 bg-background">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-stone-50/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">M-{String(index + 1).padStart(2, '0')}</span>
                  <Badge variant="outline" className={measurement.fuente === 'manual' ? 'border-slate-200 bg-white text-slate-700' : 'border-violet-200 bg-violet-50 text-violet-800'}>
                    {measurement.fuente === 'transcripcion' ? 'Extraída de la transcripción' : measurement.fuente === 'corregida' ? 'Corregida manualmente' : 'Introducida manualmente'}
                  </Badge>
                  {(() => {
                    const linkedCount = result.partidas.filter((line) => line.medicion_id === measurement.id).length;
                    return linkedCount > 0 ? <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">Usada en {linkedCount} {linkedCount === 1 ? 'partida' : 'partidas'}</Badge> : null;
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={measurement.estado_revision === 'confirmada' ? 'default' : 'outline'}
                    onClick={() => updateMeasurement(index, { estado_revision: measurement.estado_revision === 'confirmada' ? 'pendiente' : 'confirmada' })}
                    disabled={!canEdit}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />{measurement.estado_revision === 'confirmada' ? 'Confirmada' : 'Confirmar'}
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeMeasurement(index)} disabled={!canEdit} aria-label="Eliminar medición"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="space-y-4 p-4">
                <div className="grid gap-4 md:grid-cols-[minmax(180px,.8fr)_minmax(220px,1fr)_minmax(220px,1.2fr)]">
                  <div className="space-y-2"><Label>Estancia o zona</Label><Input value={measurement.estancia} onChange={(event) => updateMeasurement(index, { estancia: event.target.value })} placeholder="Ej.: Cocina" disabled={!canEdit} /></div>
                  <div className="space-y-2"><Label>Elemento medido</Label><Combobox options={measurementOptions} value={measurement.elemento} onSelect={(value) => updateMeasurement(index, { elemento: value }, true)} placeholder="Seleccionar elemento…" searchPlaceholder="Buscar elemento…" emptyText="No se encontró el elemento." /></div>
                  <div className="space-y-2"><Label>Acabado o aplicación</Label><Input value={measurement.acabado} onChange={(event) => updateMeasurement(index, { acabado: event.target.value })} placeholder="Ej.: Alicatado porcelánico" disabled={!canEdit} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(100px,.7fr))_minmax(120px,.9fr)_100px]">
                  <div className="space-y-2"><Label>Largo (m)</Label><Input type="number" min="0" step="0.01" value={measurement.largo} onChange={(event) => updateMeasurement(index, { largo: event.target.value }, true)} className="font-mono" disabled={!canEdit} /></div>
                  <div className="space-y-2"><Label>Ancho (m)</Label><Input type="number" min="0" step="0.01" value={measurement.ancho} onChange={(event) => updateMeasurement(index, { ancho: event.target.value }, true)} className="font-mono" disabled={!canEdit} /></div>
                  <div className="space-y-2"><Label>Alto (m)</Label><Input type="number" min="0" step="0.01" value={measurement.alto} onChange={(event) => updateMeasurement(index, { alto: event.target.value }, true)} className="font-mono" disabled={!canEdit} /></div>
                  <div className="space-y-2"><Label>Resultado</Label><Input type="number" min="0" step="0.001" value={measurement.resultado} onChange={(event) => updateMeasurement(index, { resultado: event.target.value, fuente: measurement.fuente === 'transcripcion' ? 'corregida' : measurement.fuente })} className="font-mono font-semibold" disabled={!canEdit} /></div>
                  <div className="space-y-2"><Label>Unidad</Label><Input value={measurement.unidad} onChange={(event) => updateMeasurement(index, { unidad: event.target.value })} className="font-mono" disabled={!canEdit} /></div>
                </div>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                  <div className="rounded-md border border-violet-200/70 bg-violet-50/50 p-3">
                    <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-800"><Calculator className="h-3.5 w-3.5" />Traza del cálculo</Label>
                    <Input value={measurement.formula} onChange={(event) => updateMeasurement(index, { formula: event.target.value })} placeholder="Ej.: 6,60 × 2,90 = 19,14 m²" className="mt-2 border-violet-200 bg-white/90 font-mono text-sm" disabled={!canEdit} />
                    {(measurement.elemento === 'paredes' || measurement.elemento === 'pared') && <p className="mt-2 text-xs text-violet-700">Criterio ORKALED: superficie bruta; no se descuentan puertas ni ventanas en alicatado o pintura.</p>}
                  </div>
                  <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2"><Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span><strong>Origen:</strong> “{measurement.texto_origen || 'Sin fragmento identificado'}”</span></div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      {(result.resumen || result.datos_pendientes.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Resumen de la visita</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea value={result.resumen} onChange={(event) => setResult((current) => ({ ...current, resumen: event.target.value }))} rows={4} disabled={!canEdit} />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Necesidades confirmadas</p>
                {result.necesidades_cliente.map((item, index) => (
                  <div key={`confirmed-${index}`} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <Input value={item} onChange={(event) => updateReviewItem('necesidades_cliente', index, event.target.value)} disabled={!canEdit} />
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeReviewItem('necesidades_cliente', index)} disabled={!canEdit} aria-label="Eliminar necesidad confirmada"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => addReviewItem('necesidades_cliente')} disabled={!canEdit}><Plus className="mr-2 h-4 w-4" />Añadir necesidad</Button>
              </div>
            </CardContent>
          </Card>
          <Card id="datos-pendientes" className="scroll-mt-24 border-border/60 shadow-none">
            <CardHeader className="border-b border-border/50 pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4 text-violet-700" />Decisiones de la visita</CardTitle>
                  <CardDescription className="mt-1">Conserva cada duda y marca cómo quedó resuelta.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">{pendingDecisionSummary.pendiente} pendientes</Badge>
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">{pendingDecisionSummary.confirmado} confirmados</Badge>
                  <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">{pendingDecisionSummary.no_aplica} no aplican</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {normalizePendingDecisions(result.datos_pendientes).map((item, index) => {
                const isPending = item.estado === 'pendiente';
                const isConfirmed = item.estado === 'confirmado';
                return (
                  <article
                    id={`dato-pendiente-${index}`}
                    key={item.id}
                    className={`scroll-mt-24 rounded-md border p-3 ${isPending ? 'border-amber-200 bg-amber-50/50' : isConfirmed ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/70'}`}
                  >
                    <div className="flex items-start gap-2">
                      {isPending ? <AlertTriangle className="mt-2.5 h-4 w-4 shrink-0 text-amber-700" /> : isConfirmed ? <CheckCircle2 className="mt-2.5 h-4 w-4 shrink-0 text-emerald-700" /> : <X className="mt-2.5 h-4 w-4 shrink-0 text-slate-500" />}
                      <Input
                        value={item.texto}
                        onChange={(event) => updatePendingDecision(index, { texto: event.target.value })}
                        disabled={!canEdit}
                        className="border-border/60 bg-white/90 text-sm"
                        aria-label={`Decisión ${index + 1}`}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 pl-6">
                      <Button type="button" variant="outline" size="sm" className={`h-8 ${isPending ? 'border-amber-400 bg-amber-100 text-amber-900' : 'bg-white/80 text-muted-foreground'}`} onClick={() => updatePendingDecision(index, { estado: 'pendiente' })} disabled={!canEdit}>Pendiente</Button>
                      <Button type="button" variant="outline" size="sm" className={`h-8 ${isConfirmed ? 'border-emerald-400 bg-emerald-100 text-emerald-900' : 'bg-white/80 text-muted-foreground'}`} onClick={() => updatePendingDecision(index, { estado: 'confirmado' })} disabled={!canEdit}>Confirmado</Button>
                      <Button type="button" variant="outline" size="sm" className={`h-8 ${item.estado === 'no_aplica' ? 'border-slate-400 bg-slate-200 text-slate-800' : 'bg-white/80 text-muted-foreground'}`} onClick={() => updatePendingDecision(index, { estado: 'no_aplica' })} disabled={!canEdit}>No aplica</Button>
                    </div>
                  </article>
                );
              })}
              {!result.datos_pendientes.length && <p className="text-sm text-muted-foreground">No se han detectado decisiones pendientes.</p>}
              <Button type="button" variant="outline" size="sm" onClick={() => addReviewItem('datos_pendientes')} disabled={!canEdit}><Plus className="mr-2 h-4 w-4" />Añadir decisión</Button>
              {pendingDecisionSummary.pendiente > 0 && <p className="text-xs leading-5 text-amber-800">Solo las decisiones marcadas como <strong>Pendiente</strong> bloquean la emisión del presupuesto.</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {result.partidas.length > 0 && (
        <Card id="partidas-propuestas" className="scroll-mt-24 border-border/60 shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><CardTitle className="text-base">Partidas propuestas</CardTitle><CardDescription>Cada línea conserva la frase de la conversación que la originó.</CardDescription></div>
              <Badge variant="outline" className="font-mono">{result.partidas.length} líneas</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {orderedLineEntries.map(({ line, index }) => (
              <article id={`partida-propuesta-${index}`} key={line.id || index} className="scroll-mt-24 rounded-lg border border-border/60 bg-background p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(260px,1.35fr)_minmax(230px,1fr)_minmax(160px,.75fr)_110px_110px_auto] lg:items-end">
                  <div className="space-y-2"><Label>Partida de la biblioteca</Label><Combobox options={systemOptions} value={line.sistema_id || ''} onSelect={(value) => selectSystem(index, value)} placeholder="Relacionar partida…" searchPlaceholder="Buscar código o descripción…" emptyText="No se encontró ninguna partida." /></div>
                  <div className="space-y-2"><Label>Medición vinculada</Label><Combobox options={linkedMeasurementOptions} value={line.medicion_id || ''} onSelect={(value) => selectMeasurement(index, value)} placeholder="Vincular medición…" searchPlaceholder="Buscar por zona o elemento…" emptyText="No hay mediciones disponibles." /></div>
                  <div className="space-y-2"><Label>Zona</Label><Input value={line.zona || ''} onChange={(event) => updateLine(index, { zona: event.target.value })} placeholder="Ej.: Cocina" /></div>
                  <div className="space-y-2"><Label>Cantidad</Label><Input type="number" min="0" step="0.001" value={line.cantidad ?? ''} onChange={(event) => updateLine(index, { cantidad: event.target.value })} className="font-mono" disabled={!!line.medicion_id} /></div>
                  <div className="space-y-2"><Label>Unidad</Label><Input value={line.unidad || ''} onChange={(event) => updateLine(index, { unidad: event.target.value })} disabled={!!line.medicion_id} /></div>
                  <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setResult((current) => ({ ...current, partidas: current.partidas.filter((_, i) => i !== index) }))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="space-y-2"><Label>Orden de actuación</Label><Combobox options={executionPhaseOptions} value={line.fase_ejecucion || inferExecutionPhase(line)} onSelect={(value) => updateLine(index, { fase_ejecucion: value })} placeholder="Seleccionar fase…" searchPlaceholder="Buscar fase…" emptyText="No se encontró ninguna fase." /></div>
                  <div className="space-y-2"><Label>Descripción para el presupuesto</Label><Input value={line.descripcion || ''} onChange={(event) => updateLine(index, { descripcion: event.target.value })} /></div>
                </div>
                {line.medicion_id && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-violet-200/70 bg-violet-50/60 px-3 py-2 text-xs text-violet-900">
                    <div className="flex items-center gap-2"><Calculator className="h-3.5 w-3.5 shrink-0" /><span><strong>Cantidad sincronizada:</strong> {measurementLabelMap.get(line.medicion_id) || 'Medición vinculada'}</span></div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-violet-800 hover:bg-violet-100 hover:text-violet-950" onClick={() => updateLine(index, { medicion_id: null })} disabled={!canEdit}>Desvincular</Button>
                  </div>
                )}
                <div className="mt-3 flex items-start gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground"><Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span><strong>Origen:</strong> “{line.texto_origen || 'Sin fragmento identificado'}”</span></div>
                {!line.sistema_id && <div className="mt-2 text-xs font-medium text-amber-700">Sin coincidencia fiable: selecciona una partida o deja la línea pendiente.</div>}
              </article>
            ))}
            <Button type="button" variant="outline" onClick={() => setResult((current) => ({ ...current, partidas: [...current.partidas, { sistema_id: null, codigo: null, capitulo: null, descripcion: '', zona: '', unidad: '', cantidad: '', medicion_id: null, texto_origen: 'Añadida manualmente', confianza: 1, estado_revision: 'sin_coincidencia', fase_ejecucion: 'pendiente' }] }))}><Plus className="mr-2 h-4 w-4" />Añadir línea manual</Button>
          </CardContent>
        </Card>
      )}

      {result.partidas.length > 0 && (
        <Card id="revision-alcance" className="scroll-mt-24 overflow-hidden border-border/60 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-stone-50/60 pb-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4 text-primary" />Revisión del alcance</CardTitle>
                <CardDescription className="mt-1 max-w-2xl">
                  Comprueba trabajos auxiliares y preguntas que suelen quedar fuera. Tú decides qué se incorpora al presupuesto.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">{scopeSummary.covered} cubiertas</Badge>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">{scopeSummary.pending} por revisar</Badge>
                {scopeSummary.dismissed > 0 && <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{scopeSummary.dismissed} descartadas</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {scopeChecks.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="h-5 w-5 shrink-0" />No hay comprobaciones automáticas aplicables a estas partidas.
              </div>
            ) : scopeChecks.map((check) => {
              const covered = check.covered || check.decision === 'aceptada';
              const dismissed = check.decision === 'descartada';
              const severity = scopeSeverity[check.severity];
              return (
                <article key={check.id} className={`rounded-lg border p-4 ${covered ? 'border-emerald-200 bg-emerald-50/40' : dismissed ? 'border-slate-200 bg-slate-50/60 opacity-75' : 'border-amber-200 bg-amber-50/35'}`}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${covered ? 'border-emerald-200 bg-white text-emerald-700' : dismissed ? 'border-slate-200 bg-white text-slate-500' : 'border-amber-200 bg-white text-amber-700'}`}>
                        {covered ? <CheckCircle2 className="h-4 w-4" /> : check.severity === 'confirmar' ? <HelpCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{check.title}</h3>
                          <Badge variant="outline" className={severity.badge}>{severity.label}</Badge>
                          {covered && <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-800">Cubierto</Badge>}
                          {dismissed && <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">Descartado</Badge>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{check.reason}</p>
                        {!covered && !dismissed && <p className="mt-2 text-xs font-medium text-amber-900"><strong>Revisar:</strong> {check.question}</p>}
                        {check.system && !covered && !dismissed && <p className="mt-1 font-mono text-[11px] text-muted-foreground">Partida propuesta: {check.system.codigo} · {check.system.nombre}</p>}
                        {check.code && !check.system && !covered && !dismissed && <p className="mt-1 text-xs text-blue-800">La partida {check.code} no está disponible en la biblioteca activa; se guardará como pregunta pendiente.</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                      {dismissed ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => setScopeDecision(check.id, 'pendiente')} disabled={!canEdit}>Recuperar revisión</Button>
                      ) : !covered ? (
                        <>
                          <Button type="button" size="sm" onClick={() => acceptScopeCheck(check)} disabled={!canEdit}>{check.system ? <Plus className="mr-2 h-4 w-4" /> : <HelpCircle className="mr-2 h-4 w-4" />}{check.system ? 'Añadir partida' : 'Añadir a pendientes'}</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setScopeDecision(check.id, 'descartada')} disabled={!canEdit}>No aplica</Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
            <p className="text-xs text-muted-foreground">Estas reglas son una ayuda preventiva basada en el alcance detectado. No sustituyen tu revisión técnica ni añaden trabajos relevantes sin confirmación.</p>
          </CardContent>
        </Card>
      )}

      {result.partidas.length > 0 && (
        <Card id="presupuesto-interno" className="scroll-mt-24 overflow-hidden border-border/60 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-stone-50/60 pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" />Presupuesto interno por orden de actuación</CardTitle>
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Borrador</Badge>
                </div>
                <CardDescription className="mt-1 max-w-2xl">
                  Las partidas se ordenan por la secuencia real de obra. Puedes corregir la fase sin cambiar su capítulo técnico.
                </CardDescription>
                {budgetSummary.pendingPrices > 0 ? (
                  <Button type="button" variant="outline" size="sm" className="mt-3 border-amber-300 bg-white text-amber-900 hover:bg-amber-50" onClick={focusNextPendingPrice}>
                    <PenLine className="mr-2 h-4 w-4" />Valorar siguiente pendiente
                  </Button>
                ) : (
                  <Badge variant="outline" className="mt-3 border-emerald-200 bg-emerald-50 text-emerald-800"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Todas las partidas valoradas</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
                <div className="rounded-md border border-border/60 bg-white px-3 py-2"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fases</p><p className="mt-1 font-mono text-lg font-semibold">{budgetPhases.length}</p></div>
                <div className="rounded-md border border-border/60 bg-white px-3 py-2"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Incluidas</p><p className="mt-1 font-mono text-lg font-semibold">{budgetSummary.included}</p></div>
                <div className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2"><p className="text-[11px] uppercase tracking-wide text-amber-800">Sin precio</p><p className="mt-1 font-mono text-lg font-semibold text-amber-950">{budgetSummary.pendingPrices}</p></div>
                <div className="rounded-md border border-violet-200 bg-violet-50/70 px-3 py-2"><p className="text-[11px] uppercase tracking-wide text-violet-800">Base provisional</p><p className="mt-1 font-mono text-lg font-semibold text-violet-950">{formatMoney(budgetSummary.base)}</p></div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {budgetPhases.map((phase) => {
              const phaseBase = phase.lines.reduce((total, { line }) => {
                if (line.estado_revision === 'descartada') return total;
                return total + getLinePricing(line).total;
              }, 0);
              return (
                <section key={phase.value} className="overflow-hidden rounded-lg border border-border/60 bg-background">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-stone-50/70 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded bg-slate-900 font-mono text-xs font-bold text-white">{String(phase.order / 10).padStart(2, '0')}</span>
                      <div><h3 className="text-sm font-semibold text-foreground">{phase.label}</h3><p className="text-xs text-muted-foreground">{phase.description} · {phase.lines.length} {phase.lines.length === 1 ? 'partida' : 'partidas'}</p></div>
                    </div>
                    <div className="text-right"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal provisional</p><p className="font-mono text-base font-semibold">{formatMoney(phaseBase)}</p></div>
                  </div>
                  <div className="divide-y divide-border/50">
                    {phase.lines.map(({ line, index }) => {
                      const excluded = line.estado_revision === 'descartada';
                      const pricing = getLinePricing(line);
                      return (
                        <div id={`presupuesto-linea-${index}`} key={line.id || `${phase.value}-${index}`} className={`scroll-mt-24 p-4 ${excluded ? 'bg-slate-50/80 opacity-70' : ''}`}>
                          <div className="grid gap-3 lg:grid-cols-[90px_minmax(260px,1fr)_120px_120px_140px_140px] lg:items-end">
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Código</p>
                              <p className="mt-2 font-mono text-xs font-semibold">{line.codigo || 'SIN-CÓD.'}</p>
                              {!excluded && (
                                pricing.pendingPrices > 0
                                  ? <Badge variant="outline" className="mt-2 border-amber-200 bg-amber-50 text-[10px] text-amber-800">{pricing.hasAnyPrice ? 'Parcial' : 'Pendiente'}</Badge>
                                  : <Badge variant="outline" className="mt-2 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800">Valorada</Badge>
                              )}
                            </div>
                            <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Partida</p><p className="mt-2 text-sm font-medium leading-snug">{line.descripcion || 'Partida pendiente de definir'}</p><p className="mt-1 text-xs text-muted-foreground">{line.capitulo || 'Sin capítulo técnico'} · {line.zona || 'Sin zona definida'}</p></div>
                            <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cantidad</p><p className="mt-2 font-mono text-sm font-semibold">{line.cantidad || '—'} {line.unidad || ''}</p></div>
                            {pricing.breakdown.length ? (
                              <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Precio</p><Badge variant="outline" className="mt-2 border-violet-200 bg-violet-50 text-violet-800">Desglose activo</Badge></div>
                            ) : (
                              <div className="space-y-2"><Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Precio / unidad</Label><Input data-price-input="true" type="number" min="0" step="0.01" value={line.precio_unitario ?? ''} onChange={(event) => updateLine(index, { precio_unitario: event.target.value })} placeholder="Pendiente" className="h-9 font-mono" disabled={!canEdit || excluded} /></div>
                            )}
                            <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Importe</p><p className={`mt-2 font-mono text-sm font-semibold ${pricing.pendingPrices > 0 && !excluded ? 'text-amber-700' : ''}`}>{excluded ? 'No incluida' : pricing.hasAnyPrice ? `${formatMoney(pricing.total)}${pricing.pendingPrices ? ' · parcial' : ''}` : 'Sin valorar'}</p></div>
                            <Button type="button" size="sm" variant={excluded ? 'outline' : 'secondary'} onClick={() => updateLine(index, { estado_revision: excluded ? (line.sistema_id ? 'propuesta' : 'sin_coincidencia') : 'descartada' })} disabled={!canEdit}>{excluded ? 'Incluir' : 'No incluir'}</Button>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                            <div className="flex items-start gap-2 rounded-md border border-violet-200/60 bg-violet-50/50 px-3 py-2"><Calculator className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-700" /><span><strong>Medición:</strong> {line.medicion_id ? measurementLabelMap.get(line.medicion_id) || 'Medición vinculada' : 'Cantidad introducida manualmente'}</span></div>
                            <div className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2"><Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span><strong>Origen:</strong> “{line.texto_origen || 'Sin fragmento identificado'}”</span></div>
                          </div>
                          {pricing.breakdown.length > 0 ? (
                            <div className="mt-3 overflow-hidden rounded-md border border-violet-200/70 bg-violet-50/30">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-200/60 px-3 py-2">
                                <div><p className="text-xs font-semibold uppercase tracking-wide text-violet-900">Modificadores de precio</p><p className="text-xs text-violet-700">Solo suman los componentes cuya cantidad sea mayor que cero.</p></div>
                                <Button type="button" variant="outline" size="sm" className="h-8 border-violet-200 bg-white text-violet-900 hover:bg-violet-100" onClick={() => addPriceComponent(index)} disabled={!canEdit || excluded}><Plus className="mr-2 h-3.5 w-3.5" />Añadir componente</Button>
                              </div>
                              <div className="divide-y divide-violet-200/50">
                                {pricing.breakdown.map((component, componentIndex) => {
                                  const componentTotal = Number(component.cantidad) > 0 && component.precio_unitario !== '' && component.precio_unitario !== null
                                    ? Number(component.cantidad) * Number(component.precio_unitario)
                                    : 0;
                                  return (
                                    <div key={component.id} className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(240px,1fr)_90px_80px_120px_120px_36px] md:items-end">
                                      <div className="space-y-1"><Label className="text-[11px] text-violet-800">Concepto</Label><Input value={component.concepto} onChange={(event) => updatePriceComponent(index, componentIndex, { concepto: event.target.value })} className="h-9 bg-white" disabled={!canEdit || excluded} />{component.es_alternativa && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-800">Alternativa</Badge>}</div>
                                      <div className="space-y-1"><Label className="text-[11px] text-violet-800">Cantidad</Label><Input type="number" min="0" step="1" value={component.cantidad} onChange={(event) => updatePriceComponent(index, componentIndex, { cantidad: event.target.value })} className="h-9 bg-white font-mono" disabled={!canEdit || excluded} /></div>
                                      <div className="space-y-1"><Label className="text-[11px] text-violet-800">Unidad</Label><Input value={component.unidad} onChange={(event) => updatePriceComponent(index, componentIndex, { unidad: event.target.value })} className="h-9 bg-white font-mono" disabled={!canEdit || excluded} /></div>
                                      <div className="space-y-1"><Label className="text-[11px] text-violet-800">Precio / ud</Label><Input data-price-input="true" type="number" min="0" step="0.01" value={component.precio_unitario} onChange={(event) => updatePriceComponent(index, componentIndex, { precio_unitario: event.target.value })} placeholder={Number(component.cantidad) > 0 ? 'Pendiente' : 'No aplica'} className="h-9 bg-white font-mono" disabled={!canEdit || excluded || Number(component.cantidad) === 0} /></div>
                                      <div><p className="text-[11px] text-violet-800">Importe</p><p className="mt-2 font-mono text-sm font-semibold text-violet-950">{componentTotal ? formatMoney(componentTotal) : '—'}</p></div>
                                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-violet-700 hover:bg-violet-100 hover:text-destructive" onClick={() => removePriceComponent(index, componentIndex)} disabled={!canEdit || excluded} aria-label="Eliminar componente de precio"><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <Button type="button" variant="ghost" size="sm" className="mt-2 h-8 text-xs text-violet-700 hover:bg-violet-50 hover:text-violet-900" onClick={() => addPriceComponent(index)} disabled={!canEdit || excluded}><Plus className="mr-2 h-3.5 w-3.5" />Desglosar precio en componentes</Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            <div className="overflow-hidden rounded-lg border border-violet-200 bg-violet-50/40">
              <div className="border-b border-violet-200 bg-violet-50/80 px-4 py-3">
                <p className="text-sm font-semibold text-violet-950">Valoración comercial del borrador</p>
                <p className="text-xs text-violet-800">El margen se calcula sobre el coste de partidas más los gastos generales. Nada se envía todavía a ContaSimple.</p>
              </div>
              <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="gastos-generales-pct">Gastos generales (%)</Label>
                    <Input id="gastos-generales-pct" type="number" min="0" step="0.1" value={commercialSettings.gastos_generales_pct} onChange={(event) => setCommercialSettings((current) => ({ ...current, gastos_generales_pct: event.target.value }))} className="bg-white font-mono" disabled={!canEdit} />
                    <p className="text-xs text-muted-foreground">Estructura, desplazamientos y costes indirectos.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="margen-comercial-pct">Margen sobre coste (%)</Label>
                    <Input id="margen-comercial-pct" type="number" min="0" step="0.1" value={commercialSettings.margen_pct} onChange={(event) => setCommercialSettings((current) => ({ ...current, margen_pct: event.target.value }))} className="bg-white font-mono" disabled={!canEdit} />
                    <p className="text-xs text-muted-foreground">Se aplica después de los gastos generales.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iva-presupuesto-pct">IVA (%)</Label>
                    <Input id="iva-presupuesto-pct" type="number" min="0" step="0.1" value={commercialSettings.iva_pct} onChange={(event) => setCommercialSettings((current) => ({ ...current, iva_pct: event.target.value }))} className="bg-white font-mono" disabled={!canEdit} />
                    <p className="text-xs text-muted-foreground">Por defecto 21%; puede ajustarse según la operación.</p>
                  </div>
                </div>
                <div className="space-y-2 rounded-md border border-violet-200 bg-white p-4 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Coste de partidas</span><span className="font-mono font-medium">{formatMoney(budgetSummary.base)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Gastos generales ({commercialSummary.gastos_generales_pct} %)</span><span className="font-mono font-medium">{formatMoney(commercialSummary.generalExpenses)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Margen ({commercialSummary.margen_pct} %)</span><span className="font-mono font-medium">{formatMoney(commercialSummary.margin)}</span></div>
                  <div className="flex justify-between gap-4 border-t border-violet-100 pt-2"><span className="font-semibold text-violet-950">Base imponible</span><span className="font-mono font-semibold text-violet-950">{formatMoney(commercialSummary.taxableBase)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">IVA ({commercialSummary.iva_pct} %)</span><span className="font-mono font-medium">{formatMoney(commercialSummary.vat)}</span></div>
                  <div className="flex justify-between gap-4 border-t border-violet-200 pt-3"><span className="text-base font-bold text-violet-950">Total presupuesto</span><span className="font-mono text-xl font-bold text-violet-950">{formatMoney(commercialSummary.total)}</span></div>
                </div>
              </div>
              <div className="border-t border-violet-200 px-4 py-3 text-xs text-violet-800">Faltan {budgetSummary.pendingPrices} precios y {budgetSummary.pendingQuantities} cantidades; los importes seguirán siendo provisionales hasta completarlos.</div>
            </div>
          </CardContent>
        </Card>
      )}

      {result.partidas.length > 0 && (
        <Card className={`overflow-hidden shadow-sm ${preparationSummary.ready ? 'border-emerald-200' : 'border-amber-200'}`}>
          <CardHeader className={`${preparationSummary.ready ? 'bg-emerald-50/70' : 'bg-amber-50/70'} border-b pb-4`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  {preparationSummary.ready ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <ClipboardCheck className="h-4 w-4 text-amber-700" />}
                  Control antes de preparar el presupuesto
                </CardTitle>
                <CardDescription className="mt-1">
                  Comprueba que el borrador puede pasar a valoración comercial sin olvidar información importante.
                </CardDescription>
              </div>
              <Badge variant="outline" className={preparationSummary.ready
                ? 'border-emerald-300 bg-white text-emerald-800'
                : 'border-amber-300 bg-white text-amber-800'}>
                {preparationSummary.ready ? 'Listo para revisar' : `${preparationSummary.pending} puntos pendientes`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 pt-5 md:grid-cols-2">
            {preparationChecks.map((check) => (
              <div key={check.id} className={`flex items-start gap-3 rounded-lg border p-3 ${check.ok ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
                {check.ok
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />}
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{check.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{check.detail}</p></div>
                {!check.ok && <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100" onClick={() => reviewPreparationCheck(check)}>Revisar</Button>}
              </div>
            ))}
            <div className="space-y-2 border-t border-border/50 pt-4 md:col-span-2">
              <Label htmlFor="objeto-presupuesto">Objeto breve del presupuesto</Label>
              <Textarea id="objeto-presupuesto" value={result.objeto_presupuesto || ''} onChange={(event) => setResult((current) => ({ ...current, objeto_presupuesto: event.target.value }))} rows={2} maxLength={220} placeholder="Ej.: Reforma integral de cocina." disabled={!canEdit} className="resize-none bg-white" />
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>Esta frase aparece en el documento del cliente; el resumen técnico completo se conserva en la revisión interna.</span><span className="shrink-0 font-mono">{String(result.objeto_presupuesto || '').length}/220</span></div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notas-cabecera-presupuesto">Notas o indicaciones de cabecera</Label>
              <Textarea id="notas-cabecera-presupuesto" value={result.notas_cabecera_presupuesto || ''} onChange={(event) => setResult((current) => ({ ...current, notas_cabecera_presupuesto: event.target.value }))} rows={4} maxLength={1200} placeholder="Añade aclaraciones para el cliente, indicaciones sobre el alcance, materiales, plazos o cualquier otra observación que deba aparecer antes de las partidas." disabled={!canEdit} className="bg-white" />
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>Opcional. Se mostrará en la cabecera del documento respetando los saltos de línea.</span><span className="shrink-0 font-mono">{String(result.notas_cabecera_presupuesto || '').length}/1200</span></div>
            </div>
            <div className="flex flex-col gap-3 border-t border-border/50 pt-4 md:col-span-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold">Vista del presupuesto</p>
                <p className="text-xs text-muted-foreground">{preparationSummary.ready ? 'El documento está completo para una última revisión visual.' : `Se abrirá marcado como borrador porque quedan ${preparationSummary.pending} grupos pendientes.`}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={openBudgetPreview}><Eye className="mr-2 h-4 w-4" />Ver vista previa</Button>
                <Button type="button" variant="outline" onClick={() => downloadBudgetPdf('draft')} disabled={Boolean(pdfGenerating)}>{pdfGenerating === 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}PDF borrador</Button>
                <Button type="button" className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => setEmitDialogOpen(true)} disabled={!canEdit || !preparationSummary.ready || emitting || Boolean(pdfGenerating)}>{emitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : preparationSummary.ready ? <ShieldCheck className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}Emitir presupuesto</Button>
              </div>
            </div>
            <p className="md:col-span-2 text-xs text-muted-foreground">Emitir crea una versión numerada e inmutable y descarga su PDF. No crea una obra ni envía información a ContaSimple.</p>
          </CardContent>
        </Card>
      )}

      {emissions.length > 0 && (
        <Card className="overflow-hidden border-emerald-200 shadow-sm">
          <CardHeader className="border-b border-emerald-200 bg-emerald-50/60 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-emerald-700" />Historial de emisiones</CardTitle>
                <CardDescription className="mt-1">Cada versión conserva exactamente las partidas, importes y condiciones que se emitieron.</CardDescription>
              </div>
              <Badge variant="outline" className="border-emerald-300 bg-white font-mono text-emerald-800">{emissions[0].numero}</Badge>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-border/50 p-0">
            {emissions.map((emission, index) => {
              const statusMeta = commercialStatusMeta[emission.estado] || commercialStatusMeta.emitido;
              const isLatest = index === 0;
              const canRegisterResponse = isLatest && ['emitido', 'enviado'].includes(emission.estado) && canEdit;
              return (
                <div key={emission.id} className="px-4 py-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(200px,1fr)_150px_140px_140px] sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{emission.numero} · v{emission.version}</span>
                        {isLatest && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800">Última versión</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Emitida el {new Date(emission.emitido_at).toLocaleString('es-ES')}</p>
                      {emission.enviado_at && <p className="mt-0.5 text-xs text-muted-foreground">Enviada el {new Date(emission.enviado_at).toLocaleString('es-ES')}</p>}
                    </div>
                    <Badge variant="outline" className={`w-fit ${statusMeta.className}`}>{statusMeta.label}</Badge>
                    <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Base imponible</p><p className="mt-1 font-mono text-sm font-medium">{formatMoney(emission.base_imponible)}</p></div>
                    <div className="sm:text-right"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p><p className="mt-1 font-mono text-base font-bold">{formatMoney(emission.total)}</p></div>
                  </div>

                  {emission.respuesta_notas && <p className="mt-3 border-l-2 border-slate-200 pl-3 text-xs leading-5 text-slate-600">{emission.respuesta_notas}</p>}

                  {canRegisterResponse && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-border/40 pt-3">
                      {emission.estado === 'emitido' && <Button type="button" size="sm" variant="outline" onClick={() => openCommercialAction(emission, 'enviado')}><Send className="mr-2 h-3.5 w-3.5" />Marcar enviado</Button>}
                      <Button type="button" size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => openCommercialAction(emission, 'aceptado')}><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Aceptar</Button>
                      <Button type="button" size="sm" variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-50" onClick={() => openCommercialAction(emission, 'cambios_solicitados')}><PenLine className="mr-2 h-3.5 w-3.5" />Solicita cambios</Button>
                      <Button type="button" size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => openCommercialAction(emission, 'rechazado')}><X className="mr-2 h-3.5 w-3.5" />Rechazar</Button>
                    </div>
                  )}

                  {isLatest && emission.estado === 'cambios_solicitados' && (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs leading-5 text-amber-900">Corrige el borrador y emite una versión nueva. Esta versión permanece cerrada y no se sobrescribe.</div>
                  )}

                  {isLatest && emission.estado === 'aceptado' && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-3">
                      <div><p className="text-sm font-semibold text-emerald-950">Presupuesto aceptado por el cliente</p><p className="mt-0.5 text-xs text-emerald-800">La obra se creará con esta versión exacta y sus partidas.</p></div>
                      {emission.proyecto_id
                        ? <Button type="button" size="sm" variant="outline" className="border-emerald-300 bg-white text-emerald-900" onClick={() => navigate?.(`/gestion/obras/${emission.proyecto_id}?tab=produccion`)}><Briefcase className="mr-2 h-4 w-4" />Ver obra</Button>
                        : <Button type="button" size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800" disabled={!canEdit} onClick={() => setConversionEmission(emission)}><Briefcase className="mr-2 h-4 w-4" />Convertir en obra</Button>}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {previewOpen && result.partidas.length > 0 && (
        <Card id="presupuesto-vista-previa" className="scroll-mt-6 overflow-hidden border-slate-300 bg-stone-100 shadow-sm">
          <CardHeader className="border-b border-slate-200 bg-stone-100 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4 text-primary" />Vista previa del presupuesto</CardTitle>
                <CardDescription className="mt-1">Representación del documento para revisar estructura, descripciones e importes antes de emitirlo.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={preparationSummary.ready ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-800'}>{preparationSummary.ready ? 'Listo para revisión final' : 'Borrador incompleto'}</Badge>
                <Button type="button" variant="ghost" size="icon" onClick={() => setPreviewOpen(false)} aria-label="Cerrar vista previa"><X className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 lg:p-8">
            <article ref={budgetPreviewRef} className="relative mx-auto max-w-5xl overflow-hidden rounded-sm border border-slate-200 bg-white text-slate-900 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
              {(!preparationSummary.ready || pdfExportMode === 'draft') && <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end overflow-hidden"><span className="mt-8 -mr-12 rotate-45 border-y border-amber-300 bg-amber-100/90 px-14 py-2 text-xs font-bold uppercase tracking-[0.24em] text-amber-900">Borrador</span></div>}
              <header className="pdf-avoid-break border-b-2 border-slate-900 px-6 py-7 sm:px-10">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-700">OrkaLED Instalaciones</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight">Presupuesto de trabajos</h2>
                    <p className="mt-1 text-sm text-slate-500">Propuesta ordenada según la secuencia prevista de ejecución.</p>
                  </div>
                  <dl className="grid grid-cols-[auto_auto] gap-x-5 gap-y-1 text-right text-xs">
                    <dt className="text-slate-500">Referencia</dt><dd className="font-mono font-semibold">{documentReference}</dd>
                    <dt className="text-slate-500">Fecha</dt><dd className="font-medium">{new Date().toLocaleDateString('es-ES')}</dd>
                    <dt className="text-slate-500">Estado</dt><dd className={`font-semibold ${preparationSummary.ready && pdfExportMode !== 'draft' ? 'text-emerald-700' : 'text-amber-700'}`}>{preparationSummary.ready && pdfExportMode !== 'draft' ? 'Revisión final' : 'Borrador'}</dd>
                  </dl>
                </div>
                <div className="mt-7 grid gap-5 border-t border-slate-200 pt-5 sm:grid-cols-3">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Cliente</p><p className="mt-2 text-sm font-semibold">{lead?.nombre_contacto || 'Cliente pendiente de identificar'}</p><p className="text-sm text-slate-600">{lead?.nombre_empresa || 'Particular'}</p><p className="mt-1 font-mono text-xs text-slate-500">CIF/NIF: {lead?.cif || 'No informado'}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Contacto</p><p className="mt-2 text-sm font-medium">{lead?.telefono || 'Teléfono no informado'}</p><p className="break-all text-sm text-slate-600">{lead?.email || 'Email no informado'}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Emplazamiento</p><p className="mt-2 text-sm font-medium">{lead?.direccion || 'Dirección pendiente'}</p><p className="text-sm text-slate-600">{[lead?.codigo_postal, lead?.municipio].filter(Boolean).join(' · ') || 'Localidad no informada'}</p></div>
                </div>
              </header>

              {(result.objeto_presupuesto || result.resumen) && <section className="border-b border-slate-200 bg-stone-50/70 px-6 py-4 sm:px-10"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Objeto de los trabajos</p><p className="mt-1.5 text-sm font-medium leading-5 text-slate-700">{result.objeto_presupuesto || summarizeBudgetObject(result.resumen)}</p></section>}
              {result.notas_cabecera_presupuesto && <section className="border-b border-slate-200 px-6 py-4 sm:px-10"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Notas e indicaciones</p><p className="mt-2 whitespace-pre-wrap border-l-2 border-violet-200 pl-4 text-sm leading-6 text-slate-600">{result.notas_cabecera_presupuesto}</p></section>}

              <div className="px-6 py-7 sm:px-10">
                <div className="space-y-7">
                  {budgetPhases.map((phase) => {
                    const includedLines = phase.lines.filter(({ line }) => line.estado_revision !== 'descartada');
                    if (!includedLines.length) return null;
                    const phaseBase = includedLines.reduce((total, { line }) => total + getLinePricing(line).total, 0);
                    const renderPreviewLine = ({ line, index }) => {
                      const pricing = getLinePricing(line);
                      return (
                        <div key={`preview-line-${line.id || index}`} className="pdf-avoid-break py-4 text-sm">
                          <div>
                            <span className="font-mono text-[10px] font-semibold text-slate-500">{line.codigo || 'SIN-CÓD.'}</span>
                            <p className="mt-1 font-medium leading-5">{line.descripcion || 'Partida pendiente de definir'}</p>
                            {line.zona && <p className="mt-1 text-xs text-slate-500">Zona: {line.zona}</p>}
                            {pricing.breakdown.length > 0 && <ul className="mt-2 space-y-1 border-l-2 border-violet-100 pl-3 text-xs text-slate-500">{pricing.breakdown.filter((item) => Number(item.cantidad) > 0).map((item) => <li key={item.id}>{item.concepto || 'Componente'} · {item.cantidad} {item.unidad} × {item.precio_unitario === '' || item.precio_unitario === null ? 'pendiente' : formatMoney(item.precio_unitario)}</li>)}</ul>}
                          </div>
                          <dl className="mt-3 grid grid-cols-4 gap-x-4 border-t border-slate-100 pt-2.5">
                            <div>
                              <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Cantidad</dt>
                              <dd className="mt-0.5 font-mono text-xs font-medium">{line.cantidad || '—'}</dd>
                            </div>
                            <div>
                              <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Unidad</dt>
                              <dd className="mt-0.5 font-mono text-xs font-medium">{line.unidad || '—'}</dd>
                            </div>
                            <div>
                              <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Precio unitario</dt>
                              <dd className={`mt-0.5 font-mono text-xs font-medium ${pricing.pendingPrices ? 'text-amber-700' : ''}`}>{pricing.breakdown.length ? 'Según desglose' : pricing.hasAnyPrice ? formatMoney(line.precio_unitario) : 'Pendiente'}</dd>
                            </div>
                            <div className="text-right">
                              <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Total</dt>
                              <dd className={`mt-0.5 font-mono text-sm font-semibold ${pricing.pendingPrices ? 'text-amber-700' : ''}`}>{pricing.hasAnyPrice ? `${formatMoney(pricing.total)}${pricing.pendingPrices ? ' *' : ''}` : 'Pendiente'}</dd>
                            </div>
                          </dl>
                        </div>
                      );
                    };
                    return (
                      <section key={`preview-${phase.value}`}>
                        <div className="pdf-avoid-break" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                          <div className="flex items-end justify-between gap-4 border-b border-slate-900 pb-2">
                            <div className="flex items-center gap-3"><span className="font-mono text-xs font-bold text-violet-700">{String(phase.order / 10).padStart(2, '0')}</span><h3 className="text-sm font-bold uppercase tracking-wide">{phase.label}</h3></div>
                            <span className="font-mono text-sm font-semibold">{formatMoney(phaseBase)}</span>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {renderPreviewLine(includedLines[0])}
                          </div>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {includedLines.slice(1).map(renderPreviewLine)}
                        </div>
                      </section>
                    );
                  })}
                </div>

                <div className="pdf-avoid-break mt-8 ml-auto max-w-md border-t-2 border-slate-900 pt-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-5"><span className="text-slate-500">Coste de partidas</span><span className="font-mono">{formatMoney(budgetSummary.base)}</span></div>
                    <div className="flex justify-between gap-5"><span className="text-slate-500">Gastos generales ({commercialSummary.gastos_generales_pct} %)</span><span className="font-mono">{formatMoney(commercialSummary.generalExpenses)}</span></div>
                    <div className="flex justify-between gap-5"><span className="text-slate-500">Margen comercial ({commercialSummary.margen_pct} %)</span><span className="font-mono">{formatMoney(commercialSummary.margin)}</span></div>
                    <div className="flex justify-between gap-5 border-t border-slate-200 pt-2"><span className="font-semibold">Base imponible</span><span className="font-mono font-semibold">{formatMoney(commercialSummary.taxableBase)}</span></div>
                    <div className="flex justify-between gap-5"><span className="text-slate-500">IVA ({commercialSummary.iva_pct} %)</span><span className="font-mono">{formatMoney(commercialSummary.vat)}</span></div>
                    <div className="flex justify-between gap-5 border-t border-slate-900 pt-3 text-lg"><span className="font-bold">TOTAL</span><span className="font-mono font-bold">{formatMoney(commercialSummary.total)}</span></div>
                  </div>
                </div>

                {(!preparationSummary.ready || pdfExportMode === 'draft') && <div className="pdf-avoid-break mt-8 border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Documento no definitivo.</strong> {preparationSummary.ready ? 'Esta copia se ha generado expresamente como borrador.' : `Quedan ${preparationSummary.pending} grupos de revisión pendientes. Los importes marcados como pendientes o parciales deben completarse antes de entregar el presupuesto.`}</div>}
                <section className="pdf-avoid-break mt-8 border-t-2 border-slate-900 pt-5">
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-700">Condiciones del presupuesto</h3>
                  <div className="mt-4 grid gap-6 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Alcance de los trabajos</p>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{budgetScopeCondition}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Forma de pago</p>
                      <ol className="mt-2 divide-y divide-slate-100 border-y border-slate-200">
                        {budgetPaymentTerms.map((term) => (
                          <li key={term.percentage} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 py-2.5">
                            <span className="font-mono text-sm font-bold text-violet-700">{term.percentage}</span>
                            <span className="text-xs leading-5 text-slate-600">{term.description}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </section>
                {!pdfExportMode && <footer className="mt-8 border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-400">Vista interna generada desde las notas, mediciones y partidas revisadas en el ERP. No constituye una oferta emitida ni ha sido enviada a ContaSimple.</footer>}
              </div>
            </article>
          </CardContent>
        </Card>
      )}

      {(result.partidas.length > 0 || result.mediciones.length > 0 || result.resumen) && (
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Guardar conserva el borrador dentro del lead. No crea obra, factura ni presupuesto en ContaSimple.</p>
          <Button onClick={saveDraft} disabled={!canEdit || saving || (!notes.trim() && !sourceFile && !result.mediciones.length)}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar borrador</Button>
        </div>
      )}

      <AlertDialog open={emitDialogOpen} onOpenChange={setEmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" />Emitir versión definitiva</AlertDialogTitle>
            <AlertDialogDescription>
              Se guardará una fotografía inmutable del presupuesto por {formatMoney(commercialSummary.total)}. {latestEmission ? `Se creará la versión ${latestEmission.version + 1} de ${latestEmission.numero}.` : 'Se asignará el siguiente número anual disponible.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-950">
            <p className="font-semibold">Esta acción no modifica el borrador.</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">Después podrás seguir editándolo y emitir una nueva versión. También se descargará el PDF correspondiente a esta emisión.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={emitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); emitBudget(); }} disabled={emitting} className="bg-emerald-700 text-white hover:bg-emerald-800">
              {emitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Confirmar emisión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(commercialAction)} onOpenChange={(open) => {
        if (!open && !commercialUpdating) {
          setCommercialAction(null);
          setCommercialNotes('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{commercialAction ? commercialStatusMeta[commercialAction.status]?.label : 'Actualizar presupuesto'}</AlertDialogTitle>
            <AlertDialogDescription>
              {commercialAction && `${commercialAction.emission.numero} · v${commercialAction.emission.version}`}. El cambio quedará fechado en el historial comercial y no modificará el contenido emitido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="respuesta-comercial-presupuesto">
              Observaciones {commercialAction && ['cambios_solicitados', 'rechazado'].includes(commercialAction.status) ? '(obligatorias)' : '(opcionales)'}
            </Label>
            <Textarea
              id="respuesta-comercial-presupuesto"
              value={commercialNotes}
              onChange={(event) => setCommercialNotes(event.target.value)}
              rows={4}
              placeholder={commercialAction?.status === 'cambios_solicitados'
                ? 'Indica exactamente qué solicita cambiar el cliente.'
                : commercialAction?.status === 'rechazado'
                  ? 'Indica, si se conoce, el motivo del rechazo.'
                  : 'Añade cualquier detalle útil para el seguimiento.'}
              disabled={commercialUpdating}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={commercialUpdating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); updateCommercialStatus(); }} disabled={commercialUpdating} className={commercialAction?.status === 'rechazado' ? 'bg-red-700 text-white hover:bg-red-800' : commercialAction?.status === 'aceptado' ? 'bg-emerald-700 text-white hover:bg-emerald-800' : ''}>
              {commercialUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : commercialAction?.status === 'aceptado' ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(conversionEmission)} onOpenChange={(open) => {
        if (!open && !converting) setConversionEmission(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-emerald-700" />Convertir presupuesto aceptado en obra</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará la obra desde {conversionEmission?.numero} · v{conversionEmission?.version}, conservando cliente, emplazamiento, importe aceptado y todas las partidas de esta versión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-950">
            <p className="font-semibold">La versión emitida no se modificará.</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">Las partidas pasarán a Producción para poder planificar y medir su ejecución. Esta acción no crea facturas ni envía datos a ContaSimple.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={converting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); convertAcceptedBudget(); }} disabled={converting} className="bg-emerald-700 text-white hover:bg-emerald-800">
              {converting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Briefcase className="mr-2 h-4 w-4" />}Crear obra
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
