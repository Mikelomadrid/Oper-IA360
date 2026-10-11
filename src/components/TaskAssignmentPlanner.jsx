import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CalendarClock, Check, CheckSquare2, Clock3, GitMerge, Layers3, Loader2, MapPin, UserPlus, Users, X } from 'lucide-react';
import { buildTeamHourlySchedule, countWorkingHoursInclusive, formatScheduleTime } from '@/lib/workSchedule';

const LEVEL_WEIGHT = { alto: 3, medio: 2, bajo: 1 };
const STOP_WORDS = new Set([
    'de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'con', 'para', 'por', 'un', 'una',
    'obra', 'trabajo', 'trabajos', 'ejecucion', 'instalacion', 'montaje', 'suministro',
    'cocina', 'incluyendo', 'preparacion', 'retirada', 'pruebas', 'punto', 'puntos',
    'nuevo', 'nueva', 'nuevos', 'nuevas', 'actual', 'final', 'material', 'completo', 'completa',
]);

const SKILL_DOMAINS = [
    ['electricidad', ['electric', 'cuadro', 'enchufe', 'interruptor', 'cable', 'lumin', 'vitro', 'horno']],
    ['fontaneria', ['fontaner', 'tuberia', 'agua', 'desague', 'sanitario', 'grifo', 'lavabo']],
    ['pintura', ['pintur', 'pintado', 'esmalte', 'imprimacion']],
    ['pladur', ['pladur', 'placa', 'perfileria', 'encintado', 'falso techo']],
    ['albanileria', ['albanil', 'ladrillo', 'tabique', 'demolicion', 'roza', 'yeso', 'cemento']],
    ['solado alicatado', ['solado', 'alicatado', 'azulejo', 'baldosa', 'ceramica', 'rodapie']],
    ['carpinteria', ['carpinter', 'puerta', 'tarima', 'madera', 'dm']],
    ['climatizacion', ['climat', 'aire acondicionado', 'conducto', 'ventilacion']],
];

const normalize = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokens = (value) => normalize(value)
    .split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

const includesAny = (text, words) => words.some((word) => text.includes(normalize(word)));

const datesOverlap = (startA, endA, startB, endB) => {
    if (!startA || !endA || !startB || !endB) return false;
    return String(startA).slice(0, 10) <= String(endB).slice(0, 10)
        && String(endA).slice(0, 10) >= String(startB).slice(0, 10);
};

const fullName = (employee) => `${employee.nombre || ''} ${employee.apellidos || ''}`.trim();

const taskZone = (task) => {
    if (task.zona) return task.zona;
    const match = String(task.descripcion || '').match(/(?:^|\n)Zona:\s*([^\n]+)/i);
    return match?.[1]?.trim() || 'Zona por definir';
};

const taskChapter = (task) => {
    if (task.capitulo) return task.capitulo;
    const match = String(task.descripcion || '').match(/(?:^|\n)Capítulo:\s*([^\n]+)/i);
    return match?.[1]?.trim() || 'Sin capítulo';
};

const taskTrade = (task) => {
    const text = normalize(`${task.titulo || ''} ${task.descripcion || ''}`);
    const match = SKILL_DOMAINS.find(([, aliases]) => includesAny(text, aliases));
    return match?.[0] || 'otros';
};

const titleCase = (value) => String(value || '').replace(/\b\w/g, (letter) => letter.toUpperCase());

