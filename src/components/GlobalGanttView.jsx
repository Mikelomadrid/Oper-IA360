import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import NativeGantt, { ViewMode } from '@/components/ui/NativeGantt';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Loader2, Calendar, Filter, ChevronLeft, ChevronRight,
    Maximize2, ExternalLink, TrendingUp, Users, Target,
    Award, ShieldCheck, Download, ZoomIn, ZoomOut
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format, startOfMonth, addYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// --- Estilos Minimalistas ---
const StatCard = ({ title, value, icon: Icon, trend, colorClass }) => (
    <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-6">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <h2 className="text-3xl font-bold text-slate-900">{value}</h2>
                    {trend && (
                        <div className={cn(
                            "flex items-center gap-1 text-xs font-bold mt-2",
                            trend.startsWith('+') ? "text-emerald-600" : "text-rose-600"
                        )}>
                            <TrendingUp className={cn("w-3 h-3", !trend.startsWith('+') && "rotate-180")} />
                            {trend}
                        </div>
                    )}
                </div>
                <div className={cn("p-3 rounded-xl", colorClass.replace('bg-', 'bg-opacity-10 text-'))}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </CardContent>
    </Card>
);

// Cabecera vacía lateral alineada a 60px
const CustomTaskListHeader = () => (
    <div className="flex border-b border-slate-200 bg-white h-[60px]">
        {/* Empty list header representation */}
    </div>
);

// Tabla lateral solo con nombre
const CustomTaskListTable = ({ rowHeight, rowWidth, fontFamily, fontSize, tasks, selectedTaskId, setSelectedTask }) => (
    <div
        className="flex flex-col border-r border-slate-200 bg-white relative z-20 pt-4"
        style={{ fontFamily: fontFamily, fontSize: fontSize, width: rowWidth, overflow: 'visible' }}
    >
        {tasks.map(t => (
            <div
                key={t.id}
                className={cn(
                    "flex items-center px-4 transition-colors",
                    t.id === 'phantom-year-bounds' ? "" : "border-b border-slate-100 cursor-pointer",
                    t.id === selectedTaskId && t.id !== 'phantom-year-bounds' ? "bg-blue-50/50" : (t.id !== 'phantom-year-bounds' && "hover:bg-slate-50")
                )}
                style={{ height: rowHeight }}
                onClick={() => { if (t.id !== 'phantom-year-bounds') setSelectedTask(t.id); }}
            >
                <div className="flex-1 truncate font-bold text-slate-800 text-xs uppercase tracking-tight">
                    {t.name}
                </div>
            </div>
        ))}
    </div>
);

