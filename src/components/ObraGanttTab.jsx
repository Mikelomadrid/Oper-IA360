import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, ServerCrash, RefreshCw, Calendar as CalendarIcon, CheckCircle2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Minimize2, Clock, Users, Euro, TrendingUp, ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Bell, XCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import NativeGantt, { ViewMode } from '@/components/ui/NativeGantt';
import TaskCrudModal from '@/components/TaskCrudModal';
import TaskDetailModal from '@/components/TaskDetailModal';
import { Card } from '@/components/ui/card';
import { useLocation, useNavigate } from 'react-router-dom';

const GANTT_COLORS = [
    { base: '#2563eb', prog: '#60a5fa' },
    { base: '#0891b2', prog: '#22d3ee' },
    { base: '#7c3aed', prog: '#a78bfa' },
    { base: '#059669', prog: '#34d399' },
];

// ─── Helper: calcular fecha fin laborable ────────────────────────────────────
/**
 * Dado un inicio y un fin "naturales", devuelve la fecha fin ajustada
 * para que la duración en días laborables (L-V, sin festivos) sea la misma
 * que la duración natural pero desplazando los fines de semana y festivos.
 *
 * Dicho de otra forma: cuenta cuántos días laborables hay entre start y end,
 * y devuelve esa misma cantidad de días laborables desde start.
 */
const calcularFinLaborable = (start, end, festivosSet) => {
    if (!start || !end) return end;

    const esDiaLaboral = (date) => {
        const dow = date.getDay(); // 0=Dom, 6=Sab
        if (dow === 0 || dow === 6) return false;
        const iso = format(date, 'yyyy-MM-dd');
        if (festivosSet.has(iso)) return false;
        return true;
    };

    // Contar días laborables entre start y end (inclusive)
    let laborables = 0;
    const cursor = new Date(start);
    cursor.setHours(12, 0, 0, 0);
    const endNoon = new Date(end);
    endNoon.setHours(12, 0, 0, 0);

    while (cursor <= endNoon) {
        if (esDiaLaboral(cursor)) laborables++;
        cursor.setDate(cursor.getDate() + 1);
    }

    if (laborables === 0) return end; // Sin días laborables, no tocar

    // Ahora construir la fecha fin avanzando 'laborables' días laborables desde start
    let count = 0;
    const result = new Date(start);
    result.setHours(12, 0, 0, 0);

    while (count < laborables) {
        if (esDiaLaboral(result)) count++;
        if (count < laborables) result.setDate(result.getDate() + 1);
    }

    // Avanzar result hasta el siguiente lunes si cae en fin de semana
    while (!esDiaLaboral(result)) {
        result.setDate(result.getDate() + 1);
    }

    result.setHours(23, 59, 59, 999);
    return result;
};

/**
 * Ajusta la fecha de inicio: si cae en fin de semana o festivo,
 * la mueve al siguiente día laborable.
 */
const ajustarInicioLaborable = (date, festivosSet) => {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    const esDiaLaboral = (dt) => {
        const dow = dt.getDay();
        if (dow === 0 || dow === 6) return false;
        const iso = format(dt, 'yyyy-MM-dd');
        if (festivosSet.has(iso)) return false;
        return true;
    };
    while (!esDiaLaboral(d)) {
        d.setDate(d.getDate() + 1);
    }
    return d;
};
// ─────────────────────────────────────────────────────────────────────────────

const CustomTaskListHeader = () => (
    <div className="border-b border-slate-200 bg-white h-[60px]" />
);