const employeeAvailabilityForTask = (employee, schedule, absences, conflicts) => {
    if (employee.baja) return { status: 'unavailable', label: 'Baja', detail: 'Empleado marcado de baja' };
    if (employee.vacaciones) return { status: 'unavailable', label: 'Vacaciones', detail: 'Empleado marcado de vacaciones' };

    const start = schedule?.fecha_inicio;
    const end = schedule?.fecha_limite || start;
    const absence = absences.find((item) => (
        item.empleado_id === employee.id
        && datesOverlap(start, end, item.fecha_inicio, item.fecha_fin)
    ));
    if (absence) return { status: 'unavailable', label: 'Ausencia', detail: 'Tiene una ausencia aprobada durante esta tarea' };

    const conflict = conflicts.find((item) => (
        item.empleado_id === employee.id
        && datesOverlap(start, end, item.fecha_inicio, item.fecha_limite)
    ));
    if (conflict) return { status: 'warning', label: 'Posible solape', detail: `Coincide con ${conflict.titulo || 'otra tarea'}` };

    return { status: 'available', label: 'Disponible', detail: 'Sin ausencias ni tareas solapadas conocidas' };
};

const scoreEmployee = (task, employee, employeeSkills, proposedLoad, absences) => {
    if (employee.baja || employee.vacaciones) return { score: -1000, reasons: ['No disponible'] };
    const hasAbsence = absences.some((absence) => (
        absence.empleado_id === employee.id
        && datesOverlap(task.fecha_inicio, task.fecha_limite, absence.fecha_inicio, absence.fecha_fin)
    ));
    if (hasAbsence) return { score: -1000, reasons: ['Ausencia durante la tarea'] };

    const taskText = normalize(task.titulo);
    const taskTokens = new Set(tokens(task.titulo));
    let score = 0;
    const matches = [];

    employeeSkills.forEach((skill) => {
        const skillText = normalize(`${skill.nombre || ''} ${skill.descripcion || ''}`);
        const overlap = tokens(skillText).filter((token) => taskTokens.has(token)).length;
        let skillScore = Math.min(overlap, 2) * 3;

        SKILL_DOMAINS.forEach(([domain, aliases]) => {
            if (includesAny(taskText, aliases) && (skillText.includes(domain) || includesAny(skillText, aliases))) {
                skillScore += 24;
            }
        });

        if (skillScore > 0) {
            skillScore += LEVEL_WEIGHT[normalize(skill.nivel)] || 0;
            score += skillScore;
            matches.push(skill.nombre);
        }
    });

    // La carga solo deshace empates entre personas capacitadas. Nunca debe
    // desplazar a un especialista en favor de alguien sin la habilidad.
    score -= (proposedLoad[employee.id] || 0) * 0.25;
    if (employee.rol === 'encargado') score -= 0.5;

    return {
        score,
        reasons: matches.length > 0
            ? [`Coincide con ${matches.slice(0, 2).join(' y ')}`]
            : ['Reparto equilibrado dentro del equipo'],
    };
};