const GlobalGanttView = () => {
    const { sessionRole } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState(ViewMode.Week);
    const [zoomLevel, setZoomLevel] = useState(65);
    const chartContainerRef = useRef(null);
    const applyHacksRef = useRef(null);
    const [festivos, setFestivos] = useState([]);
    const [dateRange] = useState({
        start: new Date(2024, 1, 1),
        end: new Date(2025, 1, 1)
    });

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        try {
            const { data: projectsData, error: projError } = await supabase
                .from('proyectos')
                .select('id, nombre_proyecto, fecha_inicio, fecha_fin_estimada, fecha_cierre_real, estado')
                .order('fecha_inicio', { ascending: true });

            if (projError) throw projError;

            // Optional: You could still fetch tasks if you need them for something else,
            // but we no longer filter out projects that don't have tasks.
            const { data: tareasData, error: taskError } = await supabase
                .from('tareas')
                .select('proyecto_id');

            if (taskError) throw taskError;

            // Remove the requirement for projects to have tasks to be displayed in the global view.
            // However, we only want to show projects that are currently active or in-progress.
            const filteredProjects = (projectsData || []).filter(p =>
                p.estado === 'activo' || p.estado === 'en_curso'
            );

            setProjects(filteredProjects);

            // --- FETCH FESTIVOS ---
            const { data: festData, error: festError } = await supabase.from('calendario_festivos').select('fecha');
            if (!festError && festData) {
                setFestivos(festData.map(f => f.fecha));
            }

        } catch (error) {
            console.error('[GlobalGantt] Fetch error:', error);
            toast({ variant: 'destructive', title: 'Error cargando cronogramas', description: error.message });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const stats = useMemo(() => {
        const active = projects.filter(p => p.estado === 'en_curso' || p.estado === 'activo').length;
        return {
            active,
            forecast: '3.2M€',
            utilization: '88%',
            satisfaction: '4.9/5.0'
        };
    }, [projects]);

    const ganttTasks = useMemo(() => {
        if (projects.length === 0) return [];

        const currentYear = 2026;
        // Definimos la fecha mínima según la vista para forzar la eliminación de columnas anteriores
        let globalMinDate = new Date(currentYear, 1, 21); // 21 de Febrero
        if (view === ViewMode.Year) {
            globalMinDate = new Date(currentYear, 0, 1); // 1 de Enero
        }

        const tasks = projects.map((p, idx) => {
            let start = p.fecha_inicio ? new Date(p.fecha_inicio) : new Date();

            // Forzar que nada empiece antes de nuestra fecha mínima
            if (start < globalMinDate) {
                start = new Date(globalMinDate.getTime());
            }

            let end = p.fecha_cierre_real
                ? new Date(p.fecha_cierre_real)
                : (p.fecha_fin_estimada ? new Date(p.fecha_fin_estimada) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000));

            // Si el proyecto terminó antes de la fecha mínima, lo ajustamos para que se vea un punto al inicio
            // o simplemente nos aseguramos que end >= start
            const safeEnd = end > start ? end : new Date(start.getTime() + 24 * 60 * 60 * 1000);

            const colors = [
                { bg: '#6366f1', prog: '#818cf8' }, // Indigo
                { bg: '#10b981', prog: '#34d399' }, // Emerald
                { bg: '#f59e0b', prog: '#fbbf24' }, // Amber
                { bg: '#3b82f6', prog: '#60a5fa' }, // Blue
            ];
            const color = colors[idx % colors.length];

            return {
                start: start,
                end: safeEnd,
                name: p.nombre_proyecto,
                id: p.id,
                type: 'project',
                progress: p.progreso || 0, // Ajustado porque antes estaba hardcodeado a 100 pero querían hueco
                isDisabled: true,
                styles: {
                    backgroundColor: color.bg,
                    backgroundSelectedColor: color.bg,
                    progressColor: color.prog,
                    progressSelectedColor: color.prog,
                },
                project_color_hack: color.bg, // para el CSS hack
            };
        });

        // Add dummy task to enforce visual bounds
        tasks.push({
            start: globalMinDate,
            end: new Date(currentYear, 11, 31),
            name: "",
            id: "phantom-year-bounds",
            type: 'project',
            progress: 0,
            isDisabled: true,
            styles: {
                backgroundColor: 'transparent',
                backgroundSelectedColor: 'transparent',
                progressColor: 'transparent',
                progressSelectedColor: 'transparent',
            },
        });

        return tasks;
    }, [projects, view]);

    const handleTaskClick = (task) => {
        // Redirect directly to the schedule tab
        navigate(`/gestion/obras/${task.id}?tab=cronograma`);
    };

    const handleProjectDateChange = async (gTask, daysShifted) => {
        if (sessionRole !== 'admin' && sessionRole !== 'tecnico') return; // Only allow management for certain roles

        try {
            const originalProject = projects.find(p => p.id === gTask.id);
            if (!originalProject) return;

            // Target dates
            const startISO = format(new Date(gTask.start), 'yyyy-MM-dd');
            const endISO = format(new Date(gTask.end), 'yyyy-MM-dd');

            // Optimistic update
            setProjects(prev => prev.map(p => p.id === gTask.id ? {
                ...p,
                fecha_inicio: startISO,
                fecha_fin_estimada: endISO
            } : p));

            const { error } = await supabase
                .from('proyectos')
                .update({
                    fecha_inicio: startISO,
                    fecha_fin_estimada: endISO,
                    fecha_cierre_real: null // In case they resize an ongoing project we treat it as an estimate
                })
                .eq('id', gTask.id);

            if (error) throw error;

            toast({ title: 'Cronograma actualizado', description: 'Las fechas del proyecto se han guardado correctamente.' });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el proyecto en el servidor.' });
            fetchProjects(); // Rollback
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-white gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
                <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Cargando Cronograma Global...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 space-y-8">


            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
                        Cronograma Global 2026
                    </h1>
                    <p className="text-slate-500">Visión general de programación multiproyecto y asignación de recursos</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-white p-1 rounded-lg border border-slate-200">
                        {[ViewMode.Day, ViewMode.Week, ViewMode.Month, ViewMode.Year].map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={cn(
                                    "px-4 py-1.5 rounded-md text-xs font-semibold transition-all",
                                    view === v ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {v === ViewMode.Day ? 'DIARIA' : v === ViewMode.Week ? 'SEMANAL' : v === ViewMode.Month ? 'MENSUAL' : 'ANUAL'}
                            </button>
                        ))}
                    </div>

                    <AnimatePresence>
                        {view === ViewMode.Day && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="flex items-center bg-white p-1 rounded-lg border border-slate-200"
                            >
                                <button
                                    onClick={() => setZoomLevel(prev => Math.max(20, Math.floor(prev / 10) * 10 - 10))}
                                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
                                    title="Alejar"
                                >
                                    <ZoomOut className="w-4 h-4" />
                                </button>
                                <span className="text-xs font-semibold text-slate-600 px-2 min-w-[3.5ch] text-center">{zoomLevel}</span>
                                <button
                                    onClick={() => setZoomLevel(prev => Math.min(200, Math.floor(prev / 10) * 10 + 10))}
                                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
                                    title="Acercar"
                                >
                                    <ZoomIn className="w-4 h-4" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <Button variant="outline" size="icon" onClick={fetchProjects} className="bg-white border-slate-200">
                        <Loader2 className={cn("w-4 h-4 text-slate-400", loading && "animate-spin")} />
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-4 h-10 shadow-sm">
                        <Download className="w-4 h-4 mr-2" /> Exportar PDF
                    </Button>
                </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="PROYECTOS ACTIVOS" value={stats.active} icon={Target} trend="+12%" colorClass="bg-indigo-500" />
                <StatCard title="PREVISIÓN DE INGRESOS" value={stats.forecast} icon={Award} trend="+8%" colorClass="bg-emerald-500" />
                <StatCard title="USO DE RECURSOS" value={stats.utilization} icon={Users} trend="-2%" colorClass="bg-amber-500" />
                <StatCard title="SATISFACCIÓN DEL CLIENTE" value={stats.satisfaction} icon={ShieldCheck} colorClass="bg-blue-500" />
            </div>

            {/* Gantt Area */}
            <Card className="bg-white border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Detalles del Proyecto</h3>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <div className="w-2 h-2 rounded-full bg-indigo-500" /> Residencial
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" /> Comercial
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <div className="w-2 h-2 rounded-full bg-amber-500" /> Lujo
                        </div>
                    </div>
                </div>
                <CardContent className="p-0">
                    <div className="overflow-x-auto overflow-y-auto max-h-[600px] flex flex-col md:flex-row gap-0 relative" ref={chartContainerRef}>
                        <div data-festivos={JSON.stringify(festivos)} style={{ display: 'none' }} />
                        {ganttTasks.length > 0 ? (
                            <>
                                <div className="hidden md:block w-[280px] flex-shrink-0 border-r border-slate-200">
                                    <CustomTaskListHeader headerHeight={120} />
                                    <CustomTaskListTable
                                        rowHeight="48px"
                                        rowWidth="280px"
                                        fontFamily="inherit"
                                        fontSize="12px"
                                        tasks={ganttTasks}
                                        selectedTaskId={null}
                                        setSelectedTask={() => { }}
                                    />
                                </div>
                                <div className="flex-1 w-full min-w-0 bg-white">
                                    <NativeGantt
                                        tasks={ganttTasks.filter(t => t.id !== 'phantom-year-bounds')}
                                        viewMode={view}
                                        canManage={sessionRole === 'admin' || sessionRole === 'tecnico'}
                                        onDateChange={handleProjectDateChange}
                                        onDoubleClick={handleTaskClick}
                                        TooltipContent={(props) => (
                                            <div className="bg-white p-3 shadow-xl border border-slate-200 rounded-lg max-w-[200px] text-xs font-sans z-50">
                                                <div className="font-bold text-slate-800 mb-1">{props.task.name}</div>
                                                <div className="text-slate-500">
                                                    Inicio: {format(new Date(props.task.start), 'dd MMM yyyy', { locale: es })}
                                                </div>
                                                <div className="text-slate-500">
                                                    Fin: {format(new Date(props.task.end), 'dd MMM yyyy', { locale: es })}
                                                </div>
                                                <div className="mt-2 text-blue-600 font-semibold text-[10px] uppercase">
                                                    Clic para abrir proyecto
                                                </div>
                                            </div>
                                        )}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-32 text-center w-full">
                                <Maximize2 className="w-12 h-12 text-slate-200 mb-4" />
                                <h3 className="text-lg font-bold text-slate-900">No hay proyectos activos</h3>
                                <p className="text-slate-500 text-sm mt-1">Inicia un nuevo proyecto para verlo en el cronograma global.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default GlobalGanttView;
