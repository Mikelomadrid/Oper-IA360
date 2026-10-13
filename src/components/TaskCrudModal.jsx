import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Link2, Loader2, MapPin, Plus, Ruler, X, CalendarPlus as CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TaskCrudModal = ({ isOpen, onClose, onSave, task, defaultProjectId }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [projectId, setProjectId] = useState(defaultProjectId || '');
    const [workItemId, setWorkItemId] = useState('');
    const [plannedQuantity, setPlannedQuantity] = useState('');
    const [plannedUnit, setPlannedUnit] = useState('');
    const [originGeneration, setOriginGeneration] = useState('manual');
    const [employeeIds, setEmployeeIds] = useState([]);
    const [startDate, setStartDate] = useState(null);
    const [deadline, setDeadline] = useState(null);
    const [subtasks, setSubtasks] = useState([{ id: null, descripcion_subtarea: '' }]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [projects, setProjects] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [workItems, setWorkItems] = useState([]);
    const [isFetchingWorkItems, setIsFetchingWorkItems] = useState(false);
    const [workItemsError, setWorkItemsError] = useState('');
    const [teamEmployeeIds, setTeamEmployeeIds] = useState(null);
    const [initialEmployeeIds, setInitialEmployeeIds] = useState([]);

    const fetchDropdownData = useCallback(async () => {
        const { data: projectsData } = await supabase.from('proyectos').select('id, nombre_proyecto').eq('estado', 'activo');
        setProjects(projectsData || []);
        const { data: employeesData, error: employeesError } = await supabase
            .from('empleados')
            .select('id, nombre, apellidos, rol, activo')
            .in('rol', ['tecnico', 'encargado'])
            .eq('activo', true)
            .order('nombre');
        if (employeesError) {
            console.error('No se pudo cargar el selector de empleados', employeesError);
            setEmployees([]);
            return;
        }
        setEmployees((employeesData || []).map((employee) => ({
            ...employee,
            display_name: `${employee.nombre || ''} ${employee.apellidos || ''}`.trim(),
        })));
    }, []);

    useEffect(() => {
        const fetchTaskDetails = async () => {
            if (task) {
                setIsFetchingDetails(true);
                const { data: taskDetails, error: taskDetailsError } = await supabase
                    .from('tareas')
                    .select('id,titulo,descripcion,proyecto_id,empleado_asignado_id,fecha_inicio,fecha_limite,obra_partida_id,cantidad_medible,unidad_medible,origen_generacion')
                    .eq('id', task.id)
                    .single();
                if (taskDetailsError) {
                    toast({ variant: 'destructive', title: 'Error cargando la tarea', description: taskDetailsError.message });
                }
                const currentTask = taskDetails || task;
                setTitle(currentTask.titulo || '');
                setDescription(currentTask.descripcion || '');
                setProjectId(currentTask.proyecto_id || defaultProjectId || '');
                setWorkItemId(currentTask.obra_partida_id || '');
                setPlannedQuantity(currentTask.cantidad_medible ?? '');
                setPlannedUnit(currentTask.unidad_medible || '');
                setOriginGeneration(currentTask.origen_generacion || 'manual');
                setEmployeeIds(currentTask.empleado_asignado_id ? [currentTask.empleado_asignado_id] : []);
                setStartDate(currentTask.fecha_inicio ? new Date(currentTask.fecha_inicio) : null);
                setDeadline(currentTask.fecha_limite ? new Date(currentTask.fecha_limite) : null);

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
                setDescription('');
                setProjectId(defaultProjectId || '');
                setWorkItemId('');
                setPlannedQuantity('');
                setPlannedUnit('');
                setOriginGeneration('manual');
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

    useEffect(() => {
        let cancelled = false;

        const fetchWorkItems = async () => {
            if (!isOpen || !projectId) {
                setWorkItems([]);
                setWorkItemsError('');
                return;
            }

            setIsFetchingWorkItems(true);
            setWorkItemsError('');
            const [itemsResult, linkedResult] = await Promise.all([
                supabase
                    .from('obras_partidas')
                    .select('id,codigo,descripcion,capitulo,zona,cantidad_total,unidad,sistema_id,orden,activa')
                    .eq('obra_id', projectId)
                    .order('orden', { ascending: true }),
                supabase
                    .from('tareas')
                    .select('id,obra_partida_id')
                    .eq('proyecto_id', projectId)
                    .not('obra_partida_id', 'is', null),
            ]);

            if (cancelled) return;
            if (itemsResult.error || linkedResult.error) {
                setWorkItems([]);
                setWorkItemsError(itemsResult.error?.message || linkedResult.error?.message || 'No se pudieron cargar las partidas.');
                setIsFetchingWorkItems(false);
                return;
            }

            const linkedByWorkItem = new Map(
                (linkedResult.data || []).map((row) => [row.obra_partida_id, row.id]),
            );
            const nextItems = (itemsResult.data || [])
                .filter((item) => item.activa || item.id === workItemId)
                .map((item) => ({ ...item, linkedTaskId: linkedByWorkItem.get(item.id) || null }));
            setWorkItems(nextItems);
            setIsFetchingWorkItems(false);
        };

        fetchWorkItems();
        return () => { cancelled = true; };
    }, [isOpen, projectId, task?.id, workItemId]);

    useEffect(() => {
        const fetchProjectTeam = async () => {
            if (!isOpen || !projectId) {
                setTeamEmployeeIds(null);
                return;
            }
            const { data, error } = await supabase
                .from('obra_equipo')
                .select('empleado_id')
                .eq('proyecto_id', projectId)
                .eq('activo', true);

            if (error) {
                console.error('No se pudo cargar el equipo de obra', error);
                setTeamEmployeeIds(null);
                return;
            }
            setTeamEmployeeIds(new Set((data || []).map((item) => item.empleado_id)));
        };
        fetchProjectTeam();
    }, [isOpen, projectId]);

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

    const selectedWorkItem = useMemo(
        () => workItems.find((item) => item.id === workItemId) || null,
        [workItems, workItemId],
    );

    const availableWorkItems = useMemo(
        () => workItems.filter((item) => !item.linkedTaskId || item.linkedTaskId === task?.id),
        [workItems, task?.id],
    );

    const isFormReady = Boolean(
        title.trim().length >= 3
        && projectId
        && workItemId
        && plannedUnit.trim()
        && Number(plannedQuantity) > 0,
    );

    const handleProjectChange = (nextProjectId) => {
        setProjectId(nextProjectId);
        setWorkItemId('');
        setPlannedQuantity('');
        setPlannedUnit('');
        setTitle('');
        setDescription('');
    };

    const handleWorkItemChange = (nextWorkItemId) => {
        const nextWorkItem = workItems.find((item) => item.id === nextWorkItemId);
        setWorkItemId(nextWorkItemId);
        if (!nextWorkItem) return;

        setPlannedQuantity(nextWorkItem.cantidad_total ?? '');
        setPlannedUnit(nextWorkItem.unidad || '');
        if (!task) {
            const sourceTitle = [nextWorkItem.codigo, nextWorkItem.descripcion].filter(Boolean).join(' · ');
            setTitle(sourceTitle.slice(0, 255));
            setDescription(nextWorkItem.descripcion || '');
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
        if (!workItemId) {
            toast({ variant: 'destructive', title: 'Partida requerida', description: 'Selecciona la partida de esta obra que origina la tarea.' });
            return;
        }
        if (!selectedWorkItem) {
            toast({ variant: 'destructive', title: 'Partida no disponible', description: 'Actualiza el formulario y selecciona una partida activa de la obra.' });
            return;
        }
        if (selectedWorkItem.linkedTaskId && selectedWorkItem.linkedTaskId !== task?.id) {
            toast({ variant: 'destructive', title: 'Partida ya vinculada', description: 'Esta partida ya tiene una tarea operativa. Edita esa tarea en lugar de crear otra.' });
            return;
        }
        const parsedQuantity = Number(plannedQuantity);
        if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
            toast({ variant: 'destructive', title: 'Medición requerida', description: 'Indica una cantidad prevista mayor que cero.' });
            return;
        }
        if (!plannedUnit.trim()) {
            toast({ variant: 'destructive', title: 'Unidad requerida', description: 'La partida debe tener una unidad de medición antes de crear la tarea.' });
            return;
        }
        if (employeeIds.length === 0) {
            toast({ variant: 'destructive', title: 'Técnico requerido', description: 'Debes asignar la tarea a al menos un técnico.' });
            return;
        }
        if (teamEmployeeIds && employeeIds.some((employeeId) => !teamEmployeeIds.has(employeeId))) {
            toast({
                variant: 'destructive',
                title: 'Técnico fuera del equipo de obra',
                description: 'El encargado debe incluir primero a esa persona en el equipo de la obra.',
            });
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
                    p_descripcion: description.trim() || null,
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
                        descripcion: description.trim() || null,
                        fecha_limite: deadline ? format(deadline, 'yyyy-MM-dd') : null,
                        fecha_inicio: startDate ? format(startDate, 'yyyy-MM-dd') : null,
                        obra_partida_id: workItemId,
                        cantidad_medible: parsedQuantity,
                        unidad_medible: plannedUnit.trim(),
                        origen_generacion: 'manual',
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
                        .update({
                            fecha_inicio: format(startDate, 'yyyy-MM-dd'),
                            descripcion: description.trim() || null,
                            ...(originGeneration !== 'presupuesto_aceptado' ? { obra_partida_id: workItemId } : {}),
                            cantidad_medible: parsedQuantity,
                            unidad_medible: plannedUnit.trim(),
                        })
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
                    const fechaNombre = format(startDate, 'dd-MM-yy'); // ej: 26-03-26

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

            onSave({
                taskId: newlySavedTaskId,
                projectId,
                fechaInicio: startDate ? format(startDate, 'yyyy-MM-dd') : null,
                fechaLimite: deadline ? format(deadline, 'yyyy-MM-dd') : null,
                workItemId,
                cantidadMedible: parsedQuantity,
                unidadMedible: plannedUnit.trim(),
                isNew: !task,
            });
        } catch (error) {
            console.error('Error saving task:', error);
            toast({ variant: 'destructive', title: 'Error al guardar', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };


    const selectableEmployees = teamEmployeeIds
        ? employees.filter((employee) => teamEmployeeIds.has(employee.id) || employeeIds.includes(employee.id))
        : employees;
    const teamIsEmpty = teamEmployeeIds && teamEmployeeIds.size === 0;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[720px]">
                <DialogHeader>
                    <DialogTitle>{task ? 'Editar Tarea' : 'Crear Nueva Tarea'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    {isFetchingDetails ? <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin" /></div> : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="project">Proyecto</Label>
                                    <Select value={projectId} onValueChange={handleProjectChange} disabled={!!defaultProjectId || !!task}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar proyecto..." /></SelectTrigger>
                                        <SelectContent>
                                            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_proyecto}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Técnicos Asignados</Label>
                                    {teamIsEmpty && (
                                        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs leading-5 text-amber-800">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                            El encargado debe formar primero el equipo de esta obra desde Dashboard → Equipo de obra.
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {employeeIds.map(eid => {
                                            const emp = selectableEmployees.find(e => e.id === eid);
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
                                        disabled={teamIsEmpty}
                                        onValueChange={(val) => {
                                            if (val && !employeeIds.includes(val)) {
                                                setEmployeeIds(prev => [...prev, val]);
                                            }
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Añadir técnico..." /></SelectTrigger>
                                        <SelectContent>
                                            {selectableEmployees.filter(e => !employeeIds.includes(e.id)).map(e => (
                                                <SelectItem key={e.id} value={e.id}>{e.display_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid gap-3 rounded-lg border border-violet-100 bg-violet-50/40 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 rounded-md border border-violet-100 bg-white p-2 text-violet-700">
                                        <Link2 className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <Label className="text-sm font-semibold text-slate-900">Partida de origen *</Label>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                            Solo se muestran partidas de esta obra. Este vínculo permitirá comparar lo previsto con el tiempo y coste reales.
                                        </p>
                                    </div>
                                </div>

                                {workItemsError ? (
                                    <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        {workItemsError}
                                    </div>
                                ) : (
                                    <Select
                                        value={workItemId}
                                        onValueChange={handleWorkItemChange}
                                        disabled={!projectId || isFetchingWorkItems || originGeneration === 'presupuesto_aceptado'}
                                    >
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder={isFetchingWorkItems ? 'Cargando partidas…' : 'Seleccionar partida de esta obra…'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {workItems.map((item) => {
                                                const occupied = item.linkedTaskId && item.linkedTaskId !== task?.id;
                                                const label = [item.codigo, item.descripcion].filter(Boolean).join(' · ');
                                                return (
                                                    <SelectItem key={item.id} value={item.id} disabled={occupied}>
                                                        {label}{occupied ? ' — ya tiene tarea' : ''}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                )}

                                {originGeneration === 'presupuesto_aceptado' && selectedWorkItem && (
                                    <div className="flex gap-2 rounded-md border border-violet-200 bg-white p-3 text-xs leading-5 text-violet-800">
                                        <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
                                        Tarea generada automáticamente desde el presupuesto aceptado. La partida de origen queda protegida; puedes ajustar la medición, el equipo y la planificación.
                                    </div>
                                )}

                                {!isFetchingWorkItems && !workItemsError && projectId && workItems.length === 0 && (
                                    <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        Esta obra no tiene partidas activas disponibles. Crea o revisa primero sus partidas de obra.
                                    </div>
                                )}

                                {!isFetchingWorkItems && !workItemsError && workItems.length > 0 && availableWorkItems.length === 0 && (
                                    <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        Todas las partidas de esta obra ya tienen una tarea asociada. Edita la tarea existente en lugar de crear un duplicado.
                                    </div>
                                )}

                                {selectedWorkItem && (
                                    <div className="rounded-md border border-violet-100 bg-white p-3">
                                        <p className="text-sm font-medium leading-5 text-slate-900">{selectedWorkItem.descripcion}</p>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                            {selectedWorkItem.capitulo && <span>{selectedWorkItem.capitulo}</span>}
                                            {selectedWorkItem.zona && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{selectedWorkItem.zona}</span>}
                                            <span className="flex items-center gap-1"><Ruler className="h-3 w-3" />Medición contractual</span>
                                        </div>
                                        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_120px] gap-3">
                                            <div className="grid gap-1.5">
                                                <Label htmlFor="planned-quantity" className="text-xs">Cantidad prevista *</Label>
                                                <Input
                                                    id="planned-quantity"
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={plannedQuantity}
                                                    onChange={(event) => setPlannedQuantity(event.target.value)}
                                                    className="bg-slate-50 tabular-nums"
                                                />
                                            </div>
                                            <div className="grid gap-1.5">
                                                <Label htmlFor="planned-unit" className="text-xs">Unidad *</Label>
                                                <Input id="planned-unit" value={plannedUnit} readOnly className="bg-slate-50 font-mono" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="title">Título operativo *</Label>
                                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                                <p className="text-xs text-slate-500">Debe identificar el trabajo en el móvil sin sustituir la descripción contractual.</p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="description">Indicaciones para el equipo</Label>
                                <Textarea
                                    id="description"
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                    rows={3}
                                    maxLength={1200}
                                    placeholder="Alcance, estancia, condiciones, materiales o precauciones relevantes…"
                                />
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
                    <Button onClick={handleSubmit} disabled={isLoading || isFetchingDetails || !isFormReady}>
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Tarea'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default TaskCrudModal;
