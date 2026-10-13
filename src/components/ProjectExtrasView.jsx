import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const CAUSAS = {
  cambio_cliente: 'Cambio solicitado por el cliente',
  vicio_oculto: 'Vicio oculto',
  error_ejecucion: 'Corrección de ejecución',
  imprevisto: 'Imprevisto de obra',
};

const ESTADOS = {
  pendiente_valoracion: { label: 'Pendiente de valorar', className: 'border-amber-300 bg-amber-50 text-amber-800' },
  pendiente_cliente: { label: 'Pendiente del cliente', className: 'border-blue-300 bg-blue-50 text-blue-800' },
  aprobado: { label: 'Aprobado', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  rechazado: { label: 'Rechazado', className: 'border-slate-300 bg-slate-100 text-slate-700' },
};

const EMPTY_FORM = {
  titulo: '',
  descripcion: '',
  estancia: '',
  causa: 'cambio_cliente',
  urgencia: 'normal',
};

const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' });

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const ProjectExtrasView = ({ projectId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [amounts, setAmounts] = useState({ importe_venta: '', coste_estimado: '', observaciones: '' });

  const { data: extras = [], isLoading, error } = useQuery({
    queryKey: ['proyecto_trabajos_extra', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from('proyecto_trabajos_extra')
        .select('*, fotos:proyecto_trabajos_extra_fotos(*)')
        .eq('proyecto_id', projectId)
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;

      return Promise.all((data || []).map(async (extra) => ({
        ...extra,
        fotos: await Promise.all((extra.fotos || []).map(async (foto) => {
          const { data: signed } = await supabase.storage
            .from('proyecto_fotos')
            .createSignedUrl(foto.archivo_path, 60 * 60);
          return { ...foto, signedUrl: signed?.signedUrl || null };
        })),
      })));
    },
  });

  const selected = useMemo(() => extras.find((extra) => extra.id === detailId) || null, [detailId, extras]);

  useEffect(() => {
    if (!selected) return;
    setAmounts({
      importe_venta: selected.importe_venta ?? '',
      coste_estimado: selected.coste_estimado ?? '',
      observaciones: selected.observaciones ?? '',
    });
  }, [selected]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['proyecto_trabajos_extra', projectId] });
  };

  const uploadPhotos = async (extraId, selectedFiles) => {
    for (const file of selectedFiles) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${projectId}/extras/${extraId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('proyecto_fotos').upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error: photoError } = await supabase.from('proyecto_trabajos_extra_fotos').insert({
        trabajo_extra_id: extraId,
        proyecto_id: projectId,
        archivo_path: path,
        nombre_archivo: file.name,
      });
      if (photoError) throw photoError;
    }
  };

  const createExtra = async () => {
    if (!form.titulo.trim() || !form.descripcion.trim()) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Indica un título y explica el trabajo adicional.' });
      return;
    }
    setSaving(true);
    try {
      const { data, error: insertError } = await supabase
        .from('proyecto_trabajos_extra')
        .insert({
          proyecto_id: projectId,
          titulo: form.titulo.trim(),
          descripcion: form.descripcion.trim(),
          estancia: form.estancia.trim() || null,
          causa: form.causa,
          urgencia: form.urgencia,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      if (files.length) await uploadPhotos(data.id, files);

      setForm(EMPTY_FORM);
      setFiles([]);
      setCreateOpen(false);
      await refresh();
      toast({ title: 'Trabajo extra registrado', description: 'Ha quedado pendiente de valoración. Todavía no se ha creado ninguna tarea.' });
    } catch (createError) {
      toast({ variant: 'destructive', title: 'No se pudo registrar', description: createError.message });
    } finally {
      setSaving(false);
    }
  };

  const updateExtra = async (patch, successTitle) => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('proyecto_trabajos_extra')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', selected.id);
      if (updateError) throw updateError;
      await refresh();
      toast({ title: successTitle });
    } catch (updateError) {
      toast({ variant: 'destructive', title: 'No se pudo guardar', description: updateError.message });
    } finally {
      setSaving(false);
    }
  };

  const sendToClient = async () => {
    const importe = toNumberOrNull(amounts.importe_venta);
    if (!importe || importe <= 0) {
      toast({ variant: 'destructive', title: 'Importe requerido', description: 'Indica el precio que se presentará al cliente.' });
      return;
    }
    await updateExtra({
      importe_venta: importe,
      coste_estimado: toNumberOrNull(amounts.coste_estimado),
      observaciones: amounts.observaciones.trim() || null,
      estado: 'pendiente_cliente',
    }, 'Valoración guardada · pendiente de respuesta del cliente');
  };

  const approveExtra = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc('aprobar_trabajo_extra', { p_trabajo_extra_id: selected.id });
      if (rpcError) throw rpcError;
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: ['obra_gantt', projectId] }),
      ]);
      toast({ title: 'Trabajo aprobado y convertido en tarea', description: 'Ya puede asignarse equipo, horas y posición en el cronograma.' });
    } catch (approveError) {
      toast({ variant: 'destructive', title: 'No se pudo aprobar', description: approveError.message });
    } finally {
      setSaving(false);
    }
  };

  const addPhotos = async (event) => {
    const newFiles = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected || !newFiles.length) return;
    setSaving(true);
    try {
      await uploadPhotos(selected.id, newFiles);
      await refresh();
      toast({ title: 'Evidencias añadidas' });
    } catch (uploadError) {
      toast({ variant: 'destructive', title: 'No se pudieron subir las fotos', description: uploadError.message });
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => extras.reduce((acc, extra) => {
    acc[extra.estado] = (acc[extra.estado] || 0) + 1;
    return acc;
  }, {}), [extras]);

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (error) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      No se pudieron cargar los trabajos extra: {error.message}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Trabajos extra y desviaciones</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Control independiente del alcance original. Solo los trabajos aprobados pasan a planificación.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="sm:self-center">
          <Plus className="mr-2 h-4 w-4" /> Registrar trabajo extra
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {Object.entries(ESTADOS).map(([key, value]) => (
          <div key={key} className="rounded-lg border bg-card px-3 py-3">
            <div className="text-2xl font-semibold tabular-nums">{counts[key] || 0}</div>
            <div className="mt-1 text-xs text-muted-foreground">{value.label}</div>
          </div>
        ))}
      </div>

      {extras.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <CircleDollarSign className="mx-auto h-9 w-9 text-muted-foreground/60" />
          <h3 className="mt-3 font-medium">Sin trabajos adicionales</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Cuando aparezca un cambio del cliente, un vicio oculto o un imprevisto, regístralo aquí antes de ejecutarlo.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {extras.map((extra, index) => {
            const status = ESTADOS[extra.estado] || ESTADOS.pendiente_valoracion;
            return (
              <button
                type="button"
                key={extra.id}
                onClick={() => setDetailId(extra.id)}
                className={`flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40 ${index ? 'border-t' : ''}`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${extra.urgencia === 'inmediata' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
                  {extra.urgencia === 'inmediata' ? <AlertTriangle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{extra.titulo}</span>
                    <Badge variant="outline" className={status.className}>{status.label}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{CAUSAS[extra.causa]}</span>
                    {extra.estancia && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{extra.estancia}</span>}
                    <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" />{extra.fotos?.length || 0}</span>
                    {extra.importe_venta !== null && <span>{currency.format(extra.importe_venta)}</span>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar trabajo extra</DialogTitle>
            <DialogDescription>Déjalo documentado antes de ejecutarlo. No aparecerá como tarea hasta su aprobación.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="extra-title">Título breve *</Label>
              <Input id="extra-title" value={form.titulo} onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))} placeholder="Ej. Sustituir bajante oculta deteriorada" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Causa *</Label>
                <Select value={form.causa} onValueChange={(value) => setForm((prev) => ({ ...prev, causa: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CAUSAS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Urgencia</Label>
                <Select value={form.urgencia} onValueChange={(value) => setForm((prev) => ({ ...prev, urgencia: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="inmediata">Inmediata</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra-room">Estancia o zona</Label>
              <Input id="extra-room" value={form.estancia} onChange={(e) => setForm((prev) => ({ ...prev, estancia: e.target.value }))} placeholder="Ej. Cocina, baño principal, portal…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra-description">Qué ha ocurrido y qué trabajo requiere *</Label>
              <Textarea id="extra-description" rows={5} value={form.descripcion} onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))} placeholder="Describe el hallazgo, el alcance adicional y cualquier condicionante." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra-photos">Evidencias</Label>
              <label htmlFor="extra-photos" className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground transition-colors hover:bg-muted/40">
                <Camera className="h-5 w-5" />
                {files.length ? `${files.length} foto${files.length === 1 ? '' : 's'} seleccionada${files.length === 1 ? '' : 's'}` : 'Hacer fotos o elegir de la galería'}
              </label>
              <input id="extra-photos" type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createExtra} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2 pr-7">
                  <DialogTitle>{selected.titulo}</DialogTitle>
                  <Badge variant="outline" className={(ESTADOS[selected.estado] || ESTADOS.pendiente_valoracion).className}>
                    {(ESTADOS[selected.estado] || ESTADOS.pendiente_valoracion).label}
                  </Badge>
                </div>
                <DialogDescription>{CAUSAS[selected.causa]}{selected.estancia ? ` · ${selected.estancia}` : ''}</DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <p className="whitespace-pre-wrap text-sm leading-6">{selected.descripcion}</p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Evidencias ({selected.fotos?.length || 0})</Label>
                    {selected.estado !== 'rechazado' && (
                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={saving}>
                        <Camera className="mr-2 h-4 w-4" /> Añadir
                      </Button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={addPhotos} />
                  </div>
                  {selected.fotos?.length ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {selected.fotos.map((foto) => (
                        <a key={foto.id} href={foto.signedUrl || '#'} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg border bg-muted">
                          {foto.signedUrl ? <img src={foto.signedUrl} alt="Evidencia del trabajo extra" className="h-full w-full object-cover" /> : <ImageIcon className="m-auto h-5 w-5" />}
                        </a>
                      ))}
                    </div>
                  ) : <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Todavía no hay fotografías.</p>}
                </div>

                {selected.estado !== 'rechazado' && selected.estado !== 'aprobado' && (
                  <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="extra-price">Precio para el cliente (€) *</Label>
                        <Input id="extra-price" inputMode="decimal" value={amounts.importe_venta} onChange={(e) => setAmounts((prev) => ({ ...prev, importe_venta: e.target.value }))} placeholder="0,00" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="extra-cost">Coste estimado interno (€)</Label>
                        <Input id="extra-cost" inputMode="decimal" value={amounts.coste_estimado} onChange={(e) => setAmounts((prev) => ({ ...prev, coste_estimado: e.target.value }))} placeholder="0,00" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="extra-notes">Notas de valoración</Label>
                      <Textarea id="extra-notes" rows={3} value={amounts.observaciones} onChange={(e) => setAmounts((prev) => ({ ...prev, observaciones: e.target.value }))} placeholder="Materiales, horas previstas o condiciones comunicadas al cliente." />
                    </div>
                  </div>
                )}

                {selected.estado === 'aprobado' && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <div className="flex items-center gap-2 font-medium"><Check className="h-4 w-4" /> Aprobado y enviado a planificación</div>
                    <div className="mt-1">Precio aprobado: {currency.format(selected.importe_venta || 0)}</div>
                    {selected.aprobado_at && <div className="mt-1 text-xs text-emerald-800">Registrado el {dateTime.format(new Date(selected.aprobado_at))}</div>}
                  </div>
                )}

                {selected.estado === 'rechazado' && (
                  <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">El cliente no ha aprobado este trabajo. No se ha generado ninguna tarea.</div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                {selected.estado === 'pendiente_valoracion' && (
                  <Button onClick={sendToClient} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar y pasar al cliente</Button>
                )}
                {selected.estado === 'pendiente_cliente' && (
                  <>
                    <Button variant="outline" className="text-slate-700" onClick={() => updateExtra({ estado: 'rechazado' }, 'Trabajo marcado como rechazado')} disabled={saving}>
                      <X className="mr-2 h-4 w-4" /> Rechazado
                    </Button>
                    <Button onClick={approveExtra} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Aprobado por el cliente
                    </Button>
                  </>
                )}
                {selected.estado === 'rechazado' && (
                  <Button variant="outline" onClick={() => updateExtra({ estado: 'pendiente_valoracion' }, 'Trabajo reabierto')} disabled={saving}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Reabrir
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectExtrasView;
