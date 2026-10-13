import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
    AlertTriangle,
    BarChart3,
    Briefcase,
    Clock3,
    Database,
    Loader2,
    RefreshCw,
    TrendingDown,
    TrendingUp,
    Users,
} from 'lucide-react';

const metricKey = (row) => `${row.sistema_id || row.partida || 'sin-sistema'}::${row.unidad || ''}`;

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value, maximumFractionDigits = 2) => new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
}).format(toNumber(value));

const VariationBadge = ({ individual, global }) => {
    const individualValue = toNumber(individual);
    const globalValue = toNumber(global);

    if (globalValue <= 0) {
        return <Badge variant="outline" className="font-normal text-slate-500">Sin media global</Badge>;
    }

    const variation = ((individualValue - globalValue) / globalValue) * 100;
    const positive = variation >= 0;
    const Icon = positive ? TrendingUp : TrendingDown;

    return (
        <Badge
            variant="outline"
            className={positive
                ? 'gap-1 border-emerald-200 bg-emerald-50 font-medium text-emerald-700'
                : 'gap-1 border-amber-200 bg-amber-50 font-medium text-amber-700'}
        >
            <Icon className="h-3 w-3" />
            {positive ? '+' : ''}{formatNumber(variation, 1)}% frente a la media
        </Badge>
    );
};

const EmptyState = () => (
    <div className="rounded-lg border border-dashed bg-slate-50/60 px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border bg-white">
            <Database className="h-5 w-5 text-violet-600" />
        </div>
        <h3 className="font-semibold text-slate-900">Todavía no hay rendimiento real</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Esta ficha empezará a completarse cuando el empleado participe en tareas con tiempo registrado,
            medición real y aprobación del encargado. Las habilidades antiguas introducidas a mano no se utilizan.
        </p>
    </div>
);

