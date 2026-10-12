import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Euro, Target, TrendingDown } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COMPLETED_STATES = new Set(['completada', 'completada_validada']);
const CLOSED_PROJECT_STATES = new Set(['finalizado', 'facturado', 'cancelado']);

const asNumber = (value) => Number(value || 0);

const toLocalDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(12, 0, 0, 0);
    return date;
};

const isWorkingDay = (date) => date.getDay() !== 0 && date.getDay() !== 6;

const workingDaysBetween = (fromValue, toValue) => {
    const from = toLocalDate(fromValue);
    const to = toLocalDate(toValue);
    if (!from || !to || to <= from) return 0;
    let cursor = new Date(from);
    let total = 0;
    while (cursor < to) {
        cursor.setDate(cursor.getDate() + 1);
        if (cursor <= to && isWorkingDay(cursor)) total += 1;
    }
    return total;
};

const addWorkingDays = (dateValue, days) => {
    const result = toLocalDate(dateValue);
    if (!result) return null;
    let pending = Math.max(0, Math.ceil(days));
    while (pending > 0) {
        result.setDate(result.getDate() + 1);
        if (isWorkingDay(result)) pending -= 1;
    }
    return result;
};

const formatCurrency = (value) => new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
}).format(asNumber(value));

const formatShortDate = (value) => {
    const date = toLocalDate(value);
    return date ? new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date) : 'Sin fecha';
};

const Metric = ({ label, value, detail, tone = 'slate' }) => {
    const tones = {
        slate: 'border-slate-200 bg-slate-50/70 text-slate-950',
        violet: 'border-violet-200 bg-violet-50/70 text-violet-950',
        amber: 'border-amber-200 bg-amber-50/80 text-amber-950',
        red: 'border-red-200 bg-red-50/80 text-red-950',
        green: 'border-emerald-200 bg-emerald-50/70 text-emerald-950',
    };

    return (
        <div className={`min-w-0 rounded-lg border p-3 ${tones[tone] || tones.slate}`}>
            <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums">{value}</p>
            <p className="mt-1 text-xs opacity-70">{detail}</p>
        </div>
    );
};

