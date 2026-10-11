import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Euro,
  FileWarning,
  Loader2,
  Link2,
  RefreshCw,
  SearchCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  getFacturasEmitidas,
  getFacturasRecibidas,
  testConnection as testContasimpleConnection,
} from '@/services/contasimpleService';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_PART_STATES = new Set(['realizado', 'finalizado', 'cerrado', 'archivado', 'cancelado', 'anulado']);
const CLOSED_LEAD_STATES = new Set(['aceptado', 'rechazado', 'anulado', 'convertido', 'aprobado', 'cancelado', 'finalizado']);

const startOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const validDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysUntil = (value, today) => {
  const date = validDate(value);
  if (!date) return null;
  return Math.ceil((startOfDay(date).getTime() - today.getTime()) / DAY_MS);
};

const formatDate = (value) => {
  const date = validDate(value);
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date);
};

const formatCurrency = (value) => new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
}).format(Number(value) || 0);

const normalizeContasimpleRows = (payload) => {
  const candidates = [
    payload?.data,
    payload?.items,
    payload?.results,
    payload?.invoices,
    payload?.rows,
    payload,
  ];
  return candidates.find(Array.isArray) || [];
};

const getInvoiceAmount = (invoice) => {
  const candidates = [
    invoice?.total,
    invoice?.Total,
    invoice?.totalAmount,
    invoice?.TotalAmount,
    invoice?.total_amount,
    invoice?.grossAmount,
    invoice?.amount,
    invoice?.Amount,
  ];
  const value = candidates.find((candidate) => candidate !== null && candidate !== undefined && candidate !== '');
  const normalized = typeof value === 'string' ? value.replace(/\s/g, '').replace(',', '.') : value;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
};