export default function EmployeeRendimientoTab({ employeeId, isAdminOrEncargado }) {
    const [individualMetrics, setIndividualMetrics] = useState([]);
    const [globalMetrics, setGlobalMetrics] = useState([]);
    const [teamMetrics, setTeamMetrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchMetrics = useCallback(async () => {
        if (!employeeId || !isAdminOrEncargado) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');

        const [individualResult, globalResult, teamResult] = await Promise.all([
            supabase.from('v_rendimiento_individual').select('*')
                .eq('empleado_id', employeeId).order('oficio').order('partida'),
            supabase.from('v_rendimiento_global').select('*').order('oficio').order('partida'),
            supabase.from('v_rendimiento_equipos').select('*')
                .like('equipo_clave', `%${employeeId}%`).order('muestras', { ascending: false }),
        ]);

        const firstError = individualResult.error || globalResult.error || teamResult.error;
        if (firstError) {
            const migrationPending = firstError.code === '42P01' || /does not exist|no existe/i.test(firstError.message || '');
            setError(migrationPending
                ? 'La base de métricas reales todavía no está instalada en este entorno.'
                : firstError.message);
            setIndividualMetrics([]);
            setGlobalMetrics([]);
            setTeamMetrics([]);
        } else {
            setIndividualMetrics(individualResult.data || []);
            setGlobalMetrics(globalResult.data || []);
            setTeamMetrics(teamResult.data || []);
        }

        setLoading(false);
    }, [employeeId, isAdminOrEncargado]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    const globalByKey = useMemo(
        () => new Map(globalMetrics.map((metric) => [metricKey(metric), metric])),
        [globalMetrics],
    );

    const teamsByKey = useMemo(() => {
        const grouped = new Map();
        teamMetrics.forEach((metric) => {
            const key = metricKey(metric);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(metric);
        });
        return grouped;
    }, [teamMetrics]);

    const trades = useMemo(() => {
        const grouped = new Map();
        individualMetrics.forEach((metric) => {
            const trade = (metric.oficio || 'Otros').trim();
            if (!grouped.has(trade)) grouped.set(trade, []);
            grouped.get(trade).push(metric);
        });
        return Array.from(grouped.entries())
            .map(([trade, metrics]) => ({ trade, metrics }))
            .sort((a, b) => a.trade.localeCompare(b.trade, 'es'));
    }, [individualMetrics]);

    const summary = useMemo(() => ({
        trades: trades.length,
        tasks: individualMetrics.length,
        samples: individualMetrics.reduce((sum, metric) => sum + toNumber(metric.muestras), 0),
        hours: individualMetrics.reduce((sum, metric) => sum + toNumber(metric.horas), 0),
        teams: new Set(teamMetrics.map((metric) => metric.equipo_clave)).size,
    }), [individualMetrics, teamMetrics, trades.length]);

    if (!isAdminOrEncargado) {
        return (
            <Card className="border-amber-200 bg-amber-50/40 shadow-none">
                <CardContent className="flex items-center gap-3 p-5 text-sm text-amber-800">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    Las métricas de rendimiento solo están disponibles para encargado y administración.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b bg-slate-50/50 pb-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <BarChart3 className="h-5 w-5 text-violet-600" />
                            Rendimiento observado
                        </CardTitle>
                        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
                            Datos calculados exclusivamente con tareas ejecutadas, medidas y aprobadas.
                            Se agrupan por oficio y partida para mejorar tiempos, equipos y futuros presupuestos.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={loading} className="shrink-0">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Actualizar
                    </Button>
                </div>

                {!loading && !error && individualMetrics.length > 0 && (
                    <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-lg border bg-white md:grid-cols-5">
                        {[
                            ['Oficios medidos', summary.trades, Briefcase],
                            ['Partidas', summary.tasks, BarChart3],
                            ['Muestras aprobadas', summary.samples, Database],
                            ['Horas observadas', `${formatNumber(summary.hours, 1)} h`, Clock3],
                            ['Equipos distintos', summary.teams, Users],
                        ].map(([label, value, Icon], index) => (
                            <div
                                key={label}
                                className={`px-4 py-3 ${index > 0 ? 'border-l' : ''} ${index === 4 ? 'col-span-2 border-t md:col-span-1 md:border-t-0' : ''}`}
                            >
                                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                </div>
                                <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</div>
                            </div>
                        ))}
                    </div>
                )}
            </CardHeader>

            <CardContent className="p-5 md:p-6">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                        Calculando métricas reales…
                    </div>
                ) : error ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                            <div>
                                <p className="font-medium text-amber-900">No se pudieron cargar las métricas</p>
                                <p className="mt-1 text-sm text-amber-700">{error}</p>
                            </div>
                        </div>
                    </div>
                ) : individualMetrics.length === 0 ? <EmptyState /> : (
                    <Accordion type="multiple" defaultValue={trades.map(({ trade }) => trade)} className="space-y-3">
                        {trades.map(({ trade, metrics }) => {
                            const tradeHours = metrics.reduce((sum, metric) => sum + toNumber(metric.horas), 0);
                            const tradeSamples = metrics.reduce((sum, metric) => sum + toNumber(metric.muestras), 0);
                            return (
                                <AccordionItem key={trade} value={trade} className="overflow-hidden rounded-lg border bg-white">
                                    <AccordionTrigger className="rounded-none px-5 py-4 hover:no-underline">
                                        <div className="flex min-w-0 flex-1 items-center justify-between gap-4 pr-3 text-left">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold uppercase tracking-wide text-slate-900">{trade}</p>
                                                <p className="mt-0.5 text-xs font-normal text-slate-500">
                                                    {metrics.length} {metrics.length === 1 ? 'partida medida' : 'partidas medidas'}
                                                </p>
                                            </div>
                                            <div className="hidden shrink-0 items-center gap-4 text-xs font-normal text-slate-500 sm:flex">
                                                <span>{tradeSamples} muestras</span>
                                                <span className="tabular-nums">{formatNumber(tradeHours, 1)} h</span>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="border-t bg-slate-50/35 px-4 pb-4 pt-4 md:px-5">
                                        <div className="space-y-3">
                                            {metrics.map((metric) => {
                                                const key = metricKey(metric);
                                                const globalMetric = globalByKey.get(key);
                                                const teams = teamsByKey.get(key) || [];
                                                return (
                                                    <div key={key} className="rounded-lg border bg-white p-4">
                                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                            <div className="min-w-0">
                                                                <p className="font-medium leading-6 text-slate-900">{metric.partida}</p>
                                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                                    <Badge variant="outline" className="font-normal">{metric.unidad}</Badge>
                                                                    <span>{formatNumber(metric.cantidad_ejecutada)} {metric.unidad} ejecutados</span>
                                                                    <span>·</span><span>{metric.muestras} muestras</span>
                                                                    <span>·</span><span>{formatNumber(metric.horas, 1)} h propias</span>
                                                                </div>
                                                            </div>
                                                            <VariationBadge individual={metric.unidades_hora} global={globalMetric?.unidades_hora_persona} />
                                                        </div>

                                                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                            <MetricBox tone="violet" label="Empleado" value={formatNumber(metric.unidades_hora, 3)} suffix={`${metric.unidad}/h propia`} />
                                                            <MetricBox label="Media global" value={globalMetric ? formatNumber(globalMetric.unidades_hora_persona, 3) : '—'} suffix={`${metric.unidad}/h persona`} />
                                                            <MetricBox label="Coste laboral medio" value={globalMetric ? `${formatNumber(globalMetric.coste_mano_obra_unidad, 2)} €` : '—'} suffix={`/${metric.unidad}`} wide />
                                                        </div>

                                                        <div className="mt-4 border-t pt-3">
                                                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                                <Users className="h-3.5 w-3.5" /> Equipos exactos observados
                                                            </div>
                                                            {teams.length === 0 ? (
                                                                <p className="mt-2 text-sm text-slate-500">Sin datos de equipo para esta partida.</p>
                                                            ) : (
                                                                <div className="mt-2 divide-y rounded-md border">
                                                                    {teams.map((team) => (
                                                                        <div key={`${team.equipo_clave}-${team.unidad}`} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                                                                            <div>
                                                                                <p className="text-sm font-medium text-slate-800">{team.equipo_nombre}</p>
                                                                                <p className="mt-0.5 text-xs text-slate-500">{team.muestras} muestras · {formatNumber(toNumber(team.minutos_equipo) / 60, 1)} h de equipo</p>
                                                                            </div>
                                                                            <div className="shrink-0 text-left sm:text-right">
                                                                                <p className="text-sm font-semibold tabular-nums text-slate-900">{formatNumber(team.unidades_hora_equipo, 3)} {team.unidad}/h</p>
                                                                                <p className="text-xs text-slate-500">{formatNumber(team.unidades_hora_persona, 3)} por hora-persona</p>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                )}
            </CardContent>
        </Card>
    );
}

function MetricBox({ label, value, suffix, tone, wide }) {
    return (
        <div className={`rounded-md border px-3 py-2.5 ${tone === 'violet' ? 'border-violet-100 bg-violet-50/50' : 'bg-slate-50'} ${wide ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
            <p className={`text-xs font-medium ${tone === 'violet' ? 'text-violet-700' : 'text-slate-600'}`}>{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {value} <span className="text-xs font-normal text-slate-500">{suffix}</span>
            </p>
        </div>
    );
}