const TaskAssignmentPlanner = ({ isOpen, onClose, projectId, tasks, holidays = [], onApplied }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [team, setTeam] = useState([]);
    const [skills, setSkills] = useState([]);
    const [absences, setAbsences] = useState([]);
    const [conflicts, setConflicts] = useState([]);
    const [selections, setSelections] = useState({});
    const [reasons, setReasons] = useState({});
    const [durations, setDurations] = useState({});
    const [saveError, setSaveError] = useState('');
    const [projectStartDate, setProjectStartDate] = useState(null);
    const [selectedTaskIds, setSelectedTaskIds] = useState([]);
    const [zoneFilter, setZoneFilter] = useState('all');
    const [tradeFilter, setTradeFilter] = useState('all');
    const [chapterFilter, setChapterFilter] = useState('all');
    const [bulkEmployeeId, setBulkEmployeeId] = useState('');
    const [bulkHours, setBulkHours] = useState('');

    const holidaySet = useMemo(() => new Set(holidays), [holidays]);

    useEffect(() => {
        if (!isOpen || !projectId) return;

        const loadPlanner = async () => {
            setLoading(true);
            setSaveError('');
            setSelectedTaskIds([]);
            setZoneFilter('all');
            setTradeFilter('all');
            setChapterFilter('all');
            setBulkEmployeeId('');
            setBulkHours('');
            try {
                const { data: projectRow, error: projectError } = await supabase
                    .from('proyectos')
                    .select('fecha_inicio')
                    .eq('id', projectId)
                    .single();
                if (projectError) throw projectError;
                setProjectStartDate(projectRow?.fecha_inicio ? String(projectRow.fecha_inicio).slice(0, 10) : null);

                const { data: teamRows, error: teamError } = await supabase
                    .from('obra_equipo')
                    .select('empleado_id')
                    .eq('proyecto_id', projectId)
                    .eq('activo', true);
                if (teamError) throw teamError;

                const employeeIds = (teamRows || []).map((row) => row.empleado_id);
                if (employeeIds.length === 0) {
                    setTeam([]);
                    setSkills([]);
                    setAbsences([]);
                    setConflicts([]);
                    setSelections({});
                    setReasons({});
                    return;
                }

                const [employeesRes, skillsRes, absencesRes, otherTasksRes] = await Promise.all([
                    supabase
                        .from('empleados')
                        .select('id, nombre, apellidos, rol, foto_url, baja, vacaciones')
                        .in('id', employeeIds),
                    supabase
                        .from('empleado_habilidades')
                        .select('empleado_id, nombre, descripcion, nivel, puede_ayudar')
                        .in('empleado_id', employeeIds),
                    supabase
                        .from('ausencias_empleados')
                        .select('empleado_id, fecha_inicio, fecha_fin, estado')
                        .in('empleado_id', employeeIds)
                        .eq('estado', 'aprobado'),
                    supabase
                        .from('tareas')
                        .select('id, proyecto_id, empleado_asignado_id, titulo, fecha_inicio, fecha_limite, estado')
                        .neq('proyecto_id', projectId)
                        .not('estado', 'in', '(completada,completada_validada,cancelada)')
                        .not('fecha_inicio', 'is', null)
                        .not('fecha_limite', 'is', null)
                        .limit(1000),
                ]);
                if (employeesRes.error) throw employeesRes.error;
                if (skillsRes.error) throw skillsRes.error;
                if (absencesRes.error) throw absencesRes.error;
                if (otherTasksRes.error) throw otherTasksRes.error;

                const employees = (employeesRes.data || []).sort((a, b) => fullName(a).localeCompare(fullName(b), 'es'));
                const skillRows = skillsRes.data || [];
                const absenceRows = absencesRes.data || [];
                const otherTasks = otherTasksRes.data || [];
                const otherTaskIds = otherTasks.map((task) => task.id);
                let taskEmployeeRows = [];
                if (otherTaskIds.length > 0) {
                    const { data, error } = await supabase
                        .from('tarea_empleados')
                        .select('tarea_id, empleado_id')
                        .in('tarea_id', otherTaskIds);
                    if (error) throw error;
                    taskEmployeeRows = data || [];
                }
                const conflictRows = otherTasks.flatMap((task) => {
                    const assignedIds = new Set([
                        task.empleado_asignado_id,
                        ...taskEmployeeRows.filter((row) => row.tarea_id === task.id).map((row) => row.empleado_id),
                    ].filter(Boolean));
                    return [...assignedIds].map((employeeId) => ({
                        empleado_id: employeeId,
                        titulo: task.titulo,
                        fecha_inicio: task.fecha_inicio,
                        fecha_limite: task.fecha_limite,
                    }));
                });
                const proposedLoad = {};
                const nextSelections = {};
                const nextReasons = {};
                const nextDurations = {};

                tasks.forEach((task) => {
                    nextDurations[task.id] = Number(task.duracion_planificada_horas)
                        || countWorkingHoursInclusive(task.fecha_inicio, task.fecha_limite, holidaySet);
                    const currentIds = (task.tecnicos || []).map((employee) => employee.id).filter(Boolean);
                    if (currentIds.length > 0) {
                        nextSelections[task.id] = currentIds;
                        nextReasons[task.id] = 'Asignación actual conservada';
                        currentIds.forEach((id) => { proposedLoad[id] = (proposedLoad[id] || 0) + 1; });
                        return;
                    }

                    const ranked = employees
                        .map((employee) => ({
                            employee,
                            ...scoreEmployee(
                                task,
                                employee,
                                skillRows.filter((skill) => skill.empleado_id === employee.id),
                                proposedLoad,
                                absenceRows,
                            ),
                        }))
                        .filter((candidate) => candidate.score > -1000)
                        .sort((a, b) => b.score - a.score || fullName(a.employee).localeCompare(fullName(b.employee), 'es'));

                    const bestMatches = ranked.filter((candidate) => candidate.score > 0).slice(0, 2);
                    nextSelections[task.id] = [];
                    nextReasons[task.id] = bestMatches.length > 0
                        ? `Mejor coincidencia por habilidades: ${bestMatches.map(({ employee }) => fullName(employee)).join(' · ')}`
                        : 'Sin coincidencia técnica suficiente; decisión manual del encargado';
                });

                setTeam(employees);
                setSkills(skillRows);
                setAbsences(absenceRows);
                setConflicts(conflictRows);
                setSelections(nextSelections);
                setReasons(nextReasons);
                setDurations(nextDurations);
            } catch (error) {
                toast({ variant: 'destructive', title: 'No se pudo preparar la propuesta', description: error.message });
            } finally {
                setLoading(false);
            }
        };

        loadPlanner();
    }, [isOpen, projectId, tasks, toast, holidaySet]);

    const plannedSchedule = useMemo(() => buildTeamHourlySchedule(
        tasks,
        durations,
        selections,
        holidaySet,
        projectStartDate,
    ), [tasks, durations, selections, holidaySet, projectStartDate]);

    const parallelTaskCount = useMemo(() => Object.values(plannedSchedule)
        .filter((item) => item.en_paralelo).length, [plannedSchedule]);

    const shortTaskCount = useMemo(() => Object.values(plannedSchedule)
        .filter((item) => item.duracion_planificada_horas < 6).length, [plannedSchedule]);

    const unassignedCount = useMemo(
        () => tasks.filter((task) => (selections[task.id] || []).length === 0).length,
        [tasks, selections],
    );

    const zones = useMemo(() => [...new Set(tasks.map(taskZone))].sort((a, b) => a.localeCompare(b, 'es')), [tasks]);
    const trades = useMemo(() => [...new Set(tasks.map(taskTrade))].sort((a, b) => a.localeCompare(b, 'es')), [tasks]);
    const chapters = useMemo(() => [...new Set(tasks.map(taskChapter))].sort((a, b) => a.localeCompare(b, 'es')), [tasks]);

    const filteredTasks = useMemo(() => tasks.filter((task) => (
        (zoneFilter === 'all' || taskZone(task) === zoneFilter)
        && (tradeFilter === 'all' || taskTrade(task) === tradeFilter)
        && (chapterFilter === 'all' || taskChapter(task) === chapterFilter)
    )), [tasks, zoneFilter, tradeFilter, chapterFilter]);

    const visibleTaskIds = useMemo(() => filteredTasks.map((task) => task.id), [filteredTasks]);
    const allVisibleSelected = visibleTaskIds.length > 0 && visibleTaskIds.every((id) => selectedTaskIds.includes(id));

    const toggleTaskSelection = (taskId, checked) => {
        setSelectedTaskIds((current) => checked
            ? [...new Set([...current, taskId])]
            : current.filter((id) => id !== taskId));
    };

    const toggleAllVisible = (checked) => {
        setSelectedTaskIds((current) => checked
            ? [...new Set([...current, ...visibleTaskIds])]
            : current.filter((id) => !visibleTaskIds.includes(id)));
    };

    const applyEmployeeToSelection = () => {
        if (!bulkEmployeeId || selectedTaskIds.length === 0) return;
        setSelections((current) => {
            const next = { ...current };
            selectedTaskIds.forEach((taskId) => {
                next[taskId] = [...new Set([...(next[taskId] || []), bulkEmployeeId])];
            });
            return next;
        });
    };

    const applyHoursToSelection = () => {
        const hours = Math.max(0.5, Math.round((Number(bulkHours) || 0) * 2) / 2);
        if (!bulkHours || selectedTaskIds.length === 0 || hours <= 0) return;
        setDurations((current) => {
            const next = { ...current };
            selectedTaskIds.forEach((taskId) => { next[taskId] = hours; });
            return next;
        });
    };

    const addEmployee = (taskId, employeeId) => {
        setSelections((current) => ({
            ...current,
            [taskId]: [...new Set([...(current[taskId] || []), employeeId])],
        }));
    };

    const removeEmployee = (taskId, employeeId) => {
        setSelections((current) => ({
            ...current,
            [taskId]: (current[taskId] || []).filter((id) => id !== employeeId),
        }));
    };

    const applyAssignments = async () => {
        setSaving(true);
        setSaveError('');
        try {
            const plan = tasks.map((task) => {
                const employeeIds = selections[task.id] || [];
                const planned = plannedSchedule[task.id];
                return {
                    tarea_id: task.id,
                    empleado_principal_id: employeeIds[0] || null,
                    empleado_ids: employeeIds,
                    fecha_inicio: planned?.fecha_inicio || task.fecha_inicio,
                    fecha_limite: planned?.fecha_limite || task.fecha_limite,
                    duracion_planificada_horas: planned?.duracion_planificada_horas || null,
                    inicio_planificado_at: planned?.inicio_planificado_at || null,
                    fin_planificado_at: planned?.fin_planificado_at || null,
                };
            });

            const { data: savedCount, error } = await supabase.rpc('guardar_planificacion_tareas', {
                p_proyecto_id: projectId,
                p_plan: plan,
            });
            if (error) throw error;
            if (Number(savedCount) !== tasks.length) {
                throw new Error(`Se esperaban ${tasks.length} tareas y se guardaron ${savedCount || 0}.`);
            }

            toast({
                title: 'Planificación guardada',
                description: `${tasks.length} tarea${tasks.length === 1 ? '' : 's'} ordenada${tasks.length === 1 ? '' : 's'} por ejecución; ${parallelTaskCount} pueden compartir fecha con otro equipo.`,
            });
            onApplied();
        } catch (error) {
            setSaveError(error.message || 'No se pudo completar el guardado.');
            toast({ variant: 'destructive', title: 'No se pudieron guardar las asignaciones', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden sm:max-w-4xl">
                <DialogHeader>
                    <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-violet-50 p-2.5 text-violet-700">
                            <CalendarClock className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle>Planificación manual de equipo y tiempos</DialogTitle>
                            <DialogDescription className="mt-1">
                                Define horas previstas de ocupación. Horario: L-J 08:30–14:00 y 15:00–18:00; V 08:30–14:30.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                    {loading ? (
                        <div className="flex min-h-72 items-center justify-center">
                            <Loader2 className="h-7 w-7 animate-spin text-violet-600" />
                        </div>
                    ) : team.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
                            <Users className="mx-auto h-8 w-8 text-amber-600" />
                            <p className="mt-3 font-semibold text-amber-900">Primero hay que formar el equipo de obra</p>
                            <p className="mt-1 text-sm text-amber-700">Añade empleados desde Dashboard → Equipo de obra y vuelve al cronograma.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 py-2">
                            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                <Check className="h-4 w-4 text-emerald-600" />
                                <span>{team.length} personas preseleccionadas para la obra</span>
                                <span className="text-slate-300">·</span>
                                <span>{skills.length} habilidades registradas</span>
                                <span className="text-slate-300">·</span>
                                <span>{absences.length} ausencias aprobadas comprobadas</span>
                                <span className="text-slate-300">·</span>
                                <span className="font-medium text-violet-700">{parallelTaskCount} tareas en jornadas compartidas</span>
                                <span className="text-slate-300">·</span>
                                <span>{shortTaskCount} tareas de menos de 6 horas</span>
                                {unassignedCount > 0 && (
                                    <>
                                        <span className="text-slate-300">·</span>
                                        <span className="font-medium text-amber-700">{unassignedCount} tareas aún sin equipo</span>
                                    </>
                                )}
                            </div>

                            <div className="sticky top-0 z-10 space-y-3 rounded-xl border border-violet-200 bg-white/95 p-3 shadow-sm backdrop-blur">
                                <div className="flex flex-wrap items-end gap-3 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2.5">
                                    <div>
                                        <label htmlFor="planning-start-date" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                                            Inicio del cronograma
                                        </label>
                                        <input
                                            id="planning-start-date"
                                            type="date"
                                            value={projectStartDate || ''}
                                            onChange={(event) => setProjectStartDate(event.target.value || null)}
                                            onInput={(event) => setProjectStartDate(event.currentTarget.value || null)}
                                            className="h-9 rounded-md border border-violet-200 bg-white px-3 font-mono text-sm tabular-nums text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                        />
                                    </div>
                                    <p className="max-w-lg pb-1 text-xs leading-5 text-slate-600">
                                        Al cambiarla, todas las partidas se recolocan desde esta fecha respetando el orden, las horas y los equipos asignados.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-2 pr-2 text-sm font-medium text-slate-800">
                                        <Layers3 className="h-4 w-4 text-violet-700" /> Filtrar partidas
                                    </div>
                                    <Select value={tradeFilter} onValueChange={setTradeFilter}>
                                        <SelectTrigger className="h-9 w-[170px] bg-slate-50 text-xs"><SelectValue placeholder="Oficio" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos los oficios</SelectItem>
                                            {trades.map((trade) => <SelectItem key={trade} value={trade}>{titleCase(trade)}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select value={zoneFilter} onValueChange={setZoneFilter}>
                                        <SelectTrigger className="h-9 w-[170px] bg-slate-50 text-xs"><SelectValue placeholder="Estancia" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas las estancias</SelectItem>
                                            {zones.map((zone) => <SelectItem key={zone} value={zone}>{zone}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select value={chapterFilter} onValueChange={setChapterFilter}>
                                        <SelectTrigger className="h-9 w-[190px] bg-slate-50 text-xs"><SelectValue placeholder="Capítulo" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos los capítulos</SelectItem>
                                            {chapters.map((chapter) => <SelectItem key={chapter} value={chapter}>{chapter}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    {(tradeFilter !== 'all' || zoneFilter !== 'all' || chapterFilter !== 'all') && (
                                        <Button type="button" variant="ghost" size="sm" onClick={() => { setTradeFilter('all'); setZoneFilter('all'); setChapterFilter('all'); }}>
                                            <X className="mr-1 h-3.5 w-3.5" /> Limpiar
                                        </Button>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                                        <Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => toggleAllVisible(Boolean(checked))} />
                                        Seleccionar visibles ({filteredTasks.length})
                                    </label>
                                    <Badge className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50">
                                        <CheckSquare2 className="mr-1 h-3.5 w-3.5" /> {selectedTaskIds.length} seleccionadas
                                    </Badge>

                                    <div className="ml-auto flex flex-wrap items-center gap-2">
                                        <Select value={bulkEmployeeId} onValueChange={setBulkEmployeeId}>
                                            <SelectTrigger className="h-9 w-[190px] bg-slate-50 text-xs"><SelectValue placeholder="Empleado o equipo" /></SelectTrigger>
                                            <SelectContent>
                                                {team.map((employee) => <SelectItem key={employee.id} value={employee.id}>{fullName(employee)}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Button type="button" size="sm" variant="outline" disabled={!bulkEmployeeId || selectedTaskIds.length === 0} onClick={applyEmployeeToSelection}>
                                            <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Añadir a seleccionadas
                                        </Button>
                                        <input
                                            type="number"
                                            min="0.5"
                                            max="500"
                                            step="0.5"
                                            value={bulkHours}
                                            onChange={(event) => setBulkHours(event.target.value)}
                                            placeholder="Horas"
                                            aria-label="Horas para las tareas seleccionadas"
                                            className="h-9 w-20 rounded-md border border-slate-200 bg-slate-50 px-2 font-mono text-xs tabular-nums outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                        />
                                        <Button type="button" size="sm" variant="outline" disabled={!bulkHours || selectedTaskIds.length === 0} onClick={applyHoursToSelection}>
                                            <Clock3 className="mr-1.5 h-3.5 w-3.5" /> Aplicar horas
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {filteredTasks.length === 0 && (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                                    No hay partidas que coincidan con estos filtros.
                                </div>
                            )}

                            {filteredTasks.map((task) => {
                                const index = tasks.findIndex((item) => item.id === task.id);
                                const selectedIds = selections[task.id] || [];
                                const available = team.filter((employee) => !selectedIds.includes(employee.id));
                                const plannedStartDate = plannedSchedule[task.id]?.fecha_inicio;
                                const plannedStartDay = plannedStartDate
                                    ? new Date(`${plannedStartDate}T12:00:00`).getDay()
                                    : null;
                                const fullDayHours = plannedStartDay === 5 ? 6 : 8.5;
                                const availabilityByEmployee = Object.fromEntries(team.map((employee) => [
                                    employee.id,
                                    employeeAvailabilityForTask(employee, plannedSchedule[task.id], absences, conflicts),
                                ]));
                                return (
                                    <div key={task.id} className={`rounded-xl border bg-white p-4 transition-colors ${selectedTaskIds.includes(task.id) ? 'border-violet-300 ring-2 ring-violet-100' : 'border-slate-200'}`}>
                                        <div className="flex items-start gap-3">
                                            <Checkbox
                                                className="mt-1"
                                                checked={selectedTaskIds.includes(task.id)}
                                                onCheckedChange={(checked) => toggleTaskSelection(task.id, Boolean(checked))}
                                                aria-label={`Seleccionar partida ${index + 1}`}
                                            />
                                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 font-mono text-xs font-semibold text-slate-600">
                                                {index + 1}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-medium leading-6 text-slate-900">{task.titulo}</p>
                                                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                                            <MapPin className="h-3.5 w-3.5" /> {taskZone(task)}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                                    {plannedSchedule[task.id]?.en_paralelo && (
                                                        <Badge className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50">
                                                            <GitMerge className="mr-1 h-3 w-3" /> Misma jornada
                                                        </Badge>
                                                    )}
                                                    {plannedSchedule[task.id]?.duracion_planificada_horas < 6 && (
                                                        <Badge className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50">
                                                            <Clock3 className="mr-1 h-3 w-3" /> Franja horaria
                                                        </Badge>
                                                    )}
                                                    {selectedIds.length === 0 ? (
                                                        <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                                                            <AlertTriangle className="mr-1 h-3 w-3" /> Sin asignar
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                                                            {selectedIds.length} asignado{selectedIds.length === 1 ? '' : 's'}
                                                        </Badge>
                                                    )}
                                                    </div>
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500">{reasons[task.id]}</p>

                                                <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                                                    <div>
                                                        <label htmlFor={`duration-${task.id}`} className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                                            Horas previstas
                                                        </label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                id={`duration-${task.id}`}
                                                                type="number"
                                                                min="0.5"
                                                                max="500"
                                                                step="0.5"
                                                                value={durations[task.id] || 0.5}
                                                                onChange={(event) => setDurations((current) => ({
                                                                    ...current,
                                                                    [task.id]: Math.max(0.5, Math.round((Number(event.target.value) || 0.5) * 2) / 2),
                                                                }))}
                                                                className="h-8 w-20 rounded-md border border-slate-200 bg-white px-2 font-mono text-sm tabular-nums text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                                            />
                                                            <span className="text-xs text-slate-600">horas</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setDurations((current) => ({ ...current, [task.id]: 4 }))}
                                                                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-violet-300 hover:text-violet-700"
                                                            >Media jornada</button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setDurations((current) => ({ ...current, [task.id]: fullDayHours }))}
                                                                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-violet-300 hover:text-violet-700"
                                                            >Jornada ({String(fullDayHours).replace('.', ',')} h)</button>
                                                        </div>
                                                    </div>
                                                    <div className="flex min-w-[230px] flex-1 items-center gap-2 text-xs text-slate-600">
                                                        <CalendarClock className="h-4 w-4 text-violet-600" />
                                                        <span className="font-mono tabular-nums">
                                                            {plannedSchedule[task.id]?.fecha_inicio || '—'} {formatScheduleTime(plannedSchedule[task.id]?.inicio_planificado_at)}
                                                            {' → '}
                                                            {plannedSchedule[task.id]?.fecha_limite || '—'} {formatScheduleTime(plannedSchedule[task.id]?.fin_planificado_at)}
                                                        </span>
                                                        {plannedSchedule[task.id]?.en_paralelo && (
                                                            <span className="text-violet-700">otro equipo trabaja en paralelo</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                                                    <div className="mb-2">
                                                        <p className="text-xs font-semibold text-slate-700">Equipo específico de esta partida</p>
                                                        <p className="text-[11px] text-slate-500">Quita o añade personas aquí sin modificar el resto de partidas.</p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedIds.map((employeeId, selectedIndex) => {
                                                            const employee = team.find((item) => item.id === employeeId);
                                                            if (!employee) return null;
                                                            const availability = availabilityByEmployee[employeeId];
                                                            const hasWarning = availability?.status !== 'available';
                                                            return (
                                                                <div
                                                                    key={employeeId}
                                                                    title={availability?.detail}
                                                                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${hasWarning ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-violet-200 bg-violet-50 text-violet-900'}`}
                                                                >
                                                                    <span>{fullName(employee)}</span>
                                                                    {selectedIndex === 0 && <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">Responsable</span>}
                                                                    {hasWarning && <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">{availability.label}</span>}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeEmployee(task.id, employeeId)}
                                                                        className="rounded p-0.5 text-violet-500 hover:bg-violet-100 hover:text-red-600"
                                                                        aria-label={`Quitar a ${fullName(employee)} solo de esta partida`}
                                                                    >
                                                                        <X className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}

                                                        {available.length > 0 && (
                                                            <Select value="" onValueChange={(employeeId) => addEmployee(task.id, employeeId)}>
                                                                <SelectTrigger className="h-8 w-[230px] border-dashed bg-white text-xs">
                                                                    <UserPlus className="mr-2 h-3.5 w-3.5" />
                                                                    <SelectValue placeholder="Añadir solo a esta partida" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {available.map((employee) => (
                                                                        <SelectItem key={employee.id} value={employee.id}>
                                                                            {fullName(employee)} · {availabilityByEmployee[employee.id]?.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {saveError && (
                    <div role="alert" className="mx-1 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                        <p className="font-medium">No se ha modificado ninguna tarea</p>
                        <p className="mt-0.5 text-xs text-red-700">{saveError}</p>
                    </div>
                )}

                <DialogFooter className="border-t border-slate-100 pt-4">
                    <p className="mr-auto self-center text-xs text-slate-500">
                        {tasks.length} tareas · {Object.values(selections).reduce((total, ids) => total + ids.length, 0)} asignaciones
                    </p>
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button
                        onClick={applyAssignments}
                        disabled={loading || saving || team.length === 0 || tasks.length === 0}
                        className="bg-violet-700 text-white hover:bg-violet-800"
                    >
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Guardar planificación
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default TaskAssignmentPlanner;
