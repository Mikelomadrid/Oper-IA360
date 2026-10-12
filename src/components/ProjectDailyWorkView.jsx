import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, isToday, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PauseCircle,
  Clock3,
  HardHat,
  Camera,
  Loader2,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Square,
  Users,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ProjectWorkforceAssignmentPanel from '@/components/ProjectWorkforceAssignmentPanel';

const dayKey = (date) => format(date, 'yyyy-MM-dd');
const asArray = (value) => (Array.isArray(value) ? value : []);

const asLocalDay = (value) => {
  if (!value) return null;
  return String(value).slice(0, 10);
};

const formatClock = (value) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date(value));
};

const formatMinutes = (minutes) => {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  return hours > 0 ? `${hours} h ${String(rest).padStart(2, '0')} min` : `${rest} min`;
};

const employeeName = (employee) => {
  if (!employee) return 'Empleado';
  return `${employee.nombre || ''} ${employee.apellidos || ''}`.trim() || employee.email || 'Empleado';
};

const taskStatusClasses = {
  pendiente: 'border-slate-200 bg-slate-50 text-slate-700',
  en_progreso: 'border-violet-200 bg-violet-50 text-violet-700',
  pendiente_revision: 'border-amber-200 bg-amber-50 text-amber-800',
  completada: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  completada_validada: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const taskStatusLabels = {
  pendiente: 'Pendiente',
  en_progreso: 'En curso',
  pendiente_revision: 'Pendiente de revisión',
  completada: 'Completada',
  completada_validada: 'Validada',
};

function SessionBadge({ session, minutes }) {
  if (!session) return <span className="text-[11px] text-muted-foreground">Sin iniciar</span>;
  if (session.estado === 'en_curso') {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Trabajando · {formatMinutes(minutes)}
      </Badge>
    );
  }
  if (session.estado === 'pausada') {
    return (
      <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-800">
        <PauseCircle className="h-3 w-3" />
        En pausa · {formatMinutes(minutes)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-slate-200 bg-slate-50 text-slate-700">
      <CheckCircle2 className="h-3 w-3" />
      Intervención cerrada · {formatMinutes(minutes)}
    </Badge>
  );
}

export default function ProjectDailyWorkView({ projectId, canManage }) {
  const { sessionRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [clockTick, setClockTick] = useState(Date.now());
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState('');
  const [evidenceDialog, setEvidenceDialog] = useState(null);

  const selectedDay = dayKey(selectedDate);
  const currentEmployeeId = sessionRole?.empleadoId || sessionRole?.id || null;

  useEffect(() => {
    const interval = window.setInterval(() => setClockTick(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const workdayQuery = useQuery({
    queryKey: ['project-daily-work', projectId],
    queryFn: async () => {
      const { data: tasks, error: tasksError } = await supabase
        .from('tareas')
        .select('id,proyecto_id,titulo,descripcion,estado,orden,fecha_inicio,fecha_limite,inicio_planificado_at,fin_planificado_at,duracion_planificada_horas,empleado_asignado_id,obra_partida_id,cantidad_medible,unidad_medible')
        .eq('proyecto_id', projectId)
        .order('orden', { ascending: true });
      if (tasksError) throw tasksError;

      const taskRows = tasks || [];
      const taskIds = taskRows.map((task) => task.id);
      const partIds = taskRows.map((task) => task.obra_partida_id).filter(Boolean);

      const [assignmentsResult, partsResult] = await Promise.all([
        taskIds.length
          ? supabase.from('tarea_empleados').select('tarea_id,empleado_id').in('tarea_id', taskIds)
          : Promise.resolve({ data: [], error: null }),
        partIds.length
          ? supabase.from('obras_partidas').select('id,codigo,capitulo,zona,unidad,cantidad_total').in('id', partIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (assignmentsResult.error) throw assignmentsResult.error;
      if (partsResult.error) throw partsResult.error;

      const assignments = assignmentsResult.data || [];
      const employeeIds = new Set(assignments.map((row) => row.empleado_id));
      taskRows.forEach((task) => {
        if (task.empleado_asignado_id) employeeIds.add(task.empleado_asignado_id);
      });

      const { data: employees, error: employeesError } = employeeIds.size
        ? await supabase
          .from('empleados')
          .select('id,nombre,apellidos,email,foto_url,rol')
          .in('id', [...employeeIds])
        : { data: [], error: null };
      if (employeesError) throw employeesError;

      return {
        tasks: taskRows,
        assignments,
        employees: employees || [],
        parts: partsResult.data || [],
      };
    },
    enabled: Boolean(projectId),
  });

  const sessionsQuery = useQuery({
    queryKey: ['task-work-sessions', projectId, selectedDay],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarea_sesiones_trabajo')
        .select('id,tarea_id,proyecto_id,empleado_id,fecha_trabajo,estado,inicio_at,ultimo_inicio_at,fin_at,minutos_acumulados,motivo_pausa,cantidad_reportada,unidad_reportada,notas')
        .eq('proyecto_id', projectId)
        .eq('fecha_trabajo', selectedDay)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(projectId),
    refetchInterval: 60_000,
  });

  const evidencesQuery = useQuery({
    queryKey: ['work-order-evidences', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordenes_trabajo_evidencias')
        .select('id,orden_trabajo_id,proyecto_id,tarea_id,empleado_id,fichaje_id,momento,archivo_path,created_at')
        .eq('proyecto_id', projectId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      return Promise.all((data || []).map(async (evidence) => {
        const storagePath = evidence.archivo_path.startsWith('proyecto_fotos/')
          ? evidence.archivo_path.slice('proyecto_fotos/'.length)
          : evidence.archivo_path;
        const { data: signedData } = await supabase.storage
          .from('proyecto_fotos')
          .createSignedUrl(storagePath, 60 * 60);
        return { ...evidence, signedUrl: signedData?.signedUrl || null };
      }));
    },
    enabled: Boolean(projectId),
    refetchInterval: 60_000,
  });

  const data = workdayQuery.data || { tasks: [], assignments: [], employees: [], parts: [] };
  const employeesById = useMemo(() => new Map(data.employees.map((employee) => [employee.id, employee])), [data.employees]);
  const partsById = useMemo(() => new Map(data.parts.map((part) => [part.id, part])), [data.parts]);

  const employeeIdsByTask = useMemo(() => {
    const map = new Map();
    data.assignments.forEach((row) => {
      const current = map.get(row.tarea_id) || [];
      if (!current.includes(row.empleado_id)) current.push(row.empleado_id);
      map.set(row.tarea_id, current);
    });
    data.tasks.forEach((task) => {
      if (!task.empleado_asignado_id) return;
      const current = map.get(task.id) || [];
      if (!current.includes(task.empleado_asignado_id)) current.unshift(task.empleado_asignado_id);
      map.set(task.id, current);
    });
    return map;
  }, [data.assignments, data.tasks]);

  const sessions = asArray(sessionsQuery.data);
  const sessionsByTask = useMemo(() => {
    const map = new Map();
    sessions.forEach((session) => {
      const current = map.get(session.tarea_id) || [];
      current.push(session);
      map.set(session.tarea_id, current);
    });
    return map;
  }, [sessions]);

  const evidences = asArray(evidencesQuery.data);
  const evidencesByTaskEmployee = useMemo(() => {
    const map = new Map();
    evidences.forEach((evidence) => {
      const key = `${evidence.tarea_id}:${evidence.empleado_id}`;
      const current = map.get(key) || [];
      current.push(evidence);
      map.set(key, current);
    });
    return map;
  }, [evidences]);

  const taskRows = useMemo(() => data.tasks
    .filter((task) => {
      const start = asLocalDay(task.inicio_planificado_at || task.fecha_inicio);
      const end = asLocalDay(task.fin_planificado_at || task.fecha_limite || task.fecha_inicio);
      const hasSession = sessionsByTask.has(task.id);
      return hasSession || (start && end && start <= selectedDay && end >= selectedDay);
    })
    .map((task) => ({
      ...task,
      part: partsById.get(task.obra_partida_id) || null,
      employeeIds: employeeIdsByTask.get(task.id) || [],
      sessions: sessionsByTask.get(task.id) || [],
    }))
    .sort((a, b) => {
      const aStart = a.inicio_planificado_at || `${a.fecha_inicio || '9999-12-31'}T23:59:00`;
      const bStart = b.inicio_planificado_at || `${b.fecha_inicio || '9999-12-31'}T23:59:00`;
      return String(aStart).localeCompare(String(bStart)) || Number(a.orden || 0) - Number(b.orden || 0);
    }), [data.tasks, employeeIdsByTask, partsById, selectedDay, sessionsByTask]);

  const summary = useMemo(() => {
    const active = sessions.filter((session) => session.estado === 'en_curso').length;
    const paused = sessions.filter((session) => session.estado === 'pausada').length;
    const finished = sessions.filter((session) => session.estado === 'finalizada').length;
    return { active, paused, finished };
  }, [sessions]);

  const sessionMinutes = (session) => {
    if (!session) return 0;
    const stored = Number(session.minutos_acumulados || 0);
    if (session.estado !== 'en_curso' || !session.ultimo_inicio_at) return stored;
    const running = Math.max(0, Math.floor((clockTick - new Date(session.ultimo_inicio_at).getTime()) / 60_000));
    return stored + running;
  };

  const actionMutation = useMutation({
    mutationFn: async ({ task, action }) => {
      const parsedQuantity = quantity.trim() === '' ? null : Number(quantity.replace(',', '.'));
      if (parsedQuantity !== null && (!Number.isFinite(parsedQuantity) || parsedQuantity < 0)) {
        throw new Error('La cantidad reportada debe ser un número válido.');
      }
      const { data: result, error } = await supabase.rpc('registrar_accion_tarea', {
        p_tarea_id: task.id,
        p_accion: action,
        p_empleado_id: currentEmployeeId,
        p_motivo: action === 'pausar' ? reason.trim() || null : null,
        p_notas: action === 'finalizar' ? notes.trim() || null : null,
        p_cantidad: action === 'finalizar' ? parsedQuantity : null,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['task-work-sessions', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project-daily-work', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['obra-gantt', projectId] }),
      ]);
      const messages = {
        iniciar: 'Intervención iniciada',
        pausar: 'Intervención pausada',
        finalizar: 'Intervención finalizada',
      };
      toast({
        title: messages[variables.action],
        description: variables.task.titulo,
      });
      setDialog(null);
      setReason('');
      setNotes('');
      setQuantity('');
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo registrar la intervención',
        description: error.message,
      });
    },
  });

  const executeAction = (task, action) => {
    if (action === 'pausar' || action === 'finalizar') {
      setReason('');
      setNotes('');
      setQuantity('');
      setDialog({ task, action });
      return;
    }
    actionMutation.mutate({ task, action });
  };

  const loading = workdayQuery.isLoading || sessionsQuery.isLoading;
  const infrastructureMissing = sessionsQuery.error?.code === '42P01'
    || sessionsQuery.error?.code === 'PGRST205'
    || sessionsQuery.error?.message?.includes('tarea_sesiones_trabajo');
  const error = workdayQuery.error || (!infrastructureMissing ? sessionsQuery.error : null);

  if (!canManage) {
    return (
      <Card className="border-amber-200 bg-amber-50/60 shadow-none">
        <CardContent className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
          <HardHat className="mb-3 h-7 w-7 text-amber-700" />
          <p className="font-semibold text-amber-950">Planificación restringida</p>
          <p className="mt-1 max-w-md text-sm text-amber-800">El cronograma, las tareas y la asignación de equipos solo están disponibles para administración y el encargado.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Preparando la jornada de obra…
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 shadow-none">
        <CardHeader>
          <CardTitle className="text-base text-destructive">No se pudo cargar la jornada</CardTitle>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <HardHat className="h-4 w-4" />
            Hoja de jornada
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Trabajo diario</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Partidas previstas para el día, equipos asignados y tiempo real dedicado por cada persona.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card p-1">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSelectedDate((date) => subDays(date, 1))} aria-label="Día anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-9 min-w-[190px] justify-center gap-2 px-3"
            onClick={() => setSelectedDate(new Date())}
          >
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="capitalize">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</span>
            {isToday(selectedDate) && <Badge className="ml-1 h-5 bg-primary/10 px-1.5 text-[10px] text-primary hover:bg-primary/10">Hoy</Badge>}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSelectedDate((date) => addDays(date, 1))} aria-label="Día siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <ProjectWorkforceAssignmentPanel projectId={projectId} />

      {infrastructureMissing && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">La vista está preparada, falta activar el registro de tiempos.</p>
            <p className="mt-0.5 text-amber-800">Aplica la migración de sesiones de trabajo para habilitar Iniciar, Pausar y Finalizar.</p>
          </div>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen de la jornada">
        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600"><Play className="h-4 w-4" /></span>
          <div><p className="font-mono text-lg font-bold tabular-nums">{summary.active}</p><p className="text-xs text-muted-foreground">trabajando ahora</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-700"><Pause className="h-4 w-4" /></span>
          <div><p className="font-mono text-lg font-bold tabular-nums">{summary.paused}</p><p className="text-xs text-muted-foreground">intervenciones en pausa</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600"><CheckCircle2 className="h-4 w-4" /></span>
          <div><p className="font-mono text-lg font-bold tabular-nums">{summary.finished}</p><p className="text-xs text-muted-foreground">intervenciones cerradas</p></div>
        </div>
      </section>

      {taskRows.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border/60 bg-card" aria-label="Partidas del día">
          <div className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Orden de actuación del día</h3>
              </div>
              <Badge variant="outline" className="font-mono tabular-nums">{taskRows.length} partidas</Badge>
            </div>
          </div>

          <div className="divide-y divide-border/50">
            {taskRows.map((task) => {
              const taskSessions = task.sessions || [];
              const mySession = taskSessions
                .filter((session) => session.empleado_id === currentEmployeeId)
                .sort((a, b) => String(b.inicio_at).localeCompare(String(a.inicio_at)))[0] || null;
              const assignedToMe = task.employeeIds.includes(currentEmployeeId);
              const canOperate = assignedToMe && isToday(selectedDate) && !infrastructureMissing
                && !['pendiente_revision', 'completada', 'completada_validada'].includes(task.estado);

              return (
                <article key={task.id} className="grid gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[90px_minmax(0,1fr)_minmax(280px,0.75fr)]">
                  <div className="font-mono text-xs tabular-nums text-muted-foreground">
                    <p className="font-semibold text-foreground">{formatClock(task.inicio_planificado_at)}</p>
                    <p className="mt-0.5">{formatClock(task.fin_planificado_at)}</p>
                    {task.duracion_planificada_horas && <p className="mt-2 text-[11px]">{Number(task.duracion_planificada_horas).toLocaleString('es-ES')} h previstas</p>}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {task.part?.codigo && <span className="font-mono text-xs font-semibold text-primary">{task.part.codigo}</span>}
                      <Badge variant="outline" className={taskStatusClasses[task.estado] || taskStatusClasses.pendiente}>
                        {taskStatusLabels[task.estado] || task.estado}
                      </Badge>
                    </div>
                    <h4 className="mt-1.5 text-sm font-semibold leading-snug text-foreground">{task.titulo}</h4>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {task.part?.zona && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{task.part.zona}</span>}
                      {task.part?.capitulo && <span>{task.part.capitulo}</span>}
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{task.employeeIds.length} asignados</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {task.employeeIds.map((employeeId) => {
                        const employee = employeesById.get(employeeId);
                        const employeeEvidences = evidencesByTaskEmployee.get(`${task.id}:${employeeId}`) || [];
                        const employeeSession = taskSessions
                          .filter((session) => session.empleado_id === employeeId)
                          .sort((a, b) => String(b.inicio_at).localeCompare(String(a.inicio_at)))[0] || null;
                        return (
                          <div key={employeeId} className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/15 px-2 py-1.5">
                            <Avatar className="h-6 w-6 border border-background">
                              {employee?.foto_url ? <img src={employee.foto_url} alt="" className="h-full w-full object-cover" /> : null}
                              <AvatarFallback className="text-[8px] font-bold">{employeeName(employee).slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="max-w-[150px] truncate text-[11px] font-medium text-foreground">{employeeName(employee)}</p>
                              <SessionBadge session={employeeSession} minutes={sessionMinutes(employeeSession)} />
                              {employeeEvidences.length > 0 && (
                                <button
                                  type="button"
                                  className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                                  onClick={() => setEvidenceDialog({ task, employee, evidences: employeeEvidences })}
                                >
                                  <Camera className="h-3 w-3" />
                                  {employeeEvidences.length} {employeeEvidences.length === 1 ? 'foto' : 'fotos'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col justify-center gap-2 border-t border-border/50 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                    {assignedToMe ? (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-foreground">Mi intervención</p>
                            <p className="text-[11px] text-muted-foreground">
                              {mySession ? formatMinutes(sessionMinutes(mySession)) : 'Todavía sin tiempo registrado'}
                            </p>
                          </div>
                          {mySession?.estado === 'en_curso' && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
                        </div>

                        {canOperate && (!mySession || mySession.estado === 'finalizada') && (
                          <Button className="justify-start bg-emerald-600 hover:bg-emerald-700" onClick={() => executeAction(task, 'iniciar')} disabled={actionMutation.isPending}>
                            <Play className="mr-2 h-4 w-4" /> Iniciar intervención
                          </Button>
                        )}
                        {canOperate && mySession?.estado === 'pausada' && (
                          <Button className="justify-start" onClick={() => executeAction(task, 'iniciar')} disabled={actionMutation.isPending}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Reanudar intervención
                          </Button>
                        )}
                        {canOperate && mySession?.estado === 'en_curso' && (
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="justify-start border-amber-200 text-amber-800 hover:bg-amber-50" onClick={() => executeAction(task, 'pausar')} disabled={actionMutation.isPending}>
                              <Pause className="mr-2 h-4 w-4" /> Pausar
                            </Button>
                            <Button variant="outline" className="justify-start border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => executeAction(task, 'finalizar')} disabled={actionMutation.isPending}>
                              <Square className="mr-2 h-4 w-4" /> Finalizar
                            </Button>
                          </div>
                        )}
                        {canOperate && mySession?.estado === 'pausada' && (
                          <Button variant="outline" className="justify-start" onClick={() => executeAction(task, 'finalizar')} disabled={actionMutation.isPending}>
                            <Square className="mr-2 h-4 w-4" /> Cerrar intervención
                          </Button>
                        )}
                        {!isToday(selectedDate) && <p className="text-xs text-muted-foreground">Las acciones solo están disponibles en la jornada de hoy.</p>}
                      </>
                    ) : (
                      <div className="rounded-lg bg-muted/25 px-3 py-3 text-xs text-muted-foreground">
                        {canManage
                          ? 'Vista de supervisión. Cada empleado registra su propia intervención.'
                          : 'Esta partida no está asignada a tu equipo.'}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <Card className="border-dashed border-border/80 bg-muted/10 shadow-none">
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
            <CalendarDays className="mb-3 h-7 w-7 text-primary" />
            <p className="font-semibold text-foreground">No hay partidas previstas para este día</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Utiliza las flechas para consultar otra jornada o ajusta el cronograma de la obra.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog?.action === 'pausar' ? 'Pausar intervención' : 'Finalizar mi intervención'}</DialogTitle>
            <DialogDescription className="line-clamp-2">{dialog?.task?.titulo}</DialogDescription>
          </DialogHeader>

          {dialog?.action === 'pausar' ? (
            <div className="space-y-2 py-2">
              <Label htmlFor="pause-reason">Motivo de la pausa</Label>
              <Textarea id="pause-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Material pendiente, cambio de zona, coordinación…" rows={3} />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="finish-quantity">Cantidad ejecutada observada (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input id="finish-quantity" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0" />
                  <span className="min-w-12 text-sm text-muted-foreground">{dialog?.task?.unidad_medible || dialog?.task?.part?.unidad || 'ud'}</span>
                </div>
                <p className="text-xs text-muted-foreground">Quedará pendiente de validación; no se sumará automáticamente a producción.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finish-notes">Observaciones (opcional)</Label>
                <Textarea id="finish-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Trabajo realizado, dificultad encontrada o información para el encargado…" rows={3} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={actionMutation.isPending}>Cancelar</Button>
            <Button
              className={dialog?.action === 'pausar' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}
              onClick={() => actionMutation.mutate({ task: dialog.task, action: dialog.action })}
              disabled={actionMutation.isPending}
            >
              {actionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialog?.action === 'pausar' ? 'Pausar ahora' : 'Finalizar intervención'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(evidenceDialog)} onOpenChange={(open) => !open && setEvidenceDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Evidencias del trabajo
            </DialogTitle>
            <DialogDescription>
              {evidenceDialog?.task?.titulo} · {employeeName(evidenceDialog?.employee)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {['inicio', 'finalizacion'].map((moment) => {
              const momentEvidences = (evidenceDialog?.evidences || []).filter((evidence) => evidence.momento === moment);
              if (!momentEvidences.length) return null;
              return (
                <section key={moment} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-foreground">
                      {moment === 'inicio' ? 'Registro inicial anterior' : 'Estado al cerrar la jornada'}
                    </h4>
                    <Badge variant="outline">{momentEvidences.length} {momentEvidences.length === 1 ? 'foto' : 'fotos'}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {momentEvidences.map((evidence) => (
                      <figure key={evidence.id} className="overflow-hidden rounded-lg border border-border/60 bg-muted/10">
                        {evidence.signedUrl ? (
                          <a href={evidence.signedUrl} target="_blank" rel="noreferrer" className="block">
                            <img src={evidence.signedUrl} alt={`Evidencia de ${moment}`} className="aspect-square w-full object-cover" />
                          </a>
                        ) : (
                          <div className="flex aspect-square items-center justify-center px-3 text-center text-xs text-muted-foreground">
                            No se pudo preparar la vista previa
                          </div>
                        )}
                        <figcaption className="border-t border-border/50 px-2 py-1.5 text-[10px] text-muted-foreground">
                          {new Intl.DateTimeFormat('es-ES', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
                          }).format(new Date(evidence.created_at))}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEvidenceDialog(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
