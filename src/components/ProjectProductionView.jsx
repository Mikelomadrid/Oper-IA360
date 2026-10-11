import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CircleDashed,
  Layers3,
  Loader2,
  MapPin,
  Plus,
  Ruler,
  Settings2,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Combobox } from '@/components/ui/combobox';

const today = () => new Date();
const asNumber = (value) => Number(value || 0);
const formatQuantity = (value) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(asNumber(value));
const formatCurrency = (value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(asNumber(value));

const emptyForm = () => ({
  obra_partida_id: '',
  sistema_id: '',
  fecha: today(),
  zona: '',
  cantidad_ejecutada: '',
  notas: '',
});

export default function ProjectProductionView({ projectId, canManage }) {
  const navigate = useNavigate();
  const { sessionRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const libraryQuery = useQuery({
    queryKey: ['production-library'],
    queryFn: async () => {
      const [{ data: systems, error: systemsError }, { data: costs, error: costsError }] = await Promise.all([
        supabase
          .from('sistemas_rendimiento')
          .select('id,codigo,nombre,categoria,unidad_base,estado,activo')
          .eq('activo', true)
          .neq('estado', 'inactivo')
          .order('codigo'),
        supabase
          .from('v_sistemas_rendimiento_costes')
          .select('id,coste_materiales,coste_mano_obra,coste_otros,coste_total'),
      ]);
      if (systemsError) throw systemsError;
      if (costsError) throw costsError;
      const costMap = new Map((costs || []).map((row) => [row.id, row]));
      return (systems || []).map((system) => ({ ...system, costes: costMap.get(system.id) || null }));
    },
  });

  const measurementsQuery = useQuery({
    queryKey: ['obra-production', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obra_sistema_mediciones')
        .select(`
          id, obra_id, obra_partida_id, sistema_id, fecha, zona, cantidad_ejecutada, unidad,
          coste_materiales_snapshot, coste_mano_obra_snapshot, coste_otros_snapshot,
          notas, created_at,
          sistema:sistemas_rendimiento(id,codigo,nombre,categoria,unidad_base)
        `)
        .eq('obra_id', projectId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(projectId),
  });

  const workItemsQuery = useQuery({
    queryKey: ['obra-work-items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obras_partidas')
        .select('id,obra_id,codigo,descripcion,unidad,cantidad_total,precio_unitario,orden,activa,presupuesto_emision_id,sistema_id,capitulo,zona,fase_ejecucion')
        .eq('obra_id', projectId)
        .eq('activa', true)
        .order('orden', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(projectId),
  });

  const systems = useMemo(() => libraryQuery.data || [], [libraryQuery.data]);
  const measurements = useMemo(() => measurementsQuery.data || [], [measurementsQuery.data]);
  const workItems = useMemo(() => workItemsQuery.data || [], [workItemsQuery.data]);
  const selectedWorkItem = workItems.find((item) => item.id === form.obra_partida_id);
  const selectedSystem = systems.find((system) => system.id === form.sistema_id);

  const workItemOptions = useMemo(() => workItems
    .filter((item) => item.sistema_id)
    .map((item) => ({
      value: item.id,
      label: `${item.codigo || 'Sin código'} · ${item.descripcion} (${formatQuantity(item.cantidad_total)} ${item.unidad})`,
    })), [workItems]);

  const workItemProgress = useMemo(() => {
    const executedByItem = new Map();
    measurements.forEach((row) => {
      if (!row.obra_partida_id) return;
      executedByItem.set(
        row.obra_partida_id,
        asNumber(executedByItem.get(row.obra_partida_id)) + asNumber(row.cantidad_ejecutada),
      );
    });

    return workItems.map((item) => {
      const planned = asNumber(item.cantidad_total);
      const executed = asNumber(executedByItem.get(item.id));
      const pending = Math.max(planned - executed, 0);
      const percentage = planned > 0 ? Math.round((executed / planned) * 100) : 0;
      const status = percentage > 100 ? 'exceeded' : percentage >= 100 ? 'completed' : executed > 0 ? 'in_progress' : 'pending';
      return { ...item, planned, executed, pending, percentage, status };
    });
  }, [measurements, workItems]);

  const selectedProgress = workItemProgress.find((item) => item.id === form.obra_partida_id);

  const progressTotals = useMemo(() => workItemProgress.reduce((totals, item) => {
    totals[item.status] += 1;
    return totals;
  }, { pending: 0, in_progress: 0, completed: 0, exceeded: 0 }), [workItemProgress]);

  const summaries = useMemo(() => {
    const grouped = new Map();
    measurements.forEach((row) => {
      const key = `${row.sistema_id}:${row.unidad}`;
      const current = grouped.get(key) || {
        key,
        sistemaId: row.sistema_id,
        codigo: row.sistema?.codigo || '—',
        nombre: row.sistema?.nombre || 'Partida no disponible',
        unidad: row.unidad,
        cantidad: 0,
        registros: 0,
        coste: 0,
      };
      current.cantidad += asNumber(row.cantidad_ejecutada);
      current.registros += 1;
      current.coste += asNumber(row.coste_materiales_snapshot)
        + asNumber(row.coste_mano_obra_snapshot)
        + asNumber(row.coste_otros_snapshot);
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  }, [measurements]);

  const openPerformanceSheet = (systemId) => {
    const returnTo = `/gestion/obras/${projectId}?tab=produccion`;
    navigate(`/inventario/rendimientos?sistemaId=${encodeURIComponent(systemId)}&returnTo=${encodeURIComponent(returnTo)}`);
  };

  const selectWorkItem = (workItemId) => {
    const item = workItems.find((candidate) => candidate.id === workItemId);
    setForm((current) => ({
      ...current,
      obra_partida_id: item?.id || '',
      sistema_id: item?.sistema_id || '',
      zona: item?.zona || current.zona,
    }));
  };

  const openRegisterForItem = (item = null) => {
    setForm({
      ...emptyForm(),
      obra_partida_id: item?.id || '',
      sistema_id: item?.sistema_id || '',
      zona: item?.zona || '',
    });
    setDialogOpen(true);
  };

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorkItem) throw new Error('Selecciona una partida de esta obra.');
      if (!selectedSystem) throw new Error('La partida seleccionada no está vinculada a la biblioteca de rendimientos.');
      const quantity = asNumber(form.cantidad_ejecutada);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad ejecutada debe ser mayor que cero.');
      const costs = selectedSystem.costes || {};
      const payload = {
        obra_id: projectId,
        obra_partida_id: selectedWorkItem.id,
        sistema_id: selectedSystem.id,
        fecha: format(form.fecha || today(), 'yyyy-MM-dd'),
        zona: form.zona.trim() || null,
        cantidad_ejecutada: quantity,
        unidad: selectedWorkItem.unidad || selectedSystem.unidad_base,
        coste_materiales_snapshot: asNumber(costs.coste_materiales) * quantity,
        coste_mano_obra_snapshot: asNumber(costs.coste_mano_obra) * quantity,
        coste_otros_snapshot: asNumber(costs.coste_otros) * quantity,
        notas: form.notas.trim() || null,
        created_by: sessionRole?.empleadoId || sessionRole?.id || null,
      };
      const { error } = await supabase.from('obra_sistema_mediciones').insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['obra-production', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['obra-work-items', projectId] }),
      ]);
      setDialogOpen(false);
      setForm(emptyForm());
      toast({
        title: 'Producción registrada',
        description: 'La medición real se ha añadido al historial de la obra.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo registrar la producción',
        description: error.message,
      });
    },
  });

  const loading = libraryQuery.isLoading || measurementsQuery.isLoading || workItemsQuery.isLoading;
  const error = libraryQuery.error || measurementsQuery.error || workItemsQuery.error;

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Cargando producción de la obra…
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-base text-destructive">No se pudo cargar Producción</CardTitle>
          <CardDescription>{error.message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <ClipboardCheck className="h-4 w-4" />
            Diario de ejecución
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Producción y rendimientos</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Registra cuánto trabajo se ha ejecutado realmente. Estos datos servirán para aprender consumos, horas y costes por unidad.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => openRegisterForItem()}
            className="shrink-0"
            disabled={workItemOptions.length === 0}
            title={workItemOptions.length === 0 ? 'No hay partidas de obra vinculadas a rendimientos' : undefined}
          >
            <Plus className="mr-2 h-4 w-4" />
            Registrar producción
          </Button>
        )}
      </div>

      <section className="space-y-3" aria-labelledby="work-items-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 id="work-items-title" className="text-base font-semibold text-foreground">Partidas de la obra</h3>
              <Badge variant="outline" className="font-mono tabular-nums">{workItemProgress.length}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Comparativa entre las cantidades aceptadas en el presupuesto y la producción registrada.
            </p>
          </div>
          {workItemProgress.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{progressTotals.pending} pendientes</Badge>
              <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">{progressTotals.in_progress} en curso</Badge>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{progressTotals.completed} completadas</Badge>
              {progressTotals.exceeded > 0 && (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">{progressTotals.exceeded} con exceso</Badge>
              )}
            </div>
          )}
        </div>

        {workItemProgress.length > 0 ? (
          <Card className="overflow-hidden border-border/60 shadow-sm">
            <div className="hidden grid-cols-[minmax(0,1fr)_100px_100px_100px_140px] gap-4 border-b border-border/60 bg-muted/20 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
              <span>Partida</span>
              <span className="text-right">Previsto</span>
              <span className="text-right">Ejecutado</span>
              <span className="text-right">Pendiente</span>
              <span>Avance</span>
            </div>
            <div className="divide-y divide-border/50">
              {workItemProgress.map((item) => {
                const statusLabel = item.status === 'completed'
                  ? 'Completada'
                  : item.status === 'exceeded'
                    ? 'Exceso'
                    : item.status === 'in_progress'
                      ? 'En curso'
                      : 'Pendiente';
                const statusClasses = item.status === 'completed'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : item.status === 'exceeded'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : item.status === 'in_progress'
                      ? 'border-violet-200 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700';
                const barClasses = item.status === 'completed'
                  ? 'bg-emerald-500'
                  : item.status === 'exceeded'
                    ? 'bg-amber-500'
                    : 'bg-violet-500';
                const StatusIcon = item.status === 'completed'
                  ? CheckCircle2
                  : item.status === 'exceeded'
                    ? AlertTriangle
                    : CircleDashed;

                return (
                  <article
                    key={item.id}
                    className="grid gap-4 px-4 py-4 transition-colors hover:bg-muted/15 md:grid-cols-[minmax(0,1fr)_100px_100px_100px_140px] md:items-center md:px-5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">{item.codigo || 'SIN-CÓDIGO'}</span>
                        <Badge variant="outline" className={`gap-1 text-[10px] ${statusClasses}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-medium leading-snug text-foreground">{item.descripcion}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {item.capitulo && <span>{item.capitulo}</span>}
                        {item.zona && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.zona}</span>}
                        {!item.sistema_id && <span className="font-medium text-amber-700">Sin rendimiento vinculado</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 md:contents">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground md:hidden">Previsto</p>
                        <p className="font-mono text-sm font-semibold tabular-nums text-foreground">{formatQuantity(item.planned)}</p>
                        <p className="text-[11px] text-muted-foreground">{item.unidad}</p>
                      </div>
                      <div className="text-center md:text-right">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground md:hidden">Ejecutado</p>
                        <p className="font-mono text-sm font-semibold tabular-nums text-foreground">{formatQuantity(item.executed)}</p>
                        <p className="text-[11px] text-muted-foreground">{item.unidad}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground md:hidden">Pendiente</p>
                        <p className="font-mono text-sm font-semibold tabular-nums text-foreground">{formatQuantity(item.pending)}</p>
                        <p className="text-[11px] text-muted-foreground">{item.unidad}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{item.percentage}%</span>
                        {canManage && item.sistema_id && (
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary" onClick={() => openRegisterForItem(item)}>
                            Registrar
                          </Button>
                        )}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full transition-[width] ${barClasses}`} style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>
        ) : (
          <Card className="border-dashed border-border/80 bg-muted/10 shadow-none">
            <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <Layers3 className="mb-3 h-6 w-6 text-primary" />
              <p className="font-semibold text-foreground">Esta obra todavía no tiene partidas contratadas</p>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                Las partidas aparecerán aquí al convertir un presupuesto aceptado en obra.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="production-summary-title">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 id="production-summary-title" className="text-sm font-semibold text-foreground">Ejecutado por partida</h3>
            <p className="text-xs text-muted-foreground">Acumulado de todas las mediciones registradas en esta obra.</p>
          </div>
          <Badge variant="outline" className="font-mono tabular-nums">
            {summaries.length} {summaries.length === 1 ? 'partida' : 'partidas'}
          </Badge>
        </div>

        {summaries.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {summaries.map((summary) => (
              <Card key={summary.key} className="border-border/60 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-primary">{summary.codigo}</p>
                      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground">{summary.nombre}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xl font-bold tabular-nums text-foreground">{formatQuantity(summary.cantidad)}</p>
                      <p className="text-xs font-medium text-muted-foreground">{summary.unidad}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                    <span>{summary.registros} {summary.registros === 1 ? 'registro' : 'registros'}</span>
                    {summary.coste > 0 ? (
                      <span>Referencia: {formatCurrency(summary.coste)}</span>
                    ) : canManage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-xs text-primary hover:text-primary"
                        onClick={() => openPerformanceSheet(summary.sistemaId)}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Configurar rendimiento
                      </Button>
                    ) : (
                      <span>Coste pendiente</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-border/80 bg-muted/10 shadow-none">
            <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-4 rounded-full border border-border/60 bg-background p-3">
                <Ruler className="h-6 w-6 text-primary" />
              </div>
              <p className="font-semibold text-foreground">Todavía no hay producción registrada</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Añade la primera medición cuando una partida empiece a ejecutarse en la obra.
              </p>
              {canManage && (
                <Button variant="outline" className="mt-5" onClick={() => openRegisterForItem()} disabled={workItemOptions.length === 0}>
                  Registrar primera medición
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base">Historial de producción</CardTitle>
          <CardDescription>Diario cronológico de mediciones reales.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {measurements.length > 0 ? (
            <div className="divide-y divide-border/50">
              {measurements.map((row) => {
                const totalCost = asNumber(row.coste_materiales_snapshot)
                  + asNumber(row.coste_mano_obra_snapshot)
                  + asNumber(row.coste_otros_snapshot);
                return (
                  <article key={row.id} className="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/20 md:grid-cols-[112px_minmax(0,1fr)_150px] md:items-center md:px-5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <span>{format(parseISO(row.fecha), 'dd MMM yyyy', { locale: es })}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">{row.sistema?.codigo || '—'}</span>
                        <span className="text-sm font-semibold text-foreground">{row.sistema?.nombre || 'Partida no disponible'}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {row.zona && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{row.zona}</span>}
                        {row.notas && <span className="line-clamp-1">{row.notas}</span>}
                      </div>
                    </div>
                    <div className="flex items-end justify-between gap-4 md:block md:text-right">
                      <p className="font-mono text-lg font-bold tabular-nums text-foreground">
                        {formatQuantity(row.cantidad_ejecutada)} <span className="text-sm font-medium text-muted-foreground">{row.unidad}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{totalCost > 0 ? `Ref. ${formatCurrency(totalCost)}` : 'Coste pendiente'}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">El historial aparecerá cuando registres la primera medición.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar producción</DialogTitle>
            <DialogDescription>
              Indica la cantidad realmente ejecutada de una partida contratada. No genera ningún asiento ni movimiento contable.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="space-y-2">
              <Label>Partida de esta obra *</Label>
              <Combobox
                options={workItemOptions}
                value={form.obra_partida_id}
                onSelect={(value) => selectWorkItem(value || '')}
                placeholder="Seleccionar partida contratada…"
                searchPlaceholder="Buscar por código o descripción…"
                emptyText="No se encontró ninguna partida vinculada."
                contentClassName="max-h-[360px]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                      {form.fecha ? format(form.fecha, 'dd/MM/yyyy') : 'Seleccionar fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="single"
                      selected={form.fecha}
                      onSelect={(date) => date && setForm((current) => ({ ...current, fecha: date }))}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="production-zone">Zona de la obra</Label>
                <Input
                  id="production-zone"
                  value={form.zona}
                  onChange={(event) => setForm((current) => ({ ...current, zona: event.target.value }))}
                  placeholder="Ej.: Planta 1 · Salón"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="production-quantity">Cantidad ejecutada *</Label>
              <div className="relative">
                <Input
                  id="production-quantity"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.cantidad_ejecutada}
                  onChange={(event) => setForm((current) => ({ ...current, cantidad_ejecutada: event.target.value }))}
                  placeholder="0"
                  className="pr-16 font-mono tabular-nums"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground">
                  {selectedWorkItem?.unidad || selectedSystem?.unidad_base || 'unidad'}
                </span>
              </div>
              {selectedProgress && (
                <p className="text-xs text-muted-foreground">
                  Previsto: <strong>{formatQuantity(selectedProgress.planned)} {selectedProgress.unidad}</strong>
                  {' · '}Ejecutado: <strong>{formatQuantity(selectedProgress.executed)} {selectedProgress.unidad}</strong>
                  {' · '}Pendiente: <strong>{formatQuantity(selectedProgress.pending)} {selectedProgress.unidad}</strong>
                </p>
              )}
              {selectedProgress && asNumber(form.cantidad_ejecutada) > selectedProgress.pending && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  La cantidad supera lo pendiente. Se permitirá guardarla, pero la partida quedará marcada con exceso de producción.
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="production-notes">Observaciones</Label>
              <Textarea
                id="production-notes"
                value={form.notas}
                onChange={(event) => setForm((current) => ({ ...current, notas: event.target.value }))}
                placeholder="Incidencias, condiciones de trabajo o aclaraciones de la medición…"
                rows={3}
              />
            </div>

            {selectedSystem && selectedWorkItem && (
              <div className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
                <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">{selectedWorkItem.codigo || selectedSystem.codigo} · {selectedWorkItem.descripcion}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Vinculada a {selectedSystem.codigo} · {selectedSystem.nombre}. Los costes son una fotografía de referencia; no sustituyen consumos ni horas reales.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={registerMutation.isPending}>Cancelar</Button>
            <Button
              onClick={() => registerMutation.mutate()}
              disabled={registerMutation.isPending || !form.obra_partida_id || !form.sistema_id || asNumber(form.cantidad_ejecutada) <= 0}
            >
              {registerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
              Guardar medición
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
