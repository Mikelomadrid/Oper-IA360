import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Calendar as CalendarIcon, CheckCircle2, Clock, MapPin, Edit, Users, LayoutList, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const TaskDetailModal = ({ isOpen, onClose, task, onEdit, onDelete }) => {
    const { sessionRole } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const canManage = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado' || sessionRole?.rol === 'manager';

    const [subtasks, setSubtasks] = useState([]);
    const [workSessions, setWorkSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [clockTick, setClockTick] = useState(Date.now());

    const fetchTaskDetails = useCallback(async () => {
        if (!task || !isOpen) return;
        setIsLoading(true);

        const [subtasksResult, sessionsResult] = await Promise.all([
            supabase
                .from('subtareas')
                .select('id, descripcion_subtarea, completada, fecha_completado')
                .eq('tarea_id', task.id)
                .order('fecha_creacion', { ascending: true }),
            supabase
                .from('tarea_sesiones_trabajo')
                .select('id, empleado_id, estado, minutos_acumulados, ultimo_inicio_at, fin_at')
                .eq('tarea_id', task.id)
                .order('inicio_at', { ascending: true }),
        ]);

        if (!subtasksResult.error && subtasksResult.data) {
            setSubtasks(subtasksResult.data);
        } else {
            setSubtasks([]);
        }
        if (!sessionsResult.error && sessionsResult.data) {
            setWorkSessions(sessionsResult.data);
        } else {
            setWorkSessions([]);
        }
        setIsLoading(false);
    }, [task, isOpen]);

    useEffect(() => {
        fetchTaskDetails();
    }, [fetchTaskDetails]);

    useEffect(() => {
        if (!isOpen || !workSessions.some((session) => session.estado === 'en_curso')) return undefined;
        const timer = window.setInterval(() => setClockTick(Date.now()), 60000);
        return () => window.clearInterval(timer);
    }, [isOpen, workSessions]);

    if (!task) return null;

    const completedSubtasksCount = subtasks.filter(st => st.completada).length;
    const progressPercentage = subtasks.length > 0
        ? Math.round((completedSubtasksCount / subtasks.length) * 100)
        : (task.estado === 'completada' || task.estado === 'completada_validada' ? 100 : task.progressPercent || 0);

    const plannedHoursPerTechnician = Number(task.duracion_planificada_horas || task.horas_calculadas || 0);
    const technicianHours = (task.tecnicos || []).map((technician) => {
        const technicianSessions = workSessions.filter((session) => session.empleado_id === technician.id);
        const minutes = technicianSessions.reduce((sum, session) => {
            let sessionMinutes = Number(session.minutos_acumulados || 0);
            if (session.estado === 'en_curso' && session.ultimo_inicio_at) {
                sessionMinutes += Math.max(0, (clockTick - new Date(session.ultimo_inicio_at).getTime()) / 60000);
            }
            return sum + sessionMinutes;
        }, 0);
        const activeSession = technicianSessions.find((session) => session.estado === 'en_curso');
        const pausedSession = technicianSessions.find((session) => session.estado === 'pausada');
        return {
            ...technician,
            actualHours: minutes / 60,
            plannedHours: plannedHoursPerTechnician,
            workStatus: activeSession ? 'en_curso' : pausedSession ? 'pausada' : technicianSessions.length > 0 ? 'finalizada' : 'sin_iniciar',
        };
    });

    const formatHours = (hours) => {
        const decimalHours = Math.max(0, Number(hours || 0));
        return `${new Intl.NumberFormat('es-ES', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(decimalHours)} h`;
    };

    const getStatusBadge = () => {
        let bgColor = "bg-amber-100 border-amber-200";
        let textColor = "text-amber-700";
        let label = task.estado_raw?.replace('_', ' ') || "pendiente";

        if (progressPercentage >= 100 || task.estado === 'completada' || task.estado === 'completada_validada') {
            bgColor = "bg-emerald-100 border-emerald-200";
            textColor = "text-emerald-700";
            label = "completada";
        } else if (progressPercentage > 0 || task.estado === 'en_progreso') {
            bgColor = "bg-blue-100 border-blue-200";
            textColor = "text-blue-700";
            label = "en progreso";
        }

        return (
            <Badge className={cn("px-3 py-1 uppercase shadow-sm font-bold", bgColor, textColor)}>
                {label}
            </Badge>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
                <DialogHeader className="p-6 pb-0">
                    <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1 pr-8">
                            <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                                {task.name || task.titulo}
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 font-medium flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                {task.nombre_proyecto || "Proyecto vinculado"}
                            </DialogDescription>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            {canManage && onDelete && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="group hover:border-red-500 hover:text-red-600 hover:bg-red-50 text-slate-500">
                                            <Trash2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                                            Eliminar
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Estás seguro de que deseas eliminar esta tarea?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción es permanente y eliminará todos los datos asociados, incluyendo subtareas y asignaciones.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => onDelete(task)} className="bg-red-600 hover:bg-red-700 text-white">
                                                Eliminar Tarea
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                            {canManage && onEdit && (
                                <Button variant="outline" size="sm" onClick={() => onEdit(task)} className="group hover:border-blue-500 hover:text-blue-600">
                                    <Edit className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                                    Editar Tarea
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                <div className="px-6 py-6 overflow-y-auto max-h-[70vh] space-y-6">
                    {/* Status and Progress Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                {getStatusBadge()}
                                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                    {progressPercentage}% completado
                                </span>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progressPercentage}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Dates column */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-blue-500" />
                                Planificación
                            </h3>
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                                <div>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Fecha Inicio</span>
                                    <p className="text-slate-900 dark:text-slate-100 font-medium mt-0.5">
                                        {task.start || task.fecha_inicio ? format(new Date(task.start || task.fecha_inicio), "EEEE, d 'de' MMMM yyyy", { locale: es }) : 'No definida'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Fecha Límite</span>
                                    <p className="text-slate-900 dark:text-slate-100 font-medium mt-0.5">
                                        {task.end || task.fecha_limite ? format(new Date(task.end || task.fecha_limite), "EEEE, d 'de' MMMM yyyy", { locale: es }) : 'No definida'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Assignees Column */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                <Users className="w-4 h-4 text-emerald-500" />
                                Técnicos Asignados
                            </h3>
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
                                {technicianHours.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {technicianHours.map(tec => {
                                            const deviation = tec.actualHours - tec.plannedHours;
                                            const isOverPlan = tec.plannedHours > 0 && deviation > 0.01;
                                            const statusLabel = tec.workStatus === 'en_curso'
                                                ? 'Trabajando'
                                                : tec.workStatus === 'pausada'
                                                    ? 'En pausa'
                                                    : tec.workStatus === 'finalizada'
                                                        ? 'Intervención cerrada'
                                                        : 'Sin iniciar';
                                            return (
                                            <div
                                                key={tec.id}
                                                className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800"
                                                onClick={() => {
                                                    onClose();
                                                    const returnUrl = encodeURIComponent(location.pathname + location.search);
                                                    navigate(`/personal/empleados/${tec.id}?tab=herramientas&returnUrl=${returnUrl}&taskId=${task.id}`);
                                                }}
                                                title={`Ver herramientas de ${tec.nombre}`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <Avatar className="w-8 h-8 border border-slate-200 dark:border-slate-700 shadow-sm">
                                                            {tec.foto_url ? (
                                                                <img src={tec.foto_url} alt={tec.nombre} className="w-full h-full object-cover rounded-full" />
                                                            ) : (
                                                                <AvatarFallback className="text-xs bg-slate-100 text-slate-700 font-semibold">
                                                                    {tec.nombre?.trim()?.substring(0, 2).toUpperCase() || 'SA'}
                                                                </AvatarFallback>
                                                            )}
                                                        </Avatar>
                                                        <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                            {tec.nombre}
                                                        </span>
                                                    </div>
                                                    <Badge variant="outline" className={cn(
                                                        'shrink-0 px-2 py-0.5 text-[10px] font-medium shadow-none',
                                                        tec.workStatus === 'en_curso' && 'border-violet-200 bg-violet-50 text-violet-700',
                                                        tec.workStatus === 'pausada' && 'border-amber-200 bg-amber-50 text-amber-700',
                                                        tec.workStatus === 'finalizada' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                                                        tec.workStatus === 'sin_iniciar' && 'border-slate-200 bg-white text-slate-500'
                                                    )}>
                                                        {statusLabel}
                                                    </Badge>
                                                </div>
                                                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200/70 pt-2 dark:border-slate-800">
                                                    <div>
                                                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Previstas</p>
                                                        <p className="font-mono text-sm font-semibold tabular-nums text-violet-700">{formatHours(tec.plannedHours)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Reales</p>
                                                        <p className="font-mono text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">{formatHours(tec.actualHours)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Diferencia</p>
                                                        <p className={cn(
                                                            'font-mono text-sm font-semibold tabular-nums',
                                                            isOverPlan ? 'text-amber-700' : 'text-emerald-700'
                                                        )}>
                                                            {deviation > 0 ? '+' : ''}{formatHours(Math.abs(deviation))}{deviation < 0 ? ' disponibles' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <span className="text-sm text-slate-500 italic block py-2">Sin técnicos asignados</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Subtasks Section */}
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                <LayoutList className="w-4 h-4 text-violet-500" />
                                Subtareas ({completedSubtasksCount}/{subtasks.length})
                            </h3>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            {isLoading ? (
                                <div className="flex justify-center items-center py-8">
                                    <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                                </div>
                            ) : subtasks.length > 0 ? (
                                <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {subtasks.map((st) => (
                                        <li key={st.id} className="p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            {st.completada ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                            ) : (
                                                <Clock className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex flex-col">
                                                <span className={cn(
                                                    "text-sm font-medium",
                                                    st.completada ? "text-slate-500 line-through dark:text-slate-400" : "text-slate-700 dark:text-slate-200"
                                                )}>
                                                    {st.descripcion_subtarea}
                                                </span>
                                                {st.completada && st.fecha_completado && (
                                                    <span className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                                        Hecho el {format(new Date(st.fecha_completado), "dd MMM, HH:mm", { locale: es })}
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="p-6 text-center text-slate-500 text-sm italic">
                                    Esta tarea no tiene subtareas definidas.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default TaskDetailModal;
