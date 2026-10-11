// DashboardContabilidad.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, Receipt, FileText,
  RefreshCw, Calendar, AlertCircle, Scale
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

// NOTA: Este dashboard lee EXCLUSIVAMENTE vistas de Supabase.
// Ya NO usa contasimpleService.js / /functions/v1/swift-function.
// (contasimpleService.js se deja intacto por si otros módulos aún lo usan).
//
// La tarjeta principal (Ingresos / Gastos / Resultado) lee DIRECTAMENTE
// la vista agregada v_contasimple_dashboard_anual, filtrada por año con
// .eq('anio', Number(year)).single() — NO se suma nada en React para
// el resumen principal, NO se usan .gte('fecha')/.lt('fecha')/.limit(5000)
// para estas cifras.
//
// Las vistas detalladas (v_contasimple_facturas_emitidas_listado, etc.)
// solo se usan para el listado de "últimas facturas", nunca para el resumen.

const AVAILABLE_YEARS = ['2026', '2025'];

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);

const formatDateEs = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
};

// ---------- Carga de datos de un año concreto ----------

async function fetchYearData(year) {
  // 1) RESUMEN PRINCIPAL: única fuente de verdad, ya agregada en el backend.
  const { data: resumen, error: resumenError } = await supabase
    .from('v_contasimple_dashboard_anual')
    .select('*')
    .eq('anio', Number(year))
    .single();

  // Si no hay fila para ese año (ej. año sin datos aún), no es un error fatal:
  // se muestra el dashboard a cero en vez de un error state.
  const noRowError = resumenError && resumenError.code === 'PGRST116';
  if (resumenError && !noRowError) throw resumenError;

  // 2) Solo para el listado "Últimas facturas emitidas" (no para el resumen).
  const { data: ultimas, error: ultimasError } = await supabase
    .from('v_contasimple_facturas_emitidas_listado')
    .select('id, numero_factura, cliente_nombre, total, fecha, estado_normalizado')
    .gte('fecha', `${year}-01-01`)
    .lt('fecha', `${Number(year) + 1}-01-01`)
    .order('fecha', { ascending: false })
    .limit(5);

  if (ultimasError) throw ultimasError;

  const r = resumen || {};

  return {
    // Principal — directamente de v_contasimple_dashboard_anual
    ingresosBase: r.ingresos_base ?? 0,
    ingresosIva: r.ingresos_iva ?? 0,
    ingresosEntradas: r.ingresos_entradas ?? 0,
    gastosBaseImputable: r.gastos_base_imputable ?? 0,
    gastosIva: r.gastos_iva_imputable ?? 0,
    gastosEntradas: r.gastos_base_entradas ?? 0,
    resultadoBase: r.resultado_base_imputable ?? 0,
    resultadoIva: r.resultado_iva_imputable ?? 0,
    // Secundario — también de la misma vista, con IVA incluido
    totalFacturado: r.total_facturado_con_iva ?? 0,
    totalCobrado: r.total_cobrado_con_iva ?? 0,
    totalPendienteCobro: r.pendiente_cobro_con_iva ?? 0,
    totalFacturasRecibidas: r.total_facturas_recibidas_con_iva ?? 0,
    totalGastos: r.gastos_total ?? 0,
    // Listado
    ultimasFacturas: ultimas || [],
    loadedAt: new Date().toISOString(),
  };
}

// ---------- UI ----------

// Tarjeta principal estilo Contasimple: título + Base + IVA + Nº entradas (opcional)
const ContasimpleMainCard = ({ title, subtitle, base, iva, entradas, icon: Icon, tone = 'primary' }) => {
  const toneClasses = {
    primary: { bg: 'bg-primary/10', text: 'text-primary', baseText: 'text-slate-900' },
    green: { bg: 'bg-green-500/10', text: 'text-green-600', baseText: 'text-green-700' },
    red: { bg: 'bg-red-500/10', text: 'text-red-600', baseText: 'text-red-700' },
  };
  const t = toneClasses[tone];
  return (
    <div className="bg-card border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${t.bg}`}>
          <Icon className={`w-5 h-5 ${t.text}`} />
        </div>
      </div>
      <div>
        <p className={`text-2xl font-bold ${t.baseText}`}>{formatCurrency(base)}</p>
        <p className="text-xs text-muted-foreground">Base</p>
      </div>
      <div className="flex items-center justify-between pt-2 border-t">
        <div>
          <p className="text-sm font-semibold">{formatCurrency(iva)}</p>
          <p className="text-[11px] text-muted-foreground">IVA</p>
        </div>
        {entradas !== undefined && (
          <div className="text-right">
            <p className="text-sm font-semibold">{entradas}</p>
            <p className="text-[11px] text-muted-foreground">Nº entradas</p>
          </div>
        )}
      </div>
    </div>
  );
};