const ProjectProfitabilityForecast = ({ projectId, project, kpis }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let mounted = true;

        const loadForecast = async () => {
            setLoading(true);
            setError(null);
            try {
                const [tasksRes, partsRes, projectsRes] = await Promise.all([
                    supabase
                        .from('tareas')
                        .select('id, estado, duracion_planificada_horas, inicio_planificado_at, fin_planificado_at, obra_partida_id')
                        .eq('proyecto_id', projectId),
                    supabase
                        .from('obras_partidas')
                        .select('id, sistema_id, cantidad_total')
                        .eq('obra_id', projectId)
                        .eq('activa', true),
                    supabase
                        .from('proyectos')
                        .select('id, nombre_proyecto, estado, fecha_inicio, fecha_fin_estimada, presupuesto_aceptado, objetivo_margen_pct')
                        .neq('id', projectId)
                        .order('fecha_inicio', { ascending: true }),
                ]);

                if (tasksRes.error) throw tasksRes.error;
                if (partsRes.error) throw partsRes.error;

                const tasks = tasksRes.data || [];
                const taskIds = tasks.map((task) => task.id);
                const parts = partsRes.data || [];
                const systemIds = [...new Set(parts.map((part) => part.sistema_id).filter(Boolean))];

                const [assignmentsRes, sessionsRes, systemCostsRes] = await Promise.all([
                    taskIds.length
                        ? supabase.from('tarea_empleados').select('tarea_id, empleado_id').in('tarea_id', taskIds)
                        : Promise.resolve({ data: [], error: null }),
                    supabase
                        .from('tarea_sesiones_trabajo')
                        .select('tarea_id, empleado_id, estado, ultimo_inicio_at, minutos_acumulados')
                        .eq('proyecto_id', projectId),
                    systemIds.length
                        ? supabase.from('v_sistemas_rendimiento_costes').select('id, coste_materiales, coste_otros').in('id', systemIds)
                        : Promise.resolve({ data: [], error: null }),
                ]);

                if (assignmentsRes.error) throw assignmentsRes.error;
                if (sessionsRes.error) throw sessionsRes.error;
                if (systemCostsRes.error) throw systemCostsRes.error;

                const employeeIds = [...new Set([
                    ...(assignmentsRes.data || []).map((row) => row.empleado_id),
                    ...(sessionsRes.data || []).map((row) => row.empleado_id),
                ].filter(Boolean))];

                const employeesRes = employeeIds.length
                    ? await supabase.from('empleados').select('id, costo_por_hora').in('id', employeeIds)
                    : { data: [], error: null };
                if (employeesRes.error) throw employeesRes.error;

                const employeeCost = new Map((employeesRes.data || []).map((employee) => [employee.id, asNumber(employee.costo_por_hora)]));
                const assignmentsByTask = new Map();
                (assignmentsRes.data || []).forEach((row) => {
                    if (!assignmentsByTask.has(row.tarea_id)) assignmentsByTask.set(row.tarea_id, []);
                    assignmentsByTask.get(row.tarea_id).push(row.empleado_id);
                });

                const sessionsByTask = new Map();
                const now = new Date();
                (sessionsRes.data || []).forEach((session) => {
                    let minutes = asNumber(session.minutos_acumulados);
                    if (session.estado === 'en_curso' && session.ultimo_inicio_at) {
                        minutes += Math.max(0, (now.getTime() - new Date(session.ultimo_inicio_at).getTime()) / 60000);
                    }
                    if (!sessionsByTask.has(session.tarea_id)) sessionsByTask.set(session.tarea_id, []);
                    sessionsByTask.get(session.tarea_id).push({ ...session, minutes });
                });

                let plannedLabor = 0;
                let taskLaborOverrun = 0;
                let delayedTasks = 0;
                let projectedDelayDays = 0;

                tasks.forEach((task) => {
                    const duration = asNumber(task.duracion_planificada_horas);
                    const assignees = assignmentsByTask.get(task.id) || [];
                    const plannedTaskCost = duration * assignees.reduce((sum, employeeId) => sum + (employeeCost.get(employeeId) || 0), 0);
                    plannedLabor += plannedTaskCost;

                    const sessions = sessionsByTask.get(task.id) || [];
                    const actualTaskCost = sessions.reduce((sum, session) => (
                        sum + (session.minutes / 60) * (employeeCost.get(session.empleado_id) || 0)
                    ), 0);
                    taskLaborOverrun += Math.max(0, actualTaskCost - plannedTaskCost);

                    const plannedEnd = toLocalDate(task.fin_planificado_at);
                    if (!COMPLETED_STATES.has(task.estado) && plannedEnd && plannedEnd < now) {
                        delayedTasks += 1;
                        const actualWorkerHours = sessions.reduce((sum, session) => sum + session.minutes / 60, 0);
                        const teamSize = Math.max(assignees.length, 1);
                        const remainingTeamHours = Math.max(0, duration - actualWorkerHours / teamSize);
                        const recoveryDays = Math.ceil(remainingTeamHours / 8.5);
                        const elapsedDelay = workingDaysBetween(plannedEnd, now);
                        projectedDelayDays = Math.max(projectedDelayDays, elapsedDelay + recoveryDays);
                    }
                });

                const systemCosts = new Map((systemCostsRes.data || []).map((row) => [row.id, row]));
                let plannedMaterials = 0;
                let plannedOther = 0;
                let linkedParts = 0;
                parts.forEach((part) => {
                    const unitCost = systemCosts.get(part.sistema_id);
                    if (!unitCost) return;
                    linkedParts += 1;
                    const quantity = asNumber(part.cantidad_total);
                    plannedMaterials += quantity * asNumber(unitCost.coste_materiales);
                    plannedOther += quantity * asNumber(unitCost.coste_otros);
                });

                const budget = asNumber(kpis?.presupuesto_aceptado);
                const targetMarginPct = asNumber(project?.objetivo_margen_pct ?? kpis?.objetivo_margen_pct ?? 15);
                const targetDirect = budget * (1 - targetMarginPct / 100);
                const plannedDirect = plannedLabor + plannedMaterials + plannedOther;
                const actualDirect = asNumber(kpis?.costo_total);
                const projectedDirect = Math.max(actualDirect, plannedDirect + taskLaborOverrun);
                const planningDeviation = plannedDirect - targetDirect;
                const directDeviation = projectedDirect - targetDirect;

                const plannedFinish = project?.fecha_fin_estimada || kpis?.fecha_fin_estimada || null;
                const projectedFinish = addWorkingDays(plannedFinish, projectedDelayDays);
                const candidates = (projectsRes.data || []).filter((candidate) => {
                    if (!candidate.fecha_inicio || CLOSED_PROJECT_STATES.has(candidate.estado)) return false;
                    const candidateStart = toLocalDate(candidate.fecha_inicio);
                    const currentStart = toLocalDate(project?.fecha_inicio || kpis?.fecha_inicio);
                    return candidateStart && (!currentStart || candidateStart > currentStart);
                });
                const nextProject = candidates[0] || null;

                let opportunityCost = null;
                let opportunityDays = 0;
                let nextDailyMargin = 0;
                if (nextProject && projectedFinish) {
                    const nextStart = toLocalDate(nextProject.fecha_inicio);
                    const nextFinish = toLocalDate(nextProject.fecha_fin_estimada);
                    opportunityDays = workingDaysBetween(nextStart, projectedFinish);
                    const nextDuration = Math.max(1, workingDaysBetween(nextStart, nextFinish));
                    const nextTargetMargin = asNumber(nextProject.presupuesto_aceptado)
                        * asNumber(nextProject.objetivo_margen_pct) / 100;
                    nextDailyMargin = nextTargetMargin / nextDuration;
                    opportunityCost = opportunityDays * nextDailyMargin;
                }

                const directDelayCost = taskLaborOverrun;
                const totalEconomicImpact = directDelayCost + asNumber(opportunityCost);
                const projectedMargin = budget - projectedDirect;
                const projectedProfitability = budget > 0
                    ? (projectedMargin / budget) * 100
                    : 0;
                const coverage = parts.length > 0 ? (linkedParts / parts.length) * 100 : 0;

                if (mounted) {
                    setData({
                        plannedDirect,
                        targetDirect,
                        targetMarginPct,
                        actualDirect,
                        projectedDirect,
                        planningDeviation,
                        directDeviation,
                        directDelayCost,
                        taskLaborOverrun,
                        plannedLabor,
                        plannedMaterials,
                        plannedOther,
                        coverage,
                        delayedTasks,
                        projectedDelayDays,
                        plannedFinish,
                        projectedFinish,
                        nextProject,
                        opportunityCost,
                        opportunityDays,
                        nextDailyMargin,
                        totalEconomicImpact,
                        projectedMargin,
                        projectedProfitability,
                    });
                }
            } catch (loadError) {
                console.error('Error calculando la previsión económica:', loadError);
                if (mounted) setError(loadError);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        if (projectId && kpis) loadForecast();
        return () => { mounted = false; };
    }, [projectId, project, kpis]);

    const status = useMemo(() => {
        if (!data) return null;
        if (data.projectedProfitability < 0 || data.directDeviation > Math.max(500, data.targetDirect * 0.1)) {
            return { label: 'Desviación confirmada', tone: 'red', icon: AlertTriangle };
        }
        if (data.projectedProfitability < data.targetMarginPct || data.projectedDelayDays > 0) {
            return data.totalEconomicImpact > Math.max(250, data.targetDirect * 0.05)
                ? { label: 'Desviación confirmada', tone: 'red', icon: AlertTriangle }
                : { label: 'Riesgo de desviación', tone: 'amber', icon: TrendingDown };
        }
        return { label: 'Dentro del objetivo', tone: 'green', icon: CheckCircle2 };
    }, [data]);

    if (loading) {
        return <div className="mt-4 h-56 animate-pulse rounded-xl border bg-muted/30" />;
    }
    if (error || !data) return null;

    const StatusIcon = status.icon;
    const statusClasses = {
        green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        amber: 'border-amber-200 bg-amber-50 text-amber-800',
        red: 'border-red-200 bg-red-50 text-red-800',
    };
    const deviationTone = data.directDeviation > 0 ? (status.tone === 'red' ? 'red' : 'amber') : 'green';

    return (
        <Card className="mt-4 overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/60 p-4 md:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700">Pulso económico de la obra</p>
                        <CardTitle className="mt-1 text-lg">Objetivo, proyección e impacto del planning</CardTitle>
                    </div>
                    <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClasses[status.tone]}`}>
                        <StatusIcon className="h-4 w-4" />
                        {status.label}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-5">
                <div className="grid items-stretch gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
                    <Metric
                        label="Coste objetivo"
                        value={formatCurrency(data.targetDirect)}
                        detail={`Para conservar un margen del ${data.targetMarginPct.toFixed(1)}%`}
                    />
                    <div className="hidden items-center text-slate-300 lg:flex"><ArrowRight className="h-5 w-5" /></div>
                    <Metric
                        label="Coste del planning"
                        value={formatCurrency(data.plannedDirect)}
                        detail={`${formatCurrency(data.plannedLabor)} MO · ${formatCurrency(data.plannedMaterials + data.plannedOther)} materiales/otros`}
                        tone="violet"
                    />
                    <div className="hidden items-center text-slate-300 lg:flex"><ArrowRight className="h-5 w-5" /></div>
                    <Metric
                        label="Proyección al cierre"
                        value={formatCurrency(data.projectedDirect)}
                        detail={`Real acumulado ${formatCurrency(data.actualDirect)} · desviación ${data.directDeviation >= 0 ? '+' : ''}${formatCurrency(data.directDeviation)}`}
                        tone={deviationTone}
                    />
                    <div className="hidden items-center text-slate-300 lg:flex"><ArrowRight className="h-5 w-5" /></div>
                    <Metric
                        label="Coste directo del retraso"
                        value={formatCurrency(data.directDelayCost)}
                        detail={data.directDelayCost > 0 ? 'Exceso real de horas frente al planning' : 'Sin exceso de horas registrado'}
                        tone={deviationTone}
                    />
                </div>

                <div className="grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-3">
                    <div className="flex gap-3 rounded-lg bg-slate-50 p-3">
                        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                        <div>
                            <p className="text-xs font-medium text-slate-500">Plazo proyectado</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-950">
                                {formatShortDate(data.plannedFinish)} → {formatShortDate(data.projectedFinish)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {data.projectedDelayDays > 0
                                    ? `${data.projectedDelayDays} días laborables · ${data.delayedTasks} tareas desviadas`
                                    : 'Sin retraso detectado'}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 rounded-lg bg-slate-50 p-3">
                        <Target className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                        <div>
                            <p className="text-xs font-medium text-slate-500">Coste de oportunidad</p>
                            <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-slate-950">
                                {data.opportunityCost === null ? 'No calculable' : formatCurrency(data.opportunityCost)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {data.nextProject
                                    ? `${data.opportunityDays} días sobre “${data.nextProject.nombre_proyecto}” · ${formatCurrency(data.nextDailyMargin)}/día`
                                    : 'No hay una siguiente obra con fecha programada'}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 rounded-lg bg-violet-50 p-3">
                        <Euro className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
                        <div>
                            <p className="text-xs font-medium text-violet-700">Rentabilidad proyectada</p>
                            <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-violet-950">
                                {data.projectedProfitability.toFixed(2)}%
                            </p>
                            <p className="mt-1 text-xs text-violet-700">
                                Margen {formatCurrency(data.projectedMargin)} · {data.opportunityCost === null
                                    ? 'impacto del retraso pendiente de siguiente obra'
                                    : `impacto del retraso ${formatCurrency(data.totalEconomicImpact)}`}
                            </p>
                        </div>
                    </div>
                </div>

                {(data.coverage < 100 || data.plannedMaterials + data.plannedOther === 0) && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>
                            {data.plannedMaterials + data.plannedOther === 0
                                ? 'Previsión provisional: todavía no hay costes técnicos de materiales vinculados a las partidas de esta obra. '
                                : `Previsión provisional: el ${data.coverage.toFixed(0)}% de las partidas tiene rendimiento y coste técnico vinculado. `}
                            La precisión aumentará al completar la biblioteca de sistemas y registrar las jornadas reales.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ProjectProfitabilityForecast;
