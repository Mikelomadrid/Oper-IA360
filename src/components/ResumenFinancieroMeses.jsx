import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Euro, Loader2 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const PERIODOS = [
    { label: 'Mes actual', value: 1, tipo: 'meses' },
    { label: 'Últimos 3 meses', value: 3, tipo: 'meses' },
    { label: 'Últimos 6 meses', value: 6, tipo: 'meses' },
    { label: 'Últimos 12 meses', value: 12, tipo: 'meses' },
];

// Generar años desde 2025 hasta el año actual
const ANIO_INICIO = 2025;
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: ANIO_ACTUAL - ANIO_INICIO + 1 }, (_, i) => ({
    label: String(ANIO_INICIO + i),
    value: ANIO_INICIO + i,
    tipo: 'anio'
}));

const formatCurrency = (val) => {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
};

const ResumenFinancieroMeses = () => {
    const [seleccion, setSeleccion] = useState({ value: 3, tipo: 'meses' }); // Por defecto 3 meses
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState([]);
    const [totales, setTotales] = useState({ facturado: 0, gastos: 0, beneficio: 0 });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const hoy = new Date();

            // Generar los meses según la selección
            let meses = [];

            if (seleccion.tipo === 'anio') {
                const anioDate = new Date(seleccion.value, 0, 1);
                const inicio = startOfYear(anioDate);
                const fin = endOfYear(anioDate);
                const todosMeses = eachMonthOfInterval({ start: inicio, end: fin });
                meses = todosMeses.map(fecha => ({
                    inicio: startOfMonth(fecha).toISOString(),
                    fin: endOfMonth(fecha).toISOString(),
                    label: format(fecha, 'MMM yy', { locale: es }),
                    labelCapitalized: '',
                }));
            } else {
                for (let i = seleccion.value - 1; i >= 0; i--) {
                    const fecha = subMonths(hoy, i);
                    meses.push({
                        inicio: startOfMonth(fecha).toISOString(),
                        fin: endOfMonth(fecha).toISOString(),
                        label: format(fecha, seleccion.value > 6 ? 'MMM yy' : 'MMMM yyyy', { locale: es }),
                        labelCapitalized: '',
                    });
                }
            }

            meses.forEach(m => {
                m.labelCapitalized = m.label.charAt(0).toUpperCase() + m.label.slice(1);
            });

            // Traer obras cobradas con fecha_cierre_real y sus KPIs
            const { data: obras, error } = await supabase
                .from('v_proyecto_kpis_con_estado')
                .select('proyecto_id, presupuesto_aceptado, coste_total_materiales, fecha_cierre_real')
                .eq('estado', 'cobrado')
                .not('fecha_cierre_real', 'is', null);

            if (error) throw error;

            // Traer mano de obra
            const proyectoIds = (obras || []).map(o => o.proyecto_id).filter(Boolean);
            let laborMap = {};
            if (proyectoIds.length > 0) {
                const { data: laborData } = await supabase
                    .from('ui_v_proyecto_mano_obra_totales_v2')
                    .select('proyecto_id, coste_total_mano_obra')
                    .in('proyecto_id', proyectoIds);
                if (laborData) {
                    laborData.forEach(l => { laborMap[l.proyecto_id] = parseFloat(l.coste_total_mano_obra || 0); });
                }
            }

            // Agrupar por mes
            const dataByMes = {};
            meses.forEach(m => {
                dataByMes[m.labelCapitalized] = { facturado: 0, gastos: 0 };
            });

            (obras || []).forEach(obra => {
                if (!obra.fecha_cierre_real) return;
                const fechaCierre = parseISO(obra.fecha_cierre_real);
                const mesLabel = (() => {
                    for (const m of meses) {
                        if (fechaCierre >= new Date(m.inicio) && fechaCierre <= new Date(m.fin)) {
                            return m.labelCapitalized;
                        }
                    }
                    return null;
                })();
                if (!mesLabel) return;

                const materiales = parseFloat(obra.coste_total_materiales || 0);
                const manoObra = laborMap[obra.proyecto_id] || 0;
                const facturado = parseFloat(obra.presupuesto_aceptado || 0);
                const gastos = materiales + manoObra;

                dataByMes[mesLabel].facturado += facturado;
                dataByMes[mesLabel].gastos += gastos;
            });

            // Construir datos para la gráfica
            let beneficioAcumulado = 0;
            const chart = meses.map(m => {
                const d = dataByMes[m.labelCapitalized];
                const beneficioMes = d.facturado - d.gastos;
                beneficioAcumulado += beneficioMes;
                return {
                    name: m.labelCapitalized,
                    Facturado: Math.round(d.facturado),
                    Gastos: Math.round(d.gastos),
                    Beneficio: Math.round(beneficioMes),
                    BeneficioAcum: Math.round(beneficioAcumulado),
                };
            });

            setChartData(chart);

            const totalFac = chart.reduce((s, d) => s + d.Facturado, 0);
            const totalGas = chart.reduce((s, d) => s + d.Gastos, 0);
            setTotales({ facturado: totalFac, gastos: totalGas, beneficio: totalFac - totalGas });

        } catch (err) {
            console.error('Error ResumenFinancieroMeses:', err);
        } finally {
            setLoading(false);
        }
    }, [seleccion]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const margenPct = totales.facturado > 0 ? ((totales.beneficio / totales.facturado) * 100).toFixed(1) : 0;
    const esBeneficio = totales.beneficio >= 0;

    return (
        <Card className="shadow-sm border-t-4 border-t-emerald-500">
            <CardHeader className="p-4 md:p-6">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                                <Euro className="w-5 h-5 text-emerald-600" />
                                Resumen financiero — Obras cobradas
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                                Facturación, gastos y beneficio por mes de cierre real
                            </p>
                        </div>
                    </div>

                    {/* Selectores — Períodos relativos */}
                    <div className="flex flex-wrap gap-2">
                        <div className="flex gap-1 bg-muted p-1 rounded-lg">
                            {PERIODOS.map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => setSeleccion({ value: p.value, tipo: 'meses' })}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                                        seleccion.tipo === 'meses' && seleccion.value === p.value
                                            ? "bg-white text-emerald-700 shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {/* Selectores — Años naturales */}
                        <div className="flex gap-1 bg-muted p-1 rounded-lg">
                            {ANIOS.map(a => (
                                <button
                                    key={a.value}
                                    onClick={() => setSeleccion({ value: a.value, tipo: 'anio' })}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                                        seleccion.tipo === 'anio' && seleccion.value === a.value
                                            ? "bg-white text-blue-700 shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* KPIs del período */}
                {!loading && (
                    <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                            <p className="text-xs text-muted-foreground">Facturado</p>
                            <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{formatCurrency(totales.facturado)}</p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                            <p className="text-xs text-muted-foreground">Gastos</p>
                            <p className="text-lg font-bold text-orange-700 dark:text-orange-400">{formatCurrency(totales.gastos)}</p>
                        </div>
                        <div className={cn(
                            "rounded-lg p-3 text-center",
                            esBeneficio ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-red-50 dark:bg-red-900/20"
                        )}>
                            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                {esBeneficio ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                Beneficio ({margenPct}%)
                            </p>
                            <p className={cn(
                                "text-lg font-bold",
                                esBeneficio ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                            )}>
                                {formatCurrency(totales.beneficio)}
                            </p>
                        </div>
                    </div>
                )}
            </CardHeader>

            <CardContent className="p-2 md:p-6 pt-0">
                {loading ? (
                    <div className="flex items-center justify-center h-[300px]">
                        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
                    </div>
                ) : chartData.length === 0 || chartData.every(d => d.Facturado === 0) ? (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
                        <Euro className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm font-medium">Sin obras cobradas en este período</p>
                        <p className="text-xs mt-1">Marca obras como "Cobrado" para verlas aquí</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={320}>
                        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/30" />
                            <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                            <Tooltip
                                formatter={(value, name) => [formatCurrency(value), name]}
                                contentStyle={{
                                    backgroundColor: 'rgba(255,255,255,0.97)',
                                    borderRadius: '10px',
                                    border: 'none',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                    fontSize: '12px'
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar dataKey="Facturado" name="Facturado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Gastos" name="Gastos" fill="#f97316" radius={[4, 4, 0, 0]} />
                            <Line
                                type="monotone"
                                dataKey="BeneficioAcum"
                                name="Beneficio acum."
                                stroke="#10b981"
                                strokeWidth={2.5}
                                dot={{ r: 4, fill: '#10b981' }}
                                activeDot={{ r: 6 }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
};

export default ResumenFinancieroMeses;
