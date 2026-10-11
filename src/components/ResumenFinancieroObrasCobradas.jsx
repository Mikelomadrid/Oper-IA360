import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';

const formatMoney = (value) =>
  (Number(value) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const formatMonthLabel = (mesISO) => {
  const d = new Date(mesISO + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }).replace('.', '');
};

export default function ResumenFinancieroObrasCobradas() {
  const [expandedMonth, setExpandedMonth] = useState(null);

  const { data: meses = [], isLoading: loadingMeses } = useQuery({
    queryKey: ['resumen_financiero_obras_cobradas_por_mes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_resumen_financiero_obras_cobradas_por_mes')
        .select('*')
        .order('mes', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: detalle = [], isLoading: loadingDetalle } = useQuery({
    queryKey: ['resumen_financiero_obras_cobradas_detalle'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_resumen_financiero_obras_cobradas_detalle')
        .select('*')
        .order('fecha_cierre_real', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Últimos 12 meses con datos para el gráfico
  const mesesGrafica = useMemo(() => meses.slice(-12), [meses]);

  const maxValor = useMemo(() => {
    return mesesGrafica.reduce((max, m) => Math.max(max, Number(m.facturado), Number(m.gastos)), 0) || 1;
  }, [mesesGrafica]);

  const totales = useMemo(() => {
    return meses.reduce(
      (acc, m) => ({
        facturado: acc.facturado + Number(m.facturado || 0),
        gastos: acc.gastos + Number(m.gastos || 0),
        beneficio: acc.beneficio + Number(m.beneficio || 0),
        num_obras: acc.num_obras + Number(m.num_obras || 0),
      }),
      { facturado: 0, gastos: 0, beneficio: 0, num_obras: 0 }
    );
  }, [meses]);

  const detallePorMes = useMemo(() => {
    const map = {};
    detalle.forEach((d) => {
      const key = d.mes;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [detalle]);

  const isLoading = loadingMeses || loadingDetalle;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Cargando resumen financiero...
      </div>
    );
  }

  if (meses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Resumen financiero — Obras cobradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Todavía no hay ninguna obra en estado "cobrado" con fecha de cierre registrada.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Resumen financiero — Obras cobradas
          </CardTitle>
          <CardDescription>
            Se suman automáticamente todas las obras que pasan a "cobrado", agrupadas por mes de cierre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Totales acumulados */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-xs text-muted-foreground">Obras cobradas</p>
              <p className="text-lg font-semibold">{totales.num_obras}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Facturado total</p>
              <p className="text-lg font-semibold">{formatMoney(totales.facturado)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gastos total</p>
              <p className="text-lg font-semibold">{formatMoney(totales.gastos)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Beneficio total</p>
              <p className={`text-lg font-semibold ${totales.beneficio >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {formatMoney(totales.beneficio)}
              </p>
            </div>
          </div>

          {/* Gráfico de barras (CSS puro, sin dependencias) */}
          <div className="border-t pt-6">
            <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Facturado</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Gastos</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Beneficio</span>
            </div>
            <div className="flex items-end gap-3 overflow-x-auto pb-2" style={{ minHeight: 220 }}>
              {mesesGrafica.map((m) => {
                const hFacturado = Math.max(4, (Number(m.facturado) / maxValor) * 180);
                const hGastos = Math.max(4, (Number(m.gastos) / maxValor) * 180);
                const beneficioPositivo = Number(m.beneficio) >= 0;
                const hBeneficio = Math.max(4, (Math.abs(Number(m.beneficio)) / maxValor) * 180);
                return (
                  <div key={m.mes} className="flex flex-col items-center gap-2 shrink-0" style={{ width: 64 }}>
                    <div className="flex items-end gap-1" style={{ height: 180 }}>
                      <div
                        className="w-4 rounded-t bg-blue-500 transition-all"
                        style={{ height: hFacturado }}
                        title={`Facturado: ${formatMoney(m.facturado)}`}
                      />
                      <div
                        className="w-4 rounded-t bg-red-400 transition-all"
                        style={{ height: hGastos }}
                        title={`Gastos: ${formatMoney(m.gastos)}`}
                      />
                      <div
                        className={`w-4 rounded-t transition-all ${beneficioPositivo ? 'bg-emerald-500' : 'bg-red-600'}`}
                        style={{ height: hBeneficio }}
                        title={`Beneficio: ${formatMoney(m.beneficio)}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground capitalize">{formatMonthLabel(m.mes)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla detalle por mes, expandible a obras individuales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle por mes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {[...meses].reverse().map((m) => {
              const isOpen = expandedMonth === m.mes;
              const obras = detallePorMes[m.mes] || [];
              return (
                <div key={m.mes}>
                  <button
                    type="button"
                    onClick={() => setExpandedMonth(isOpen ? null : m.mes)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-medium capitalize">{formatMonthLabel(m.mes)}</span>
                      <span className="text-xs text-muted-foreground">({m.num_obras} obra{m.num_obras === 1 ? '' : 's'})</span>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <span className="text-muted-foreground">Facturado <span className="font-semibold text-foreground">{formatMoney(m.facturado)}</span></span>
                      <span className="text-muted-foreground">Gastos <span className="font-semibold text-foreground">{formatMoney(m.gastos)}</span></span>
                      <span className={`font-semibold ${Number(m.beneficio) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {formatMoney(m.beneficio)}
                      </span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="bg-muted/30 px-4 py-2">
                      {obras.map((o) => (
                        <div key={o.proyecto_id} className="flex items-center justify-between py-2 text-sm border-b last:border-0 border-border/50">
                          <span>{o.nombre_proyecto}</span>
                          <div className="flex gap-6 text-xs">
                            <span className="text-muted-foreground">{formatMoney(o.facturado)}</span>
                            <span className="text-muted-foreground">{formatMoney(o.gastos)}</span>
                            <span className={Number(o.beneficio) >= 0 ? 'text-emerald-500' : 'text-red-500'}>{formatMoney(o.beneficio)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
