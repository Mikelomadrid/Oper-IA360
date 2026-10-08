// BandejaAdminContasimple.jsx
//
// Subsección "Bandeja administración" dentro de la pestaña Contasimple.
//
// Cola fiscal de facturas recibidas. Permite revisar y crear la factura recibida
// directamente por API en ContaSimple, sin subir archivos ni usar su OCR.
//
// Lee EXCLUSIVAMENTE:
//   v_contasimple_admin_resumen_facturas -> cards por estado (pendiente / contabilizada / rechazada_no_contabilizable)
//   v_contasimple_admin_bandeja_facturas -> tabla filtrable y paginada
//
// Acciones manuales: RPC flopy_marcar_factura_contasimple_estado.
// Vista previa/registro remoto: Edge Function contasimple-invoice.
//
// El comparador ERP vs Contasimple sigue viviendo en su propia pestaña
// (ComparadorContasimple.jsx) y no se toca desde aquí.

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, AlertTriangle, Search, Paperclip, ChevronDown, ChevronUp, ChevronRight,
  Inbox, CheckCircle2, XCircle, Lock, Trash2, Send, FileCheck2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import {
  createReceivedInvoice,
  previewReceivedInvoice,
} from '@/services/contasimpleInvoiceService';

const PAGE_SIZE = 100;

// ---------- Formatters ----------

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
};

const formatDateEs = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
};

// ---------- Estados (solo 3) ----------