const buildRadar = ({
  tareas,
  partes,
  leads,
  proyectos,
  gastos,
  facturasContasimple = [],
  devolucionesPendientes = [],
  materialesAuditados = [],
}) => {
  const today = startOfDay();
  const nextWeek = new Date(today.getTime() + (7 * DAY_MS));
  const items = [];

  tareas.forEach((tarea) => {
    const remaining = daysUntil(tarea.fecha_limite, today);
    if (remaining !== null && remaining <= 7) {
      items.push({
        id: `tarea-${tarea.id}`,
        lane: remaining <= 0 ? 'urgente' : 'proximo',
        kind: 'Tarea',
        icon: ClipboardList,
        title: tarea.titulo || 'Tarea sin título',
        detail: remaining < 0 ? `Vencida hace ${Math.abs(remaining)} día(s)` : remaining === 0 ? 'Vence hoy' : `Vence en ${remaining} día(s)`,
        date: tarea.fecha_limite,
        href: `/gestion/tareas?focus=${tarea.id}`,
      });
      return;
    }

    if (!tarea.empleado_asignado_id) {
      items.push({
        id: `tarea-${tarea.id}`,
        lane: 'sin_seguimiento',
        kind: 'Tarea',
        icon: ClipboardList,
        title: tarea.titulo || 'Tarea sin título',
        detail: 'Sin responsable asignado',
        date: tarea.fecha_limite,
        href: `/gestion/tareas?focus=${tarea.id}`,
      });
    }
  });

  partes.forEach((parte) => {
    const state = String(parte.estado || '').toLowerCase();
    if (CLOSED_PART_STATES.has(state)) return;
    const visitDate = validDate(parte.fecha_visita || parte.visita_agendada_at);
    const createdDate = validDate(parte.created_at);
    const reference = parte.custom_id || `#${String(parte.id).slice(0, 8)}`;

    if (visitDate && visitDate <= nextWeek) {
      const remaining = daysUntil(visitDate, today);
      items.push({
        id: `parte-${parte.id}`,
        lane: remaining <= 0 ? 'urgente' : 'proximo',
        kind: 'Parte',
        icon: Wrench,
        title: `${reference} · ${parte.cliente_nombre || 'Cliente sin nombre'}`,
        detail: remaining < 0 ? `Visita atrasada ${Math.abs(remaining)} día(s)` : remaining === 0 ? 'Visita prevista hoy' : `Visita en ${remaining} día(s)`,
        date: visitDate,
        href: `/gestion/partes/detail/${parte.id}`,
      });
      return;
    }

    if (!visitDate && createdDate && ((today.getTime() - startOfDay(createdDate).getTime()) / DAY_MS) >= 3) {
      items.push({
        id: `parte-${parte.id}`,
        lane: 'sin_seguimiento',
        kind: 'Parte',
        icon: Wrench,
        title: `${reference} · ${parte.cliente_nombre || 'Cliente sin nombre'}`,
        detail: 'Sin visita programada',
        date: createdDate,
        href: `/gestion/partes/detail/${parte.id}`,
      });
    }
  });

  proyectos.forEach((proyecto) => {
    const deadline = proyecto.fecha_fin_estimada || proyecto.fecha_finalizacion_estimada;
    const remaining = daysUntil(deadline, today);
    if (remaining === null || remaining > 7) return;
    items.push({
      id: `proyecto-${proyecto.id}`,
      lane: remaining <= 0 ? 'urgente' : 'proximo',
      kind: 'Obra',
      icon: Briefcase,
      title: proyecto.nombre_proyecto || 'Obra sin nombre',
      detail: remaining < 0 ? `Fin previsto superado ${Math.abs(remaining)} día(s)` : remaining === 0 ? 'Fin previsto hoy' : `Fin previsto en ${remaining} día(s)`,
      date: deadline,
      href: `/gestion/obras/${proyecto.id}`,
    });
  });

  gastos.forEach((gasto) => {
    const remaining = daysUntil(gasto.fecha_vencimiento, today);
    if (remaining === null || remaining > 7 || gasto.estado_pago === 'pagada') return;
    items.push({
      id: `gasto-${gasto.id}`,
      lane: remaining <= 0 ? 'urgente' : 'proximo',
      kind: 'Factura',
      icon: FileWarning,
      title: gasto.concepto || gasto.numero_factura || 'Factura sin concepto',
      detail: remaining < 0 ? `Pago vencido hace ${Math.abs(remaining)} día(s)` : remaining === 0 ? 'Pago vence hoy' : `Pago vence en ${remaining} día(s)`,
      date: gasto.fecha_vencimiento,
      href: '/administracion/gastos',
    });
  });

  facturasContasimple.forEach((factura) => {
    const state = factura.estado_contasimple;
    if (!['lista_para_contasimple', 'posible_duplicado_contasimple', 'error_contasimple'].includes(state)) return;
    const hasError = ['posible_duplicado_contasimple', 'error_contasimple'].includes(state);
    const reference = factura.numero_factura || `#${String(factura.factura_id).slice(0, 8)}`;
    const statusLabel = state === 'lista_para_contasimple'
      ? 'Preparada pero pendiente de registrar'
      : state === 'posible_duplicado_contasimple'
        ? 'Posible duplicado: requiere revisión'
        : factura.contasimple_error || 'Error al registrar en ContaSimple';
    items.push({
      id: `contasimple-${factura.factura_id}`,
      lane: hasError ? 'urgente' : 'sin_seguimiento',
      kind: 'ContaSimple',
      icon: Link2,
      title: `${reference} · ${factura.proveedor_nombre || 'Proveedor sin identificar'}`,
      detail: `${statusLabel} · ${formatCurrency(factura.total)}`,
      date: factura.fecha_registro || factura.fecha_factura,
      href: '/contabilidad?subtab=bandeja',
    });
  });

  devolucionesPendientes.forEach((devolucion) => {
    const createdAt = validDate(devolucion.created_at);
    const ageDays = createdAt
      ? Math.max(0, Math.floor((today.getTime() - startOfDay(createdAt).getTime()) / DAY_MS))
      : 0;
    items.push({
      id: `abono-${devolucion.id}`,
      lane: ageDays >= 7 ? 'urgente' : 'sin_seguimiento',
      kind: 'Abono',
      icon: Euro,
      title: `${devolucion.proveedor_nombre || 'Proveedor'} · ${devolucion.obra_nombre || 'Obra'}`,
      detail: `${formatCurrency(devolucion.importe_base_estimado)} pendientes de abono${ageDays ? ` · ${ageDays} día(s)` : ''}`,
      date: devolucion.created_at,
      href: `/gestion/obras/${devolucion.obra_id}?tab=materiales`,
    });
  });

  materialesAuditados.forEach((material) => {
    const state = material.estado_auditoria;
    const stateLabel = {
      no_previsto: 'Material no previsto en esta obra',
      unidad_incompatible: 'Unidad incompatible con la prevista',
      exceso_cantidad: 'Cantidad superior a la prevista',
      pendiente_revision: 'Conciliación pendiente de revisión',
    }[state] || 'Material pendiente de revisar';
    items.push({
      id: `material-${material.linea_ocr_id}`,
      lane: ['unidad_incompatible', 'exceso_cantidad'].includes(state) ? 'urgente' : 'sin_seguimiento',
      kind: 'Material',
      icon: SearchCheck,
      title: `${material.descripcion || material.referencia || 'Material sin descripción'} · ${material.nombre_proyecto || 'Obra'}`,
      detail: material.motivo_auditoria || stateLabel,
      date: material.fecha_factura,
      href: `/gestion/obras/${material.obra_id}?tab=materiales`,
    });
  });

  leads.forEach((lead) => {
    const state = String(lead.estado || '').toLowerCase();
    if (lead.archivado || CLOSED_LEAD_STATES.has(state)) return;
    const lastActivity = validDate(lead.updated_at || lead.visto_primera_vez_at || lead.fecha_creacion || lead.created_at);
    if (!lastActivity) return;
    const inactiveDays = Math.floor((today.getTime() - startOfDay(lastActivity).getTime()) / DAY_MS);
    if (inactiveDays < 7) return;
    items.push({
      id: `lead-${lead.id}`,
      lane: 'sin_seguimiento',
      kind: 'Lead',
      icon: SearchCheck,
      title: lead.nombre_empresa || lead.nombre_contacto || 'Lead sin nombre',
      detail: `${inactiveDays} día(s) sin actividad registrada`,
      date: lastActivity,
      href: `/gestion/leads/${lead.id}`,
    });
  });

  return items.sort((a, b) => {
    const laneOrder = { urgente: 0, proximo: 1, sin_seguimiento: 2 };
    if (laneOrder[a.lane] !== laneOrder[b.lane]) return laneOrder[a.lane] - laneOrder[b.lane];
    return (validDate(a.date)?.getTime() || 0) - (validDate(b.date)?.getTime() || 0);
  });
};

