import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Plus, X, CalendarPlus as CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TaskCrudModal = ({ isOpen, onClose, onSave, task, defaultProjectId }) => {
    const [title, setTitle] = useState('');
    const [projectId, setProjectId] = useState(defaultProjectId || '');
    const [employeeIds, setEmployeeIds] = useState([]);
    const [startDate, setStartDate] = useState(null);
    const [deadline, setDeadline] = useState(null);
    const [subtasks, setSubtasks] = useState([{ id: null, descripcion_subtarea: '' }]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [projects, setProjects] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [initialEmployeeIds, setInitialEmployeeIds] = useState([]);

    const fetchDropdownData = useCallback(async () => {
        const { data: projectsData } = await supabase.from('proyectos').select('id, nombre_proyecto').eq('estado', 'activo');
        setProjects(projectsData || []);
        const { data: employeesData } = await supabase.from('v_empleados_selector').select('*').in('rol', ['tecnico', 'encargado']);
        setEmployees(employeesData || []);
    }, []);

    useEffect(() => {
        const fetchTaskDetails = async () => {
            if (task) {
                setIsFetchingDetails(true);
                setTitle(task.titulo);
                setProjectId(task.proyecto_id);
                setEmployeeIds(task.empleado_asignado_id ? [task.empleado_asignado_id] : []);
                setStartDate(task.fecha_inicio ? new Date(task.fecha_inicio) : null);
                setDeadline(task.fecha_limite ? new Date(task.fecha_limite) : null);

                const { data: subtasksData, error } = await supabase
                    .from('subtareas')
                    .select('id, descripcion_subtarea, completada')
                    .eq('tarea_id', task.id)
                    .order('fecha_creacion', { ascending: true });

                if (error) {
                    toast({ variant: 'destructive', title: 'Error cargando subtareas', description: error.message });
                    setSubtasks([{ id: null, descripcion_subtarea: '' }]);
                } else {
                    setSubtasks(subtasksData.length > 0 ? subtasksData : [{ id: null, descripcion_subtarea: '' }]);
                }
                setIsFetchingDetails(false);
            } else {
                setTitle('');
                setProjectId(defaultProjectId || '');
                setEmployeeIds([]);
                setInitialEmployeeIds([]);
                setStartDate(null);
                setDeadline(null);
                setSubtasks([{ id: null, descripcion_subtarea: '' }]);
            }
        };

        if (isOpen) {
            fetchDropdownData();
            fetchTaskDetails();
        }
    }, [task, isOpen, defaultProjectId, fetchDropdownData]);

    // Re-fetch all assignees if editing existing task
    useEffect(() => {
        const fetchMultipleTechs = async () => {
            if (isOpen && task && task.id) {
                const { data, error } = await supabase.from('tarea_empleados').select('empleado_id').eq('tarea_id', task.id);
                if (!error && data && data.length > 0) {
                    const eids = data.map(d => d.empleado_id);
                    setEmployeeIds(eids);
                    setInitialEmployeeIds(eids);
                }
            }
        };
        fetchMultipleTechs();
    }, [task, isOpen]);


    const handleSubtaskChange = (index, value) => {
        const newSubtasks = [...subtasks];
        newSubtasks[index].descripcion_subtarea = value;
        setSubtasks(newSubtasks);
    };

    const addSubtask = () => setSubtasks([...subtasks, { id: null, descripcion_subtarea: '' }]);

    const removeSubtask = (index) => {
        if (subtasks.length > 1) {
            setSubtasks(subtasks.filter((_, i) => i !== index));
        } else {
            setSubtasks([{ id: null, descripcion_subtarea: '' }]);
        }
    };

    const handleSubmit = async () => {
        if (!title.trim() || title.trim().length < 3) {
            toast({ variant: 'destructive', title: 'Título inválido', description: 'El título es obligatorio y debe tener al menos 3 caracteres.' });
            return;
        }
        if (!projectId) {
            toast({ variant: 'destructive', title: 'Proyecto requerido', description: 'Debes seleccionar un proyecto.' });
            return;
        }
        if (employeeIds.length === 0) {
            toast({ variant: 'destructive', title: 'Técnico requerido', description: 'Debes asignar la tarea a al menos un técnico.' });
            return;
        }

        if (!startDate) {
            toast({ variant: 'destructive', title: 'Fecha de inicio requerida', description: 'Debes indicar cuándo empieza la tarea.' });
            return;
        }

        if (deadline && startDate > deadline) {
            toast({ variant: 'destructive', title: 'Fechas incongruentes', description: 'La fecha límite no puede ser anterior a la de inicio.' });
            return;
        }

        setIsLoading(true);

        const subtasksPayload = subtasks
            .map(st => ({
                id: st.id,
                descripcion_subtarea: st.descripcion_subtarea.trim()
            }))
            .filter(st => st.descripcion_subtarea.length > 0);

        try {
            let newlySavedTaskId = task?.id;

            if (task) {
                const { error } = await supabase.rpc('tarea_update_preservando_subtareas', {
                    p_tarea_id: task.id,
                    p_titulo: title.trim(),
                    p_empleado_asignado_id: employeeIds[0], // primary assignee for legacy code
                    p_fecha_limite: deadline ? format(deadline, 'yyyy-MM-dd') : null,
                    p_subtareas: subtasksPayload,
                    p_descripcion: null,
                });
                if (error) throw error;
                toast({ title: 'Tarea actualizada con éxito' });
            } else {
                // Use robust direct insertion to guarantee we get the newly generated ID back immediately.
                const { data: newTasks, error: taskError } = await supabase
                    .from('tareas')
                    .insert({
                        proyecto_id: projectId,
                        empleado_asignado_id: employeeIds[0], // primary assignee for legacy code
                        titulo: title.trim(),
                        descripcion: null,
                        fecha_limite: deadline ? format(deadline, 'yyyy-MM-dd') : null,
                        fecha_inicio: startDate ? format(startDate, 'yyyy-MM-dd') : null,
                        estado: 'pendiente' // Default status
                    })
                    .select('id');

                if (taskError) throw taskError;

                newlySavedTaskId = newTasks[0].id;

                if (subtasksPayload.length > 0) {
                    const stInserts = subtasksPayload.map(st => ({
                        tarea_id: newlySavedTaskId,
                        descripcion_subtarea: st.descripcion_subtarea
                    }));
                    const { error: subError } = await supabase.from('subtareas').insert(stInserts);
                    if (subError) console.error("Error inserting subtasks", subError);
                }

                toast({ title: 'Tarea creada con éxito' });
            }

            // At this point we are 100% sure we have the correct Task ID for associations
            if (newlySavedTaskId) {
                const finalIdToUpdate = newlySavedTaskId;

                // Update fecha_inicio for edited tasks since RPC doesn't handle it
                if (task) {
                    const { error: updateError } = await supabase
                        .from('tareas')
                        .update({ fecha_inicio: format(startDate, 'yyyy-MM-dd') })
                        .eq('id', finalIdToUpdate);
                    if (updateError) console.error("Could not update fecha_inicio", updateError);
                }

                // Now save the relation to multiple assignees
                // 1. Delete existing (if any)
                await supabase.from('tarea_empleados').delete().eq('tarea_id', finalIdToUpdate);
                // 2 & 3. Assign technicians and send notifications (using RPC to bypass RLS)
                for (const eid of employeeIds) {
                    const isNewAssignee = !initialEmployeeIds.includes(eid);
                    let notificationMsg = null;

                    if (isNewAssignee) {
                        const projectName = projects.find(p => p.id === projectId)?.nombre_proyecto || 'Proyecto Desconocido';
                        notificationMsg = task
                            ? `Se te ha asignado una tarea existente: "${title.trim()}" en el proyecto ${projectName}.`
                            : `Se te ha asignado una nueva tarea: "${title.trim()}" en el proyecto ${projectName}.`;
                    }

                    const { error: rpcError } = await supabase.rpc('asignar_tecnico_tarea_forzado', {
                        p_tarea_id: finalIdToUpdate,
                        p_empleado_id: eid,
                        p_mensaje_notificacion: notificationMsg
                    });

                    if (rpcError) {
                        console.error("Error forzando asignación de técnico", eid, rpcError);
                        toast({ variant: 'destructive', title: 'Error asignando técnico', description: rpcError.message });
                    }
                }
            }

            // ── Creación automática de carpetas de fotos ──────────────────
            // Solo al crear tarea nueva (no al editar) y si hay fecha de inicio y técnicos
            if (!task && projectId && startDate && employeeIds.length > 0) {
                try {
                    const fechaNombre = format(startDate, 'dd-M-yyyy'); // ej: 26-3-2026

                    // 1. Buscar si ya existe la carpeta del día en la raíz (carpeta_padre_id null)
                    const { data: existentes } = await supabase
                        .from('carpetas')
                        .select('id, nombre')
                        .eq('proyecto_id', projectId)
                        .eq('tipo', 'foto')
                        .is('carpeta_padre_id', null)
                        .eq('nombre', fechaNombre);

                    let carpetaDiaId;

                    if (existentes && existentes.length > 0) {
                        // Ya existe la carpeta del día
                        carpetaDiaId = existentes[0].id;
                    } else {
                        // Crear carpeta del día
                        const { data: nuevaCarpetaDia, error: errDia } = await supabase
                            .from('carpetas')
                            .insert({ proyecto_id: projectId, nombre: fechaNombre, carpeta_padre_id: null, tipo: 'foto' })
                            .select('id')
                            .single();
                        if (!errDia) carpetaDiaId = nuevaCarpetaDia.id;
                    }

                    if (carpetaDiaId) {
                        // 2. Para cada técnico asignado, crear subcarpeta con su nombre si no existe
                        const { data: subcarpetasExistentes } = await supabase
                            .from('carpetas')
                            .select('nombre')
                            .eq('proyecto_id', projectId)
                            .eq('tipo', 'foto')
                            .eq('carpeta_padre_id', carpetaDiaId);

                        const nombresExistentes = new Set((subcarpetasExistentes || []).map(c => c.nombre.toUpperCase()));

                        for (const eid of employeeIds) {
                            const emp = employees.find(e => e.id === eid);
                            if (!emp) continue;
                            const nombreTecnico = emp.nombre?.toUpperCase().trim();
                            if (!nombreTecnico || nombresExistentes.has(nombreTecnico)) continue;

                            await supabase.from('carpetas').insert({
                                proyecto_id: projectId,
                                nombre: nombreTecnico,
                                carpeta_padre_id: carpetaDiaId,
                                tipo: 'foto',
                                created_by: eid
                            });
                        }
                    }
                } catch (carpetaErr) {
                    // No bloqueamos el guardado si falla la creación de carpetas
                    console.error('Error creando carpetas automáticas:', carpetaErr);
                }
            }
            // ─────────────────────────────────────────────────────────────

            onSave();
        } catch (error) {
            console.error('Error saving task:', error);
            toast({ variant: 'destructive', title: 'Error al guardar', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{task ? 'Editar Tarea' : 'Crear Nueva Tarea'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    {isFetchingDetails ? <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin" /></div> : (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="title">Título</Label>
                                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="project">Proyecto</Label>
                                    <Select value={projectId} onValueChange={setProjectId} disabled={!!defaultProjectId || !!task}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar proyecto..." /></SelectTrigger>
                                        <SelectContent>
                                            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_proyecto}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Técnicos Asignados</Label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {employeeIds.map(eid => {
                                            const emp = employees.find(e => e.id === eid);
                                            return emp ? (
                                                <div key={eid} className="flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-700 text-xs px-2 py-1 rounded-full">
                                                    <span>{emp.display_name}</span>
                                                    <button type="button" onClick={() => setEmployeeIds(prev => prev.filter(id => id !== eid))} className="hover:text-red-500 ml-1">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                    <Select
                                        value=""
                                        onValueChange={(val) => {
                                            if (val && !employeeIds.includes(val)) {
                                                setEmployeeIds(prev => [...prev, val]);
                                            }
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Añadir técnico..." /></SelectTrigger>
                                        <SelectContent>
                                            {employees.filter(e => !employeeIds.includes(e.id)).map(e => (
                                                <SelectItem key={e.id} value={e.id}>{e.display_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Subtareas</Label>
                                {subtasks.map((st, index) => (
                                    <div key={st.id || `new-${index}`} className="flex items-center gap-2">
                                        <Input
                                            value={st.descripcion_subtarea}
                                            onChange={(e) => handleSubtaskChange(index, e.target.value)}
                                            placeholder={`Subtarea ${index + 1}`}
                                            maxLength="200"
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => removeSubtask(index)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={addSubtask} className="mt-2"><Plus className="h-4 w-4 mr-2" /> Añadir subtarea</Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="startdate">Fecha Inicio</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className="justify-start text-left font-normal">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {startDate ? format(startDate, "PPP", { locale: es }) : <span>Elige inicio</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="deadline">Fecha Límite</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className="justify-start text-left font-normal">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {deadline ? format(deadline, "PPP", { locale: es }) : <span>Elige límite</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isLoading || isFetchingDetails}>
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Tarea'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default TaskCrudModal;