const KPICard = ({ title, value, subtitle, icon: Icon, color = 'primary' }) => {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-500/10 text-green-600',
    red: 'bg-red-500/10 text-red-600',
    yellow: 'bg-yellow-500/10 text-yellow-600',
  };
  return (
    <div className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export default function DashboardContabilidad({ navigate }) {
  const [year, setYear] = useState('2026');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataByYear, setDataByYear] = useState({});

  // Caché en memoria por año: si ya se cargó, no se vuelve a pedir a Supabase
  // salvo que se pulse "Actualizar" (force = true) o cambie el año y no esté cacheado.
  const cacheRef = useRef({});

  const loadYear = useCallback(async (y, { force = false } = {}) => {
    if (!force && cacheRef.current[y]) {
      setDataByYear(prev => ({ ...prev, [y]: cacheRef.current[y] }));
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchYearData(y);
      cacheRef.current[y] = result;
      setDataByYear(prev => ({ ...prev, [y]: result }));
    } catch (err) {
      console.error('Error cargando dashboard de Contabilidad:', err);
      setError(err?.message || 'No se pudieron cargar los datos de Contasimple.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadYear(year);
  }, [year, loadYear]);

  const handleRefresh = () => loadYear(year, { force: true });
  const handleYearChange = (e) => setYear(e.target.value);

  const data = dataByYear[year];

  // ---------- Loading state (solo si no hay nada cacheado para este año) ----------
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Cargando datos de {year}...</span>
      </div>
    );
  }

  // ---------- Error state (solo si no hay nada cacheado para este año) ----------
  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-red-600 font-medium">Error al cargar datos</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button onClick={handleRefresh} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          Reintentar
        </button>
      </div>
    );
  }

  const safeData = data || {
    ingresosBase: 0, ingresosIva: 0, ingresosEntradas: 0,
    gastosBaseImputable: 0, gastosIva: 0, gastosEntradas: 0,
    resultadoBase: 0, resultadoIva: 0,
    totalFacturado: 0, totalCobrado: 0, totalPendienteCobro: 0,
    totalFacturasRecibidas: 0, totalGastos: 0,
    ultimasFacturas: [],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <select
            value={year}
            onChange={handleYearChange}
            className="bg-background border rounded-lg px-3 py-1.5 text-sm"
          >
            {AVAILABLE_YEARS.map((y) => (
              <option key={y} value={y}>Año {y}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Tarjeta principal: v_contasimple_dashboard_anual, sin cálculo en cliente */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ContasimpleMainCard
          title="Ingresos"
          subtitle="Base imponible de facturas emitidas"
          base={safeData.ingresosBase}
          iva={safeData.ingresosIva}
          entradas={safeData.ingresosEntradas}
          icon={TrendingUp}
          tone="green"
        />
        <ContasimpleMainCard
          title="Gastos"
          subtitle="Base imputable (recibidas + gastos)"
          base={safeData.gastosBaseImputable}
          iva={safeData.gastosIva}
          entradas={safeData.gastosEntradas}
          icon={TrendingDown}
          tone="red"
        />
        <ContasimpleMainCard
          title="Resultado"
          subtitle="Base imputable (ingresos - gastos)"
          base={safeData.resultadoBase}
          iva={safeData.resultadoIva}
          entradas={undefined}
          icon={Scale}
          tone={safeData.resultadoBase >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Bloque secundario: cifras con IVA incluido, también de v_contasimple_dashboard_anual */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Facturado (con IVA)"
          value={formatCurrency(safeData.totalFacturado)}
          subtitle={`${safeData.ingresosEntradas} facturas emitidas`}
          icon={FileText}
          color="primary"
        />
        <KPICard
          title="Total Cobrado"
          value={formatCurrency(safeData.totalCobrado)}
          subtitle="Facturas emitidas cobradas"
          icon={Wallet}
          color="green"
        />
        <KPICard
          title="Pendiente de Cobro"
          value={formatCurrency(safeData.totalPendienteCobro)}
          subtitle="Facturas emitidas no cobradas"
          icon={Receipt}
          color="yellow"
        />
        <KPICard
          title="Total Facturas Recibidas (con IVA)"
          value={formatCurrency(safeData.totalFacturasRecibidas)}
          subtitle="Facturas recibidas del año"
          icon={Receipt}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4" /> Últimas Facturas Emitidas
          </h3>
          <div className="space-y-3">
            {safeData.ultimasFacturas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay facturas emitidas en {year}.</p>
            ) : (
              safeData.ultimasFacturas.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="min-w-0">
                    <span className="font-medium text-sm">{f.numero_factura || '—'}</span>
                    <p className="text-sm text-muted-foreground truncate">{f.cliente_nombre || '-'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold">{formatCurrency(f.total)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateEs(f.fecha)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Receipt className="w-4 h-4" /> Resumen {year} (base imponible)
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <span>Ingresos (base)</span>
              <span className="font-bold text-green-600">{formatCurrency(safeData.ingresosBase)}</span>
            </div>
            <div className="flex justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <span>Gastos (base imputable)</span>
              <span className="font-bold text-red-600">{formatCurrency(safeData.gastosBaseImputable)}</span>
            </div>
            <div className={`flex justify-between p-3 rounded-lg ${safeData.resultadoBase >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              <span className="font-semibold">Resultado (base)</span>
              <span className={`font-bold text-lg ${safeData.resultadoBase >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(safeData.resultadoBase)}
              </span>
            </div>
            <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
              <span>Resultado (IVA)</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(safeData.resultadoIva)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