const laneConfig = {
  urgente: {
    title: 'Urgente hoy',
    subtitle: 'Vencido o con fecha de hoy',
    icon: AlertTriangle,
    accent: 'text-destructive',
    line: 'bg-destructive',
    count: 'bg-destructive/10 text-destructive',
  },
  proximo: {
    title: 'Próximos 7 días',
    subtitle: 'Compromisos que se acercan',
    icon: CalendarClock,
    accent: 'text-amber-600 dark:text-amber-400',
    line: 'bg-amber-500',
    count: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  sin_seguimiento: {
    title: 'Sin seguimiento',
    subtitle: 'Abierto sin movimiento suficiente',
    icon: SearchCheck,
    accent: 'text-primary',
    line: 'bg-primary',
    count: 'bg-primary/10 text-primary',
  },
};

const RadarItem = ({ item, navigate }) => {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => navigate(item.href)}
      className="group w-full rounded-lg border border-border/60 bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md border border-border/50 bg-muted/35 p-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.kind}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDate(item.date)}</span>
          </div>
          <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">{item.title}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs leading-4 text-muted-foreground">{item.detail}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
        </div>
      </div>
    </button>
  );
};

const RadarLane = ({ lane, items, navigate }) => {
  const config = laneConfig[lane];
  const Icon = config.icon;
  return (
    <section className="min-w-0" aria-labelledby={`radar-${lane}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('mt-0.5 rounded-md border border-border/50 bg-card p-2', config.accent)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h2 id={`radar-${lane}`} className="text-sm font-bold tracking-tight">{config.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{config.subtitle}</p>
          </div>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold tabular-nums', config.count)}>{items.length}</span>
      </div>
      <div className={cn('mb-3 h-0.5 w-full rounded-full opacity-70', config.line)} />
      <div className="space-y-2">
        {items.length > 0 ? items.map((item) => <RadarItem key={item.id} item={item} navigate={navigate} />) : (
          <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 text-center">
            <div>
              <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-600/70 dark:text-emerald-400/70" />
              <p className="text-sm font-medium text-foreground">Sin asuntos en este carril</p>
              <p className="mt-1 text-xs text-muted-foreground">El radar no ha encontrado incidencias.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const CentroControlIA = ({ navigate }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [contasimpleStatus, setContasimpleStatus] = useState({ state: 'idle', message: 'Pendiente de comprobación' });
  const [contasimpleInvoices, setContasimpleInvoices] = useState({
    state: 'idle',
    issuedCount: 0,
    receivedCount: 0,
    issuedAvailable: 0,
    receivedAvailable: 0,
    issuedTotal: 0,
    receivedTotal: 0,
    issuedComplete: true,
    receivedComplete: true,
    loadedAt: null,
    message: '',
  });
  const feedbackTimerRef = useRef(null);

  const loadRadar = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const activeTaskStates = ['pendiente', 'en_progreso', 'en_revision', 'pendiente_revision', 'en_proceso'];
      const [
        taskResult,
        partResult,
        leadResult,
        projectResult,
        expenseResult,
        contasimpleResult,
        returnsResult,
        materialAuditResult,
      ] = await Promise.all([
        supabase.from('tareas').select('id,titulo,estado,fecha_limite,proyecto_id,empleado_asignado_id').in('estado', activeTaskStates).limit(300),
        supabase.from('partes').select('id,custom_id,estado,cliente_nombre,fecha_visita,visita_agendada_at,created_at,deleted_at').is('deleted_at', null).limit(300),
        supabase.from('leads').select('id,nombre_contacto,nombre_empresa,estado,archivado,fecha_creacion,created_at,updated_at,visto_primera_vez_at').eq('archivado', false).limit(300),
        supabase.from('proyectos').select('id,nombre_proyecto,estado,fecha_finalizacion_estimada,fecha_fin_estimada').in('estado', ['activo', 'en_espera']).limit(300),
        supabase.from('gastos').select('id,numero_factura,concepto,estado_pago,fecha_vencimiento,total_con_iva').in('estado_pago', ['pendiente_pago', 'parcialmente_pagada', 'vencida']).limit(300),
        supabase
          .from('v_contasimple_admin_bandeja_facturas')
          .select('factura_id,fecha_registro,proveedor_nombre,numero_factura,fecha_factura,total,estado_contasimple,contasimple_error')
          .in('estado_contasimple', ['lista_para_contasimple', 'posible_duplicado_contasimple', 'error_contasimple'])
          .limit(150),
        supabase
          .from('v_devoluciones_proveedor_pendientes_abono')
          .select('id,obra_id,obra_nombre,proveedor_nombre,importe_base_estimado,created_at,numero_factura_origen')
          .limit(150),
        supabase
          .from('v_factura_material_auditoria')
          .select('factura_id,obra_id,nombre_proyecto,fecha_factura,linea_ocr_id,referencia,descripcion,estado_auditoria,motivo_auditoria')
          .in('estado_auditoria', ['no_previsto', 'unidad_incompatible', 'exceso_cantidad', 'pendiente_revision'])
          .limit(200),
      ]);

      const results = [taskResult, partResult, leadResult, projectResult, expenseResult];
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) throw firstError;

      [contasimpleResult, returnsResult, materialAuditResult].forEach((result) => {
        if (result.error) console.warn('Optional IA360 control source unavailable:', result.error.message);
      });

      setItems(buildRadar({
        tareas: taskResult.data || [],
        partes: partResult.data || [],
        leads: leadResult.data || [],
        proyectos: projectResult.data || [],
        gastos: expenseResult.data || [],
        facturasContasimple: contasimpleResult.error ? [] : (contasimpleResult.data || []),
        devolucionesPendientes: returnsResult.error ? [] : (returnsResult.data || []),
        materialesAuditados: materialAuditResult.error ? [] : (materialAuditResult.data || []),
      }));
      setLastUpdated(new Date());
      if (silent) {
        setRefreshMessage('Radar actualizado');
        if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = window.setTimeout(() => setRefreshMessage(''), 3500);
      }
    } catch (loadError) {
      console.error('Error loading IA360 control radar:', loadError);
      setError('No se ha podido actualizar el radar. Revisa los permisos de lectura del entorno.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRadar();
  }, [loadRadar]);

  useEffect(() => () => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
  }, []);

  const checkContasimple = useCallback(async () => {
    setContasimpleStatus({ state: 'checking', message: 'Comprobando conexión segura…' });
    try {
      const result = await testContasimpleConnection();
      if (!result?.connected) throw new Error(result?.message || 'La conexión no se pudo verificar.');
      setContasimpleStatus({ state: 'connected', message: 'Conectado en modo solo lectura' });
    } catch (connectionError) {
      console.error('Error checking Contasimple connection:', connectionError);
      setContasimpleStatus({ state: 'error', message: connectionError?.message || 'No se pudo validar la conexión' });
    }
  }, []);

  const loadContasimpleInvoices = useCallback(async () => {
    const currentYearStart = `${new Date().getFullYear()}-01-01`;
    setContasimpleInvoices((current) => ({ ...current, state: 'loading', message: '' }));
    try {
      const [issuedResult, receivedResult] = await Promise.all([
        getFacturasEmitidas(currentYearStart),
        getFacturasRecibidas(currentYearStart),
      ]);
      const issued = normalizeContasimpleRows(issuedResult?.data);
      const received = normalizeContasimpleRows(receivedResult?.data);

      setContasimpleStatus({ state: 'connected', message: 'Conectado en modo solo lectura' });
      setContasimpleInvoices({
        state: 'loaded',
        issuedCount: issued.length,
        receivedCount: received.length,
        issuedAvailable: issuedResult?.meta?.totalAvailable ?? issued.length,
        receivedAvailable: receivedResult?.meta?.totalAvailable ?? received.length,
        issuedTotal: issued.reduce((total, invoice) => total + getInvoiceAmount(invoice), 0),
        receivedTotal: received.reduce((total, invoice) => total + getInvoiceAmount(invoice), 0),
        issuedComplete: issuedResult?.meta?.complete !== false,
        receivedComplete: receivedResult?.meta?.complete !== false,
        loadedAt: new Date(),
        message: '',
      });
    } catch (invoiceError) {
      console.error('Error loading Contasimple invoices:', invoiceError);
      setContasimpleInvoices((current) => ({
        ...current,
        state: 'error',
        message: invoiceError?.message || 'No se pudieron leer las facturas.',
      }));
    }
  }, []);

  const lanes = useMemo(() => ({
    urgente: items.filter((item) => item.lane === 'urgente'),
    proximo: items.filter((item) => item.lane === 'proximo'),
    sin_seguimiento: items.filter((item) => item.lane === 'sin_seguimiento'),
  }), [items]);

  const todayLabel = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-7 border-b border-border/60 pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                <BrainCircuit className="h-4 w-4" />
                Centro de Control IA360
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Qué necesita atención ahora</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Radar operativo de solo lectura. Cruza fechas y estados del ERP para ordenar el trabajo pendiente sin modificar registros.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Corte operativo</p>
                <p className="mt-0.5 text-sm font-semibold capitalize tabular-nums">{todayLabel}</p>
              </div>
              <Button variant="outline" onClick={() => loadRadar({ silent: true })} disabled={refreshing || loading} className="gap-2">
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {refreshing ? 'Actualizando…' : 'Actualizar'}
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Lectura segura</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" />Reglas explicables, sin decisiones automáticas</span>
            {lastUpdated && <span className="tabular-nums">Actualizado a las {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
            <span aria-live="polite" className={cn('inline-flex items-center gap-1.5 font-medium text-emerald-700 transition-opacity dark:text-emerald-300', refreshMessage ? 'opacity-100' : 'opacity-0')}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {refreshMessage || 'Radar actualizado'}
            </span>
          </div>
        </header>

        <section className="mb-5 rounded-lg border border-border/60 bg-card px-4 py-3" aria-label="Estado de Contasimple">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-border/50 bg-muted/35 p-2 text-primary">
                <Link2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Contasimple</p>
                <p className={cn(
                  'mt-0.5 text-xs',
                  contasimpleStatus.state === 'connected' && 'text-emerald-700 dark:text-emerald-300',
                  contasimpleStatus.state === 'error' ? 'text-destructive' : 'text-muted-foreground',
                )}>
                  {contasimpleStatus.message}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={checkContasimple}
                disabled={contasimpleStatus.state === 'checking' || contasimpleInvoices.state === 'loading'}
              >
                {contasimpleStatus.state === 'checking'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Link2 className="h-4 w-4" />}
                {contasimpleStatus.state === 'checking' ? 'Comprobando…' : 'Probar conexión'}
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={loadContasimpleInvoices}
                disabled={contasimpleInvoices.state === 'loading' || contasimpleStatus.state === 'checking'}
              >
                {contasimpleInvoices.state === 'loading'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Euro className="h-4 w-4" />}
                {contasimpleInvoices.state === 'loading' ? 'Leyendo…' : 'Leer facturas del año'}
              </Button>
            </div>
          </div>

          {contasimpleInvoices.state === 'loaded' && (
            <div className="mt-4 grid gap-3 border-t border-border/50 pt-4 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
              <div className="rounded-md bg-muted/25 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Facturas emitidas</p>
                <p className="mt-1 text-lg font-bold tabular-nums">
                  {contasimpleInvoices.issuedComplete
                    ? contasimpleInvoices.issuedCount
                    : `${contasimpleInvoices.issuedCount} de ${contasimpleInvoices.issuedAvailable || `${contasimpleInvoices.issuedCount}+`} analizadas`}
                </p>
              </div>
              <div className="rounded-md bg-muted/25 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Importe emitido</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(contasimpleInvoices.issuedTotal)}</p>
              </div>
              <div className="rounded-md bg-muted/25 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Facturas recibidas</p>
                <p className="mt-1 text-lg font-bold tabular-nums">
                  {contasimpleInvoices.receivedComplete
                    ? contasimpleInvoices.receivedCount
                    : `${contasimpleInvoices.receivedCount} de ${contasimpleInvoices.receivedAvailable || `${contasimpleInvoices.receivedCount}+`} analizadas`}
                </p>
              </div>
              <div className="rounded-md bg-muted/25 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Importe recibido</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(contasimpleInvoices.receivedTotal)}</p>
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
                Lectura temporal desde el 1 de enero. No se ha guardado ni modificado ningún dato.
                {(!contasimpleInvoices.issuedComplete || !contasimpleInvoices.receivedComplete) && ' Contasimple limita este endpoint a las 50 facturas más recientes; los importes mostrados corresponden solo a los registros analizados.'}
                {contasimpleInvoices.loadedAt && ` Actualizado a las ${contasimpleInvoices.loadedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`}
              </p>
            </div>
          )}

          {contasimpleInvoices.state === 'error' && (
            <p className="mt-3 border-t border-border/50 pt-3 text-xs text-destructive" role="alert">
              {contasimpleInvoices.message}
            </p>
          )}
        </section>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-border/60 bg-card">
            <div className="text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
              <p className="mt-3 text-sm font-medium">Revisando el estado operativo…</p>
              <p className="mt-1 text-xs text-muted-foreground">Solo se están realizando consultas de lectura.</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <h2 className="font-semibold text-destructive">Radar no disponible</h2>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" onClick={() => loadRadar()} className="mt-4">Reintentar</Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{items.length} asunto(s) requieren revisión</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Abre cualquier elemento para revisar su contexto en el módulo original.</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold tabular-nums text-primary">{lanes.urgente.length} urgentes</span>
            </div>

            <div className="grid items-start gap-7 lg:grid-cols-3">
              <RadarLane lane="urgente" items={lanes.urgente} navigate={navigate} />
              <RadarLane lane="proximo" items={lanes.proximo} navigate={navigate} />
              <RadarLane lane="sin_seguimiento" items={lanes.sin_seguimiento} navigate={navigate} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CentroControlIA;
