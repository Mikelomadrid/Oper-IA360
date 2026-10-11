import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    AlertTriangle,
    CalendarDays,
    Check,
    Clock3,
    Loader2,
    ShieldAlert,
    Sparkles,
    UserPlus,
    Users,
    X,
} from 'lucide-react';

const DAY_MS = 24 * 60 * 60 * 1000;

const dateOnly = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`) : null;
const isoDate = (date) => date.toISOString().slice(0, 10);
const formatDate = (value) => value
    ? new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(dateOnly(value))
    : 'Sin fecha';

const overlapDays = (startA, endA, startB, endB) => {
    const start = Math.max(dateOnly(startA)?.getTime() || 0, dateOnly(startB)?.getTime() || 0);
    const end = Math.min(dateOnly(endA)?.getTime() || 0, dateOnly(endB)?.getTime() || 0);
    return end >= start ? Math.floor((end - start) / DAY_MS) + 1 : 0;
};

const STATUS_META = {
    disponible: {
        label: 'Disponible',
        icon: Check,
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        dot: 'bg-emerald-500',
    },
    parcial: {
        label: 'Disponibilidad parcial',
        icon: Clock3,
        badge: 'border-amber-200 bg-amber-50 text-amber-700',
        dot: 'bg-amber-500',
    },
    no_disponible: {
        label: 'No disponible',
        icon: ShieldAlert,
        badge: 'border-red-200 bg-red-50 text-red-700',
        dot: 'bg-red-500',
    },
};

const initials = (employee) => `${employee.nombre?.[0] || ''}${employee.apellidos?.[0] || ''}`.toUpperCase();
const fullName = (employee) => `${employee.nombre || ''} ${employee.apellidos || ''}`.trim();

const ProjectTeamView = ({ projectId, canManage }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [project, setProject] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [team, setTeam] = useState([]);
    const [skills, setSkills] = useState([]);
    const [absences, setAbsences] = useState([]);
    const [conflictTasks, setConflictTasks] = useState([]);
    const [taskAssignments, setTaskAssignments] = useState([]);

    const fetchData = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const { data: projectData, error: projectError } = await supabase
                .from('proyectos')
                .select('id, nombre_proyecto, fecha_inicio, fecha_fin_estimada')
                .eq('id', projectId)
                .single();
            if (projectError) throw projectError;

            const fallbackStart = new Date();
            fallbackStart.setHours(12, 0, 0, 0);
            const fallbackEnd = new Date(fallbackStart.getTime() + 30 * DAY_MS);
            const periodStart = projectData.fecha_inicio || isoDate(fallbackStart);
            const periodEnd = projectData.fecha_fin_estimada || isoDate(fallbackEnd);

            const [employeesRes, teamRes, skillsRes] = await Promise.all([
                supabase
                    .from('empleados')
                    .select('id, nombre, apellidos, rol, foto_url, activo, baja, vacaciones')
                    .eq('activo', true)
                    .order('nombre'),
                supabase
                    .from('obra_equipo')
                    .select('id, proyecto_id, empleado_id, rol_equipo, activo, asignado_en')
                    .eq('proyecto_id', projectId)
                    .eq('activo', true),
                supabase
                    .from('empleado_habilidades')
                    .select('empleado_id, nombre, nivel, puede_ayudar'),
            ]);

            if (employeesRes.error) throw employeesRes.error;
            if (teamRes.error) throw teamRes.error;
            if (skillsRes.error) {
                console.warn('[ProjectTeamView:skills]', skillsRes.error.message);
            }

            let absencesData = [];
            let otherTasks = [];
            let assignments = [];

            if (canManage) {
                const [absencesRes, tasksRes] = await Promise.all([
                    supabase
                        .from('ausencias_empleados')
                        .select('id, empleado_id, fecha_inicio, fecha_fin, tipo, estado')
                        .eq('estado', 'aprobado')
                        .lte('fecha_inicio', periodEnd)
                        .gte('fecha_fin', periodStart),
                    supabase
                        .from('tareas')
                        .select('id, proyecto_id, empleado_asignado_id, titulo, fecha_inicio, fecha_limite, estado')
                        .neq('proyecto_id', projectId)
                        .not('estado', 'in', '(completada,completada_validada,cancelada)')
                        .lte('fecha_inicio', periodEnd)
                        .gte('fecha_limite', periodStart),
                ]);
                if (absencesRes.error) throw absencesRes.error;
                if (tasksRes.error) throw tasksRes.error;
                absencesData = absencesRes.data || [];
                otherTasks = tasksRes.data || [];

                const taskIds = otherTasks.map((task) => task.id);
                if (taskIds.length > 0) {
                    const { data, error } = await supabase
                        .from('tarea_empleados')
                        .select('tarea_id, empleado_id')
                        .in('tarea_id', taskIds);
                    if (error) throw error;
                    assignments = data || [];
                }
            }

            setProject({ ...projectData, periodStart, periodEnd });
            setEmployees(employeesRes.data || []);
            setTeam(teamRes.data || []);
            setSkills(skillsRes.error ? [] : (skillsRes.data || []));
            setAbsences(absencesData);
            setConflictTasks(otherTasks);
            setTaskAssignments(assignments);
        } catch (error) {
            console.error('[ProjectTeamView]', JSON.stringify({
                message: error?.message,
                code: error?.code,
                details: error?.details,
                hint: error?.hint,
            }));
            toast({
                variant: 'destructive',
                title: 'No se pudo cargar el equipo',
                description: error.message,
            });
        } finally {
            setLoading(false);
        }
    }, [projectId, canManage, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const teamIds = useMemo(() => new Set(team.map((member) => member.empleado_id)), [team]);

    const employeeRows = useMemo(() => employees.map((employee) => {
        const employeeAbsences = absences.filter((item) => item.empleado_id === employee.id);
        const assignedTaskIds = new Set(
            taskAssignments
                .filter((item) => item.empleado_id === employee.id)
                .map((item) => item.tarea_id),
        );
        const employeeConflicts = conflictTasks.filter((task) => (
            task.empleado_asignado_id === employee.id || assignedTaskIds.has(task.id)
        ));
        const absenceDays = employeeAbsences.reduce(
            (sum, item) => sum + overlapDays(item.fecha_inicio, item.fecha_fin, project?.periodStart, project?.periodEnd),
            0,
        );
        const conflictDays = employeeConflicts.reduce(
            (sum, item) => sum + overlapDays(item.fecha_inicio, item.fecha_limite, project?.periodStart, project?.periodEnd),
            0,
        );
        const isBlocked = employee.baja || employee.vacaciones || absenceDays > 0;
        const availability = isBlocked ? 'no_disponible' : conflictDays > 0 ? 'parcial' : 'disponible';
        const reasons = [];
        if (employee.baja) reasons.push('Empleado marcado de baja');
        if (employee.vacaciones) reasons.push('Empleado marcado de vacaciones');
        if (absenceDays > 0) reasons.push(`${absenceDays} día${absenceDays === 1 ? '' : 's'} de ausencia en el periodo`);
        if (conflictDays > 0) reasons.push(`${conflictDays} día${conflictDays === 1 ? '' : 's'} con tareas en otras obras`);

        return {
            ...employee,
            availability,
            reasons,
            employeeSkills: skills.filter((skill) => skill.empleado_id === employee.id),
            isSelected: teamIds.has(employee.id),
            teamRecord: team.find((member) => member.empleado_id === employee.id),
        };
    }), [employees, absences, conflictTasks, taskAssignments, project, skills, teamIds, team]);

    const availabilityOrder = { disponible: 0, parcial: 1, no_disponible: 2 };
    const byAvailabilityThenName = (a, b) => (
        availabilityOrder[a.availability] - availabilityOrder[b.availability]
        || fullName(a).localeCompare(fullName(b), 'es')
    );
    const selectedRows = employeeRows.filter((employee) => employee.isSelected).sort(byAvailabilityThenName);
    const candidateRows = employeeRows.filter((employee) => !employee.isSelected).sort(byAvailabilityThenName);
    const availableCount = employeeRows.filter((employee) => employee.availability === 'disponible').length;
    const partialCount = employeeRows.filter((employee) => employee.availability === 'parcial').length;

    const addEmployee = async (employee) => {
        if (!canManage) return;
        setSavingId(employee.id);
        try {
            const { error } = await supabase.from('obra_equipo').upsert({
                proyecto_id: projectId,
                empleado_id: employee.id,
                rol_equipo: employee.rol === 'encargado' ? 'responsable' : 'tecnico',
                activo: true,
            }, { onConflict: 'proyecto_id,empleado_id' });
            if (error) throw error;
            toast({ title: 'Añadido al equipo', description: `${fullName(employee)} ya forma parte de esta obra.` });
            await fetchData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'No se pudo añadir', description: error.message });
        } finally {
            setSavingId(null);
        }
    };

    const removeEmployee = async (employee) => {
        if (!canManage || !employee.teamRecord) return;
        setSavingId(employee.id);
        try {
            const { error } = await supabase
                .from('obra_equipo')
                .delete()
                .eq('id', employee.teamRecord.id);
            if (error) throw error;
            toast({ title: 'Retirado del equipo', description: `${fullName(employee)} ya no está preasignado a esta obra.` });
            await fetchData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'No se pudo retirar', description: error.message });
        } finally {
            setSavingId(null);
        }
    };

    if (loading) {
        return <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-violet-50 p-2.5 text-violet-700"><Users className="h-5 w-5" /></div>
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-slate-950">Equipo disponible para la obra</h2>
                        <p className="mt-1 text-sm text-slate-600">Desde que la obra se acepta, el encargado puede formar el equipo con cualquier empleado activo.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CalendarDays className="h-4 w-4" />
                    <span className="font-medium">{formatDate(project?.periodStart)} — {formatDate(project?.periodEnd)}</span>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <Summary label="En el equipo" value={selectedRows.length} tone="violet" />
                <Summary label="Disponibles" value={availableCount} tone="green" />
                <Summary label="Disponibilidad parcial" value={partialCount} tone="amber" />
            </div>

            <Card className="border-violet-200 bg-violet-50/40 shadow-none">
                <CardContent className="flex gap-3 p-4">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
                    <div>
                        <p className="font-medium text-slate-900">Recomendación transparente, decisión humana</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                            La disponibilidad, las ausencias y los solapes son avisos para decidir mejor, no bloqueos. Todavía no hay suficientes ejecuciones comparables para ordenar personas por rentabilidad; el encargado conserva siempre la decisión final.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <section className="space-y-3">
                <div>
                    <h3 className="font-semibold text-slate-950">Personal asignado por el encargado</h3>
                        <p className="text-sm text-slate-500">Este grupo podrá repartirse después entre las tareas, incluso mientras la obra siga pendiente de comenzar.</p>
                </div>
                {selectedRows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                        <Users className="mx-auto h-8 w-8 text-slate-400" />
                        <p className="mt-3 font-medium text-slate-700">Aún no hay personal asignado a esta obra</p>
                        <p className="mt-1 text-sm text-slate-500">Selecciona abajo a las personas disponibles.</p>
                    </div>
                ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                        {selectedRows.map((employee) => (
                            <EmployeeCard
                                key={employee.id}
                                employee={employee}
                                action="remove"
                                disabled={!canManage || savingId === employee.id}
                                onAction={() => removeEmployee(employee)}
                            />
                        ))}
                    </div>
                )}
            </section>

            {canManage && (
                <section className="space-y-3">
                    <div>
                        <h3 className="font-semibold text-slate-950">Personal de la empresa</h3>
                        <p className="text-sm text-slate-500">Se muestra todo el personal activo. Las ausencias y tareas de otras obras se señalan para que el encargado pueda valorarlas.</p>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                        {candidateRows.map((employee) => (
                            <EmployeeCard
                                key={employee.id}
                                employee={employee}
                                action="add"
                                disabled={savingId === employee.id}
                                onAction={() => addEmployee(employee)}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

const Summary = ({ label, value, tone }) => {
    const tones = {
        violet: 'border-violet-200 bg-violet-50 text-violet-800',
        green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        amber: 'border-amber-200 bg-amber-50 text-amber-800',
    };
    return (
        <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
    );
};

const EmployeeCard = ({ employee, action, disabled, onAction }) => {
    const meta = STATUS_META[employee.availability];
    const StatusIcon = meta.icon;
    const mainSkills = employee.employeeSkills.slice(0, 3);
    return (
        <article className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
                    {employee.foto_url ? <img src={employee.foto_url} alt="" className="h-full w-full object-cover" /> : initials(employee)}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="font-medium text-slate-950">{fullName(employee)}</p>
                            <p className="text-xs capitalize text-slate-500">{employee.rol}</p>
                        </div>
                        <Badge variant="outline" className={meta.badge}>
                            <StatusIcon className="mr-1 h-3.5 w-3.5" />{meta.label}
                        </Badge>
                    </div>

                    {mainSkills.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {mainSkills.map((skill) => (
                                <span key={`${employee.id}-${skill.nombre}`} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                    {skill.nombre} · {skill.nivel}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="mt-3 min-h-5 text-xs text-slate-500">
                        {employee.reasons.length > 0 ? (
                            <span className="flex items-start gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{employee.reasons.join(' · ')}</span>
                        ) : (
                            <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${meta.dot}`} />Sin ausencias ni tareas solapadas conocidas</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                {action === 'add' ? (
                    <Button size="sm" variant="outline" disabled={disabled} onClick={onAction}>
                        {disabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        {employee.availability === 'no_disponible' ? 'Añadir con aviso' : 'Añadir a la obra'}
                    </Button>
                ) : (
                    <Button size="sm" variant="ghost" className="text-slate-500 hover:bg-red-50 hover:text-red-700" disabled={disabled} onClick={onAction}>
                        {disabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                        Quitar del equipo
                    </Button>
                )}
            </div>
        </article>
    );
};

export default ProjectTeamView;

