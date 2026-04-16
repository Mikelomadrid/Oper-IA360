import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Loader2, ServerCrash, Inbox, Plus, Filter, LayoutGrid, List, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, PlayCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import TaskCard from '@/components/TaskCard';
import TaskCrudModal from '@/components/TaskCrudModal';
import TecnicoTaskModal from '@/components/TecnicoTaskModal';
import RevisionTareaModal from '@/components/RevisionTareaModal';
import EvidenciasTareaModal from '@/components/EvidenciasTareaModal';
import SeleccionTareaModal from '@/components/SeleccionTareaModal';
import { cn } from '@/lib/utils';

const Tareas = ({ forcedProjectId }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalState, setModalState] = useState({ isOpen: false, task: null, type: null });
  const [revisionModalState, setRevisionModalState] = useState({ isOpen: false, task: null });
  const [evidenciasModalState, setEvidenciasModalState] = useState({ isOpen: false, task: null, subtaskId: null, readOnly: true, onUploadComplete: null });
  const [viewMode, setViewMode] = useState('cluster'); // 'cluster' | 'list'

  // New state for completed tasks tab
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

  const [projects, setProjects] = useState([]);
  const { sessionRole, user, loadingAuth } = useAuth();
  const [filterProjectId, setFilterProjectId] = useState(forcedProjectId || 'all');
  const [currentEmployeeId, setCurrentEmployeeId] = useState(null);

  // ✅ NUEVO: Estado del fichaje actual del técnico
  const [fichajeActual, setFichajeActual] = useState({
    fichajeId: null,
    proyectoId: null,
    nombreUbicacion: null,
    loading: true
  });

  // ✅ NUEVO: Para abrir modal de selección de tarea
  const [seleccionTareaModalOpen, setSeleccionTareaModalOpen] = useState(false);
  const [tieneTareaActiva, setTieneTareaActiva] = useState(false);

  const canManage = useMemo(() => sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado' || sessionRole?.rol === 'manager', [sessionRole]);

  // Filter tasks
  const activeTasks = useMemo(() => tasks.filter(t => !['completada', 'completada_validada'].includes(t.estado)), [tasks]);
  const completedTasks = useMemo(() => tasks.filter(t => ['completada', 'completada_validada'].includes(t.estado)), [tasks]);

  useEffect(() => {
    const fetchEmployeeId = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('empleados')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();
        if (data) {
          setCurrentEmployeeId(data.id);
        }
      }
    };
    fetchEmployeeId();
  }, [user]);

  // ✅ NUEVO: Obtener fichaje activo del técnico
  const fetchFichajeActual = useCallback(async () => {
    if (canManage) {
      // Los admin/encargados no tienen restricción
      setFichajeActual({ fichajeId: null, proyectoId: null, nombreUbicacion: null, loading: false });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_estado_fichaje_sesion');
      
      if (error) throw error;

      if (data && data.length > 0) {
        setFichajeActual({
          fichajeId: data[0].fichaje_id,
          proyectoId: data[0].proyecto_id,
          nombreUbicacion: data[0].nombre_ubicacion,
          loading: false
        });
      } else {
        setFichajeActual({
          fichajeId: null,
          proyectoId: null,
          nombreUbicacion: null,
          loading: false
        });
      }
    } catch (err) {
      console.error("Error fetching fichaje actual:", err);
      setFichajeActual(prev => ({ ...prev, loading: false }));
    }
  }, [canManage]);

  useEffect(() => {
    fetchFichajeActual();
  }, [fetchFichajeActual]);

  // ✅ NUEVO: Detectar si tiene tarea activa en la obra donde está fichado
  useEffect(() => {
    if (canManage || !fichajeActual.proyectoId || tasks.length === 0) {
      setTieneTareaActiva(false);
      return;
    }

    // Buscar si tiene alguna tarea activa (con fecha_inicio_real) en la obra actual
    const tareaActiva = tasks.find(t => 
      t.proyecto_id === fichajeActual.proyectoId && 
      t.fecha_inicio_real !== null &&
      !['completada', 'completada_validada', 'pendiente_revision'].includes(t.estado)
    );

    setTieneTareaActiva(!!tareaActiva);
  }, [tasks, fichajeActual.proyectoId, canManage]);

  // ✅ NUEVO: Determinar si una tarea es accesible para el técnico
  const isTaskAccessible = useCallback((task) => {
    // Admin/Encargados siempre pueden acceder
    if (canManage) return true;

    // Si el técnico no está fichado, no puede acceder a ninguna tarea
    if (!fichajeActual.fichajeId) return false;

    // Solo puede acceder si:
    // 1. La tarea es de la obra donde está fichado
    // 2. Y la tarea tiene fecha_inicio_real (está en curso)
    const esDeObraActual = task.proyecto_id === fichajeActual.proyectoId;
    const estaEnCurso = task.fecha_inicio_real !== null;

    return esDeObraActual && estaEnCurso;
  }, [canManage, fichajeActual]);

  const groupTasks = (tasksData) => {
    if (!tasksData || tasksData.length === 0) return [];

    const grouped = tasksData.reduce((acc, current) => {
      const taskId = current.tarea_id;
      if (!acc[taskId]) {
        acc[taskId] = {
          id: taskId,
          titulo: current.titulo,
          descripcion: current.descripcion,
          estado: current.estado_tarea,
          fecha_limite: current.fecha_limite,
          fecha_completada: current.fecha_completado,
          fecha_inicio_real: current.fecha_inicio_real, // ✅ AÑADIDO
          nombre_proyecto: current.nombre_proyecto,
          tecnico_nombre: current.tecnico_nombre,
          empleado_asignado_id: current.empleado_asignado_id,
          proyecto_id: current.proyecto_id,
          total_subtareas: current.total_subtareas,
          subtareas_completadas: current.subtareas_completadas,
          subtareas: [],
          evidencias_count: 0,
          ultima_revision: null,
        };
      }

      if (current.subtarea_id) {
        const hasSubtask = acc[taskId].subtareas.some(st => st.id === current.subtarea_id);
        if (!hasSubtask) {
          acc[taskId].subtareas.push({
            id: current.subtarea_id,
            descripcion_subtarea: current.descripcion_subtarea,
            completada: current.subtarea_completada,
            fecha_completado: current.fecha_completado,
            evidencias_count: Number(current.evidencias_subtarea) || 0,
          });
        }
      }

      if (current.revision_id) {
        if (!acc[taskId].revisions) {
          acc[taskId].revisions = new Map();
        }
        if (!acc[taskId].revisions.has(current.revision_id)) {
          acc[taskId].revisions.set(current.revision_id, {
            aprobado: current.revision_aprobado,
            comentario: current.revision_comentario,
            fecha_revision: current.fecha_revision,
            revisor_nombre: current.revisor_nombre,
          });
        }
      }

      return acc;
    }, {});

    Object.values(grouped).forEach(task => {
      task.evidencias_count = task.subtareas.reduce((sum, st) => sum + (st.evidencias_count || 0), 0);

      if (task.revisions && task.revisions.size > 0) {
        const allRevisions = Array.from(task.revisions.values());
        task.ultima_revision = allRevisions.sort((a, b) => new Date(b.fecha_revision) - new Date(a.fecha_revision))[0];
      }
      delete task.revisions;
    });

    return Object.values(grouped);
  };

  const fetchData = useCallback(async () => {
    // Wait for auth loading to finish
    if (loadingAuth || !sessionRole) return;

    setLoading(true);
    setError(null);

    if (canManage) {
      const { data, error: rpcError } = await supabase.rpc('get_tareas_admin', {
        p_project_id: filterProjectId === 'all' ? null : filterProjectId
      });

      if (rpcError) {
        setError(rpcError);
        toast({ variant: 'destructive', title: 'Error al cargar tareas', description: rpcError.message });
        setTasks([]);
      } else {
        const mappedTasks = (data || []).map(t => ({
          ...t,
          ultima_revision: t.revisiones && t.revisiones.length > 0 ? t.revisiones[0] : null,
          total_subtareas: t.subtareas ? t.subtareas.length : 0,
          subtareas_completadas: t.subtareas ? t.subtareas.filter(s => s.completada).length : 0
        }));

        // Fetch multiple assignments para la vista Admin
        const { data: assignments } = await supabase.from('tarea_empleados').select('*');
        if (assignments) {
          const aggr = {};
          assignments.forEach(a => { if (!aggr[a.tarea_id]) aggr[a.tarea_id] = []; aggr[a.tarea_id].push(a); });
          mappedTasks.forEach(t => t.asignados = aggr[t.id] || []);
        }

        setTasks(mappedTasks);
      }
    } else {
      // ✅ MODIFICADO: Añadir fecha_inicio_real al select
      let query = supabase.from('v_tareas_detalle_para_ui').select(`
        tarea_id,
        proyecto_id,
        nombre_proyecto,
        empleado_asignado_id,
        tecnico_nombre,
        titulo,
        descripcion,
        estado_tarea,
        fecha_limite,
        fecha_inicio_real,
        subtarea_id,
        descripcion_subtarea,
        subtarea_completada,
        fecha_completado,
        evidencias_subtarea,
        total_subtareas,
        subtareas_completadas,
        asignada_a_usuario_actual,
        revision_id,
        revision_aprobado,
        revision_comentario,
        fecha_revision,
        revisor_nombre,
        fecha_creacion
      `).order('fecha_creacion', { ascending: false });

      if (filterProjectId !== 'all') {
        query = query.eq('proyecto_id', filterProjectId);
      }

      // Si no tenemos el UUID del empleado cargado aún, evitamos lanzar query
      if (!currentEmployeeId) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const { data: misAsignaciones } = await supabase.from('tarea_empleados').select('tarea_id').eq('empleado_id', currentEmployeeId);
      const misTareasIdsTemp = misAsignaciones?.map(a => a.tarea_id) || [];

      if (misTareasIdsTemp.length > 0) {
        query = query.or(`empleado_asignado_id.eq.${currentEmployeeId},tarea_id.in.(${misTareasIdsTemp.join(',')})`);
      } else {
        query = query.eq('empleado_asignado_id', currentEmployeeId);
      }

      const { data, error: rpcError } = await query;

      if (rpcError) {
        setError(rpcError);
        toast({ variant: 'destructive', title: 'Error al cargar tareas', description: rpcError.message });
        setTasks([]);
      } else {
        const grouped = groupTasks(data || []);

        const taskIds = grouped.map(t => t.id);
        if (taskIds.length > 0) {
          const { data: allRelatedAssig } = await supabase.from('tarea_empleados').select('*').in('tarea_id', taskIds);
          if (allRelatedAssig) {
            const aggr = {};
            allRelatedAssig.forEach(a => { if (!aggr[a.tarea_id]) aggr[a.tarea_id] = []; aggr[a.tarea_id].push(a); });
            grouped.forEach(t => t.asignados = aggr[t.id] || []);
          }
        }

        setTasks(grouped);
      }
    }
    setLoading(false);
  }, [loadingAuth, sessionRole, canManage, filterProjectId, currentEmployeeId]);

  const fetchCrudData = useCallback(async () => {
    if (!canManage) return;
    const { data: projectsData, error: projectsError } = await supabase.from('proyectos').select('id, nombre_proyecto').eq('estado', 'activo');
    if (projectsError) toast({ variant: 'destructive', title: 'Error cargando proyectos' });
    else setProjects(projectsData);
  }, [canManage]);

  useEffect(() => {
    if (!loadingAuth && sessionRole) {
      fetchData();
      if (canManage) fetchCrudData();
    }

    const channel = supabase.channel('realtime:public:tareas_flow')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtareas' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evidencias_tarea' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarea_revisiones' }, () => fetchData())
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log('Subscribed to Tareas realtime channel');
        if (err) console.error('Realtime subscription error:', err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, fetchCrudData, canManage, loadingAuth, sessionRole]);

  const handleSaveTask = () => {
    fetchData();
    handleCloseModal();
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const { data: subtasksData } = await supabase.from('subtareas').select('id').eq('tarea_id', taskId);
      const subtaskIds = subtasksData?.map(s => s.id) || [];

      if (subtaskIds.length > 0) {
        await supabase.from('evidencias_tarea').delete().in('subtarea_id', subtaskIds);
        await supabase.from('subtareas').delete().in('id', subtaskIds);
      }

      await supabase.from('tarea_empleados').delete().eq('tarea_id', taskId);
      await supabase.from('tarea_revisiones').delete().eq('tarea_id', taskId);
      await supabase.from('tareas').delete().eq('id', taskId);

      toast({ title: 'Tarea eliminada' });
      fetchData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al eliminar', description: error.message });
    }
  };

  // ✅ MODIFICADO: handleCardClick ahora verifica accesibilidad
  const handleCardClick = (task) => {
    // ✅ NUEVO: Bloquear si está pendiente de revisión o completada (para técnicos)
    if (!canManage && ['pendiente_revision', 'completada', 'completada_validada'].includes(task.estado)) {
      toast({
        title: 'Tarea bloqueada',
        description: task.estado === 'pendiente_revision' 
          ? 'Esta tarea está pendiente de revisión. No puedes modificarla hasta que sea revisada.'
          : 'Esta tarea ya ha sido completada.',
        className: 'bg-amber-600 text-white'
      });
      return;
    }

    // Verificar si la tarea es accesible
    if (!canManage && !isTaskAccessible(task)) {
      // Mostrar mensaje explicativo
      if (!fichajeActual.fichajeId) {
        toast({
          variant: 'destructive',
          title: 'No estás fichado',
          description: 'Debes fichar entrada en una obra para acceder a tus tareas.',
        });
      } else if (task.proyecto_id !== fichajeActual.proyectoId) {
        toast({
          variant: 'destructive',
          title: 'Tarea de otra obra',
          description: `Esta tarea pertenece a otra obra. Estás fichado en: ${fichajeActual.nombreUbicacion}`,
        });
      } else if (!task.fecha_inicio_real) {
        toast({
          variant: 'destructive',
          title: 'Tarea no iniciada',
          description: 'Esta tarea aún no ha sido iniciada. Selecciónala al fichar entrada.',
        });
      }
      return;
    }

    const isAssignedToMe = currentEmployeeId &&
      (task.empleado_asignado_id === currentEmployeeId ||
        (task.asignados && task.asignados.some(a => a.empleado_id === currentEmployeeId)));
    if (!canManage || isAssignedToMe) {
      setModalState({ isOpen: true, task, type: 'tecnico' });
    } else if (canManage) {
      setModalState({ isOpen: true, task, type: 'admin' });
    }
  };

  const handleEditClick = (task) => {
    setModalState({ isOpen: true, task, type: 'admin' });
  };

  const handleCreateClick = () => {
    setModalState({ isOpen: true, task: null, type: 'admin' });
  };

  const handleCloseModal = () => {
    setModalState({ isOpen: false, task: null, type: null });
  };

  const handleOpenEvidenceModal = (task, subtaskId) => {
    setEvidenciasModalState({
      isOpen: true,
      task,
      subtaskId,
      readOnly: false,
      onUploadComplete: () => {
        fetchData();
        setEvidenciasModalState({ isOpen: false, task: null, subtaskId: null, readOnly: true, onUploadComplete: null });
      }
    });
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completada': return <Badge className="bg-green-500">Completada</Badge>;
      case 'completada_validada': return <Badge className="bg-green-700">Validada</Badge>;
      case 'pendiente_revision': return <Badge className="bg-blue-500">En Revisión</Badge>;
      case 'en_progreso': return <Badge className="bg-yellow-500">En Progreso</Badge>;
      default: return <Badge variant="secondary">Pendiente</Badge>;
    }
  };

  const renderTasksContent = (taskList) => {
    if (viewMode === 'cluster') {
      return (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {taskList.map(task => {
            const accessible = isTaskAccessible(task);
            return (
              <TaskCard
                key={task.id}
                task={task}
                canManage={canManage}
                currentEmployeeId={currentEmployeeId}
                isAccessible={accessible} // ✅ NUEVO PROP
                onCardClick={() => handleCardClick(task)}
                onEdit={() => handleEditClick(task)}
                onDelete={handleDeleteTask}
                onRevisar={() => setRevisionModalState({ isOpen: true, task })}
                onShowEvidences={() => setEvidenciasModalState(prev => ({ ...prev, isOpen: true, task, readOnly: true }))}
              />
            );
          })}
        </div>
      );
    }
    return (
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[40%] sm:w-auto pl-4">Tarea</TableHead>
              <TableHead className="hidden md:table-cell">Proyecto</TableHead>
              <TableHead className="hidden lg:table-cell">Asignado a</TableHead>
              <TableHead className="hidden sm:table-cell">
                Fecha {taskList === completedTasks ? 'Fin' : 'Límite'}
              </TableHead>
              <TableHead className="hidden md:table-cell">Progreso</TableHead>
              <TableHead className="w-[100px]">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskList.map(task => {
              const accessible = isTaskAccessible(task);
              return (
                <TableRow
                  key={task.id}
                  onClick={() => handleCardClick(task)}
                  className={cn(
                    "transition-colors group",
                    accessible 
                      ? "cursor-pointer hover:bg-muted/50" 
                      : "cursor-not-allowed opacity-50 grayscale"
                  )}
                >
                  <TableCell className="font-medium pl-4">
                    <div className="flex flex-col gap-1">
                      <span className={!accessible ? "text-muted-foreground" : ""}>{task.titulo}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1">{task.descripcion}</span>
                      <div className="md:hidden text-[10px] text-muted-foreground flex flex-col gap-0.5 mt-1">
                        <span className="font-semibold text-foreground/80">{task.nombre_proyecto}</span>
                        {task.fecha_limite && !['completada', 'completada_validada'].includes(task.estado) && <span>Vence: {new Date(task.fecha_limite).toLocaleDateString()}</span>}
                        {(task.estado === 'completada' || task.estado === 'completada_validada') && task.fecha_completada && (
                          <span className="text-green-600">Fin: {new Date(task.fecha_completada).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{task.nombre_proyecto}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{task.tecnico_nombre}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">
                    {(['completada', 'completada_validada'].includes(task.estado) && task.fecha_completada) ? (
                      <span className="text-green-600 font-medium" title="Fecha de finalización">
                        {new Date(task.fecha_completada).toLocaleDateString()}
                      </span>
                    ) : (
                      task.fecha_limite ? new Date(task.fecha_limite).toLocaleDateString() : '-'
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${task.total_subtareas > 0 ? (task.subtareas_completadas / task.total_subtareas) * 100 : 0}%` }}
                        />
                      </div>
                      <span>{task.subtareas_completadas}/{task.total_subtareas}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(task.estado)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (loading || fichajeActual.loading) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-foreground text-lg mt-4">Cargando tareas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg m-8 border border-destructive/50">
        <ServerCrash className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold text-destructive mb-2">Error al cargar tareas</h2>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Tareas</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {canManage && (
            <Select value={filterProjectId} onValueChange={setFilterProjectId}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por proyecto..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proyectos</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_proyecto}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center bg-muted rounded-lg p-1 border">
            <Button
              variant={viewMode === 'cluster' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => setViewMode('cluster')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {canManage && (
            <Button onClick={handleCreateClick}>
              <Plus className="mr-2 h-4 w-4" /> Crear Tarea
            </Button>
          )}
        </div>
      </motion.div>

      {/* ✅ NUEVO: Banner si el técnico no está fichado */}
      {!canManage && !fichajeActual.fichajeId && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">No estás fichado</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">Debes fichar entrada en una obra para poder trabajar en tus tareas.</p>
          </div>
        </motion.div>
      )}

      {/* ✅ NUEVO: Banner mostrando dónde está fichado */}
      {!canManage && fichajeActual.fichajeId && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Fichado en: {fichajeActual.nombreUbicacion}</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {tieneTareaActiva 
                    ? 'Tienes una tarea en curso. Complétala para poder iniciar otra.'
                    : 'No tienes ninguna tarea activa. Inicia una para continuar trabajando.'
                  }
                </p>
              </div>
            </div>
            
            {/* Botón para iniciar nueva tarea si no tiene ninguna activa */}
            {!tieneTareaActiva && (
              <Button 
                onClick={() => setSeleccionTareaModalOpen(true)}
                className="bg-green-600 hover:bg-green-700 shrink-0"
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                Iniciar tarea
              </Button>
            )}
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {activeTasks.length > 0 ? (
          <motion.div
            key="active-tasks"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {renderTasksContent(activeTasks)}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-lg border border-dashed mt-8">
            <Inbox className="w-20 h-20 text-primary/50 mb-4" />
            <h3 className="text-xl font-semibold">¡Todo al día!</h3>
            <p className="text-muted-foreground mt-2">
              No hay tareas pendientes en la selección actual.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {completedTasks.length > 0 && (
        <div className="mt-8">
          <Collapsible open={isCompletedOpen} onOpenChange={setIsCompletedOpen} className="border rounded-xl bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <h3 className="font-semibold text-muted-foreground flex items-center gap-2 text-sm uppercase tracking-wide">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Tareas Finalizadas ({completedTasks.length})
              </h3>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isCompletedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="p-4 bg-slate-50/50 dark:bg-muted/10">
                {renderTasksContent(completedTasks)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {modalState.isOpen && modalState.type === 'admin' && (
        <TaskCrudModal
          isOpen={modalState.isOpen}
          onClose={handleCloseModal}
          onSave={handleSaveTask}
          task={modalState.task}
          defaultProjectId={filterProjectId !== 'all' ? filterProjectId : null}
        />
      )}

      {modalState.isOpen && modalState.type === 'tecnico' && (
        <TecnicoTaskModal
          isOpen={modalState.isOpen}
          onClose={handleCloseModal}
          onSave={fetchData}
          task={modalState.task}
          onAllSubtasksComplete={handleOpenEvidenceModal}
        />
      )}

      <EvidenciasTareaModal
        isOpen={evidenciasModalState.isOpen}
        onClose={() => setEvidenciasModalState(prev => ({ ...prev, isOpen: false }))}
        task={evidenciasModalState.task}
        subtaskId={evidenciasModalState.subtaskId}
        uploadBucket="tarea_evidencias"
        uploadPrefix={`tarea_evidencias/${evidenciasModalState.task?.id}/`}
        onUploadComplete={evidenciasModalState.onUploadComplete}
        readOnly={evidenciasModalState.readOnly}
      />

      {canManage && (
        <RevisionTareaModal
          isOpen={revisionModalState.isOpen}
          onClose={() => setRevisionModalState({ isOpen: false, task: null })}
          onSubmitted={fetchData}
          task={revisionModalState.task}
        />
      )}

      {/* ✅ NUEVO: Modal para que técnico seleccione nueva tarea */}
      {!canManage && fichajeActual.proyectoId && (
        <SeleccionTareaModal
          isOpen={seleccionTareaModalOpen}
          onClose={() => setSeleccionTareaModalOpen(false)}
          proyectoId={fichajeActual.proyectoId}
          empleadoId={currentEmployeeId}
          onTareaSeleccionada={(tarea) => {
            setSeleccionTareaModalOpen(false);
            fetchData();
            fetchFichajeActual();
          }}
        />
      )}
    </div>
  );
};

export default Tareas;