const CustomTaskListTable = ({
    rowHeight,
    rowWidth,
    fontFamily,
    fontSize,
    tasks,
    selectedTaskId,
    setSelectedTask,
    setDetailModalState,
    onTaskReorder,
    canManage
}) => {
    const [draggedTaskId, setDraggedTaskId] = useState(null);

    const handleDragStart = (e, task) => {
        setDraggedTaskId(task.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetTask) => {
        e.preventDefault();
        if (draggedTaskId && draggedTaskId !== targetTask.id) {
            onTaskReorder(draggedTaskId, targetTask.id);
        }
        setDraggedTaskId(null);
    };

    return (
        <div
            className="flex flex-col border-r border-slate-200 bg-white relative z-20 pt-4"
            style={{ fontFamily: fontFamily, fontSize: fontSize, width: rowWidth, overflow: 'visible' }}
        >
            {tasks.filter(t => t.id !== '__gantt_phantom_range__').map((t) => {
                const isSelected = t.id === selectedTaskId;

                return (
                    <div
                        key={t.id}
                        draggable={canManage && !t.isDisabled ? "true" : "false"}
                        onDragStart={(e) => {
                            if (!canManage || t.isDisabled) { e.preventDefault(); return; }
                            handleDragStart(e, t);
                        }}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragOver}
                        onDrop={(e) => handleDrop(e, t)}
                        className={cn(
                            "flex items-center border-b border-slate-100 px-3 transition-all relative hover:z-[100]",
                            canManage && !t.isDisabled ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                            draggedTaskId === t.id ? "opacity-30 bg-blue-50" : "",
                            isSelected ? "bg-blue-50/50" : "hover:bg-slate-50",
                            t.isDisabled ? "opacity-60" : ""
                        )}
                        style={{ height: rowHeight }}
                        onClick={() => setSelectedTask(t.id)}
                        onDoubleClick={() => {
                            const originalTask = tasks.find(task => task.id === t.id);
                            if (originalTask) {
                                setSelectedTask(t.id);
                                setDetailModalState({ isOpen: true, task: originalTask });
                            }
                        }}
                    >
                        {canManage && !t.isDisabled && (
                            <div className="w-6 flex shrink-0 justify-center items-center text-slate-300 hover:text-blue-500 mr-2">
                                <svg width="10" height="14" viewBox="0 0 12 16" fill="currentColor">
                                    <path d="M4 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM4 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM4 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
                                </svg>
                            </div>
                        )}

                        <div className="w-10 flex shrink-0 justify-center items-center mr-3">
                            {t.tecnicos && t.tecnicos.length > 0 ? (
                                <div className="flex -space-x-1 pl-1">
                                    {t.tecnicos.map((tec) => (
                                        <Avatar key={tec.id} className="w-6 h-6 border border-white">
                                            {tec.foto_url ? (
                                                <img src={tec.foto_url} alt={tec.nombre} className="w-full h-full object-cover rounded-full" />
                                            ) : (
                                                <AvatarFallback className="text-[8px] bg-slate-100 text-slate-600">
                                                    {tec.nombre?.substring(0, 2).toUpperCase() || 'SA'}
                                                </AvatarFallback>
                                            )}
                                        </Avatar>
                                    ))}
                                </div>
                            ) : (
                                <Avatar className="w-6 h-6 border border-white opacity-40">
                                    <AvatarFallback className="text-[8px] bg-slate-100 text-slate-600">SA</AvatarFallback>
                                </Avatar>
                            )}
                        </div>

                        <div className="flex-1 truncate font-medium text-slate-800 text-sm">
                            {t.name}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const GanttTooltip = ({ task }) => {
    const bgColor = task.progress >= 100 ? "bg-emerald-100 border-emerald-200" :
        task.progress > 0 ? "bg-blue-100 border-blue-200" : "bg-amber-100 border-amber-200";
    const textColor = task.progress >= 100 ? "text-emerald-700" :
        task.progress > 0 ? "text-blue-700" : "text-amber-700";

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-lg p-4 w-64 text-sm z-50">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2 truncate">{task.name}</h4>
            <div className="space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-muted-foreground text-xs uppercase font-semibold">Estado</span>
                    <Badge className={cn("px-2 py-0.5 capitalize shadow-none", bgColor, textColor)}>
                        {task.estado_raw?.replace('_', ' ')}
                    </Badge>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                    <span className="text-xs text-muted-foreground font-semibold">Asignados:</span>
                    <div className="flex flex-wrap gap-2">
                        {task.tecnicos && task.tecnicos.length > 0 ? (
                            task.tecnicos.map(tec => (
                                <div key={tec.id} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 rounded-full pr-2">
                                    <Avatar className="w-5 h-5 border border-slate-200 dark:border-slate-700">
                                        {tec.foto_url ? (
                                            <img src={tec.foto_url} alt={tec.nombre} className="w-full h-full object-cover rounded-full" />
                                        ) : (
                                            <AvatarFallback className="text-[9px] bg-slate-100 text-slate-600">
                                                {tec.nombre?.substring(0, 2).toUpperCase() || 'SA'}
                                            </AvatarFallback>
                                        )}
                                    </Avatar>
                                    <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[80px]">
                                        {tec.nombre}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <span className="text-xs italic text-slate-400">Sin asignar</span>
                        )}
                    </div>
                </div>
                <div className="flex flex-col gap-1 pt-2">
                    <span className="text-xs text-muted-foreground flex justify-between">
                        <span>Inicio:</span> <span className="text-slate-700 dark:text-slate-300 font-medium">{format(task.start, "d MMM yyyy", { locale: es })}</span>
                    </span>
                    <span className="text-xs text-muted-foreground flex justify-between">
                        <span>Fin:</span> <span className="text-slate-700 dark:text-slate-300 font-medium">{format(task.end, "d MMM yyyy", { locale: es })}</span>
                    </span>
                    <span className="text-xs text-muted-foreground flex justify-between">
                        <span>Progreso:</span> <span className="text-slate-700 dark:text-slate-300 font-medium">{Math.round(task.progress)}%</span>
                    </span>
                </div>
            </div>
        </div>
    );
};

const ObraGanttTab = ({ obraId }) => {
    const { sessionRole } = useAuth();
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();

    const [tasks, setTasks] = useState([]);
    const chartContainerRef = useRef(null);
    const applyHacksRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [ganttScale, setGanttScale] = useState(ViewMode.Day);
    const [zoomLevel, setZoomLevel] = useState(65);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [crudModalState, setCrudModalState] = useState({ isOpen: false, task: null });
    const [detailModalState, setDetailModalState] = useState({ isOpen: false, task: null });
    const [festivos, setFestivos] = useState([]);

    const canManage = useMemo(() => sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado' || sessionRole?.rol === 'manager', [sessionRole?.rol]);

    // ✅ Set de festivos para lookups rápidos
    const festivosSet = useMemo(() => new Set(festivos), [festivos]);

    // ─── Estado resumen de horas ───────────────────────────────────────────────
    const [horasData, setHorasData] = useState(null);
    const [loadingHoras, setLoadingHoras] = useState(false);
    const [showDesglose, setShowDesglose] = useState(false);

    // ─── Estado alertas de retraso ─────────────────────────────────────────────
    const [alertasRetraso, setAlertasRetraso] = useState([]);
    const [toastRetrasoMostrado, setToastRetrasoMostrado] = useState(false);
    const [showPanelAlertas, setShowPanelAlertas] = useState(true);
    const [confirmLimpiar, setConfirmLimpiar] = useState(false);
    const [limpiando, setLimpiando] = useState(false);

    // Horario Orkaled: L-J 8.5h, V 6h
    const HORAS_DIA = { 1: 8.5, 2: 8.5, 3: 8.5, 4: 8.5, 5: 6, 6: 0, 0: 0 };

    const calcularHorasTeoricas = useCallback((fechaInicio, fechaFin, festivosSetParam) => {
        if (!fechaInicio || !fechaFin) return 0;
        let horas = 0;
        const cursor = new Date(fechaInicio);
        cursor.setHours(12, 0, 0, 0);
        const fin = new Date(fechaFin);
        fin.setHours(12, 0, 0, 0);
        while (cursor <= fin) {
            const dow = cursor.getDay();
            const iso = format(cursor, 'yyyy-MM-dd');
            if (dow !== 0 && dow !== 6 && !festivosSetParam.has(iso)) {
                horas += HORAS_DIA[dow] || 0;
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return horas;
    }, []);

    const fetchHorasData = useCallback(async () => {
        if (!obraId) return;
        setLoadingHoras(true);
        try {
            const { data: extrasData } = await supabase
                .from('v_horas_extras_coste_final')
                .select('empleado_id, horas_extras, importe_horas_extras')
                .eq('proyecto_id', obraId);

            const taskIds = tasks.map(t => t.id).filter(Boolean);
            let empMap = {};

            if (taskIds.length > 0) {
                const { data: empData } = await supabase
                    .from('tarea_empleados')
                    .select('empleado_id, empleados(nombre, apellidos, foto_url)')
                    .in('tarea_id', taskIds);
                (empData || []).forEach(te => {
                    if (te.empleado_id && te.empleados) {
                        empMap[te.empleado_id] = {
                            nombre: `${te.empleados.nombre} ${te.empleados.apellidos || ''}`.trim(),
                            foto_url: te.empleados.foto_url,
                        };
                    }
                });
            }

            const empIdsExtras = [...new Set((extrasData || []).map(e => e.empleado_id))];
            if (empIdsExtras.length > 0) {
                const { data: empExtrasData } = await supabase
                    .from('empleados')
                    .select('id, nombre, apellidos, foto_url')
                    .in('id', empIdsExtras);
                (empExtrasData || []).forEach(e => {
                    if (!empMap[e.id]) {
                        empMap[e.id] = { nombre: `${e.nombre} ${e.apellidos || ''}`.trim(), foto_url: e.foto_url };
                    }
                });
            }

            let totalHorasTeoricas = 0;
            const horasPorEmpleado = {};

            tasks.forEach(task => {
                if (!task.fecha_inicio || !task.fecha_limite) return;
                const horasTarea = calcularHorasTeoricas(task.fecha_inicio, task.fecha_limite, festivosSet);
                const tecIds = task.tecnicos?.map(t => t.id) || [];
                const nTec = tecIds.length || 1;
                const horasPorTec = horasTarea / nTec;
                totalHorasTeoricas += horasTarea;
                tecIds.forEach(id => {
                    if (!horasPorEmpleado[id]) horasPorEmpleado[id] = { normales: 0, extras: 0, costeExtras: 0 };
                    horasPorEmpleado[id].normales += horasPorTec;
                });
            });

            let totalExtras = 0;
            let totalCosteExtras = 0;
            (extrasData || []).forEach(e => {
                totalExtras += Number(e.horas_extras || 0);
                totalCosteExtras += Number(e.importe_horas_extras || 0);
                if (!horasPorEmpleado[e.empleado_id]) horasPorEmpleado[e.empleado_id] = { normales: 0, extras: 0, costeExtras: 0 };
                horasPorEmpleado[e.empleado_id].extras += Number(e.horas_extras || 0);
                horasPorEmpleado[e.empleado_id].costeExtras += Number(e.importe_horas_extras || 0);
            });

            const TARIFA_NORMAL = 27;
            const costeNormal = totalHorasTeoricas * TARIFA_NORMAL;

            setHorasData({
                totalNormales: totalHorasTeoricas,
                totalExtras,
                totalCosteExtras,
                costeNormal,
                costeTotal: costeNormal + totalCosteExtras,
                nTrabajadores: Object.keys(empMap).length,
                desglose: Object.entries(horasPorEmpleado).map(([id, h]) => ({
                    id,
                    nombre: empMap[id]?.nombre || 'Desconocido',
                    foto_url: empMap[id]?.foto_url,
                    ...h
                }))
            });
        } catch (err) {
            console.error('Error cargando horas:', err);
        } finally {
            setLoadingHoras(false);
        }
    }, [obraId, tasks, festivosSet, calcularHorasTeoricas]);

    useEffect(() => {
        if (tasks.length > 0) {
            fetchHorasData();
        }
    }, [fetchHorasData]);

    // ─── Calcular alertas de retraso ──────────────────────────────────────────
    const calcularAlertas = useCallback(async () => {
        if (!tasks.length) return;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const TARIFA_NORMAL = 27;

        const alertas = [];
        for (const task of tasks) {
            if (!task.fecha_limite) continue;
            const fin = new Date(task.fecha_limite);
            fin.setHours(0, 0, 0, 0);
            const progreso = task.progressPercent || 0;
            const diasRetraso = Math.floor((hoy - fin) / (1000 * 60 * 60 * 24));
            const diasRestantes = Math.floor((fin - hoy) / (1000 * 60 * 60 * 24));

            let estado = null;
            if (fin < hoy && progreso < 100) {
                estado = 'retrasada';
            } else if (diasRestantes <= 3 && diasRestantes >= 0 && progreso < 70) {
                estado = 'en_riesgo';
            }

            if (estado) {
                // Calcular impacto económico
                const horasRetraso = diasRetraso > 0
                    ? calcularHorasTeoricas(task.fecha_limite, format(hoy, 'yyyy-MM-dd'), festivosSet)
                    : 0;
                const costeRetraso = horasRetraso * TARIFA_NORMAL;

                alertas.push({
                    id: task.id,
                    titulo: task.titulo,
                    estado,
                    diasRetraso: diasRetraso > 0 ? diasRetraso : 0,
                    diasRestantes: diasRestantes >= 0 ? diasRestantes : 0,
                    progreso,
                    costeRetraso,
                    horasRetraso,
                    tecnicos: task.tecnicos || [],
                    fecha_limite: task.fecha_limite,
                });
            }
        }

        setAlertasRetraso(alertas);

        // Toast si hay retrasos y no se ha mostrado aún
        if (alertas.filter(a => a.estado === 'retrasada').length > 0 && !toastRetrasoMostrado) {
            const retrasadas = alertas.filter(a => a.estado === 'retrasada');
            toast({
                variant: 'destructive',
                title: `⚠️ ${retrasadas.length} tarea${retrasadas.length > 1 ? 's' : ''} retrasada${retrasadas.length > 1 ? 's' : ''}`,
                description: retrasadas.map(a => `• ${a.titulo} (${a.diasRetraso}d de retraso)`).join('\n'),
            });
            setToastRetrasoMostrado(true);

            // Enviar notificaciones a empleados afectados
            const { data: { user } } = await supabase.auth.getUser();
            for (const alerta of retrasadas) {
                for (const tec of alerta.tecnicos) {
                    // Buscar user_id del empleado
                    const { data: empData } = await supabase
                        .from('empleados')
                        .select('auth_user_id')
                        .eq('id', tec.id)
                        .single();
                    if (empData?.auth_user_id) {
                        await supabase.from('notificaciones').upsert({
                            user_id: empData.auth_user_id,
                            empleado_id: tec.id,
                            referencia_id: alerta.id,
                            tipo_objeto: 'tarea',
                            tipo_entidad: 'retraso',
                            mensaje: `⚠️ La tarea "${alerta.titulo}" lleva ${alerta.diasRetraso} día${alerta.diasRetraso > 1 ? 's' : ''} de retraso. Progreso actual: ${Math.round(alerta.progreso)}%.`,
                            estado: 'no_leida',
                            fecha_creacion: new Date().toISOString(),
                        }, { onConflict: 'empleado_id,referencia_id,tipo_entidad' });
                    }
                }
            }
        }
    }, [tasks, festivosSet, calcularHorasTeoricas, toast, toastRetrasoMostrado]);

    useEffect(() => {
        if (tasks.length > 0) {
            calcularAlertas();
        }
    }, [calcularAlertas]);

    const fmtH = (h) => `${Math.floor(h)}h ${Math.round((h % 1) * 60)}min`;
    const fmtEur = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v || 0);

    const fetchData = useCallback(async () => {
        if (!obraId) return;
        setLoading(true);
        setError(null);
        try {
            const { data: tasksData, error: tasksError } = await supabase
                .from('v_tareas_ui')
                .select('id, titulo, empleado_asignado_id, estado, fecha_creacion, tecnico_nombre, fecha_limite, proyecto_id')
                .eq('proyecto_id', obraId);

            const { data: tareasBaseData, error: tareasBaseError } = await supabase
                .from('tareas')
                .select('id, orden, fecha_inicio')
                .eq('proyecto_id', obraId);

            const taskIds = tasksData?.map(t => t.id) || [];
            let tareasRawData = [];
            let userFotos = {};
            let empNames = {};
            let tareaEmpleadosMap = {};

            if (taskIds.length > 0) {
                const { data: rawTareas, error: rawError } = await supabase
                    .from('tareas')
                    .select('id, fecha_inicio, empleado_asignado_id, orden')
                    .in('id', taskIds);

                if (!rawError && rawTareas) {
                    tareasRawData = rawTareas;
                }

                const { data: teData } = await supabase
                    .from('tarea_empleados')
                    .select('tarea_id, empleado_id')
                    .in('tarea_id', taskIds);

                let userIds = new Set(rawTareas?.map(r => r.empleado_asignado_id).filter(Boolean) || []);
                if (teData) {
                    teData.forEach(te => userIds.add(te.empleado_id));
                    teData.forEach(te => {
                        if (!tareaEmpleadosMap[te.tarea_id]) tareaEmpleadosMap[te.tarea_id] = [];
                        tareaEmpleadosMap[te.tarea_id].push(te.empleado_id);
                    });
                }

                userIds = [...userIds];

                if (userIds.length > 0) {
                    const { data: empData } = await supabase.from('empleados').select('id, foto_url, nombre, apellidos').in('id', userIds);
                    if (empData) {
                        empData.forEach(e => {
                            userFotos[e.id] = e.foto_url;
                            empNames[e.id] = `${e.nombre} ${e.apellidos || ''}`.trim();
                        });
                    }
                }
            }

            if (tasksError) throw tasksError;

            if (tasksData.length > 0) {
                const taskIds = tasksData.map(t => t.id);
                const { data: subtasksRes, error: subtasksError } = await supabase
                    .from('v_subtareas_ui')
                    .select('tarea_id, completada')
                    .in('tarea_id', taskIds);

                if (subtasksError) throw subtasksError;

                const progressByTask = {};
                subtasksRes.forEach(st => {
                    if (!progressByTask[st.tarea_id]) progressByTask[st.tarea_id] = { total: 0, completed: 0 };
                    progressByTask[st.tarea_id].total += 1;
                    if (st.completada) progressByTask[st.tarea_id].completed += 1;
                });

                const formattedTasks = tasksData.map(task => {
                    const prog = progressByTask[task.id] || { total: 0, completed: 0 };
                    let progressPercent = prog.total > 0 ? (prog.completed / prog.total) * 100 : 0;

                    if (prog.total === 0) {
                        if (task.estado === 'completada' || task.estado === 'completada_validada') progressPercent = 100;
                        else if (task.estado === 'en_progreso') progressPercent = 50;
                    } else if (task.estado === 'completada' || task.estado === 'completada_validada') {
                        progressPercent = 100;
                    }

                    const rawDataForTask = tareasRawData.find(r => r.id === task.id);
                    const rawDate = rawDataForTask?.fecha_inicio;

                    let assigneesIds = tareaEmpleadosMap[task.id];
                    if (!assigneesIds || assigneesIds.length === 0) {
                        assigneesIds = rawDataForTask?.empleado_asignado_id ? [rawDataForTask.empleado_asignado_id] : [];
                    }

                    const tecnicosDetails = assigneesIds.map(eid => ({
                        id: eid,
                        nombre: empNames[eid] || 'Desconocido',
                        foto_url: userFotos[eid]
                    }));

                    return {
                        ...task,
                        fecha_inicio: rawDate,
                        tecnicos: tecnicosDetails,
                        progressPercent
                    };
                });

                formattedTasks.sort((a, b) => {
                    const ordenA = a.orden ?? 0;
                    const ordenB = b.orden ?? 0;
                    if (ordenA !== ordenB) return ordenA - ordenB;
                    const fechaA = new Date(a.fecha_creacion).getTime();
                    const fechaB = new Date(b.fecha_creacion).getTime();
                    return fechaA - fechaB;
                });

                setTasks(formattedTasks);
            } else {
                setTasks([]);
            }

            // --- FETCH FESTIVOS ---
            const { data: festData, error: festError } = await supabase.from('calendario_festivos').select('fecha');
            if (!festError && festData) {
                setFestivos(festData.map(f => f.fecha));
            }

        } catch (e) {
            console.error("Error fetching tasks for Gantt:", e);
            setError(e);
            toast({ variant: 'destructive', title: 'Error al cargar cronograma', description: e.message });
        } finally {
            setLoading(false);
        }
    }, [obraId, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (ganttScale === ViewMode.Day) setZoomLevel(65);
    }, [ganttScale]);

    useEffect(() => {
        if (!loading && tasks.length > 0) {
            const searchParams = new URLSearchParams(location.search);
            const openTaskId = searchParams.get('openTask');

            if (openTaskId) {
                const taskToOpen = tasks.find(t => String(t.id) === openTaskId);
                if (taskToOpen) {
                    setDetailModalState({ isOpen: true, task: taskToOpen });
                    searchParams.delete('openTask');
                    const newSearch = searchParams.toString();
                    navigate({
                        pathname: location.pathname,
                        search: newSearch ? `?${newSearch}` : ''
                    }, { replace: true });
                }
            }
        }
    }, [loading, tasks, location.search, location.pathname, navigate]);

    const ganttData = useMemo(() => {
        const currentYear = 2026;
        let globalMinDate = new Date(currentYear, 1, 21);
        if (ganttScale === ViewMode.Year) {
            globalMinDate = new Date(currentYear, 0, 1);
        }

        const formatted = tasks.map((task, index) => {
            const startStr = task.fecha_inicio || task.fecha_creacion || new Date().toISOString();
            let startRaw = new Date(startStr);

            if (startRaw < globalMinDate) {
                startRaw = new Date(globalMinDate.getTime());
            }

            // ✅ Ajustar inicio: si cae en fin de semana o festivo, mover al siguiente laborable
            const start = ajustarInicioLaborable(startRaw, festivosSet);

            let end;
            if (task.fecha_limite) {
                const endRaw = new Date(task.fecha_limite);
                // ✅ Calcular fin laborable: misma duración en días laborables
                end = calcularFinLaborable(start, endRaw, festivosSet);
            } else {
                // Sin fecha límite: 1 día laborable
                end = new Date(start.getTime());
                end.setHours(23, 59, 59, 999);
            }

            if (end < start) {
                end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
            }

            const targetColor = GANTT_COLORS[index % GANTT_COLORS.length];

            // ✅ Color según estado de retraso
            const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
            // Parsear fecha_limite como local (evitar problema UTC)
            let finTask = null;
            if (task.fecha_limite) {
                const [y, m, d] = task.fecha_limite.split('-').map(Number);
                finTask = new Date(y, m - 1, d);
                finTask.setHours(0, 0, 0, 0);
            }
            const progreso = task.progressPercent || 0;
            const diasRestantes = finTask ? Math.floor((finTask - hoy) / (1000 * 60 * 60 * 24)) : 99;
            const esRetrasada = finTask && finTask < hoy && progreso < 100;
            const esEnRiesgo = !esRetrasada && diasRestantes <= 3 && diasRestantes >= 0 && progreso < 70;

            const color = esRetrasada ? '#ef4444' : esEnRiesgo ? '#f97316' : targetColor.base;

            return {
                start,
                end,
                name: task.titulo,
                id: task.id,
                type: 'task',
                progress: task.progressPercent,
                isDisabled: !canManage,
                styles: {
                    backgroundColor: color,
                    progressColor: color,
                    backgroundSelectedColor: color,
                    progressSelectedColor: color,
                },
                project_color_hack: color,
                estado_raw: task.estado,
                tecnicos: task.tecnicos,
                es_retrasada: esRetrasada,
                es_en_riesgo: esEnRiesgo,
            };
        });

        // Phantom task
        formatted.push({
            start: globalMinDate,
            end: new Date(currentYear, 11, 31),
            name: "",
            id: "__gantt_phantom_range__",
            type: 'task',
            progress: 0,
            isDisabled: true,
            styles: {
                backgroundColor: 'transparent',
                backgroundSelectedColor: 'transparent',
                progressColor: 'transparent',
                progressSelectedColor: 'transparent',
            },
        });

        return formatted;
    }, [tasks, canManage, ganttScale, festivosSet]); // ✅ festivosSet como dependencia

    const handleGanttTaskChange = async (gTask) => {
        try {
            const originalTask = tasks.find(t => t.id === gTask.id);
            if (!originalTask) return;

            const getNoon = (dateStrOrObj) => {
                const d = new Date(dateStrOrObj);
                d.setHours(12, 0, 0, 0);
                return d;
            };

            const oldStart = getNoon(originalTask.fecha_inicio);
            const newStart = getNoon(gTask.start);
            const diffStart = Math.round((newStart.getTime() - oldStart.getTime()) / (1000 * 3600 * 24));

            const oldEnd = getNoon(originalTask.fecha_limite);
            const newEnd = getNoon(gTask.end);
            const diffEnd = Math.round((newEnd.getTime() - oldEnd.getTime()) / (1000 * 3600 * 24));

            let targetStart = new Date(originalTask.fecha_inicio + "T12:00:00");
            let targetEnd = new Date(originalTask.fecha_limite + "T12:00:00");

            if (diffStart !== 0 && diffEnd !== 0) {
                targetStart.setDate(targetStart.getDate() + diffStart);
                targetEnd.setDate(targetEnd.getDate() + diffStart);
            } else if (diffStart !== 0 && diffEnd === 0) {
                targetStart.setDate(targetStart.getDate() + diffStart);
            } else if (diffStart === 0 && diffEnd !== 0) {
                targetEnd.setDate(targetEnd.getDate() + diffEnd);
            } else {
                return;
            }

            const startISO = format(targetStart, 'yyyy-MM-dd');
            const endISO = format(targetEnd, 'yyyy-MM-dd');

            const { error } = await supabase
                .from('tareas')
                .update({ fecha_inicio: startISO, fecha_limite: endISO })
                .eq('id', gTask.id);

            if (error) throw error;

            toast({ title: 'Cronograma actualizado', description: 'Las fechas de la tarea se han guardado automáticamente.' });

            setTasks(prev => {
                const nextTasks = prev.map(t => t.id === gTask.id ? {
                    ...t,
                    fecha_inicio: startISO,
                    fecha_limite: endISO
                } : t);

                if (obraId) {
                    let pMin = null;
                    let pMax = null;
                    nextTasks.forEach(t => {
                        if (t.id === '__gantt_phantom_range__') return;
                        const st = new Date(t.fecha_inicio || t.fecha_creacion || new Date());
                        const ed = t.fecha_limite ? new Date(t.fecha_limite) : new Date(st.getTime() + 86400000);
                        if (!pMin || st < pMin) pMin = st;
                        if (!pMax || ed > pMax) pMax = ed;
                    });

                    if (pMin && pMax) {
                        supabase.from('proyectos').update({
                            fecha_inicio: format(pMin, 'yyyy-MM-dd'),
                            fecha_fin_estimada: format(pMax, 'yyyy-MM-dd')
                        }).eq('id', obraId).then(({ error: pErr }) => {
                            if (pErr) console.error("Error syncing project boundaries:", pErr);
                        });
                    }
                }
                return nextTasks;
            });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar la tarea en el servidor.' });
            fetchData();
        }
    };

    const handleDeleteTask = async (taskToDelete) => {
        if (!taskToDelete?.id) return;

        try {
            const taskId = taskToDelete.id;
            await supabase.from('tarea_empleados').delete().eq('tarea_id', taskId);
            await supabase.from('tarea_revisiones').delete().eq('tarea_id', taskId);

            const { data: subtasks } = await supabase.from('subtareas').select('id').eq('tarea_id', taskId);
            if (subtasks && subtasks.length > 0) {
                const stIds = subtasks.map(st => st.id);
                await supabase.from('evidencias_tarea').delete().in('subtarea_id', stIds);
                await supabase.from('subtareas').delete().in('id', stIds);
            }

            const { error } = await supabase.from('tareas').delete().eq('id', taskId);
            if (error) throw error;

            toast({ title: 'Tarea eliminada', description: 'La tarea se eliminó correctamente.' });
            setDetailModalState({ isOpen: false, task: null });
            fetchData();
        } catch (error) {
            console.error("Error deleting task:", error);
            toast({ title: 'Error', description: 'Hubo un error al eliminar la tarea: ' + error.message, variant: 'destructive' });
        }
    };

    const handleTaskReorder = async (draggedId, targetId) => {
        if (!draggedId || !targetId || draggedId === targetId) return;

        const originalTasks = [...tasks];
        const draggedIndex = originalTasks.findIndex(t => t.id === draggedId);
        const targetIndex = originalTasks.findIndex(t => t.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        const newTasks = [...originalTasks];
        const [draggedTask] = newTasks.splice(draggedIndex, 1);
        newTasks.splice(targetIndex, 0, draggedTask);

        const updatedTasks = newTasks.map((t, index) => ({ ...t, orden: index }));
        setTasks(updatedTasks);

        try {
            const tasksToUpdate = updatedTasks.filter((t, i) => originalTasks[i]?.id !== t.id || originalTasks[i]?.orden !== t.orden);
            const promises = tasksToUpdate.map(t => supabase.from('tareas').update({ orden: t.orden }).eq('id', t.id));
            await Promise.all(promises);
            toast({ title: 'Orden guardado', description: 'El nuevo orden de las tareas se ha guardado correctamente.' });
        } catch (error) {
            console.error("Error reordering tasks:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el nuevo orden.' });
            setTasks(originalTasks);
        }
    };

    const handleLimpiarGantt = async () => {
        if (!obraId) return;
        setLimpiando(true);
        try {
            const { data: tareasData } = await supabase
                .from('tareas')
                .select('id')
                .eq('proyecto_id', obraId);

            const taskIds = (tareasData || []).map(t => t.id);

            if (taskIds.length > 0) {
                for (const taskId of taskIds) {
                    const { data: subtasks } = await supabase.from('subtareas').select('id').eq('tarea_id', taskId);
                    if (subtasks?.length > 0) {
                        const stIds = subtasks.map(st => st.id);
                        await supabase.from('evidencias_tarea').delete().in('subtarea_id', stIds);
                        await supabase.from('subtareas').delete().in('id', stIds);
                    }
                    await supabase.from('tarea_empleados').delete().eq('tarea_id', taskId);
                    await supabase.from('tarea_revisiones').delete().eq('tarea_id', taskId);
                }
                await supabase.from('tareas').delete().eq('proyecto_id', obraId);
            }

            toast({ title: '🗑️ Gantt limpiado', description: `Se eliminaron ${taskIds.length} tarea${taskIds.length !== 1 ? 's' : ''} del cronograma.` });
            setConfirmLimpiar(false);
            fetchData();
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo limpiar el Gantt: ' + err.message });
        } finally {
            setLimpiando(false);
        }
    };

    const extendedGanttData = useMemo(() => ganttData, [ganttData]);

    if (loading) return <div className="flex items-center justify-center p-8 h-64"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
    if (error) return <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-destructive/50"><ServerCrash className="w-16 h-16 text-destructive mb-4" /><h2 className="text-2xl font-bold text-destructive mb-2">Error</h2><p className="text-muted-foreground mb-4">{error.message}</p><Button onClick={fetchData}><RefreshCw className="mr-2 h-4 w-4" /> Reintentar</Button></div>;

    return (
        <div className="space-y-6 py-6 animate-in fade-in duration-700 min-h-[600px] relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-xl">
                        <CalendarIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Cronograma de Tareas</h2>
                        <p className="text-sm text-slate-500 font-medium">
                            Planifica y ajusta las fechas de las tareas de la obra interactuando con el gráfico.
                        </p>
                    </div>
                </div>
                {canManage && (
                    <div className="flex items-center gap-2">
                        {!confirmLimpiar ? (
                            <Button
                                variant="outline"
                                onClick={() => setConfirmLimpiar(true)}
                                disabled={tasks.length === 0}
                                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-semibold rounded-xl h-11 px-4 transition-all"
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Limpiar Gantt
                            </Button>
                        ) : (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                                <span className="text-sm text-red-700 font-medium">¿Borrar todas las tareas?</span>
                                <Button
                                    size="sm"
                                    onClick={handleLimpiarGantt}
                                    disabled={limpiando}
                                    className="bg-red-600 hover:bg-red-700 text-white rounded-lg h-8 px-3 text-xs font-bold"
                                >
                                    {limpiando ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sí, borrar'}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setConfirmLimpiar(false)}
                                    className="rounded-lg h-8 px-3 text-xs"
                                >
                                    Cancelar
                                </Button>
                            </div>
                        )}
                        <Button
                            onClick={() => setCrudModalState({ isOpen: true, task: null })}
                            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-xl shadow-lg shadow-blue-100 px-6 h-11 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Plus className="w-5 h-5 mr-2" /> Nueva Tarea
                        </Button>
                    </div>
                )}
            </div>

            {/* ✅ PANEL DE ALERTAS DE RETRASO */}
            {alertasRetraso.length > 0 && showPanelAlertas && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <h3 className="font-bold text-red-800 text-base">
                                Alertas de Cronograma
                                <span className="ml-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">{alertasRetraso.length}</span>
                            </h3>
                        </div>
                        <button onClick={() => setShowPanelAlertas(false)} className="text-red-400 hover:text-red-700">
                            <XCircle className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {alertasRetraso.map(alerta => (
                            <div key={alerta.id} className={cn(
                                "flex items-start gap-3 p-3 rounded-xl border",
                                alerta.estado === 'retrasada'
                                    ? "bg-red-100/70 border-red-200"
                                    : "bg-orange-50 border-orange-200"
                            )}>
                                <div className="shrink-0 mt-0.5">
                                    {alerta.estado === 'retrasada'
                                        ? <XCircle className="w-5 h-5 text-red-600" />
                                        : <AlertCircle className="w-5 h-5 text-orange-500" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-sm text-slate-900 truncate">{alerta.titulo}</span>
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded-full font-bold",
                                            alerta.estado === 'retrasada'
                                                ? "bg-red-600 text-white"
                                                : "bg-orange-500 text-white"
                                        )}>
                                            {alerta.estado === 'retrasada'
                                                ? `${alerta.diasRetraso}d de retraso`
                                                : `Vence en ${alerta.diasRestantes}d`
                                            }
                                        </span>
                                        <span className="text-xs text-slate-500">{Math.round(alerta.progreso)}% completada</span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                                        <span>Fin previsto: {alerta.fecha_limite ? format(new Date(alerta.fecha_limite), 'dd/MM/yyyy') : '—'}</span>
                                        {alerta.costeRetraso > 0 && (
                                            <span className="text-red-600 font-semibold">
                                                Impacto estimado: {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(alerta.costeRetraso)}
                                            </span>
                                        )}
                                        {alerta.tecnicos.length > 0 && (
                                            <span>Asignados: {alerta.tecnicos.map(t => t.nombre).join(', ')}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Resumen impacto total */}
                    {alertasRetraso.some(a => a.costeRetraso > 0) && (
                        <div className="mt-3 pt-3 border-t border-red-200 flex items-center justify-between text-sm">
                            <span className="text-red-700 font-medium">Impacto económico total estimado:</span>
                            <span className="font-bold text-red-800 text-base">
                                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                                    alertasRetraso.reduce((acc, a) => acc + (a.costeRetraso || 0), 0)
                                )}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Botón para mostrar alertas si están ocultas */}
            {alertasRetraso.length > 0 && !showPanelAlertas && (
                <button
                    onClick={() => setShowPanelAlertas(true)}
                    className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-2 transition-colors"
                >
                    <Bell className="w-4 h-4" />
                    Ver {alertasRetraso.length} alerta{alertasRetraso.length > 1 ? 's' : ''} de cronograma
                </button>
            )}

            {/* ✅ RESUMEN DE HORAS DE MANO DE OBRA */}
            {horasData && (
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-50 rounded-xl">
                                <Clock className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-base">Resumen de Mano de Obra</h3>
                                <p className="text-xs text-slate-500">Calculado sobre el cronograma actual · L-J 8,5h/día · V 6h/día</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowDesglose(p => !p)}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            {showDesglose ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {showDesglose ? 'Ocultar desglose' : 'Ver desglose por empleado'}
                        </button>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Horas Normales</p>
                            <p className="text-2xl font-bold text-blue-700 mt-1">{fmtH(horasData.totalNormales)}</p>
                            <p className="text-xs text-blue-500 mt-0.5">Según cronograma</p>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider">Horas Extra</p>
                            <p className="text-2xl font-bold text-amber-700 mt-1">{fmtH(horasData.totalExtras)}</p>
                            <p className="text-xs text-amber-500 mt-0.5">{fmtEur(horasData.totalCosteExtras)}</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                            <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider">Trabajadores</p>
                            <p className="text-2xl font-bold text-purple-700 mt-1">{horasData.nTrabajadores}</p>
                            <p className="text-xs text-purple-500 mt-0.5">En este proyecto</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Coste Total MO</p>
                            <p className="text-xl font-bold text-emerald-700 mt-1">{fmtEur(horasData.costeTotal)}</p>
                            <p className="text-xs text-emerald-500 mt-0.5">Normal + Extras</p>
                        </div>
                    </div>

                    {/* Desglose por empleado */}
                    {showDesglose && horasData.desglose.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Desglose por empleado</p>
                            <div className="space-y-2">
                                {horasData.desglose.map(emp => (
                                    <div key={emp.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                            {emp.foto_url
                                                ? <img src={emp.foto_url} alt={emp.nombre} className="w-full h-full object-cover" />
                                                : <span className="text-[10px] font-bold text-slate-600">{emp.nombre?.substring(0, 2).toUpperCase()}</span>
                                            }
                                        </div>
                                        <span className="text-sm font-medium text-slate-800 flex-1 truncate">{emp.nombre}</span>
                                        <div className="flex gap-4 text-xs">
                                            <span className="text-blue-600 font-mono">{fmtH(emp.normales)} <span className="text-slate-400">norm.</span></span>
                                            {emp.extras > 0 && <span className="text-amber-600 font-mono">{fmtH(emp.extras)} <span className="text-slate-400">extra</span></span>}
                                            <span className="text-emerald-600 font-mono font-semibold">{fmtEur((emp.normales * 27) + emp.costeExtras)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {loadingHoras && !horasData && (
                <div className="flex items-center gap-2 text-sm text-slate-400 bg-white rounded-xl border p-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Calculando horas de mano de obra...
                </div>
            )}

            <div className={cn("relative z-10", isFullscreen && "fixed inset-0 z-[999] bg-white flex flex-col p-4")}>
                <Card className="bg-white border-slate-200 rounded-xl overflow-hidden shadow-sm mt-4 flex flex-col" style={isFullscreen ? { flex: 1, marginTop: 0 } : {}}>
                    <div className="flex bg-white/80 backdrop-blur-sm p-3 border-b border-slate-200/60 items-center justify-between gap-4 h-[60px]">
                        <AnimatePresence mode="wait">
                            {ganttScale === ViewMode.Day && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200"
                                >
                                    <button onClick={() => setZoomLevel(prev => Math.max(20, Math.floor(prev / 10) * 10 - 10))} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all">
                                        <ZoomOut className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setZoomLevel(prev => Math.min(200, Math.floor(prev / 10) * 10 + 10))} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all">
                                        <ZoomIn className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-inner">
                            {[
                                { id: ViewMode.Day, label: 'Días' },
                                { id: ViewMode.Week, label: 'Semanas' },
                                { id: ViewMode.Month, label: 'Meses' },
                            ].map((v) => (
                                <button
                                    key={v.id}
                                    onClick={() => setGanttScale(v.id)}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
                                        ganttScale === v.id
                                            ? "bg-[#7c3aed] text-white shadow-md shadow-purple-200 scale-[1.02]"
                                            : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                                    )}
                                >
                                    {v.label}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setIsFullscreen(prev => !prev)}
                            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"
                            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-0 border-t border-slate-200 bg-slate-50 relative" ref={chartContainerRef}>
                        {tasks.length > 0 ? (
                            <div className="flex flex-row w-full" style={{ maxHeight: isFullscreen ? 'calc(100vh - 180px)' : '600px', overflow: 'hidden' }}>
                                <div
                                    className="w-[300px] flex-shrink-0 bg-white border-r border-slate-200 overflow-y-auto overflow-x-hidden"
                                    style={{ scrollbarWidth: 'none' }}
                                    ref={(el) => {
                                        if (!el) return;
                                        el._leftCol = true;
                                        const syncScroll = (e) => {
                                            const ganttScroll = el.parentElement?.querySelector('[data-gantt-scroll]');
                                            if (ganttScroll && ganttScroll.scrollTop !== el.scrollTop) {
                                                ganttScroll.scrollTop = el.scrollTop;
                                            }
                                        };
                                        el.addEventListener('scroll', syncScroll);
                                    }}
                                >
                                    <CustomTaskListHeader />
                                    <CustomTaskListTable
                                        rowHeight="48px"
                                        tasks={extendedGanttData}
                                        setDetailModalState={setDetailModalState}
                                        onTaskReorder={handleTaskReorder}
                                        canManage={canManage}
                                        selectedTaskId={null}
                                        setSelectedTask={() => { }}
                                        onExpanderClick={() => { }}
                                    />
                                </div>
                                <div
                                    className="flex-1 min-w-0 overflow-x-auto overflow-y-auto bg-white"
                                    data-gantt-scroll="true"
                                    style={{ scrollbarWidth: 'auto', scrollbarColor: '#94a3b8 #f1f5f9' }}
                                    ref={(el) => {
                                        if (!el) return;
                                        el.addEventListener('scroll', () => {
                                            const leftCol = el.parentElement?.querySelector('[style*="scrollbar-width: none"]');
                                            if (leftCol && leftCol.scrollTop !== el.scrollTop) {
                                                leftCol.scrollTop = el.scrollTop;
                                            }
                                        });
                                    }}
                                >
                                    <NativeGantt
                                        tasks={extendedGanttData.filter(t => t.id !== '__gantt_phantom_range__')}
                                        viewMode={ganttScale}
                                        zoomLevel={zoomLevel}
                                        canManage={canManage}
                                        maxHeight="none"
                                        festivosSet={festivosSet}
                                        onDateChange={handleGanttTaskChange}
                                        onDoubleClick={(gTask) => {
                                            const originalTask = tasks.find(t => t.id === gTask.id);
                                            if (originalTask) setDetailModalState({ isOpen: true, task: originalTask });
                                        }}
                                        TooltipContent={(props) => (
                                            <div className="bg-white p-3 shadow-xl border border-slate-200 rounded-lg max-w-[200px] text-xs font-sans z-50">
                                                <div className="font-bold text-slate-800 mb-1">{props.task.name}</div>
                                                <div className="text-slate-500">Inicio: {format(new Date(props.task.start), 'dd MMM yyyy', { locale: es })}</div>
                                                <div className="text-slate-500">Fin: {format(new Date(props.task.end), 'dd MMM yyyy', { locale: es })}</div>
                                                <div className="mt-2 text-blue-600 font-semibold text-[10px] uppercase">Doble clic para ver detalles</div>
                                            </div>
                                        )}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-24 px-6 w-full text-center animate-in fade-in zoom-in duration-500 bg-white">
                                <div className="bg-slate-50 p-6 rounded-full mb-6">
                                    <CalendarIcon className="w-12 h-12 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">No hay tareas programadas</h3>
                                <p className="text-slate-500 max-w-sm mb-8">
                                    Aún no se ha definido el cronograma de esta obra. Comienza añadiendo la primera partida o fase de trabajo.
                                </p>
                                {canManage && (
                                    <Button
                                        onClick={() => setCrudModalState({ isOpen: true, task: null })}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 h-12 rounded-xl shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95"
                                    >
                                        <Plus className="w-5 h-5 mr-2" /> Añadir Primera Tarea
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <TaskCrudModal
                isOpen={crudModalState.isOpen}
                onClose={() => setCrudModalState({ isOpen: false, task: null })}
                onSave={() => { setCrudModalState({ isOpen: false, task: null }); fetchData(); }}
                task={crudModalState.task}
                defaultProjectId={obraId}
            />

            <TaskDetailModal
                isOpen={detailModalState.isOpen}
                onClose={() => setDetailModalState({ isOpen: false, task: null })}
                task={detailModalState.task}
                onEdit={(taskToEdit) => {
                    setDetailModalState({ isOpen: false, task: null });
                    setTimeout(() => { setCrudModalState({ isOpen: true, task: taskToEdit }); }, 150);
                }}
                onDelete={handleDeleteTask}
            />
        </div>
    );
};

export default ObraGanttTab;
