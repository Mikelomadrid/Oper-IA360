import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Clock, Lock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const TecnicoTaskModal = ({ isOpen, onClose, onSave, task, onAllSubtasksComplete }) => {
    const [subtasks, setSubtasks] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);

    // ✅ NUEVO: Detectar si la tarea está bloqueada (pendiente de revisión o completada)
    const isLocked = task?.estado === 'pendiente_revision' || 
                     task?.estado === 'completada' || 
                     task?.estado === 'completada_validada';

    const fetchSubtasks = useCallback(async () => {
        if (!task) return;
        setIsFetchingDetails(true);
        const { data, error } = await supabase
            .from('v_subtareas_ui')
            .select('id, descripcion_subtarea, completada, fecha_completado')
            .eq('tarea_id', task.id)
            .order('fecha_creacion', { ascending: true });

        if (error) {
            toast({ variant: 'destructive', title: 'Error cargando subtareas', description: error.message });
            setSubtasks([]);
        } else {
            setSubtasks(data || []);
        }
        setIsFetchingDetails(false);
    }, [task]);

    useEffect(() => {
        if (isOpen) {
            fetchSubtasks();
        }
    }, [isOpen, fetchSubtasks]);

    const handleSubtaskToggle = (subtaskId) => {
        setSubtasks(currentSubtasks =>
            currentSubtasks.map(st =>
                st.id === subtaskId ? { ...st, completada: !st.completada } : st
            )
        );
    };

    const handleSubmit = async () => {
        setIsLoading(true);

        const subtasksPayload = subtasks.map(st => ({
            id: st.id,
            completada: st.completada
        }));

        try {
            const { error: rpcError } = await supabase.rpc('api_guardar_progreso_subtareas', {
                p_items: subtasksPayload
            });

            if (rpcError) throw rpcError;
            
            // Re-fetch task details to check for completion
            const { data: updatedTask, error: taskDetailsError } = await supabase
                .from('v_tareas_detalle_para_ui')
                .select('total_subtareas, subtareas_completadas')
                .eq('tarea_id', task.id)
                .single();
            
            if (taskDetailsError) throw taskDetailsError;

            const allDone = updatedTask && updatedTask.total_subtareas > 0 && updatedTask.total_subtareas === updatedTask.subtareas_completadas;

            if (allDone) {
                toast({ 
                    title: '¡Tarea completada!', 
                    description: 'La tarea ha pasado a revisión.',
                    className: 'bg-green-600 text-white'
                });
            } else {
                toast({ title: 'Progreso guardado', description: 'Se han actualizado las subtareas.' });
            }
            
            await onSave();
            onClose();

        } catch (error) {
            console.error('Error saving subtasks via RPC:', error);
            toast({ variant: 'destructive', title: 'Error al guardar', description: error.message });
            fetchSubtasks();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Completar Tarea</DialogTitle>
                    <DialogDescription>Marca las subtareas que has finalizado.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                    {isFetchingDetails ? (
                        <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin" /></div>
                    ) : (
                        <>
                            <div className="space-y-1">
                                <Label className="text-muted-foreground">Tarea</Label>
                                <p className="font-semibold">{task?.titulo}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-muted-foreground">Proyecto</Label>
                                <p className="font-semibold">{task?.nombre_proyecto}</p>
                            </div>
                            <div className="space-y-4 pt-4">
                                <Label className="font-semibold">Subtareas</Label>
                                {subtasks.length > 0 ? subtasks.map((st) => (
                                    <div key={st.id} className="flex items-center space-x-3">
                                        <Checkbox
                                            id={`subtask-${st.id}`}
                                            checked={st.completada}
                                            onCheckedChange={() => handleSubtaskToggle(st.id)}
                                        />
                                        <label
                                            htmlFor={`subtask-${st.id}`}
                                            className={`text-sm font-medium leading-none transition-colors ${st.completada ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                                        >
                                            {st.descripcion_subtarea}
                                        </label>
                                    </div>
                                )) : <p className="text-sm text-muted-foreground">Esta tarea no tiene subtareas definidas.</p>}
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isLoading || isFetchingDetails}>
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Progreso'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default TecnicoTaskModal;
