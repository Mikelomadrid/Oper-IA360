import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2, ServerCrash, Inbox, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TaskCard from '@/components/TaskCard';
import TaskCrudModal from '@/components/TaskCrudModal';
import RevisionTareaModal from '@/components/RevisionTareaModal';
import EvidenciasTareaModal from '@/components/EvidenciasTareaModal';

const ProjectTasks = ({ projectId }) => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [crudModalState, setCrudModalState] = useState({ isOpen: false, task: null });
    const [evidenciasModalState, setEvidenciasModalState] = useState({ isOpen: false, task: null, subtaskId: null, uploadBucket: null, uploadPrefix: null, readOnly: false });
    const [revisionModalState, setRevisionModalState] = useState({ isOpen: false, task: null });
    const { sessionRole } = useAuth();
    const [savingSubtaskId, setSavingSubtaskId] = useState(null);
    const [lastRefreshAt, setLastRefreshAt] = useState(null);

    const canManage = useMemo(() => sessionRole.rol === 'admin' || sessionRole.rol === 'encargado', [sessionRole.rol]);

    const fetchTasksWithDetails = useCallback(async (query) => {
        const { data: tasksData, error: tasksError } = await query;
        if (tasksError) throw tasksError;
        if (tasksData.length === 0) return [];

        const taskIds = tasksData.map(t => t.id);
        const [subtasksRes, revisionsRes, assignmentsRes] = await Promise.all([
            supabase.from('v_subtareas_ui').select('*').in('tarea_id', taskIds),
            supabase.from('v_tarea_ultima_revision').select('*').in('tarea_id', taskIds),
            supabase.from('tarea_empleados').select('*').in('tarea_id', taskIds)
        ]);

        if (subtasksRes.error) throw subtasksRes.error;

        const subtasksByTaskId = subtasksRes.data.reduce((acc, st) => {
            if (!acc[st.tarea_id]) acc[st.tarea_id] = [];
            acc[st.tarea_id].push(st);
            return acc;
        }, {});

        const revisionsByTaskId = revisionsRes.data?.reduce((acc, r) => {
            acc[r.tarea_id] = r;
            return acc;
        }, {}) || {};

        const asignadosByTaskId = assignmentsRes.data?.reduce((acc, a) => {
            if (!acc[a.tarea_id]) acc[a.tarea_id] = [];
            acc[a.tarea_id].push(a);
            return acc;
        }, {}) || {};

        return tasksData.map(task => ({
            ...task,
            subtareas: (subtasksByTaskId[task.id] || []).sort((a, b) => new Date(a.fecha_creacion) - new Date(b.fecha_creacion)),
            ultima_revision: revisionsByTaskId[task.id] || null,
            asignados: asignadosByTaskId[task.id] || []
        }));
    }, []);

    const fetchData = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        setError(null);
        try {
            let query = supabase.from('v_tareas_ui')
                .select('id,titulo,descripcion,proyecto_id,empleado_asignado_id,estado,fecha_creacion,evidencias_count,nombre_proyecto,tecnico_nombre,fecha_limite')
                .eq('proyecto_id', projectId)
                .order('fecha_creacion', { ascending: false });

            const fetchedTasks = await fetchTasksWithDetails(query);
            setTasks(fetchedTasks);
            setLastRefreshAt(new Date().toISOString());
        } catch (e) {
            setError(e);
            toast({ variant: 'destructive', title: 'Error al cargar tareas', description: e.message });
        } finally {
            setLoading(false);
        }
    }, [projectId, fetchTasksWithDetails]);

    const refetchSingleTask = useCallback(async (taskId) => {
        if (!taskId) return;
        try {
            const { data: updatedTaskData, error: taskError } = await supabase
                .from('v_tareas_ui')
                .select('id,titulo,descripcion,proyecto_id,empleado_asignado_id,estado,fecha_creacion,evidencias_count,nombre_proyecto,tecnico_nombre,fecha_limite')
                .eq('id', taskId)
                .single();
            if (taskError) throw taskError;

            const [subtasksRes, revisionRes] = await Promise.all([
                supabase.from('v_subtareas_ui').select('*').eq('tarea_id', taskId).order('fecha_creacion', { ascending: true }),
                supabase.from('v_tarea_ultima_revision').select('*').eq('tarea_id', taskId).single()
            ]);

            if (subtasksRes.error) throw subtasksRes.error;

            const fullUpdatedTask = {
                ...updatedTaskData,
                subtareas: subtasksRes.data || [],
                ultima_revision: revisionRes.data || null
            };

            setTasks(currentTasks => currentTasks.map(task => task.id === taskId ? fullUpdatedTask : task));
            setLastRefreshAt(new Date().toISOString());
        } catch (error) {
            toast({ variant: "destructive", title: "Error al refrescar la tarea", description: error.message });
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSubtaskToggle = async (taskId, subtask, isChecked) => {
        setSavingSubtaskId(subtask.id);
        try {
            const { data, error } = await supabase.rpc('marcar_subtarea_y_revisar_api', { p_subtarea_id: subtask.id, p_completada: isChecked });
            if (error) {
                toast({ variant: 'destructive', title: 'Error al actualizar', description: error.message });
                await refetchSingleTask(taskId);
                return;
            }
            if (data?.requires_evidencias) {
                const taskToOpen = tasks.find(t => t.id === taskId);
                if (taskToOpen) {
                    setEvidenciasModalState({
                        isOpen: true,
                        task: taskToOpen,
                        subtaskId: subtask.id,
                        uploadBucket: 'tarea_evidencias',
                        uploadPrefix: data.upload_prefix || `tarea_evidencias/${data.tarea_id}/`,
                        readOnly: false
                    });
                }
            } else {
                toast({ title: 'Subtarea actualizada' });
            }
            await refetchSingleTask(data?.tarea_id || taskId);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error inesperado', description: 'Error al marcar la subtarea' });
            await refetchSingleTask(taskId);
        } finally {
            setSavingSubtaskId(null);
        }
    };

    const handleDeleteTask = async (taskId) => {
        try {
            await supabase.from('subtareas').delete().eq('tarea_id', taskId);
            await supabase.from('tareas').delete().eq('id', taskId);
            toast({ title: 'Tarea eliminada' });
            fetchData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al eliminar', description: error.message });
        }
    };

    if (loading) return <div className="flex items-center justify-center p-8 h-64"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
    if (error) return <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-destructive/50"><ServerCrash className="w-16 h-16 text-destructive mb-4" /><h2 className="text-2xl font-bold text-destructive mb-2">Error</h2><p className="text-muted-foreground mb-4">{error.message}</p><Button onClick={fetchData}><RefreshCw className="mr-2 h-4 w-4" /> Reintentar</Button></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-sm text-muted-foreground font-mono">Tareas cargadas: {tasks.length} — Refrescado: {lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString() : 'nunca'}</p>
                </div>
                {canManage && (
                    <Button onClick={() => setCrudModalState({ isOpen: true, task: null })}>
                        <Plus className="mr-2 h-4 w-4" /> Crear Tarea
                    </Button>
                )}
            </div>

            <AnimatePresence>
                {tasks.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {tasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onSubtaskToggle={handleSubtaskToggle}
                                canManage={canManage}
                                onEdit={(t) => setCrudModalState({ isOpen: true, task: t })}
                                onDelete={handleDeleteTask}
                                onRevisar={(t) => setRevisionModalState({ isOpen: true, task: t })}
                                onShowEvidences={(t) => setEvidenciasModalState({ isOpen: true, task: t, readOnly: true })}
                                savingSubtaskId={savingSubtaskId}
                                sessionEmployeeId={sessionRole.empleadoId}
                            />
                        ))}
                    </div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-lg border border-dashed mt-8">
                        <Inbox className="w-20 h-20 text-primary/50 mb-4" />
                        <h3 className="text-xl font-semibold">No hay tareas</h3>
                        <p className="text-muted-foreground mt-2">Este proyecto todavía no tiene tareas asignadas.</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <TaskCrudModal
                isOpen={crudModalState.isOpen}
                onClose={() => setCrudModalState({ isOpen: false, task: null })}
                onSave={fetchData}
                task={crudModalState.task}
                defaultProjectId={projectId}
            />
            <RevisionTareaModal
                isOpen={revisionModalState.isOpen}
                onClose={() => setRevisionModalState({ isOpen: false, task: null })}
                task={revisionModalState.task}
                onSave={() => refetchSingleTask(revisionModalState.task?.id)}
            />
            <EvidenciasTareaModal
                isOpen={evidenciasModalState.isOpen}
                onClose={() => {
                    setEvidenciasModalState({ isOpen: false, task: null, subtaskId: null, readOnly: false });
                    if (evidenciasModalState.task) refetchSingleTask(evidenciasModalState.task.id);
                }}
                task={evidenciasModalState.task}
                subtaskId={evidenciasModalState.subtaskId}
                uploadBucket={evidenciasModalState.uploadBucket}
                uploadPrefix={evidenciasModalState.uploadPrefix}
                onUploadComplete={() => refetchSingleTask(evidenciasModalState.task.id)}
                readOnly={evidenciasModalState.readOnly}
            />
        </div>
    );
};

export default ProjectTasks;