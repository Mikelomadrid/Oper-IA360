import React, { useEffect, useMemo, useState } from 'react';
import {
  Bluetooth,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Copy,
  CopyPlus,
  Home,
  Loader2,
  Plus,
  RotateCcw,
  Ruler,
  Save,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import BluetoothLaserTester from './BluetoothLaserTester';

const DRAFT_KEY = 'orkaled:mediciones:visita-rapida:v1';

const PRIMARY_ROOMS = [
  'Entrada / recibidor',
  'Salón',
  'Comedor',
  'Cocina',
  'Dormitorio',
  'Baño',
  'Aseo',
  'Pasillo',
  'Distribuidor',
  'Terraza / balcón',
];

const SECONDARY_ROOMS = [
  'Despacho',
  'Vestidor',
  'Lavadero / tendedero',
  'Despensa',
  'Trastero',
  'Escalera',
  'Buhardilla',
  'Sótano',
  'Garaje',
  'Cuarto de instalaciones',
  'Patio',
  'Porche',
  'Jardín / exterior',
  'Fachada',
  'Cubierta / tejado',
];

const EMPTY_DRAFT = {
  propertyType: 'vivienda',
  generalHeight: '',
  generalHeightSource: 'manual',
  rooms: [],
};

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `room-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseMeasure(value) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatMeasure(value, decimals = 2) {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getRoomMetrics(room, generalHeight) {
  const measureA = parseMeasure(room.measureA);
  const measureB = parseMeasure(room.measureB);
  const inheritedHeight = room.useCustomHeight ? room.height : generalHeight;
  const height = parseMeasure(inheritedHeight);
  const length = measureA && measureB ? Math.max(measureA, measureB) : null;
  const width = measureA && measureB ? Math.min(measureA, measureB) : null;
  const floor = length && width ? length * width : null;
  const perimeter = length && width ? 2 * (length + width) : null;
  const walls = perimeter && height ? perimeter * height : null;

  return {
    measureA,
    measureB,
    height,
    length,
    width,
    floor,
    ceiling: floor,
    perimeter,
    walls,
    complete: Boolean(length && width && height),
  };
}

function readDraft(draftKey) {
  if (typeof window === 'undefined') return EMPTY_DRAFT;
  try {
    const stored = window.localStorage.getItem(draftKey);
    if (!stored) return EMPTY_DRAFT;
    const parsed = JSON.parse(stored);
    return {
      ...EMPTY_DRAFT,
      ...parsed,
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export default function MedicionVisitMode({
  open,
  onOpenChange,
  onSaved,
  originType = 'libre',
  originId = null,
  contextLabel = '',
}) {
  const draftKey = `${DRAFT_KEY}:${originType}:${originId || 'general'}`;
  const [draft, setDraft] = useState(() => readDraft(draftKey));
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [laserOpen, setLaserOpen] = useState(false);
  const [laserTarget, setLaserTarget] = useState(null);

  useEffect(() => {
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draft, draftKey]);

  useEffect(() => {
    if (!open) return;
    if (!activeRoomId && draft.rooms.length > 0) {
      setActiveRoomId(draft.rooms[0].id);
    }
  }, [activeRoomId, draft.rooms, open]);

  const activeRoom = draft.rooms.find((room) => room.id === activeRoomId) || null;
  const activeMetrics = activeRoom ? getRoomMetrics(activeRoom, draft.generalHeight) : null;
  const completedRooms = draft.rooms.filter((room) => getRoomMetrics(room, draft.generalHeight).complete);

  const totals = useMemo(() => draft.rooms.reduce((result, room) => {
    const metrics = getRoomMetrics(room, draft.generalHeight);
    return {
      floor: result.floor + (metrics.floor || 0),
      walls: result.walls + (metrics.walls || 0),
      perimeter: result.perimeter + (metrics.perimeter || 0),
    };
  }, { floor: 0, walls: 0, perimeter: 0 }), [draft.generalHeight, draft.rooms]);

  const addRoom = (baseName, template = {}) => {
    const id = createId();
    setDraft((current) => {
      const matching = current.rooms.filter((room) => room.baseName === baseName);
      const nextRooms = current.rooms.map((room) => (
        matching.length === 1 && room.name === baseName
          ? { ...room, name: `${baseName} 1` }
          : room
      ));
      const sequence = matching.length + 1;
      const name = matching.length === 0 ? baseName : `${baseName} ${sequence}`;
      return {
        ...current,
        rooms: [...nextRooms, {
          id,
          baseName,
          name,
          isCustom: Boolean(template.isCustom),
          measureA: template.measureA || '',
          measureB: template.measureB || '',
          height: template.height || '',
          useCustomHeight: Boolean(template.useCustomHeight),
          sources: template.sources || { measureA: 'manual', measureB: 'manual', height: 'manual' },
          savedId: null,
        }],
      };
    });
    setActiveRoomId(id);
  };

  const addCustomRoom = () => {
    const name = customName.trim() || 'Espacio personalizado';
    addRoom(name, { isCustom: true });
    setCustomName('');
  };

  const updateRoom = (roomId, patch) => {
    setDraft((current) => ({
      ...current,
      rooms: current.rooms.map((room) => (
        room.id === roomId ? { ...room, ...patch } : room
      )),
    }));
  };

  const removeRoom = (roomId) => {
    setDraft((current) => ({
      ...current,
      rooms: current.rooms.filter((room) => room.id !== roomId),
    }));
    if (activeRoomId === roomId) setActiveRoomId(null);
  };

  const duplicateRoom = (room, includeMeasures) => {
    addRoom(room.baseName, includeMeasures ? {
      isCustom: room.isCustom,
      measureA: room.measureA,
      measureB: room.measureB,
      height: room.height,
      useCustomHeight: room.useCustomHeight,
      sources: room.sources,
    } : { isCustom: room.isCustom });
  };

  const openLaserFor = (target) => {
    setLaserTarget(target);
    setLaserOpen(true);
  };

  const useLaserMeasurement = (value) => {
    const formatted = String(Number(value.toFixed(3)));
    if (laserTarget?.kind === 'generalHeight') {
      setDraft((current) => ({
        ...current,
        generalHeight: formatted,
        generalHeightSource: 'glm',
      }));
      return;
    }
    if (!laserTarget?.roomId || !laserTarget?.field) return;
    setDraft((current) => ({
      ...current,
      rooms: current.rooms.map((room) => (
        room.id === laserTarget.roomId
          ? {
            ...room,
            [laserTarget.field]: formatted,
            sources: { ...room.sources, [laserTarget.field]: 'glm' },
          }
          : room
      )),
    }));
  };

  const resetVisit = () => {
    if (draft.rooms.length > 0 && !window.confirm('¿Quieres borrar el borrador de esta visita y comenzar de nuevo?')) return;
    setDraft(EMPTY_DRAFT);
    setActiveRoomId(null);
    window.localStorage.removeItem(draftKey);
  };

  const saveMeasurements = async () => {
    if (completedRooms.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No hay espacios completos',
        description: 'Introduce Medida A, Medida B y una altura antes de guardar.',
      });
      return;
    }

    setSaving(true);
    try {
      const savedIds = {};
      for (const room of completedRooms) {
        const metrics = getRoomMetrics(room, draft.generalHeight);
        let measurementId = room.savedId;

        if (measurementId) {
          const { error: updateError } = await supabase
            .from('mediciones')
            .update({ nombre: room.name })
            .eq('id', measurementId);
          if (updateError) throw updateError;
          const { error: deleteError } = await supabase
            .from('medicion_lineas')
            .delete()
            .eq('medicion_id', measurementId);
          if (deleteError) throw deleteError;
        } else {
          const { data, error: measurementError } = await supabase
            .from('mediciones')
            .insert({
              nombre: room.name,
              origen_tipo: originType,
              origen_id: originId,
            })
            .select('id')
            .single();
          if (measurementError) throw measurementError;
          measurementId = data.id;
        }

        const { error: lineError } = await supabase.from('medicion_lineas').insert({
          medicion_id: measurementId,
          ancho: metrics.width,
          largo: metrics.length,
          altura: metrics.height,
          orden: 1,
        });
        if (lineError) throw lineError;
        savedIds[room.id] = measurementId;
      }

      setDraft((current) => ({
        ...current,
        rooms: current.rooms.map((room) => (
          savedIds[room.id] ? { ...room, savedId: savedIds[room.id] } : room
        )),
      }));
      toast({
        title: 'Mediciones guardadas',
        description: `${completedRooms.length} espacio${completedRooms.length === 1 ? '' : 's'} sincronizado${completedRooms.length === 1 ? '' : 's'} correctamente.`,
      });
      onSaved?.({
        originType,
        originId,
        rooms: completedRooms.map((room) => ({
          ...room,
          savedId: savedIds[room.id] || room.savedId,
          metrics: getRoomMetrics(room, draft.generalHeight),
        })),
      });
    } catch (saveError) {
      console.error('Error saving visit measurements:', saveError);
      toast({
        variant: 'destructive',
        title: 'No se pudieron guardar las mediciones',
        description: `${saveError.message || 'El borrador continúa guardado en este dispositivo.'}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const laserLabel = laserTarget?.kind === 'generalHeight'
    ? 'Altura general'
    : `${activeRoom?.name || 'Espacio'} · ${laserTarget?.field === 'measureA' ? 'Medida A' : laserTarget?.field === 'measureB' ? 'Medida B' : 'Altura'}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[96vh] w-[calc(100vw-0.75rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:h-[92vh]">
          <DialogHeader className="border-b bg-card px-4 py-4 pr-12 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700">
                <Ruler className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Modo visita · Mediciones rápidas</DialogTitle>
                <DialogDescription>
                  {contextLabel ? `${contextLabel}. ` : ''}Selecciona espacios, mide y guarda. El borrador permanece en este dispositivo.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[360px_minmax(0,1fr)] lg:overflow-hidden">
            <aside className="space-y-5 border-b bg-muted/20 p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r sm:p-5">
              <div className="space-y-2">
                <Label>Tipo de inmueble</Label>
                <Select value={draft.propertyType} onValueChange={(value) => setDraft((current) => ({ ...current, propertyType: value }))}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vivienda">Vivienda</SelectItem>
                    <SelectItem value="comunidad" disabled>Comunidad · próximamente</SelectItem>
                    <SelectItem value="sanitario" disabled>Centro sanitario · próximamente</SelectItem>
                    <SelectItem value="empresa" disabled>Empresa/local · próximamente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label htmlFor="visit-general-height">Altura general</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Se aplicará a todos los espacios salvo que indiques otra.</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 bg-background">
                    {draft.generalHeightSource === 'glm' ? 'GLM' : 'Manual'}
                  </Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="visit-general-height"
                      inputMode="decimal"
                      value={draft.generalHeight}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        generalHeight: event.target.value,
                        generalHeightSource: 'manual',
                      }))}
                      placeholder="2,50"
                      className="pr-9 font-mono tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">m</span>
                  </div>
                  <Button type="button" variant="outline" size="icon" onClick={() => openLaserFor({ kind: 'generalHeight' })} aria-label="Medir altura general con GLM">
                    <Bluetooth className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Espacios habituales</p>
                  <Badge variant="secondary">{draft.rooms.length}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PRIMARY_ROOMS.map((room) => (
                    <Button key={room} type="button" variant="outline" className="h-auto min-h-11 justify-start whitespace-normal bg-card px-3 py-2 text-left" onClick={() => addRoom(room)}>
                      <Plus className="mr-2 h-3.5 w-3.5 shrink-0 text-violet-600" />{room}
                    </Button>
                  ))}
                </div>
              </div>

              <details className="rounded-lg border bg-card p-3">
                <summary className="cursor-pointer text-sm font-semibold">Más espacios</summary>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {SECONDARY_ROOMS.map((room) => (
                    <Button key={room} type="button" variant="ghost" className="h-auto min-h-10 justify-start whitespace-normal px-2 py-2 text-left text-xs" onClick={() => addRoom(room)}>
                      <Plus className="mr-1.5 h-3.5 w-3.5 shrink-0" />{room}
                    </Button>
                  ))}
                </div>
              </details>

              <div className="rounded-lg border border-dashed bg-card p-3">
                <Label htmlFor="custom-room-name">Otro espacio</Label>
                <div className="mt-2 flex gap-2">
                  <Input id="custom-room-name" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Nombre opcional" onKeyDown={(event) => { if (event.key === 'Enter') addCustomRoom(); }} />
                  <Button type="button" onClick={addCustomRoom}><Plus className="mr-1 h-4 w-4" />Añadir</Button>
                </div>
              </div>
            </aside>

            <main className="min-h-0 space-y-5 p-4 lg:overflow-y-auto sm:p-6">
              <div className="grid grid-cols-3 gap-2 rounded-lg border bg-card p-3 sm:gap-4 sm:p-4">
                <div><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Suelo/techo</p><p className="mt-1 font-mono text-lg font-semibold tabular-nums sm:text-xl">{formatMeasure(totals.floor)} <span className="text-xs font-normal text-muted-foreground">m²</span></p></div>
                <div><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Paredes</p><p className="mt-1 font-mono text-lg font-semibold tabular-nums sm:text-xl">{formatMeasure(totals.walls)} <span className="text-xs font-normal text-muted-foreground">m²</span></p></div>
                <div><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Rodapié</p><p className="mt-1 font-mono text-lg font-semibold tabular-nums sm:text-xl">{formatMeasure(totals.perimeter)} <span className="text-xs font-normal text-muted-foreground">ml</span></p></div>
              </div>

              {draft.rooms.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 p-8 text-center">
                  <Home className="h-9 w-9 text-violet-500" />
                  <h3 className="mt-4 font-semibold">Añade la primera estancia</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">Pulsa un espacio del listado. No necesitas escribir nombres ni seguir un orden fijo.</p>
                </div>
              ) : (
                <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Estancias de la visita</p>
                    {draft.rooms.map((room) => {
                      const metrics = getRoomMetrics(room, draft.generalHeight);
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => setActiveRoomId(room.id)}
                          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${activeRoomId === room.id ? 'border-violet-300 bg-violet-50' : 'bg-card hover:bg-muted/30'}`}
                        >
                          {metrics.complete ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <CircleDashed className="h-4 w-4 shrink-0 text-amber-500" />}
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{room.name}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>

                  {activeRoom && activeMetrics && (
                    <Card className="border-border/70 shadow-sm">
                      <CardHeader className="border-b bg-muted/20 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <Label htmlFor="active-room-name" className="sr-only">Nombre del espacio</Label>
                            <Input id="active-room-name" value={activeRoom.name} onChange={(event) => updateRoom(activeRoom.id, { name: event.target.value })} className="h-9 max-w-md bg-background font-semibold" />
                          </div>
                          <Badge className={activeMetrics.complete ? 'bg-emerald-600' : ''} variant={activeMetrics.complete ? 'default' : 'outline'}>{activeMetrics.complete ? 'Completa' : 'Pendiente'}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-5 p-4 sm:p-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                          {[
                            { field: 'measureA', label: 'Medida A' },
                            { field: 'measureB', label: 'Medida B' },
                          ].map(({ field, label }) => (
                            <div key={field} className="space-y-2">
                              <div className="flex items-center justify-between gap-2"><Label htmlFor={`${activeRoom.id}-${field}`}>{label}</Label><Badge variant="outline" className="bg-background text-[10px]">{activeRoom.sources?.[field] === 'glm' ? 'GLM' : 'Manual'}</Badge></div>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Input id={`${activeRoom.id}-${field}`} inputMode="decimal" value={activeRoom[field]} onChange={(event) => updateRoom(activeRoom.id, { [field]: event.target.value, sources: { ...activeRoom.sources, [field]: 'manual' } })} placeholder="0,000" className="pr-9 font-mono tabular-nums" />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">m</span>
                                </div>
                                <Button type="button" variant="outline" size="icon" onClick={() => openLaserFor({ roomId: activeRoom.id, field })} aria-label={`Medir ${label} con GLM`}><Bluetooth className="h-4 w-4" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-lg border bg-muted/10 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">Altura</p>
                              {!activeRoom.useCustomHeight && <p className="mt-0.5 text-xs text-muted-foreground">Heredada de la vivienda: {draft.generalHeight ? `${draft.generalHeight} m` : 'sin indicar'}</p>}
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => updateRoom(activeRoom.id, { useCustomHeight: !activeRoom.useCustomHeight })}>
                              {activeRoom.useCustomHeight ? 'Usar altura general' : 'Usar otra altura'}
                            </Button>
                          </div>
                          {activeRoom.useCustomHeight && (
                            <div className="mt-3 flex max-w-xs gap-2">
                              <div className="relative flex-1"><Input inputMode="decimal" value={activeRoom.height} onChange={(event) => updateRoom(activeRoom.id, { height: event.target.value, sources: { ...activeRoom.sources, height: 'manual' } })} placeholder="2,500" className="pr-9 font-mono tabular-nums" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">m</span></div>
                              <Button type="button" variant="outline" size="icon" onClick={() => openLaserFor({ roomId: activeRoom.id, field: 'height' })} aria-label="Medir altura con GLM"><Bluetooth className="h-4 w-4" /></Button>
                            </div>
                          )}
                        </div>

                        {activeMetrics.measureA && activeMetrics.measureB && (
                          <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-violet-950"><CheckCircle2 className="h-4 w-4 text-violet-600" />Dimensiones ordenadas automáticamente</div>
                            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                              <div><dt className="text-xs text-muted-foreground">Largo</dt><dd className="font-mono font-semibold">{formatMeasure(activeMetrics.length, 3)} m</dd></div>
                              <div><dt className="text-xs text-muted-foreground">Ancho</dt><dd className="font-mono font-semibold">{formatMeasure(activeMetrics.width, 3)} m</dd></div>
                              <div><dt className="text-xs text-muted-foreground">Suelo/techo</dt><dd className="font-mono font-semibold">{formatMeasure(activeMetrics.floor)} m²</dd></div>
                              <div><dt className="text-xs text-muted-foreground">Paredes</dt><dd className="font-mono font-semibold">{formatMeasure(activeMetrics.walls)} m²</dd></div>
                            </dl>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 border-t pt-4">
                          <Button type="button" variant="outline" size="sm" onClick={() => duplicateRoom(activeRoom, false)}><Copy className="mr-2 h-4 w-4" />Duplicar estructura</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => duplicateRoom(activeRoom, true)}><CopyPlus className="mr-2 h-4 w-4" />Duplicar con medidas</Button>
                          <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => removeRoom(activeRoom.id)}><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </main>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-card px-4 py-3 sm:px-6">
            <Button type="button" variant="ghost" onClick={resetVisit}><RotateCcw className="mr-2 h-4 w-4" />Nueva visita</Button>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">{completedRooms.length}/{draft.rooms.length} completas</span>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
              <Button type="button" onClick={saveMeasurements} disabled={saving || completedRooms.length === 0}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar mediciones
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {open && (
        <BluetoothLaserTester
          open={laserOpen}
          onOpenChange={setLaserOpen}
          captureLabel={laserLabel}
          onUseMeasurement={useLaserMeasurement}
          disconnectOnClose={false}
        />
      )}
    </>
  );
}
