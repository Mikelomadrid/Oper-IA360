import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Camera, CheckCircle2, Clock3, ExternalLink, Image as ImageIcon, Loader2, RotateCcw, Users, X } from 'lucide-react';
import { RadioGroup as ShadRadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const EMPTY_DETAILS = { orders: [], sessions: [], employees: [], evidences: [] };

const formatHours = (minutes) => `${(Number(minutes || 0) / 60).toLocaleString('es-ES', { maximumFractionDigits: 2 })} h`;
const formatPlannedHours = (hours) => `${Number(hours || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })} h`;
const employeeName = (employee) => [employee?.nombre, employee?.apellidos].filter(Boolean).join(' ') || employee?.email || 'Empleado sin identificar';
const formatEvidenceDate = (value) => value
  ? new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : 'Fecha no disponible';

const signEvidence = async (evidence) => {
  const rawPath = evidence.archivo_path || evidence.archivo_url;
  if (!rawPath) return { ...evidence, signedUrl: null };
  if (/^https?:\/\//i.test(rawPath)) return { ...evidence, signedUrl: rawPath };
  const storagePath = rawPath.replace(/^proyecto_fotos\//, '');
  const { data, error } = await supabase.storage.from('proyecto_fotos').createSignedUrl(storagePath, 60 * 60);
  return { ...evidence, signedUrl: error ? null : data?.signedUrl || null };
};

const RevisionTareaModal = ({ isOpen, onClose, onSubmitted, task }) => {
  const [aprobado, setAprobado] = useState(true);
  const [comentario, setComentario] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [selectedEvidence, setSelectedEvidence] = useState(null);

  useEffect(() => {
    if (!isOpen || !task?.id) return undefined;
    let cancelled = false;

    const loadDetails = async () => {
      setAprobado(true);
      setComentario('');
      setSelectedEvidence(null);
      setLoadError('');
      setDetails(EMPTY_DETAILS);
      setIsLoading(true);
      try {
        const [ordersResult, sessionsResult, newEvidenceResult, legacyEvidenceResult] = await Promise.all([
          supabase.from('ordenes_trabajo_diarias').select('id,empleado_id,estado,horas_previstas,notas_encargado,resultado_notas,iniciada_at,cerrada_at,asignada_at').eq('tarea_id', task.id).order('asignada_at', { ascending: true }),
          supabase.from('tarea_sesiones_trabajo').select('id,empleado_id,estado,inicio_at,fin_at,minutos_acumulados,notas,fecha_trabajo').eq('tarea_id', task.id).order('inicio_at', { ascending: true }),
          supabase.from('ordenes_trabajo_evidencias').select('id,orden_trabajo_id,empleado_id,momento,archivo_path,created_at').eq('tarea_id', task.id).order('created_at', { ascending: true }),
          supabase.rpc('get_evidencias_por_tarea', { p_tarea_id: task.id }),
        ]);
        const firstError = [ordersResult.error, sessionsResult.error, newEvidenceResult.error].find(Boolean);
        if (firstError) throw firstError;

        const orders = ordersResult.data || [];
        const sessions = sessionsResult.data || [];
        const newEvidences = (newEvidenceResult.data || []).map((evidence) => ({ ...evidence, source: 'orden', uploadedAt: evidence.created_at }));
        const legacyEvidences = legacyEvidenceResult.error ? [] : (legacyEvidenceResult.data || []).map((evidence) => ({
          ...evidence,
          id: evidence.evidencia_id,
          source: 'subtarea',
          momento: 'finalizacion',
          uploadedAt: evidence.fecha_subida,
        }));
        const employeeIds = [...new Set([
          ...orders.map((order) => order.empleado_id),
          ...sessions.map((session) => session.empleado_id),
          ...newEvidences.map((evidence) => evidence.empleado_id),
          ...legacyEvidences.map((evidence) => evidence.empleado_id),
        ].filter(Boolean))];
        const employeesResult = employeeIds.length
          ? await supabase.from('empleados').select('id,nombre,apellidos,email').in('id', employeeIds)
          : { data: [], error: null };
        if (employeesResult.error) throw employeesResult.error;
        const evidences = await Promise.all([...newEvidences, ...legacyEvidences].map(signEvidence));
        if (!cancelled) setDetails({ orders, sessions, employees: employeesResult.data || [], evidences });
      } catch (error) {
        console.error('Error cargando la revisión de tarea:', error);
        if (!cancelled) setLoadError(error.message || 'No se pudo cargar el detalle de revisión.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadDetails();
    return () => { cancelled = true; };
  }, [isOpen, task]);

  const employeesById = useMemo(() => new Map(details.employees.map((employee) => [employee.id, employee])), [details.employees]);
  const responsibleIds = useMemo(() => [...new Set([
    ...details.orders.map((order) => order.empleado_id),
    ...details.sessions.map((session) => session.empleado_id),
  ].filter(Boolean))], [details.orders, details.sessions]);
  const plannedHours = useMemo(() => details.orders.reduce((total, order) => total + Number(order.horas_previstas || 0), 0), [details.orders]);
  const actualMinutes = useMemo(() => details.sessions.reduce((total, session) => total + Number(session.minutos_acumulados || 0), 0), [details.sessions]);
  const hasEvidence = details.evidences.length > 0;

  const handleSave = async () => {
    if (aprobado && !hasEvidence) {
      toast({ variant: 'destructive', title: 'Faltan fotografías', description: 'No se puede aprobar una tarea sin al menos una evidencia.' });
      return;
    }
    if (!aprobado && !comentario.trim()) {
      toast({ variant: 'destructive', title: 'Comentario requerido', description: 'Indica qué debe corregirse antes de devolver la tarea.' });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('admin_guardar_revision_tarea', {
        p_tarea_id: task.id,
        p_resultado: aprobado ? 'aprobada' : 'rechazada',
        p_comentario: comentario.trim() || null,
      });
      if (error) throw error;
      toast({
        title: aprobado ? 'Tarea aprobada' : 'Tarea devuelta para corregir',
        description: aprobado ? 'El trabajo queda validado por el encargado.' : 'La tarea vuelve al equipo conservando la indicación de corrección.',
      });
      onSubmitted?.();
      onClose();
    } catch (error) {
      console.error('Error validando tarea:', error);
      toast({ variant: 'destructive', title: 'Error al validar', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setSelectedEvidence(null); onClose(); } }}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-5 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">Pendiente de revisión</Badge>
            {task?.nombre_proyecto && <span className="text-xs text-muted-foreground">{task.nombre_proyecto}</span>}
          </div>
          <DialogTitle className="pt-1 text-xl">{task?.titulo || 'Revisión de tarea'}</DialogTitle>
          <DialogDescription>Comprueba las evidencias y el tiempo registrado antes de tomar una decisión.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex min-h-[280px] items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Preparando la revisión…</div>
          ) : loadError ? (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div><p className="font-semibold">No se pudo cargar el detalle</p><p className="mt-0.5">{loadError}</p></div>
            </div>
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen de revisión">
                <div className="rounded-lg border border-border/60 bg-muted/15 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Users className="h-4 w-4" />Responsables</div>
                  <p className="mt-2 text-sm font-semibold">{responsibleIds.length || 'Sin asignación'}</p>
                  {responsibleIds.length > 0 && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{responsibleIds.map((id) => employeeName(employeesById.get(id))).join(', ')}</p>}
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/15 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Clock3 className="h-4 w-4" />Tiempo</div>
                  <div className="mt-2 flex items-baseline gap-2"><span className="font-mono text-lg font-bold tabular-nums">{formatHours(actualMinutes)}</span><span className="text-xs text-muted-foreground">reales</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatPlannedHours(plannedHours)} previstas</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/15 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Camera className="h-4 w-4" />Evidencias</div>
                  <p className="mt-2 font-mono text-lg font-bold tabular-nums">{details.evidences.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">fotografías registradas</p>
                </div>
              </section>

              {task?.descripcion && (
                <section className="rounded-lg border border-border/60 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trabajo indicado</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{task.descripcion}</p>
                </section>
              )}

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div><h3 className="text-sm font-semibold">Fotografías aportadas</h3><p className="text-xs text-muted-foreground">Cada imagen conserva el empleado, la fecha y la hora de subida.</p></div>
                  <Badge variant="outline" className="font-mono tabular-nums">{details.evidences.length}</Badge>
                </div>
                {!hasEvidence ? (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div><p className="font-semibold">No hay fotografías</p><p className="mt-0.5 text-amber-800">La aprobación queda bloqueada hasta que el técnico aporte al menos una evidencia.</p></div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {details.evidences.map((evidence) => (
                      <article key={`${evidence.source}-${evidence.id}`} className="overflow-hidden rounded-lg border border-border/60 bg-card">
                        {evidence.signedUrl ? (
                          <button type="button" onClick={() => setSelectedEvidence(evidence)} className="group block w-full bg-muted/25 text-left" aria-label={`Ampliar evidencia de ${evidence.empleado_nombre || employeeName(employeesById.get(evidence.empleado_id))}`}>
                            <img src={evidence.signedUrl} alt="Evidencia de la tarea" className="h-36 w-full object-cover transition-opacity group-hover:opacity-90" />
                          </button>
                        ) : (
                          <div className="flex h-36 items-center justify-center bg-muted/30 text-muted-foreground"><ImageIcon className="h-7 w-7" /></div>
                        )}
                        <div className="space-y-1.5 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className={evidence.momento === 'inicio' ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}>{evidence.momento === 'inicio' ? 'Inicio' : 'Finalización'}</Badge>
                            {evidence.signedUrl && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
                          </div>
                          <p className="truncate text-xs font-medium">{evidence.empleado_nombre || employeeName(employeesById.get(evidence.empleado_id))}</p>
                          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{formatEvidenceDate(evidence.uploadedAt)}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="border-t border-border/60 pt-5">
                <ShadRadioGroup value={aprobado ? 'aprobar' : 'devolver'} onValueChange={(value) => setAprobado(value === 'aprobar')} className="grid gap-3 sm:grid-cols-2">
                  <Label htmlFor="r-aprobar" className={`cursor-pointer rounded-lg border p-4 transition-colors ${aprobado ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200' : 'border-border/60 hover:bg-muted/30'}`}>
                    <div className="flex items-start gap-3"><RadioGroupItem value="aprobar" id="r-aprobar" className="mt-0.5" /><div><span className="flex items-center gap-1.5 font-semibold text-emerald-900"><CheckCircle2 className="h-4 w-4" />Aprobar trabajo</span><p className="mt-1 text-xs font-normal text-emerald-800">La tarea quedará validada y cerrada.</p></div></div>
                  </Label>
                  <Label htmlFor="r-devolver" className={`cursor-pointer rounded-lg border p-4 transition-colors ${!aprobado ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-200' : 'border-border/60 hover:bg-muted/30'}`}>
                    <div className="flex items-start gap-3"><RadioGroupItem value="devolver" id="r-devolver" className="mt-0.5" /><div><span className="flex items-center gap-1.5 font-semibold text-amber-950"><RotateCcw className="h-4 w-4" />Devolver para corregir</span><p className="mt-1 text-xs font-normal text-amber-800">Volverá a aparecer al equipo con tu indicación.</p></div></div>
                  </Label>
                </ShadRadioGroup>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="comentario-revision">Comentario {aprobado ? '(opcional)' : '(obligatorio)'}</Label>
                  <Textarea id="comentario-revision" placeholder={aprobado ? 'Observación para el historial…' : 'Explica de forma concreta qué debe corregirse…'} value={comentario} onChange={(event) => setComentario(event.target.value)} className="min-h-[96px]" />
                </div>
              </section>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 bg-card px-6 py-4 shadow-[0_-6px_18px_rgba(15,23,42,0.05)]">
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="w-full sm:w-auto">Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading || Boolean(loadError) || (aprobado && !hasEvidence) || (!aprobado && !comentario.trim())} className={`w-full sm:w-auto ${aprobado ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 text-white hover:bg-amber-700'}`}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : aprobado ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            {aprobado ? 'Guardar y aprobar' : 'Guardar y devolver'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(selectedEvidence)} onOpenChange={(open) => { if (!open) setSelectedEvidence(null); }}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] max-w-[96vw] flex-col gap-0 overflow-hidden border-slate-800 bg-slate-950 p-0 text-white [&>button.absolute]:hidden">
        <DialogHeader className="shrink-0 flex-row items-center justify-between space-y-0 border-b border-white/10 px-4 py-3 pr-4 text-left sm:px-5">
          <div className="min-w-0">
            <DialogTitle className="truncate text-base text-white">Evidencia fotográfica</DialogTitle>
            <DialogDescription className="mt-1 truncate text-xs text-slate-300">
              {selectedEvidence ? `${selectedEvidence.empleado_nombre || employeeName(employeesById.get(selectedEvidence.empleado_id))} · ${formatEvidenceDate(selectedEvidence.uploadedAt)}` : ''}
            </DialogDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => setSelectedEvidence(null)} className="ml-4 shrink-0 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <X className="mr-2 h-4 w-4" />
            Cerrar imagen
          </Button>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-3 sm:p-5">
          {selectedEvidence?.signedUrl && (
            <img src={selectedEvidence.signedUrl} alt="Evidencia ampliada de la tarea" className="max-h-full max-w-full rounded-md object-contain" />
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default RevisionTareaModal;
