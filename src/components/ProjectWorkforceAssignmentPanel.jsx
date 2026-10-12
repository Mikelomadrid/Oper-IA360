import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Loader2,
  MapPin,
  Plus,
  UserCheck,
  Users,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const OPEN_ORDER_STATES = ['asignada', 'activa', 'pendiente_continuar'];

const employeeName = (employee) => (
  `${employee?.nombre || ''} ${employee?.apellidos || ''}`.trim() || employee?.email || 'Empleado'
);

const formatClock = (value) => value
  ? new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date(value))
  : '—';

const TRANSFER_REASONS = [
  { value: 'compra_material', label: 'Compra o recogida de material' },
  { value: 'urgencia_averia', label: 'Urgencia o avería' },
  { value: 'otra_obra', label: 'Apoyo en otra obra' },
  { value: 'nave_almacen', label: 'Nave o almacén' },
  { value: 'gestion', label: 'Gestión o desplazamiento general' },
  { value: 'otro', label: 'Otro motivo' },
];

export default function ProjectWorkforceAssignmentPanel({ projectId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [assignDialog, setAssignDialog] = useState(null);
  const [transferDialog, setTransferDialog] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [plannedHours, setPlannedHours] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferDestination, setTransferDestination] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  const workforceQuery = useQuery({
    queryKey: ['project-present-workforce', projectId],
    queryFn: async () => {
      const { data: attendance, error: attendanceError } = await supabase
        .rpc('listar_personal_presente_obra', { p_proyecto_id: projectId });
      if (attendanceError) throw attendanceError;

      const attendanceRows = (attendance || []).map((row) => ({
        id: row.fichaje_id,
        empleado_id: row.empleado_id,
        proyecto_id: row.proyecto_id,
        hora_entrada: row.hora_entrada,
      }));
      const employeeIds = attendanceRows.map((row) => row.empleado_id).filter(Boolean);
      const [{ data: employees, error: employeesError }, { data: orders, error: ordersError }] = await Promise.all([
        employeeIds.length
          ? supabase.from('empleados').select('id,nombre,apellidos,email,foto_url,rol').in('id', employeeIds)
          : Promise.resolve({ data: [], error: null }),
        employeeIds.length
          ? supabase
            .from('ordenes_trabajo_diarias')
            .select('id,proyecto_id,tarea_id,empleado_id,fichaje_id,estado,orden,horas_previstas,notas_encargado,asignada_at')
            .eq('proyecto_id', projectId)
            .in('empleado_id', employeeIds)
            .in('estado', OPEN_ORDER_STATES)
            .order('orden', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (employeesError) throw employeesError;
      if (ordersError) throw ordersError;

      return { attendance: attendanceRows, employees: employees || [], orders: orders || [] };
    },
    enabled: Boolean(projectId),
    refetchInterval: 10_000,
  });

  const resourcesQuery = useQuery({
    queryKey: ['project-assignment-resources', projectId],
    queryFn: async () => {
      const [tasksResult, projectsResult, centersResult] = await Promise.all([
        supabase
          .from('tareas')
          .select('id,titulo,estado,orden,duracion_planificada_horas,fecha_inicio,fecha_limite')
          .eq('proyecto_id', projectId)
          .in('estado', ['pendiente', 'en_progreso'])
          .order('orden', { ascending: true }),
        supabase
          .from('proyectos')
          .select('id,nombre_proyecto,estado')
          .neq('id', projectId)
          .in('estado', ['activo', 'en_espera'])
          .order('nombre_proyecto'),
        supabase.from('centros_coste_internos').select('id,nombre_centro').order('nombre_centro'),
      ]);
      if (tasksResult.error) throw tasksResult.error;
      // Las tareas deben seguir disponibles aunque falle un selector auxiliar
      // utilizado únicamente al preparar traslados.
      if (projectsResult.error) console.warn('No se pudieron cargar otras obras para traslados:', projectsResult.error);
      if (centersResult.error) console.warn('No se pudieron cargar centros internos para traslados:', centersResult.error);
      return {
        tasks: tasksResult.data || [],
        projects: projectsResult.error ? [] : (projectsResult.data || []),
        centers: centersResult.error ? [] : (centersResult.data || []),
      };
    },
    enabled: Boolean(projectId),
  });

  const data = workforceQuery.data || { attendance: [], employees: [], orders: [] };
  const resources = resourcesQuery.data || { tasks: [], projects: [], centers: [] };
  const employeesById = useMemo(
    () => new Map(data.employees.map((employee) => [employee.id, employee])),
    [data.employees],
  );
  const ordersByEmployee = useMemo(() => {
    const map = new Map();
    data.orders.forEach((order) => {
      const current = map.get(order.empleado_id) || [];
      current.push(order);
      map.set(order.empleado_id, current);
    });
    return map;
  }, [data.orders]);
  const tasksById = useMemo(() => new Map(resources.tasks.map((task) => [task.id, task])), [resources.tasks]);

  const waitingCount = data.attendance.filter((attendance) => !(ordersByEmployee.get(attendance.empleado_id) || []).length).length;

  const resetAssignment = () => {
    setAssignDialog(null);
    setSelectedTaskId('');
    setPlannedHours('');
    setAssignmentNotes('');
  };

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignDialog || !selectedTaskId) throw new Error('Selecciona la tarea que debe realizar.');
      const hours = plannedHours.trim() ? Number(plannedHours.replace(',', '.')) : null;
      if (hours !== null && (!Number.isFinite(hours) || hours <= 0)) throw new Error('Las horas previstas no son válidas.');
      const rpcName = assignDialog.mode === 'queue' ? 'encolar_orden_trabajo' : 'preparar_orden_trabajo';
      const { error } = await supabase.rpc(rpcName, {
        p_proyecto_id: projectId,
        p_tarea_id: selectedTaskId,
        p_empleado_id: assignDialog.empleado_id,
        p_horas_previstas: hours,
        p_notas: assignmentNotes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project-present-workforce', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['task-work-sessions', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['obra-gantt', projectId] }),
      ]);
      toast({
        title: assignDialog?.mode === 'queue' ? 'Tarea añadida a la cola' : 'Trabajo asignado',
        description: assignDialog?.mode === 'queue'
          ? 'El técnico la verá como siguiente trabajo, sin marcarla como iniciada.'
          : 'El técnico ya puede verla e iniciarla directamente.',
      });
      resetAssignment();
    },
    onError: (error) => toast({ variant: 'destructive', title: 'No se pudo asignar', description: error.message }),
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!transferDialog || !transferReason || !transferDestination) throw new Error('Indica motivo y destino.');
      const [destinationType, destinationId] = transferDestination.split(':');
      const imputacion = transferReason === 'compra_material'
        ? 'obra_origen'
        : destinationType === 'centro'
          ? 'logistica_interna'
          : 'obra_destino';
      const reasonLabel = TRANSFER_REASONS.find((item) => item.value === transferReason)?.label || transferReason;
      const { error } = await supabase.rpc('registrar_traslado_personal', {
        p_fichaje_id: transferDialog.id,
        p_motivo: reasonLabel,
        p_proyecto_destino_id: destinationType === 'obra' ? destinationId : null,
        p_centro_destino_id: destinationType === 'centro' ? destinationId : null,
        p_imputacion_tipo: imputacion,
        p_notas: transferNotes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Traslado preparado', description: 'Al fichar la salida se cerrará el coste de esta obra.' });
      setTransferDialog(null);
      setTransferReason('');
      setTransferDestination('');
      setTransferNotes('');
    },
    onError: (error) => toast({ variant: 'destructive', title: 'No se pudo preparar el traslado', description: error.message }),
  });

  const openAssignment = (attendance, mode = 'activate') => {
    const employee = employeesById.get(attendance.empleado_id);
    const orders = ordersByEmployee.get(attendance.empleado_id) || [];
    const currentOrder = orders.find((order) => order.estado === 'activa')
      || orders.find((order) => order.estado === 'pendiente_continuar')
      || orders[0];
    setAssignDialog({ ...attendance, employee, mode });
    setSelectedTaskId(mode === 'queue' ? '' : (currentOrder?.tarea_id || ''));
    setPlannedHours(mode === 'queue' ? '' : (currentOrder?.horas_previstas ? String(currentOrder.horas_previstas).replace('.', ',') : ''));
    setAssignmentNotes(mode === 'queue' ? '' : (currentOrder?.notas_encargado || ''));
  };

  if (workforceQuery.isLoading) {
    return <div className="flex items-center gap-2 rounded-lg border border-border/60 px-4 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Comprobando el personal presente…</div>;
  }

  const missingInfrastructure = workforceQuery.error?.code === '42P01'
    || workforceQuery.error?.code === 'PGRST205'
    || workforceQuery.error?.message?.includes('ordenes_trabajo_diarias');
  if (workforceQuery.error && !missingInfrastructure) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{workforceQuery.error.message}</div>;
  }

  return (
    <section className="space-y-3" aria-label="Personal presente y asignación rápida">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary"><UserCheck className="h-4 w-4" />Puesto de mando móvil</div>
          <h3 className="mt-1 text-lg font-bold tracking-tight">Personal presente</h3>
          <p className="text-sm text-muted-foreground">Asigna el siguiente trabajo respetando el orden de actuación de la obra.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5"><Users className="h-3.5 w-3.5" />{data.attendance.length} fichados</Badge>
          {waitingCount > 0 && <Badge className="gap-1.5 border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50"><AlertTriangle className="h-3.5 w-3.5" />{waitingCount} sin tarea</Badge>}
        </div>
      </div>

      {missingInfrastructure && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Aplica la migración de operativa diaria para activar la asignación rápida.</div>
      )}

      {!missingInfrastructure && data.attendance.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-5 py-8 text-center">
          <MapPin className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 font-semibold">Todavía no hay personal fichado en esta obra</p>
          <p className="mt-1 text-sm text-muted-foreground">Los técnicos aparecerán aquí en cuanto registren su entrada.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.attendance.map((attendance) => {
            const employee = employeesById.get(attendance.empleado_id);
            const orders = ordersByEmployee.get(attendance.empleado_id) || [];
            const currentOrder = orders.find((order) => order.estado === 'activa') || orders[0];
            const task = currentOrder ? tasksById.get(currentOrder.tarea_id) : null;
            const waiting = !currentOrder;
            return (
              <article key={attendance.id} className={`rounded-xl border px-4 py-4 ${waiting ? 'border-amber-200 bg-amber-50/60' : 'border-border/60 bg-card'}`}>
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 border border-background">
                    {employee?.foto_url ? <img src={employee.foto_url} alt="" className="h-full w-full object-cover" /> : null}
                    <AvatarFallback className="text-xs font-bold">{employeeName(employee).slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{employeeName(employee)}</p>
                      <span className="font-mono text-[11px] text-muted-foreground">desde {formatClock(attendance.hora_entrada)}</span>
                    </div>
                    {waiting ? (
                      <div className="mt-2 flex items-start gap-2 text-sm text-amber-900"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Esperando asignación.</strong> El tiempo todavía no está imputado a una tarea.</span></div>
                    ) : (
                      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Trabajo liberado</div>
                        <p className="mt-1 line-clamp-2 text-sm font-medium text-emerald-950">{task?.titulo || 'Tarea asignada'}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className={`mt-4 grid gap-2 ${waiting ? 'grid-cols-2' : 'sm:grid-cols-3'}`}>
                  <Button className={waiting ? 'bg-violet-600 hover:bg-violet-700' : ''} variant={waiting ? 'default' : 'outline'} onClick={() => openAssignment(attendance, waiting ? 'activate' : 'queue')}>
                    <Plus className="mr-2 h-4 w-4" />{waiting ? 'Asignar trabajo' : 'Añadir siguiente'}
                  </Button>
                  {!waiting && (
                    <Button variant="outline" onClick={() => openAssignment(attendance, 'activate')}>
                      <ClipboardList className="mr-2 h-4 w-4" />Cambiar actual
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setTransferDialog({ ...attendance, employee })}>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />Reasignar
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(assignDialog)} onOpenChange={(open) => !open && resetAssignment()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Asignación rápida</DialogTitle>
            <DialogDescription>
              {assignDialog?.mode === 'queue'
                ? `${employeeName(assignDialog?.employee)} la verá como siguiente tarea, respetando el orden de actuación.`
                : `${employeeName(assignDialog?.employee)} verá esta orden como trabajo actual, sin acceder al cronograma completo.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tarea siguiendo el orden de actuación</Label>
              <Select disabled={resourcesQuery.isLoading || Boolean(resourcesQuery.error) || resources.tasks.length === 0} value={selectedTaskId} onValueChange={(value) => {
                setSelectedTaskId(value);
                const selected = tasksById.get(value);
                if (selected?.duracion_planificada_horas) setPlannedHours(String(selected.duracion_planificada_horas).replace('.', ','));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={resourcesQuery.isLoading ? 'Cargando tareas…' : resources.tasks.length === 0 ? 'No hay tareas disponibles' : 'Selecciona la siguiente tarea…'} />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  {resources.tasks.map((task, index) => <SelectItem key={task.id} value={task.id}><span className="font-mono text-xs text-muted-foreground">{Number(task.orden ?? index + 1)}.</span> {task.titulo}</SelectItem>)}
                </SelectContent>
              </Select>
              {resourcesQuery.error && <p className="text-xs font-medium text-red-700">No se pudieron cargar las tareas: {resourcesQuery.error.message}</p>}
              {!resourcesQuery.isLoading && !resourcesQuery.error && resources.tasks.length === 0 && <p className="text-xs text-amber-800">La obra no tiene tareas pendientes o en curso para asignar.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-hours">Horas previstas para este técnico</Label>
              <Input id="quick-hours" inputMode="decimal" value={plannedHours} onChange={(event) => setPlannedHours(event.target.value)} placeholder="Ej. 3,5" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-notes">Indicaciones del encargado</Label>
              <Textarea id="quick-notes" value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} placeholder="Zona, prioridad o detalle que debe conocer…" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAssignment}>Cancelar</Button>
            <Button onClick={() => assignMutation.mutate()} disabled={!selectedTaskId || assignMutation.isPending}>
              {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {assignDialog?.mode === 'queue' ? 'Añadir a la cola' : 'Asignar ahora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(transferDialog)} onOpenChange={(open) => !open && setTransferDialog(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Reasignar técnico</DialogTitle>
            <DialogDescription>La imputación a esta obra se detendrá cuando {employeeName(transferDialog?.employee)} fiche la salida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select value={transferReason} onValueChange={setTransferReason}>
                <SelectTrigger><SelectValue placeholder="¿Por qué abandona la obra?" /></SelectTrigger>
                <SelectContent>{TRANSFER_REASONS.map((reason) => <SelectItem key={reason.value} value={reason.value}>{reason.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Destino</Label>
              <Select value={transferDestination} onValueChange={setTransferDestination}>
                <SelectTrigger><SelectValue placeholder="Selecciona obra, nave o centro…" /></SelectTrigger>
                <SelectContent>
                  {resources.centers.map((center) => <SelectItem key={`centro:${center.id}`} value={`centro:${center.id}`}>{center.nombre_centro}</SelectItem>)}
                  {resources.projects.map((project) => <SelectItem key={`obra:${project.id}`} value={`obra:${project.id}`}>{project.nombre_proyecto}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-notes">Indicaciones</Label>
              <Textarea id="transfer-notes" value={transferNotes} onChange={(event) => setTransferNotes(event.target.value)} placeholder="Material a recoger, dirección de la urgencia, persona de contacto…" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialog(null)}>Cancelar</Button>
            <Button onClick={() => transferMutation.mutate()} disabled={!transferReason || !transferDestination || transferMutation.isPending}>
              {transferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Preparar traslado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