const ESTADOS = [
  { value: 'pendiente', label: 'Pendiente', icon: Inbox, classes: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  { value: 'contabilizada', label: 'Contabilizada', icon: Lock, classes: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-600' },
  { value: 'rechazada_no_contabilizable', label: 'No contabilizable', icon: XCircle, classes: 'bg-slate-200 text-slate-700 border-slate-300', dot: 'bg-slate-500' },
];

const estadoInfo = (value) =>
  ESTADOS.find(e => e.value === value) || { value, label: value || 'Pendiente', classes: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };

const CONTASIMPLE_ESTADOS = {
  lista_para_contasimple: { label: 'Preparada para enviar', classes: 'bg-amber-50 text-amber-800 border-amber-200' },
  enviada_ocr_contasimple: { label: 'Envío OCR antiguo', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  procesando_contasimple: { label: 'OCR antiguo en proceso', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  creada_en_contasimple: { label: 'Creada en ContaSimple', classes: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  posible_duplicado_contasimple: { label: 'Posible duplicado', classes: 'bg-orange-50 text-orange-800 border-orange-200' },
  error_contasimple: { label: 'Error de ContaSimple', classes: 'bg-red-50 text-red-700 border-red-200' },
};

const contasimpleInfo = (value) => CONTASIMPLE_ESTADOS[value] || null;

const ACTION_CONFIG = {
  contabilizada: {
    title: 'Marcar como contabilizada',
    description: (f) => `¿Confirmas que la factura de "${f.proveedor_nombre || 'este proveedor'}" (${f.numero_factura || 'sin número'}) ya está gestionada directamente en Contasimple?`,
    requireObs: false,
    confirmLabel: 'Confirmar contabilizada',
    confirmVariant: 'default',
  },
  rechazada_no_contabilizable: {
    title: 'Marcar como no contabilizable',
    description: (f) => `Factura de "${f.proveedor_nombre || 'proveedor desconocido'}" (${f.numero_factura || 'sin número'}). Indica el motivo antes de confirmar.`,
    requireObs: true,
    confirmLabel: 'Confirmar rechazo',
    confirmVariant: 'destructive',
  },
};

// Detecta violación de FK (23503) al intentar borrar una factura referenciada
// desde gastos_obra o proveedor_catalogo (ON DELETE NO ACTION en esas tablas).
const isForeignKeyViolation = (err) => (err?.code === '23503');

// ---------- Pequeños helpers de UI ----------

const EstadoBadge = ({ value }) => {
  const info = estadoInfo(value);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${info.classes}`}>
      {info.label}
    </span>
  );
};

const ContaSimpleBadge = ({ value }) => {
  const info = contasimpleInfo(value);
  if (!info) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${info.classes}`}>
      {info.label}
    </span>
  );
};

const isMissingRelationError = (err) => {
  if (!err) return false;
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();
  return code === '42P01' || msg.includes('does not exist') || msg.includes('schema cache');
};

const VistasFaltantesAviso = ({ onRetry }) => (
  <Card className="shadow-sm border-amber-200 bg-amber-50/50">
    <CardContent className="py-10 flex flex-col items-center justify-center gap-3 text-center px-4">
      <AlertTriangle className="w-8 h-8 text-amber-500" />
      <p className="text-sm font-medium text-amber-800">Falta instalar las vistas de la bandeja de administración</p>
      <p className="text-xs text-amber-700 max-w-md">
        Esta sección necesita las vistas v_contasimple_admin_resumen_facturas y
        v_contasimple_admin_bandeja_facturas en Supabase. El resto de Contabilidad sigue funcionando con normalidad.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 mt-1">
        <RefreshCw className="w-3.5 h-3.5" /> Reintentar
      </Button>
    </CardContent>
  </Card>
);

const ResumenEstadoCard = ({ value, count, importe, active, onClick }) => {
  const info = estadoInfo(value);
  const Icon = info.icon || Inbox;
  return (
    <Card
      onClick={onClick}
      className={`shadow-sm border-slate-200 cursor-pointer transition-shadow hover:shadow-md ${active ? 'ring-2 ring-primary' : ''}`}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${info.dot}`} />
          <p className="text-xs font-semibold text-slate-700 truncate">{info.label}</p>
        </div>
        <p className="text-2xl font-bold text-slate-900">{count}</p>
        <p className="text-xs text-muted-foreground">{formatCurrency(importe)}</p>
      </CardContent>
    </Card>
  );
};

const DetalleFactura = ({ f }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs">
    <div><span className="text-muted-foreground">ID factura:</span> <span className="font-mono text-slate-600">{f.factura_id}</span></div>
    <div><span className="text-muted-foreground">NIF proveedor:</span> <span className="text-slate-700">{f.proveedor_nif || '—'}</span></div>
    <div><span className="text-muted-foreground">Contabilizada el:</span> <span className="text-slate-700">{formatDateEs(f.contabilizado_at)}</span></div>
    <div><span className="text-muted-foreground">Flujo ContaSimple:</span> <ContaSimpleBadge value={f.estado_contasimple} /></div>
    <div><span className="text-muted-foreground">Periodo:</span> <span className="text-slate-700">{f.contasimple_periodo || '—'}</span></div>
    <div><span className="text-muted-foreground">Solicitud OCR antigua:</span> <span className="font-mono text-slate-600">{f.contasimple_ocr_request_id || '—'}</span></div>
    <div><span className="text-muted-foreground">Estado OCR antiguo:</span> <span className="text-slate-700">{f.contasimple_ocr_status || '—'}</span></div>
    <div><span className="text-muted-foreground">Documento ContaSimple:</span> <span className="font-mono text-slate-600">{f.contasimple_documento_id || f.contasimple_id || '—'}</span></div>
    <div className="sm:col-span-2 lg:col-span-3">
      <span className="text-muted-foreground">Documento:</span>{' '}
      {f.documento_id ? (
        <span className="inline-flex items-center gap-1 text-slate-700" title={f.ruta_original || f.thumbnail_path || ''}>
          <Paperclip className="w-3.5 h-3.5" /> Adjunto disponible
        </span>
      ) : (
        <span className="text-slate-400">Sin adjunto</span>
      )}
    </div>
    {f.observaciones && (
      <div className="sm:col-span-2 lg:col-span-3 pt-1 border-t">
        <span className="text-muted-foreground">Observaciones:</span> <span className="text-slate-700">{f.observaciones}</span>
      </div>
    )}
    {f.contasimple_error && (
      <div className="sm:col-span-2 lg:col-span-3 pt-1 border-t text-red-700">
        <span className="font-medium">Incidencia ContaSimple:</span> {f.contasimple_error}
      </div>
    )}
  </div>
);

// ---------- Acciones (según estado) ----------

const AccionesBotones = ({ f, isBusy, onAction, onEliminar, onEnviar }) => {
  const estado = f.estado;

  if (estado === 'contabilizada') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold bg-emerald-100 text-emerald-800 border-emerald-300">
        <Lock className="w-3 h-3" /> Cerrada
      </span>
    );
  }

  if (estado === 'rechazada_no_contabilizable') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[11px] gap-1 text-red-600 hover:text-red-600 hover:bg-red-50 border-red-200"
        disabled={isBusy}
        onClick={() => onEliminar(f)}
      >
        {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Eliminar
      </Button>
    );
  }

  if (f.estado_contasimple === 'lista_para_contasimple') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          size="sm"
          className="h-7 px-2 text-[11px] gap-1"
          disabled={isBusy}
          onClick={() => onEnviar(f)}
        >
          {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Enviar a ContaSimple
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1 text-red-600 hover:text-red-600 hover:bg-red-50 border-red-200"
          disabled={isBusy}
          onClick={() => onAction(f, 'rechazada_no_contabilizable')}
        >
          <XCircle className="w-3.5 h-3.5" /> No contabilizable
        </Button>
      </div>
    );
  }

  if (['enviada_ocr_contasimple', 'procesando_contasimple'].includes(f.estado_contasimple)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold bg-blue-50 text-blue-700 border-blue-200">
        Flujo OCR anterior
      </span>
    );
  }

  if (f.estado_contasimple === 'creada_en_contasimple') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold bg-emerald-50 text-emerald-800 border-emerald-200">
          <FileCheck2 className="w-3.5 h-3.5" /> Creada
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1 text-emerald-700 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
          disabled={isBusy}
          onClick={() => onAction(f, 'contabilizada')}
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Cerrar
        </Button>
      </div>
    );
  }

  if (['posible_duplicado_contasimple', 'error_contasimple'].includes(f.estado_contasimple)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold bg-amber-50 text-amber-800 border-amber-200">
        <AlertTriangle className="w-3.5 h-3.5" /> Revisar detalle
      </span>
    );
  }

  // pendiente
  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[11px] gap-1 text-emerald-700 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
        disabled={isBusy}
        onClick={() => onAction(f, 'contabilizada')}
      >
        {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        Contabilizada
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[11px] gap-1 text-red-600 hover:text-red-600 hover:bg-red-50 border-red-200"
        disabled={isBusy}
        onClick={() => onAction(f, 'rechazada_no_contabilizable')}
      >
        <XCircle className="w-3.5 h-3.5" />
        No contabilizable
      </Button>
    </div>
  );
};

export default function BandejaAdminContasimple() {
  const { toast } = useToast();
  const [missing, setMissing] = useState(false);

  const [userId, setUserId] = useState(null);
  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data }) => setUserId(data?.user?.id ?? null))
      .catch(() => setUserId(null));
  }, []);

  const [resumen, setResumen] = useState([]);
  const [loadingResumen, setLoadingResumen] = useState(true);
  const [errorResumen, setErrorResumen] = useState(null);

  const [filas, setFilas] = useState([]);
  const [filasCount, setFilasCount] = useState(0);
  const [loadingFilas, setLoadingFilas] = useState(true);
  const [errorFilas, setErrorFilas] = useState(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const [filtroEstado, setFiltroEstado] = useState('all');
  const [busquedaInput, setBusquedaInput] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const toggleExpand = (facturaId) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(facturaId)) next.delete(facturaId); else next.add(facturaId);
      return next;
    });
  };

  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionDialog, setActionDialog] = useState(null); // { factura, estado, config } | null
  const [actionObs, setActionObs] = useState('');

  const [deleteDialog, setDeleteDialog] = useState(null); // factura | null
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [sendDialog, setSendDialog] = useState(null);
  const [sendPreview, setSendPreview] = useState(null);
  const [sendPreviewLoading, setSendPreviewLoading] = useState(false);
  const [sendPreviewError, setSendPreviewError] = useState(null);
  const [contasimpleLoadingId, setContasimpleLoadingId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setBusqueda(busquedaInput.trim()), 400);
    return () => clearTimeout(t);
  }, [busquedaInput]);

  const loadResumen = useCallback(async () => {
    setLoadingResumen(true);
    setErrorResumen(null);
    try {
      const { data, error } = await supabase
        .from('v_contasimple_admin_resumen_facturas')
        .select('*');
      if (error) throw error;
      setResumen(data || []);
      setMissing(false);
    } catch (err) {
      console.error('Error cargando resumen de la bandeja de administración:', err);
      if (isMissingRelationError(err)) {
        setMissing(true);
      } else {
        setErrorResumen(err?.message || 'No se pudo cargar el resumen.');
      }
    } finally {
      setLoadingResumen(false);
    }
  }, []);

  const loadFilas = useCallback(async (estado, texto, lim) => {
    setLoadingFilas(true);
    setErrorFilas(null);
    try {
      let query = supabase
        .from('v_contasimple_admin_bandeja_facturas')
        .select('*', { count: 'exact' });

      if (estado !== 'all') {
        query = query.eq('estado', estado);
      }
      if (texto) {
        const t = texto.replace(/[%,]/g, '');
        query = query.or(
          `proveedor_nombre.ilike.%${t}%,numero_factura.ilike.%${t}%,proveedor_nif.ilike.%${t}%`
        );
      }

      query = query.order('fecha_registro', { ascending: false, nullsFirst: false }).range(0, lim - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      setFilas(data || []);
      setFilasCount(count ?? (data || []).length);
      setMissing(false);
    } catch (err) {
      console.error('Error cargando la bandeja de administración:', err);
      if (isMissingRelationError(err)) {
        setMissing(true);
      } else {
        setErrorFilas(err?.message || 'No se pudo cargar la bandeja de facturas.');
      }
    } finally {
      setLoadingFilas(false);
    }
  }, []);

  useEffect(() => { loadResumen(); }, [loadResumen]);
  useEffect(() => {
    loadFilas(filtroEstado, busqueda, limit);
  }, [filtroEstado, busqueda, limit, loadFilas]);

  const handleRetryAll = () => {
    setMissing(false);
    loadResumen();
    loadFilas(filtroEstado, busqueda, limit);
  };

  const resetLimit = () => setLimit(PAGE_SIZE);

  const handleCardClick = (value) => {
    setFiltroEstado(prev => (prev === value ? 'all' : value));
    resetLimit();
  };

  const refrescarTrasAccion = useCallback(async () => {
    await Promise.all([
      loadResumen(),
      loadFilas(filtroEstado, busqueda, limit),
    ]);
  }, [loadResumen, loadFilas, filtroEstado, busqueda, limit]);

  const ejecutarAccion = useCallback(async (facturaId, nuevoEstado, observaciones) => {
    setActionLoadingId(facturaId);
    try {
      const { data, error } = await supabase.rpc('flopy_marcar_factura_contasimple_estado', {
        p_factura_id: facturaId,
        p_estado: nuevoEstado,
        p_usuario_id: userId ?? null,
        p_observaciones: observaciones || null,
      });

      if (error) throw error;

      if (!data?.ok) {
        toast({
          variant: 'destructive',
          title: 'No se pudo actualizar',
          description: data?.mensaje || data?.error || 'Error desconocido al actualizar el estado.',
        });
        return false;
      }

      toast({ title: 'Estado actualizado', description: 'La factura se ha actualizado correctamente.' });
      await refrescarTrasAccion();
      return true;
    } catch (err) {
      console.error('Error en RPC flopy_marcar_factura_contasimple_estado:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'No se pudo actualizar el estado de la factura.',
      });
      return false;
    } finally {
      setActionLoadingId(null);
    }
  }, [userId, toast, refrescarTrasAccion]);

  const openAction = (f, estadoDestino) => {
    setActionObs('');
    setActionDialog({ factura: f, estado: estadoDestino, config: ACTION_CONFIG[estadoDestino] });
  };

  const confirmActionDialog = async () => {
    if (!actionDialog) return;
    const obs = actionObs.trim();
    if (actionDialog.config.requireObs && !obs) {
      toast({ variant: 'destructive', title: 'Observación requerida', description: 'Escribe el motivo antes de continuar.' });
      return;
    }
    const ok = await ejecutarAccion(actionDialog.factura.factura_id, actionDialog.estado, obs || null);
    if (ok) {
      setActionDialog(null);
      setActionObs('');
    }
  };

  const confirmEliminar = async () => {
    if (!deleteDialog) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('facturas_gastos')
        .delete()
        .eq('id', deleteDialog.factura_id);
      if (error) throw error;

      toast({ title: 'Factura eliminada', description: 'Se ha eliminado correctamente de la bandeja.' });
      setDeleteDialog(null);
      await refrescarTrasAccion();
    } catch (err) {
      console.error('Error eliminando factura:', err);
      if (isForeignKeyViolation(err)) {
        toast({
          variant: 'destructive',
          title: 'No se puede eliminar',
          description: 'Esta factura ya está vinculada a un gasto de obra o al catálogo de proveedor. Desvincúlala primero desde su obra/proveedor antes de borrarla aquí.',
        });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: err?.message || 'No se pudo eliminar la factura.' });
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const confirmEnviarContasimple = async () => {
    if (!sendDialog) return;
    if (!sendPreview || sendPreviewError) {
      toast({ variant: 'destructive', title: 'Validación pendiente', description: 'Primero deben validarse los datos que se enviarán a ContaSimple.' });
      return;
    }
    setContasimpleLoadingId(sendDialog.factura_id);
    try {
      const result = await createReceivedInvoice(sendDialog.factura_id);
      toast({
        title: 'Factura registrada en ContaSimple',
        description: result?.documentNumber || result?.documentId
          ? `Documento ${result.documentNumber || result.documentId} creado directamente, sin OCR.`
          : 'La factura se ha creado directamente, sin subir el archivo.',
      });
      setSendDialog(null);
      await refrescarTrasAccion();
    } catch (err) {
      console.error('Error enviando factura a ContaSimple:', err);
      toast({
        variant: 'destructive',
        title: err?.code === 'possible_duplicate' ? 'Posible factura duplicada' : 'No se pudo enviar a ContaSimple',
        description: err?.message || 'Revisa el detalle de la factura antes de volver a intentarlo.',
      });
      await refrescarTrasAccion();
    } finally {
      setContasimpleLoadingId(null);
    }
  };

  const openSendDialog = async (factura) => {
    setSendDialog(factura);
    setSendPreview(null);
    setSendPreviewError(null);
    setSendPreviewLoading(true);
    try {
      const preview = await previewReceivedInvoice(factura.factura_id);
      setSendPreview(preview);
    } catch (err) {
      console.error('Error validando factura para ContaSimple:', err);
      setSendPreviewError(err?.message || 'No se pudieron validar los datos de la factura.');
    } finally {
      setSendPreviewLoading(false);
    }
  };

  if (missing) {
    return <VistasFaltantesAviso onRetry={handleRetryAll} />;
  }

  const resumenPorEstado = (estado) => resumen.find(r => r.estado === estado);

  return (
    <div className="space-y-6">

      <div>
        <h3 className="text-base font-bold text-slate-900">Bandeja administración</h3>
        <p className="text-xs text-muted-foreground">
          Revisa las facturas y regístralas directamente en ContaSimple. El ERP envía los datos ya validados, sin subir imágenes y sin consumir OCR de ContaSimple.
        </p>
      </div>

      {/* ---------- Resumen ---------- */}
      {loadingResumen ? (
        <Card className="shadow-sm border-slate-200">
          <CardContent className="h-24 flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" /> Cargando resumen...
          </CardContent>
        </Card>
      ) : errorResumen ? (
        <Card className="shadow-sm border-red-200">
          <CardContent className="h-24 flex flex-col items-center justify-center gap-2 text-center px-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">{errorResumen}</p>
            <Button variant="outline" size="sm" onClick={loadResumen}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ESTADOS.map((e) => {
            const row = resumenPorEstado(e.value);
            return (
              <ResumenEstadoCard
                key={e.value}
                value={e.value}
                count={row?.total ?? 0}
                importe={row?.importe_total ?? 0}
                active={filtroEstado === e.value}
                onClick={() => handleCardClick(e.value)}
              />
            );
          })}
        </div>
      )}

      {/* ---------- Filtros ---------- */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={busquedaInput}
                onChange={(e) => { setBusquedaInput(e.target.value); resetLimit(); }}
                placeholder="Buscar por proveedor, número o NIF..."
                className="pl-8 h-9 text-xs"
              />
            </div>
            <select
              value={filtroEstado}
              onChange={(e) => { setFiltroEstado(e.target.value); resetLimit(); }}
              className="bg-background border rounded-lg px-2.5 py-1.5 text-xs min-w-0"
            >
              <option value="all">Todos los estados</option>
              {ESTADOS.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Vista MÓVIL/TABLET: cards ---------- */}
      <div className="md:hidden space-y-2">
        {loadingFilas ? (
          <Card><CardContent className="h-24 flex items-center justify-center text-muted-foreground text-sm">Cargando...</CardContent></Card>
        ) : filas.length === 0 ? (
          <Card><CardContent className="h-24 flex items-center justify-center text-muted-foreground text-sm">No hay facturas para este filtro.</CardContent></Card>
        ) : (
          filas.map((f) => {
            const isBusy = actionLoadingId === f.factura_id || contasimpleLoadingId === f.factura_id || deleteDialog?.factura_id === f.factura_id;
            const expanded = expandedIds.has(f.factura_id);
            return (
              <Card key={f.factura_id} className="shadow-sm border-slate-200">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-800 truncate">{f.proveedor_nombre || '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">{f.numero_factura || '—'} · {formatDateEs(f.fecha_factura)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1"><EstadoBadge value={f.estado} /><ContaSimpleBadge value={f.estado_contasimple} /></div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-900">{formatCurrency(f.total)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => toggleExpand(f.factura_id)}
                      className="text-xs text-primary flex items-center gap-1"
                    >
                      {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {expanded ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                    <AccionesBotones f={f} isBusy={isBusy} onAction={openAction} onEliminar={(fila) => setDeleteDialog(fila)} onEnviar={openSendDialog} />
                  </div>
                  {expanded && (
                    <div className="pt-2 border-t">
                      <DetalleFactura f={f} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>Mostrando {filas.length} de {filasCount}</span>
          {filas.length < filasCount && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLimit(l => l + PAGE_SIZE)}>
              <ChevronDown className="w-3.5 h-3.5" /> Ver más
            </Button>
          )}
        </div>
      </div>

      {/* ---------- Vista ESCRITORIO: tabla compacta ---------- */}
      <Card className="hidden md:block shadow-sm border-slate-200 overflow-hidden">
        {errorFilas ? (
          <div className="p-6 text-center text-sm text-red-600">{errorFilas}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full table-fixed">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="font-semibold text-slate-700 w-[14%]">Estado</TableHead>
                  <TableHead className="font-semibold text-slate-700 w-[26%]">Proveedor</TableHead>
                  <TableHead className="font-semibold text-slate-700 w-[16%]">Nº factura</TableHead>
                  <TableHead className="font-semibold text-slate-700 w-[10%]">Fecha</TableHead>
                  <TableHead className="font-semibold text-slate-700 w-[12%] text-right">Total</TableHead>
                  <TableHead className="font-semibold text-slate-700 w-[250px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {loadingFilas ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : filas.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No hay facturas para este filtro.</TableCell></TableRow>
                ) : (
                  filas.map((f) => {
                    const isBusy = actionLoadingId === f.factura_id || contasimpleLoadingId === f.factura_id || deleteDialog?.factura_id === f.factura_id;
                    const expanded = expandedIds.has(f.factura_id);
                    return (
                      <React.Fragment key={f.factura_id}>
                        <TableRow
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => toggleExpand(f.factura_id)}
                        >
                          <TableCell className="pr-0">
                            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          </TableCell>
                          <TableCell className="space-y-1"><EstadoBadge value={f.estado} /><div><ContaSimpleBadge value={f.estado_contasimple} /></div></TableCell>
                          <TableCell className="font-medium text-slate-800 truncate" title={f.proveedor_nombre || ''}>
                            {f.proveedor_nombre || '—'}
                          </TableCell>
                          <TableCell className="text-slate-700 truncate" title={f.numero_factura || ''}>
                            {f.numero_factura || '—'}
                          </TableCell>
                          <TableCell className="text-slate-600 whitespace-nowrap">{formatDateEs(f.fecha_factura)}</TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(f.total)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <AccionesBotones f={f} isBusy={isBusy} onAction={openAction} onEliminar={(fila) => setDeleteDialog(fila)} onEnviar={openSendDialog} />
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow className="bg-slate-50/60">
                            <TableCell colSpan={7} className="py-3">
                              <DetalleFactura f={f} />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="px-4 py-3 flex items-center justify-between text-xs text-muted-foreground border-t">
          <span>Mostrando {filas.length} de {filasCount}</span>
          {filas.length < filasCount && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLimit(l => l + PAGE_SIZE)}>
              <ChevronDown className="w-3.5 h-3.5" /> Ver más
            </Button>
          )}
        </div>
      </Card>

      {/* ---------- Diálogo genérico de confirmación ---------- */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => { if (!open) setActionDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog?.config.title}</DialogTitle>
            <DialogDescription>
              {actionDialog && actionDialog.config.description(actionDialog.factura)}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={actionObs}
            onChange={(e) => setActionObs(e.target.value)}
            placeholder={actionDialog?.config.requireObs ? 'Motivo (obligatorio)...' : 'Observación (opcional)...'}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancelar</Button>
            <Button
              variant={actionDialog?.config.confirmVariant}
              onClick={confirmActionDialog}
              disabled={actionLoadingId === actionDialog?.factura?.factura_id}
            >
              {actionLoadingId === actionDialog?.factura?.factura_id ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {actionDialog?.config.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Confirmación de envío real a ContaSimple ---------- */}
      <Dialog open={!!sendDialog} onOpenChange={(open) => { if (!open && !contasimpleLoadingId) { setSendDialog(null); setSendPreview(null); setSendPreviewError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar factura en ContaSimple</DialogTitle>
            <DialogDescription>
              Se crearán directamente el proveedor (solo si no existe) y la factura recibida con los datos validados por el ERP. No se subirá la imagen y no se utilizará ni cobrará el OCR de ContaSimple.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-slate-50 p-4 text-sm space-y-2">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Proveedor</span><span className="font-medium text-right">{sendDialog?.proveedor_nombre || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Nº factura</span><span className="font-medium">{sendDialog?.numero_factura || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Fecha</span><span className="font-medium">{formatDateEs(sendDialog?.fecha_factura)}</span></div>
            <div className="flex justify-between gap-4 border-t pt-2"><span className="text-muted-foreground">Total</span><span className="font-bold">{formatCurrency(sendDialog?.total)}</span></div>
          </div>
          {sendPreviewLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              <RefreshCw className="h-4 w-4 animate-spin" /> Validando proveedor, líneas, importes y posibles duplicados…
            </div>
          )}
          {sendPreviewError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {sendPreviewError}
            </div>
          )}
          {sendPreview && !sendPreviewLoading && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 space-y-1">
              <p className="font-semibold">Datos listos para registro directo</p>
              <p>{sendPreview.invoice?.lines?.length || 0} líneas · Base {formatCurrency(sendPreview.totals?.base)} · IVA {formatCurrency(sendPreview.totals?.vat)}</p>
              <p>Proveedor: {sendPreview.provider?.action === 'create' ? 'se creará en ContaSimple' : 'se reutilizará el existente'}.</p>
              <p>Archivo: no se envía · OCR de ContaSimple: no se utiliza.</p>
            </div>
          )}
          <p className="text-xs text-amber-700">El botón creará realmente la factura recibida en ContaSimple. Antes se comprobarán duplicados por NIF, número e importe.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialog(null)} disabled={!!contasimpleLoadingId}>Cancelar</Button>
            <Button onClick={confirmEnviarContasimple} disabled={!!contasimpleLoadingId || sendPreviewLoading || !sendPreview || !!sendPreviewError}>
              {contasimpleLoadingId ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
              Registrar sin OCR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Diálogo de Eliminar (facturas no contabilizables) ---------- */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar factura</DialogTitle>
            <DialogDescription>
              ¿Eliminar definitivamente la factura de "{deleteDialog?.proveedor_nombre || 'proveedor desconocido'}"
              {deleteDialog?.numero_factura ? ` (${deleteDialog.numero_factura})` : ''}? Esta acción no se puede deshacer.
              Se eliminará también su lectura OCR y su control de Contasimple asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmEliminar} disabled={deleteLoading}>
              {deleteLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
