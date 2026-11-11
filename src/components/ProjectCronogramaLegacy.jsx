import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CalendarDays, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const formatDate = (value) => {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleDateString('es-ES');
};

const ProjectCronogramaLegacy = ({ projectId }) => {
    const { data: tasks = [], isLoading, error } = useQuery({
        queryKey: ['project_cronograma_basic', projectId],
        enabled: !!projectId,
        queryFn: async () => {
            const { data, error: queryError } = await supabase
                .from('tareas')
                .select('id, titulo, descripcion, estado, fecha_inicio, fecha_limite, fecha_creacion')
                .eq('proyecto_id', projectId)
                .order('fecha_inicio', { ascending: true, nullsFirst: false })
                .order('fecha_creacion', { ascending: true });
            if (queryError) throw queryError;
            return data || [];
        },
    });

    if (isLoading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (error) {
        return <Card className="border-destructive/40"><CardContent className="p-6 text-center text-destructive">No se pudo cargar el cronograma: {error.message}</CardContent></Card>;
    }

    const datedTasks = tasks.filter(task => task.fecha_inicio || task.fecha_limite);
    const rangeStart = datedTasks.reduce((min, task) => {
        const value = new Date(task.fecha_inicio || task.fecha_limite);
        return value < min ? value : min;
    }, new Date());
    const rangeEnd = datedTasks.reduce((max, task) => {
        const value = new Date(task.fecha_limite || task.fecha_inicio);
        return value > max ? value : max;
    }, new Date());
    const totalDays = Math.max(1, Math.ceil((rangeEnd - rangeStart) / 86400000) + 1);
    const position = (value, fallback) => Math.max(0, Math.min(100, ((new Date(value || fallback) - rangeStart) / 86400000 / totalDays) * 100));
    const width = (task) => Math.max(1.5, position(task.fecha_limite, task.fecha_inicio) - position(task.fecha_inicio, task.fecha_limite));
    const markers = Array.from({ length: 7 }, (_, index) => index);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5" /> Cronograma de la obra</CardTitle>
            </CardHeader>
            <CardContent>
                {tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                        <CalendarDays className="h-10 w-10 opacity-40" />
                        <p>No hay tareas asignadas a esta obra.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="min-w-[900px]">
                            <div className="mb-2 grid grid-cols-[260px_minmax(0,1fr)] text-xs text-muted-foreground">
                                <div />
                                <div className="grid grid-cols-7">
                                    {markers.map((marker) => {
                                        const date = new Date(rangeStart.getTime() + ((totalDays - 1) * marker / 6) * 86400000);
                                        return <div key={marker} className="border-l px-2 py-1">{formatDate(date)}</div>;
                                    })}
                                </div>
                            </div>
                            <div className="space-y-2">
                                {tasks.map((task) => {
                                    const start = task.fecha_inicio || task.fecha_limite;
                                    const left = position(start, rangeStart);
                                    return (
                                        <div key={task.id} className="grid grid-cols-[260px_minmax(0,1fr)] items-center gap-3 rounded border p-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium">{task.titulo || task.descripcion || 'Tarea sin título'}</p>
                                                <p className="text-xs text-muted-foreground">{formatDate(task.fecha_inicio)} → {formatDate(task.fecha_limite)}</p>
                                            </div>
                                            <div className="relative h-8 rounded bg-slate-50" style={{ backgroundImage: 'linear-gradient(to right, rgba(148,163,184,.25) 1px, transparent 1px)', backgroundSize: '14.2857% 100%' }}>
                                                <div className="absolute top-1/2 h-5 -translate-y-1/2 rounded bg-blue-600 px-2 text-[10px] leading-5 text-white shadow" style={{ left: `${left}%`, width: `${width(task)}%` }} title={`${task.titulo || 'Tarea'}: ${formatDate(task.fecha_inicio)} - ${formatDate(task.fecha_limite)}`}>
                                                    <span className="block truncate">{String(task.estado || 'pendiente').replaceAll('_', ' ')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ProjectCronogramaLegacy;
