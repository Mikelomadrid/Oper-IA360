// ComparadorContasimple.jsx
//
// Subsección "Comparador" dentro de la pestaña Contasimple.
// Lee EXCLUSIVAMENTE estas vistas de Supabase (todas ya agregadas o paginables
// desde el propio backend, sin descargar arrays grandes sin límite):
//   v_contasimple_comparador_resumen     -> cards (bloque/estado/total)
//   v_contasimple_proveedores_match      -> tabla de proveedores (paginada)
//   v_contasimple_comparador_pendientes  -> tabla de documentos pendientes (paginada)
//
// No llama a la API de Contasimple, no usa swift-function, no expone claves.
// Si estas vistas todavía no están instaladas en Supabase, muestra un aviso
// amable y NO rompe el resto del módulo de Contabilidad.

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, AlertTriangle, Users, FileStack, Paperclip,
  CheckCircle2, XCircle, ChevronDown
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import { supabase } from '@/lib/customSupabaseClient';

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

// ---------- Pequeños helpers de UI ----------

const SiNoPill = ({ value }) => (
  value
    ? <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Sí</span>
    : <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-medium"><XCircle className="w-3.5 h-3.5" /> No</span>
);

const ESTADO_MATCH_LABELS = {
  erp_y_contasimple: { label: 'ERP + Contasimple', classes: 'bg-green-100 text-green-700 border-green-200' },
  solo_erp: { label: 'Solo ERP', classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  solo_contasimple: { label: 'Solo Contasimple', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const ESTADO_COMPARACION_LABELS = {
  match_importe_ok: { label: 'Cuadra', classes: 'bg-green-100 text-green-700 border-green-200' },
  match_importe_descuadrado: { label: 'Descuadrado', classes: 'bg-red-100 text-red-700 border-red-200' },
  solo_erp: { label: 'Solo ERP', classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  solo_contasimple: { label: 'Solo Contasimple', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const EstadoBadge = ({ value, dict }) => {
  const info = dict[value] || { label: value || 'Desconocido', classes: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wide ${info.classes}`}>
      {info.label}
    </span>
  );
};

const TIPO_LABELS = {
  gasto: 'Gasto',
  factura_recibida: 'Factura recibida',
};

// ---------- Aviso de vistas no instaladas (no rompe el resto de Contabilidad) ----------

const VistasFaltantesAviso = ({ onRetry }) => (
  <Card className="shadow-sm border-amber-200 bg-amber-50/50">
    <CardContent className="py-10 flex flex-col items-center justify-center gap-3 text-center px-4">
      <AlertTriangle className="w-8 h-8 text-amber-500" />
      <p className="text-sm font-medium text-amber-800">Falta instalar las vistas del comparador</p>
      <p className="text-xs text-amber-700 max-w-md">
        Esta sección necesita las vistas v_contasimple_comparador_resumen, v_contasimple_proveedores_match
        y v_contasimple_comparador_pendientes en Supabase. El resto de Contabilidad sigue funcionando con normalidad.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 mt-1">
        <RefreshCw className="w-3.5 h-3.5" /> Reintentar
      </Button>
    </CardContent>
  </Card>
);

// Detecta el error típico de PostgREST cuando una vista/tabla no existe (42P01)
const isMissingRelationError = (err) => {
  if (!err) return false;
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();
  return code === '42P01' || msg.includes('does not exist') || msg.includes('schema cache');
};

// ---------- Resumen (cards) ----------

const ResumenBloque = ({ title, icon: Icon, items, labels }) => {
  const total = items.reduce((sum, it) => sum + (Number(it.total) || 0), 0);
  return (
    <Card className="shadow-sm border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
          <span className="ml-auto text-xs text-muted-foreground">{total} total</span>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin datos.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((it) => {
              const info = labels[it.estado] || { label: it.estado, classes: 'bg-slate-100 text-slate-600 border-slate-200' };
              return (
                <div key={it.estado} className="flex items-center justify-between text-sm">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${info.classes}`}>
                    {info.label}
                  </span>
                  <span className="font-bold text-slate-900">{it.total}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ADJUNTOS_LABELS = {
  con_adjunto: { label: 'Con adjunto', classes: 'bg-green-100 text-green-700 border-green-200' },
  sin_adjunto: { label: 'Sin adjunto', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function ComparadorContasimple() {
  // Estado general
  const [missing, setMissing] = useState(false);
  const [loadingResumen, setLoadingResumen] = useState(true);
  const [errorResumen, setErrorResumen] = useState(null);
  const [resumen, setResumen] = useState([]);

  // Proveedores
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCount, setProveedoresCount] = useState(0);
  const [proveedoresLoading, setProveedoresLoading] = useState(true);
  const [proveedoresError, setProveedoresError] = useState(null);
  const [proveedoresFiltro, setProveedoresFiltro] = useState('all');
  const [proveedoresLimit, setProveedoresLimit] = useState(PAGE_SIZE);

  // Documentos pendientes
  const [pendientes, setPendientes] = useState([]);
  const [pendientesCount, setPendientesCount] = useState(0);
  const [pendientesLoading, setPendientesLoading] = useState(true);
  const [pendientesError, setPendientesError] = useState(null);
  const [filtroEstadoComparacion, setFiltroEstadoComparacion] = useState('all');
  const [filtroTipo, setFiltroTipo] = useState('all');
  const [filtroAnio, setFiltroAnio] = useState('all');
  const [pendientesLimit, setPendientesLimit] = useState(PAGE_SIZE);

  // ---------- Carga del resumen ----------
  const loadResumen = useCallback(async () => {
    setLoadingResumen(true);
    setErrorResumen(null);
    try {
      const { data, error } = await supabase
        .from('v_contasimple_comparador_resumen')
        .select('*');
      if (error) throw error;
      setResumen(data || []);
      setMissing(false);
    } catch (err) {
      console.error('Error cargando resumen del comparador:', err);
      if (isMissingRelationError(err)) {
        setMissing(true);
      } else {
        setErrorResumen(err?.message || 'No se pudo cargar el resumen del comparador.');
      }
    } finally {
      setLoadingResumen(false);
    }
  }, []);

  // ---------- Carga de proveedores (paginada, filtrable) ----------
  const loadProveedores = useCallback(async (filtro, limit) => {
    setProveedoresLoading(true);
    setProveedoresError(null);
    try {
      let query = supabase
        .from('v_contasimple_proveedores_match')
        .select('*', { count: 'exact' });
      if (filtro !== 'all') {
        query = query.eq('estado_match', filtro);
      }
      query = query.range(0, limit - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      setProveedores(data || []);
      setProveedoresCount(count ?? (data || []).length);
    } catch (err) {
      console.error('Error cargando proveedores del comparador:', err);
      if (isMissingRelationError(err)) {
        setMissing(true);
      } else {
        setProveedoresError(err?.message || 'No se pudieron cargar los proveedores.');
      }
    } finally {
      setProveedoresLoading(false);
    }
  }, []);

  // ---------- Carga de documentos pendientes (paginada, filtrable) ----------
  const loadPendientes = useCallback(async (estadoComparacion, tipo, anio, limit) => {
    setPendientesLoading(true);
    setPendientesError(null);
    try {
      let query = supabase
        .from('v_contasimple_comparador_pendientes')
        .select('*', { count: 'exact' });

      if (estadoComparacion !== 'all') {
        query = query.eq('estado_comparacion', estadoComparacion);
      }
      if (tipo !== 'all') {
        query = query.eq('contasimple_tipo', tipo);
      }
      if (anio !== 'all') {
        const from = `${anio}-01-01`;
        const to = `${Number(anio) + 1}-01-01`;
        // Año contable: preferimos contasimple_period (prefijo AAAA); si no hay
        // periodo (documentos "solo_erp"), usamos la fecha del ERP como fallback.
        query = query.or(
          `contasimple_period.ilike.${anio}%,and(contasimple_period.is.null,erp_fecha_factura.gte.${from},erp_fecha_factura.lt.${to})`
        );
      }

      query = query.order('erp_fecha_registro', { ascending: false, nullsFirst: false }).range(0, limit - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      setPendientes(data || []);
      setPendientesCount(count ?? (data || []).length);
    } catch (err) {
      console.error('Error cargando documentos pendientes del comparador:', err);
      if (isMissingRelationError(err)) {
        setMissing(true);
      } else {
        setPendientesError(err?.message || 'No se pudieron cargar los documentos pendientes.');
      }
    } finally {
      setPendientesLoading(false);
    }
  }, []);

  useEffect(() => { loadResumen(); }, [loadResumen]);
  useEffect(() => { loadProveedores(proveedoresFiltro, proveedoresLimit); }, [proveedoresFiltro, proveedoresLimit, loadProveedores]);
  useEffect(() => { loadPendientes(filtroEstadoComparacion, filtroTipo, filtroAnio, pendientesLimit); }, [filtroEstadoComparacion, filtroTipo, filtroAnio, pendientesLimit, loadPendientes]);

  const handleRetryAll = () => {
    setMissing(false);
    loadResumen();
    loadProveedores(proveedoresFiltro, proveedoresLimit);
    loadPendientes(filtroEstadoComparacion, filtroTipo, filtroAnio, pendientesLimit);
  };

  // ---------- Aviso global si las vistas no están instaladas ----------
  if (missing) {
    return <VistasFaltantesAviso onRetry={handleRetryAll} />;
  }

  const porBloque = (bloque) => resumen.filter(r => r.bloque === bloque);

  return (
    <div className="space-y-6">

      {/* ---------- Resumen ---------- */}
      {loadingResumen ? (
        <Card className="shadow-sm border-slate-200">
          <CardContent className="h-32 flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" /> Cargando resumen del comparador...
          </CardContent>
        </Card>
      ) : errorResumen ? (
        <Card className="shadow-sm border-red-200">
          <CardContent className="h-32 flex flex-col items-center justify-center gap-2 text-center px-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <p className="text-sm text-red-700">{errorResumen}</p>
            <Button variant="outline" size="sm" onClick={loadResumen}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <ResumenBloque title="Proveedores" icon={Users} items={porBloque('proveedores')} labels={ESTADO_MATCH_LABELS} />
          <ResumenBloque title="Documentos" icon={FileStack} items={porBloque('documentos')} labels={ESTADO_COMPARACION_LABELS} />
          <ResumenBloque title="Adjuntos ERP" icon={Paperclip} items={porBloque('adjuntos_erp')} labels={ADJUNTOS_LABELS} />
          <ResumenBloque title="Adjuntos Contasimple" icon={Paperclip} items={porBloque('adjuntos_contasimple')} labels={ADJUNTOS_LABELS} />
        </div>
      )}

      {/* ---------- Tabla de proveedores ---------- */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <div className="px-4 pt-4 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Proveedores: ERP vs Contasimple</h3>
          <select
            value={proveedoresFiltro}
            onChange={(e) => { setProveedoresFiltro(e.target.value); setProveedoresLimit(PAGE_SIZE); }}
            className="bg-background border rounded-lg px-3 py-1.5 text-xs"
          >
            <option value="all">Todos los estados</option>
            <option value="erp_y_contasimple">ERP + Contasimple</option>
            <option value="solo_erp">Solo ERP</option>
            <option value="solo_contasimple">Solo Contasimple</option>
          </select>
        </div>
        {proveedoresError ? (
          <div className="p-6 text-center text-sm text-red-600">{proveedoresError}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700">Proveedor ERP</TableHead>
                  <TableHead className="font-semibold text-slate-700">CIF ERP</TableHead>
                  <TableHead className="font-semibold text-slate-700">Proveedor Contasimple</TableHead>
                  <TableHead className="font-semibold text-slate-700">NIF Contasimple</TableHead>
                  <TableHead className="font-semibold text-slate-700">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {proveedoresLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : proveedores.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No hay proveedores para este filtro.</TableCell></TableRow>
                ) : (
                  proveedores.map((p) => (
                    <TableRow key={p.erp_proveedor_id || p.contasimple_id} className="hover:bg-slate-50">
                      <TableCell className="text-slate-700">{p.erp_nombre || '—'}</TableCell>
                      <TableCell className="text-slate-500">{p.erp_cif || '—'}</TableCell>
                      <TableCell className="text-slate-700">{p.contasimple_nombre || '—'}</TableCell>
                      <TableCell className="text-slate-500">{p.contasimple_nif || '—'}</TableCell>
                      <TableCell><EstadoBadge value={p.estado_match} dict={ESTADO_MATCH_LABELS} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="px-4 py-3 flex items-center justify-between text-xs text-muted-foreground border-t">
          <span>Mostrando {proveedores.length} de {proveedoresCount}</span>
          {proveedores.length < proveedoresCount && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setProveedoresLimit(l => l + PAGE_SIZE)}>
              <ChevronDown className="w-3.5 h-3.5" /> Ver más
            </Button>
          )}
        </div>
      </Card>

      {/* ---------- Tabla de documentos pendientes ---------- */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <div className="px-4 pt-4 pb-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Documentos pendientes de cuadre</h3>
          <div className="flex flex-wrap gap-2">
            <select
              value={filtroEstadoComparacion}
              onChange={(e) => { setFiltroEstadoComparacion(e.target.value); setPendientesLimit(PAGE_SIZE); }}
              className="bg-background border rounded-lg px-3 py-1.5 text-xs"
            >
              <option value="all">Todos los estados</option>
              <option value="match_importe_ok">Cuadra</option>
              <option value="match_importe_descuadrado">Descuadrado</option>
              <option value="solo_erp">Solo ERP</option>
              <option value="solo_contasimple">Solo Contasimple</option>
            </select>
            <select
              value={filtroTipo}
              onChange={(e) => { setFiltroTipo(e.target.value); setPendientesLimit(PAGE_SIZE); }}
              className="bg-background border rounded-lg px-3 py-1.5 text-xs"
            >
              <option value="all">Todos los tipos</option>
              <option value="factura_recibida">Factura recibida</option>
              <option value="gasto">Gasto</option>
            </select>
            <select
              value={filtroAnio}
              onChange={(e) => { setFiltroAnio(e.target.value); setPendientesLimit(PAGE_SIZE); }}
              className="bg-background border rounded-lg px-3 py-1.5 text-xs"
            >
              <option value="all">Todos los años</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>
        </div>
        {pendientesError ? (
          <div className="p-6 text-center text-sm text-red-600">{pendientesError}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead colSpan={7} className="text-center text-[11px] uppercase tracking-wide text-slate-500 bg-slate-100 border-r">ERP</TableHead>
                  <TableHead colSpan={8} className="text-center text-[11px] uppercase tracking-wide text-slate-500 bg-slate-100">Contasimple</TableHead>
                  <TableHead rowSpan={2} className="align-bottom font-semibold text-slate-700">Diferencia</TableHead>
                  <TableHead rowSpan={2} className="align-bottom font-semibold text-slate-700">Estado</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="font-semibold text-slate-700 border-r-0">Proveedor</TableHead>
                  <TableHead className="font-semibold text-slate-700">NIF</TableHead>
                  <TableHead className="font-semibold text-slate-700">Número</TableHead>
                  <TableHead className="font-semibold text-slate-700">Fecha</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">Total</TableHead>
                  <TableHead className="font-semibold text-slate-700">Adjunto</TableHead>
                  <TableHead className="font-semibold text-slate-700 border-r">Estado cont.</TableHead>
                  <TableHead className="font-semibold text-slate-700">Tipo</TableHead>
                  <TableHead className="font-semibold text-slate-700">ID</TableHead>
                  <TableHead className="font-semibold text-slate-700">Proveedor</TableHead>
                  <TableHead className="font-semibold text-slate-700">NIF</TableHead>
                  <TableHead className="font-semibold text-slate-700">Número</TableHead>
                  <TableHead className="font-semibold text-slate-700">Periodo</TableHead>
                  <TableHead className="font-semibold text-slate-700">Fecha</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {pendientesLoading ? (
                  <TableRow><TableCell colSpan={16} className="h-20 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : pendientes.length === 0 ? (
                  <TableRow><TableCell colSpan={16} className="h-20 text-center text-muted-foreground">No hay documentos pendientes para este filtro.</TableCell></TableRow>
                ) : (
                  pendientes.map((d) => (
                    <TableRow key={d.erp_factura_id || `${d.contasimple_tipo}-${d.contasimple_id}`} className="hover:bg-slate-50">
                      <TableCell className="text-slate-700">{d.erp_proveedor_nombre || '—'}</TableCell>
                      <TableCell className="text-slate-500">{d.erp_proveedor_nif || '—'}</TableCell>
                      <TableCell className="text-slate-700">{d.erp_numero_factura || '—'}</TableCell>
                      <TableCell className="text-slate-600">{formatDateEs(d.erp_fecha_factura)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(d.erp_total)}</TableCell>
                      <TableCell><SiNoPill value={d.erp_tiene_adjunto} /></TableCell>
                      <TableCell className="text-slate-500 border-r">{d.erp_estado_contabilidad || '—'}</TableCell>
                      <TableCell className="text-slate-600">{TIPO_LABELS[d.contasimple_tipo] || '—'}</TableCell>
                      <TableCell className="text-slate-500">{d.contasimple_id ?? '—'}</TableCell>
                      <TableCell className="text-slate-700">{d.contasimple_proveedor_nombre || '—'}</TableCell>
                      <TableCell className="text-slate-500">{d.contasimple_proveedor_nif || '—'}</TableCell>
                      <TableCell className="text-slate-700">{d.contasimple_numero_factura || '—'}</TableCell>
                      <TableCell className="text-slate-500">{d.contasimple_period || '—'}</TableCell>
                      <TableCell className="text-slate-600">{formatDateEs(d.contasimple_fecha_factura)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(d.contasimple_total)}</TableCell>
                      <TableCell className={`text-right font-semibold ${Number(d.diferencia_total) !== 0 ? 'text-red-600' : 'text-slate-700'}`}>
                        {formatCurrency(d.diferencia_total)}
                      </TableCell>
                      <TableCell><EstadoBadge value={d.estado_comparacion} dict={ESTADO_COMPARACION_LABELS} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="px-4 py-3 flex items-center justify-between text-xs text-muted-foreground border-t">
          <span>Mostrando {pendientes.length} de {pendientesCount}</span>
          {pendientes.length < pendientesCount && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPendientesLimit(l => l + PAGE_SIZE)}>
              <ChevronDown className="w-3.5 h-3.5" /> Ver más
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
