import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Pencil, Trash2, FileImage, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PlanoCraft from '@/components/PlanoCraft';

// ─── Helpers ───────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Modal simple (sin prompt(), sin librerías extra) ──────────────────────
function SimpleModal({ title, fields, onOk, onCancel }) {
  const [vals, setVals] = useState(() => {
    const v = {};
    fields.forEach(f => (v[f.key] = f.def || ''));
    return v;
  });

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-card border rounded-xl shadow-xl p-6 w-80 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-base">{title}</h3>
        {fields.map((f, i) => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs text-muted-foreground">{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea
                autoFocus={i === 0}
                value={vals[f.key] || ''}
                onChange={e => setVals(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none h-20 outline-none focus:ring-1 focus:ring-primary"
              />
            ) : (
              <input
                autoFocus={i === 0}
                value={vals[f.key] || ''}
                onChange={e => setVals(p => ({ ...p, [f.key]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { onOk(vals); } }}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            )}
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
          <Button className="flex-1" onClick={() => onOk(vals)}>Aceptar</Button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function PlanosTab({ proyectoId }) {
  const { toast } = useToast();
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planActivo, setPlanActivo] = useState(null); // { id, titulo, data }
  const [modal, setModal] = useState(null); // { title, fields, onOk }
  const [saving, setSaving] = useState(false);

  // ─── Cargar planos del proyecto ──────────────────────────────────────────
  const cargarPlanos = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('planos_vivienda')
        .select('id, titulo, escala, unidad, created_at, data')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPlanos(data || []);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al cargar planos', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [proyectoId, toast]);

  useEffect(() => { cargarPlanos(); }, [cargarPlanos]);

  // ─── Abrir modal helper ──────────────────────────────────────────────────
  const openModal = (title, fields, onOk) => setModal({ title, fields, onOk });
  const closeModal = () => setModal(null);

  // ─── Crear plano nuevo ───────────────────────────────────────────────────
  const crearPlano = () => {
    openModal(
      'Nuevo plano',
      [
        { key: 'titulo', label: 'Nombre del plano', def: 'Plano ' + (planos.length + 1) },
        { key: 'escala', label: 'Escala (ej: 1:50)', def: '1:50' },
      ],
      async (vals) => {
        closeModal();
        if (!vals.titulo?.trim()) return;
        setSaving(true);
        try {
          const { data, error } = await supabase
            .from('planos_vivienda')
            .insert({
              proyecto_id: proyectoId,
              titulo: vals.titulo.trim(),
              escala: vals.escala || '1:50',
              unidad: 'cm',
              data: { walls: [], rooms: [], doors: [], windows: [], dims: [], texts: [] },
            })
            .select()
            .single();

          if (error) throw error;
          setPlanos(p => [...p, data]);
          toast({ title: 'Plano creado', description: vals.titulo.trim() });
        } catch (e) {
          toast({ variant: 'destructive', title: 'Error al crear plano', description: e.message });
        } finally {
          setSaving(false);
        }
      }
    );
  };

  // ─── Editar nombre plano ─────────────────────────────────────────────────
  const editarPlano = (plano) => {
    openModal(
      'Editar plano',
      [
        { key: 'titulo', label: 'Nombre', def: plano.titulo },
        { key: 'escala', label: 'Escala', def: plano.escala || '1:50' },
      ],
      async (vals) => {
        closeModal();
        if (!vals.titulo?.trim()) return;
        try {
          const { error } = await supabase
            .from('planos_vivienda')
            .update({ titulo: vals.titulo.trim(), escala: vals.escala })
            .eq('id', plano.id);

          if (error) throw error;
          setPlanos(p => p.map(pl => pl.id === plano.id ? { ...pl, titulo: vals.titulo.trim(), escala: vals.escala } : pl));
        } catch (e) {
          toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
      }
    );
  };

  // ─── Eliminar plano ──────────────────────────────────────────────────────
  const eliminarPlano = (plano) => {
    openModal(
      'Eliminar plano',
      [{ key: 'confirm', label: `Escribe "${plano.titulo}" para confirmar`, def: '' }],
      async (vals) => {
        closeModal();
        if (vals.confirm !== plano.titulo) {
          toast({ variant: 'destructive', title: 'Nombre incorrecto', description: 'No se eliminó el plano.' });
          return;
        }
        try {
          const { error } = await supabase.from('planos_vivienda').delete().eq('id', plano.id);
          if (error) throw error;
          setPlanos(p => p.filter(pl => pl.id !== plano.id));
          toast({ title: 'Plano eliminado' });
        } catch (e) {
          toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
      }
    );
  };

  // ─── Guardar datos del editor en Supabase ────────────────────────────────
  const guardarData = useCallback(async (planoId, data) => {
    try {
      const { error } = await supabase
        .from('planos_vivienda')
        .update({ data })
        .eq('id', planoId);
      if (error) throw error;
    } catch (e) {
      console.error('[PlanosTab] Error guardando plano:', e.message);
    }
  }, []);

  // ─── Vista: Editor activo ────────────────────────────────────────────────
  if (planActivo) {
    return (
      <PlanoCraft
        planId={planActivo.id}
        planNombre={planActivo.titulo}
        initialData={planActivo.data || { walls: [], rooms: [], doors: [], windows: [], dims: [], texts: [] }}
        onBack={() => { setPlanActivo(null); cargarPlanos(); }}
        onSave={(data) => guardarData(planActivo.id, data)}
      />
    );
  }

  // ─── Vista: Lista de planos ──────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {modal && (
        <SimpleModal
          title={modal.title}
          fields={modal.fields}
          onOk={modal.onOk}
          onCancel={closeModal}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Planos</h2>
          <p className="text-sm text-muted-foreground">{planos.length} plano{planos.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={crearPlano} disabled={saving} size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          Nuevo plano
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : planos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
          <FileImage className="w-12 h-12 opacity-20" />
          <p className="font-medium">Sin planos todavía</p>
          <p className="text-sm">Crea el primer plano para esta obra.</p>
          <Button variant="outline" size="sm" onClick={crearPlano}>
            <Plus className="w-4 h-4 mr-2" />
            Crear plano
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {planos.map(plano => (
            <div
              key={plano.id}
              className="border rounded-xl p-4 bg-card hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => setPlanActivo(plano)}
            >
              {/* Preview mini */}
              <div className="w-full h-24 rounded-lg bg-muted/30 flex items-center justify-center mb-3 border border-border/50">
                {plano.data?.walls?.length > 0 ? (
                  <MiniPreview walls={plano.data.walls} rooms={plano.data.rooms || []} />
                ) : (
                  <FileImage className="w-8 h-8 text-muted-foreground/30" />
                )}
              </div>

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{plano.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {plano.escala || '1:50'} · {plano.data?.walls?.length || 0} paredes
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(plano.created_at).toLocaleDateString('es')}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editarPlano(plano)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => eliminarPlano(plano)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mini preview SVG del plano ────────────────────────────────────────────
function MiniPreview({ walls, rooms }) {
  if (!walls?.length) return null;

  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  walls.forEach(w => {
    x1 = Math.min(x1, w.x1, w.x2);
    y1 = Math.min(y1, w.y1, w.y2);
    x2 = Math.max(x2, w.x1, w.x2);
    y2 = Math.max(y2, w.y1, w.y2);
  });

  const W = 120, H = 60, pad = 6;
  const scaleX = (W - pad * 2) / (x2 - x1 || 1);
  const scaleY = (H - pad * 2) / (y2 - y1 || 1);
  const sc = Math.min(scaleX, scaleY);
  const tx = (v) => (v - x1) * sc + pad;
  const ty = (v) => (v - y1) * sc + pad;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {rooms?.map((rm, i) => rm.pts?.length >= 3 && (
        <polygon
          key={i}
          points={rm.pts.map(p => `${tx(p.x)},${ty(p.y)}`).join(' ')}
          fill={rm.color + '22'}
          stroke={rm.color}
          strokeWidth="0.5"
        />
      ))}
      {walls.map((w, i) => (
        <line
          key={i}
          x1={tx(w.x1)} y1={ty(w.y1)}
          x2={tx(w.x2)} y2={ty(w.y2)}
          stroke="#8896ab"
          strokeWidth={Math.max(0.8, (w.t || 8) * sc * 0.5)}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
