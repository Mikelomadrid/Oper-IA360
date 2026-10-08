import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  BadgeCheck,
  Boxes,
  Clock3,
  CopyPlus,
  Euro,
  Hammer,
  Loader2,
  Package,
  PencilLine,
  Plus,
  Search,
  Settings2,
  Trash2,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import AnalisisFacturasTrabajos from '@/components/AnalisisFacturasTrabajos';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const CATEGORIES = [
  ['pladur_techos', 'Pladur y techos'],
  ['pintura', 'Pintura'],
  ['albanileria', 'Albañilería'],
  ['electricidad', 'Electricidad'],
  ['fontaneria', 'Fontanería'],
  ['climatizacion', 'Climatización'],
  ['cerrajeria', 'Cerrajería'],
  ['limpieza_desescombro', 'Limpieza y desescombro'],
  ['otros', 'Otros'],
];

const UNITS = ['m²', 'ml', 'm³', 'ud', 'kg', 'h', 'día'];
const MATERIAL_UNITS = ['ud', 'm', 'm²', 'm³', 'kg', 'l', 'saco', 'caja', 'rollo'];

const EMPTY_SYSTEM = {
  codigo: '',
  nombre: '',
  categoria: 'pladur_techos',
  unidad_base: 'm²',
  descripcion: '',
  merma_general_pct: '0',
};

const EMPTY_MATERIAL = {
  material_id: '',
  descripcion: '',
  referencia: '',
  unidad: 'ud',
  cantidad_por_unidad: '',
  merma_pct: '0',
  precio_unitario_referencia: '',
};

const EMPTY_LABOR = {
  oficio: '',
  rol_referencia: 'tecnico',
  tipo_hora: 'ordinaria',
  horas_por_unidad: '',
  coste_hora_referencia: '',
};

const EMPTY_OTHER = {
  tipo: 'maquinaria',
  descripcion: '',
  unidad: 'h',
  cantidad_por_unidad: '1',
  coste_unitario_referencia: '',
};

const number = (value) => Number(value || 0);
const money = (value) => new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
}).format(number(value));
const quantity = (value) => new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 4,
}).format(number(value));

const categoryLabel = (value) => CATEGORIES.find(([key]) => key === value)?.[1] || value;

function StatusBadge({ status }) {
  const validated = status === 'validado';
  const inactive = status === 'inactivo';
  return (
    <Badge
      variant="outline"
      className={validated
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : inactive
          ? 'border-slate-200 bg-slate-100 text-slate-600'
          : 'border-amber-200 bg-amber-50 text-amber-800'}
    >
      {validated ? 'Validado' : inactive ? 'Inactivo' : 'Borrador'}
    </Badge>
  );
}

function CostLine({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    blue: 'border-blue-200 bg-blue-50/60 text-blue-950',
    amber: 'border-amber-200 bg-amber-50/70 text-amber-950',
    green: 'border-emerald-200 bg-emerald-50/70 text-emerald-950',
  };
  return (
    <div className={`flex min-h-20 items-center justify-between border px-4 py-3 ${tones[tone]}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center border border-current/15 bg-white/70">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <strong className="font-mono text-lg tabular-nums">{money(value)}</strong>
    </div>
  );
}

const BibliotecaRendimientos = () => {
  const { sessionRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('todas');
  const [selectedId, setSelectedId] = useState(null);
  const [systemDialog, setSystemDialog] = useState(false);
  const [materialDialog, setMaterialDialog] = useState(false);
  const [laborDialog, setLaborDialog] = useState(false);
  const [otherDialog, setOtherDialog] = useState(false);
  const [systemForm, setSystemForm] = useState(EMPTY_SYSTEM);
  const [materialForm, setMaterialForm] = useState(EMPTY_MATERIAL);
  const [laborForm, setLaborForm] = useState(EMPTY_LABOR);
  const [otherForm, setOtherForm] = useState(EMPTY_OTHER);

  const systemsQuery = useQuery({
    queryKey: ['sistemas-rendimiento'],
    queryFn: async () => {
      const [{ data: systems, error }, { data: costs, error: costsError }] = await Promise.all([
        supabase.from('sistemas_rendimiento').select('*').order('categoria').order('codigo'),
        supabase.from('v_sistemas_rendimiento_costes').select('*'),
      ]);
      if (error) throw error;
      if (costsError) throw costsError;
      const costMap = new Map((costs || []).map((row) => [row.id, row]));
      return (systems || []).map((row) => ({ ...row, ...(costMap.get(row.id) || {}) }));
    },
  });

  const materialsCatalogQuery = useQuery({
    queryKey: ['materiales-catalogo-rendimientos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materiales')
        .select('id,codigo,nombre,descripcion,unidad_medida,precio_coste')
        .order('descripcion')
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const hourlyRatesQuery = useQuery({
    queryKey: ['costes-horarios-rendimientos'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('api_costes_horarios_rendimientos');
      if (error) throw error;
      return data || [];
    },
  });

  const selected = (systemsQuery.data || []).find((row) => row.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId && systemsQuery.data?.length) setSelectedId(systemsQuery.data[0].id);
    if (selectedId && systemsQuery.data && !systemsQuery.data.some((row) => row.id === selectedId)) {
      setSelectedId(systemsQuery.data[0]?.id || null);
    }
  }, [selectedId, systemsQuery.data]);

  const detailQuery = useQuery({
    queryKey: ['sistema-rendimiento-detalle', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const [materials, labor, others] = await Promise.all([
        supabase.from('sistema_rendimiento_materiales').select('*').eq('sistema_id', selectedId).order('orden'),
        supabase.from('sistema_rendimiento_mano_obra').select('*').eq('sistema_id', selectedId).order('orden'),
        supabase.from('sistema_rendimiento_otros_costes').select('*').eq('sistema_id', selectedId).order('orden'),
      ]);
      if (materials.error) throw materials.error;
      if (labor.error) throw labor.error;
      if (others.error) throw others.error;
      return { materials: materials.data || [], labor: labor.data || [], others: others.data || [] };
    },
  });

  const filteredSystems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (systemsQuery.data || []).filter((row) => {
      const matchCategory = category === 'todas' || row.categoria === category;
      const matchTerm = !term || `${row.codigo} ${row.nombre} ${row.descripcion || ''}`.toLowerCase().includes(term);
      return matchCategory && matchTerm;
    });
  }, [systemsQuery.data, search, category]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sistemas-rendimiento'] }),
      queryClient.invalidateQueries({ queryKey: ['sistema-rendimiento-detalle', selectedId] }),
    ]);
  };

  const createSystem = useMutation({
    mutationFn: async () => {
      const payload = {
        ...systemForm,
        codigo: systemForm.codigo.trim().toUpperCase(),
        nombre: systemForm.nombre.trim(),
        descripcion: systemForm.descripcion.trim() || null,
        merma_general_pct: number(systemForm.merma_general_pct),
        created_by: sessionRole?.empleadoId || sessionRole?.id || null,
      };
      const { data, error } = await supabase.from('sistemas_rendimiento').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      setSystemDialog(false);
      setSystemForm(EMPTY_SYSTEM);
      await invalidate();
      setSelectedId(data.id);
      toast({ title: 'Sistema creado', description: 'Ya puedes añadir materiales y mano de obra.' });
    },
    onError: (error) => toast({ variant: 'destructive', title: 'No se pudo crear', description: error.message }),
  });

  const addMaterial = useMutation({
    mutationFn: async () => {
      const payload = {
        sistema_id: selectedId,
        material_id: materialForm.material_id || null,
        descripcion: materialForm.descripcion.trim(),
        referencia: materialForm.referencia.trim() || null,
        unidad: materialForm.unidad,
        cantidad_por_unidad: number(materialForm.cantidad_por_unidad),
        merma_pct: number(materialForm.merma_pct),
        precio_unitario_referencia: number(materialForm.precio_unitario_referencia),
        orden: detailQuery.data?.materials?.length || 0,
      };
      const { error } = await supabase.from('sistema_rendimiento_materiales').insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      setMaterialDialog(false);
      setMaterialForm(EMPTY_MATERIAL);
      await invalidate();
      toast({ title: 'Material añadido' });
    },
    onError: (error) => toast({ variant: 'destructive', title: 'No se pudo añadir', description: error.message }),
  });

  const addLabor = useMutation({
    mutationFn: async () => {
      const payload = {
        sistema_id: selectedId,
        oficio: laborForm.oficio.trim(),
        rol_referencia: laborForm.rol_referencia,
        tipo_hora: laborForm.tipo_hora,
        horas_por_unidad: number(laborForm.horas_por_unidad),
        coste_hora_referencia: number(laborForm.coste_hora_referencia),
        orden: detailQuery.data?.labor?.length || 0,
      };
      const { error } = await supabase.from('sistema_rendimiento_mano_obra').insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      setLaborDialog(false);
      setLaborForm(EMPTY_LABOR);
      await invalidate();
      toast({ title: 'Rendimiento de mano de obra añadido' });
    },
    onError: (error) => toast({ variant: 'destructive', title: 'No se pudo añadir', description: error.message }),
  });

  const addOther = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sistema_rendimiento_otros_costes').insert({
        sistema_id: selectedId,
        tipo: otherForm.tipo,
        descripcion: otherForm.descripcion.trim(),
        unidad: otherForm.unidad,
        cantidad_por_unidad: number(otherForm.cantidad_por_unidad),
        coste_unitario_referencia: number(otherForm.coste_unitario_referencia),
        orden: detailQuery.data?.others?.length || 0,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setOtherDialog(false);
      setOtherForm(EMPTY_OTHER);
      await invalidate();
      toast({ title: 'Otro coste añadido' });
    },
    onError: (error) => toast({ variant: 'destructive', title: 'No se pudo añadir', description: error.message }),
  });

  const updateStatus = useMutation({
    mutationFn: async (estado) => {
      const isValidated = estado === 'validado';
      const { error } = await supabase.from('sistemas_rendimiento').update({
        estado,
        activo: estado !== 'inactivo',
        validated_at: isValidated ? new Date().toISOString() : null,
        validated_by: isValidated ? (sessionRole?.empleadoId || sessionRole?.id || null) : null,
        updated_at: new Date().toISOString(),
      }).eq('id', selectedId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast({ title: 'Estado actualizado' });
    },
    onError: (error) => toast({ variant: 'destructive', title: 'No se pudo actualizar', description: error.message }),
  });

  const removeRow = useMutation({
    mutationFn: async ({ table, id }) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => toast({ variant: 'destructive', title: 'No se pudo eliminar', description: error.message }),
  });

  const createRevision = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Selecciona un sistema');
      const nextVersion = number(selected.version) + 1;
      const { data: copy, error } = await supabase.from('sistemas_rendimiento').insert({
        codigo: `${selected.codigo}-V${nextVersion}`,
        nombre: selected.nombre,
        categoria: selected.categoria,
        unidad_base: selected.unidad_base,
        descripcion: selected.descripcion,
        merma_general_pct: selected.merma_general_pct,
        estado: 'borrador',
        version: nextVersion,
        created_by: sessionRole?.empleadoId || sessionRole?.id || null,
      }).select().single();
      if (error) throw error;
      const current = detailQuery.data || { materials: [], labor: [], others: [] };
      const inserts = [];
      if (current.materials.length) inserts.push(supabase.from('sistema_rendimiento_materiales').insert(current.materials.map(({ id, sistema_id, created_at, updated_at, ...row }) => ({ ...row, sistema_id: copy.id }))));
      if (current.labor.length) inserts.push(supabase.from('sistema_rendimiento_mano_obra').insert(current.labor.map(({ id, sistema_id, created_at, updated_at, ...row }) => ({ ...row, sistema_id: copy.id }))));
      if (current.others.length) inserts.push(supabase.from('sistema_rendimiento_otros_costes').insert(current.others.map(({ id, sistema_id, created_at, updated_at, ...row }) => ({ ...row, sistema_id: copy.id }))));
      const results = await Promise.all(inserts);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      return copy;
    },
    onSuccess: async (copy) => {
      await invalidate();
      setSelectedId(copy.id);
      toast({ title: 'Nueva revisión creada', description: 'Los recursos se han copiado como borrador independiente.' });
    },
    onError: (error) => toast({ variant: 'destructive', title: 'No se pudo crear la revisión', description: error.message }),
  });

  const onCatalogMaterial = (materialId) => {
    const item = (materialsCatalogQuery.data || []).find((row) => row.id === materialId);
    if (!item) return;
    setMaterialForm((prev) => ({
      ...prev,
      material_id: item.id,
      descripcion: item.nombre || item.descripcion || '',
      referencia: item.codigo || '',
      unidad: item.unidad_medida || 'ud',
      precio_unitario_referencia: String(item.precio_coste || 0),
    }));
  };

  const onLaborRate = (rol, tipoHora) => {
    const rate = (hourlyRatesQuery.data || []).find((row) => row.rol === rol && row.tipo_hora === tipoHora);
    setLaborForm((prev) => ({ ...prev, rol_referencia: rol, tipo_hora: tipoHora, coste_hora_referencia: String(rate?.coste_hora || prev.coste_hora_referencia || '') }));
  };

  const openLaborDialog = () => {
    const rate = (hourlyRatesQuery.data || []).find((row) => row.rol === 'tecnico' && row.tipo_hora === 'ordinaria');
    setLaborForm({ ...EMPTY_LABOR, coste_hora_referencia: String(rate?.coste_hora || '') });
    setLaborDialog(true);
  };

  const stats = useMemo(() => {
    const all = systemsQuery.data || [];
    return {
      total: all.length,
      validated: all.filter((row) => row.estado === 'validado').length,
      drafts: all.filter((row) => row.estado === 'borrador').length,
    };
  }, [systemsQuery.data]);

  const detail = detailQuery.data || { materials: [], labor: [], others: [] };
  const busy = systemsQuery.isLoading || materialsCatalogQuery.isLoading || hourlyRatesQuery.isLoading;

  if (busy) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              <Settings2 className="h-4 w-4" /> Inventario técnico
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">Sistemas y rendimientos</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Define qué materiales, horas y medios hacen falta para ejecutar una unidad de trabajo. Esta biblioteca será la base de presupuestos y del aprendizaje con obras reales.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AnalisisFacturasTrabajos />
            <Button className="gap-2 bg-blue-700 hover:bg-blue-800" onClick={() => setSystemDialog(true)}>
              <Plus className="h-4 w-4" /> Nuevo sistema
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span><strong className="font-mono text-slate-950">{stats.total}</strong> <span className="text-slate-500">sistemas</span></span>
          <span><strong className="font-mono text-emerald-700">{stats.validated}</strong> <span className="text-slate-500">validados</span></span>
          <span><strong className="font-mono text-amber-700">{stats.drafts}</strong> <span className="text-slate-500">en aprendizaje</span></span>
        </div>
      </header>

      <div className="grid min-h-[680px] gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="border border-slate-200 bg-slate-50/70">
          <div className="space-y-3 border-b border-slate-200 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar sistema o código" className="bg-white pl-9" />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las familias</SelectItem>
                {CATEGORIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-[610px] overflow-y-auto">
            {filteredSystems.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Todavía no hay sistemas en esta selección.</div>
            ) : filteredSystems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full border-b border-slate-200 p-4 text-left transition-colors ${selectedId === item.id ? 'bg-blue-50 shadow-[inset_3px_0_0_#1d4ed8]' : 'bg-white hover:bg-slate-50'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-xs font-semibold text-blue-700">{item.codigo}</span>
                  <StatusBadge status={item.estado} />
                </div>
                <div className="mt-2 font-medium leading-snug text-slate-950">{item.nombre}</div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{categoryLabel(item.categoria)}</span>
                  <strong className="font-mono text-slate-700">{money(item.coste_total)}/{item.unidad_base}</strong>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 border border-slate-200 bg-white">
          {!selected ? (
            <div className="grid min-h-[680px] place-items-center p-8 text-center">
              <div>
                <Hammer className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 font-medium text-slate-700">Crea el primer sistema constructivo</p>
                <p className="mt-1 text-sm text-slate-500">Por ejemplo: tabique de pladur de 13 mm por cada m².</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 p-5 md:p-6">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-blue-700">{selected.codigo}</span>
                      <StatusBadge status={selected.estado} />
                      <Badge variant="outline">Revisión {selected.version}</Badge>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-slate-950 md:text-2xl">{selected.nombre}</h2>
                    <p className="mt-2 max-w-3xl text-sm text-slate-600">{selected.descripcion || 'Sin descripción técnica todavía.'}</p>
                    <div className="mt-3 text-xs uppercase tracking-wide text-slate-500">
                      {categoryLabel(selected.categoria)} · unidad de cálculo: <strong className="text-slate-800">1 {selected.unidad_base}</strong>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => createRevision.mutate()} disabled={createRevision.isPending}>
                      {createRevision.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />} Nueva revisión
                    </Button>
                    {selected.estado !== 'validado' ? (
                      <Button
                        className="gap-2 bg-emerald-700 hover:bg-emerald-800"
                        onClick={() => updateStatus.mutate('validado')}
                        disabled={updateStatus.isPending || (detail.materials.length === 0 && detail.labor.length === 0 && detail.others.length === 0)}
                        title={detail.materials.length === 0 && detail.labor.length === 0 && detail.others.length === 0 ? 'Añade al menos un recurso antes de validar' : 'Validar esta revisión'}
                      >
                        <BadgeCheck className="h-4 w-4" /> Validar
                      </Button>
                    ) : (
                      <Button variant="outline" className="gap-2" onClick={() => updateStatus.mutate('borrador')} disabled={updateStatus.isPending}>
                        <PencilLine className="h-4 w-4" /> Revisar
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" title="Archivar" onClick={() => updateStatus.mutate('inactivo')}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <section className="border-b border-slate-200 bg-slate-50/60 p-5 md:p-6">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ficha de coste unitario</div>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950">Qué cuesta ejecutar 1 {selected.unidad_base}</h3>
                  </div>
                  <span className="hidden text-xs text-slate-500 md:block">Precios de referencia de esta revisión</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <CostLine icon={Package} label="Materiales" value={selected.coste_materiales} tone="blue" />
                  <CostLine icon={Users} label="Mano de obra" value={selected.coste_mano_obra} tone="amber" />
                  <CostLine icon={Settings2} label="Otros medios" value={selected.coste_otros} />
                  <CostLine icon={Euro} label="Coste directo" value={selected.coste_total} tone="green" />
                </div>
                <div className="mt-3 flex flex-wrap gap-5 text-xs text-slate-600">
                  <span><strong className="font-mono text-slate-900">{quantity(selected.horas_mano_obra)}</strong> h de mano de obra/{selected.unidad_base}</span>
                  <span><strong className="font-mono text-slate-900">{selected.numero_materiales || 0}</strong> materiales definidos</span>
                  <span>Merma general: <strong className="font-mono text-slate-900">{quantity(selected.merma_general_pct)}%</strong></span>
                </div>
              </section>

              <section className="border-b border-slate-200 p-5 md:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold text-slate-950"><Package className="h-4 w-4 text-blue-700" /> Materiales</h3>
                    <p className="mt-1 text-xs text-slate-500">Consumo para 1 {selected.unidad_base}, incluida la merma particular.</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setMaterialDialog(true)}><Plus className="h-4 w-4" /> Añadir</Button>
                </div>
                <div className="overflow-x-auto border border-slate-200">
                  <Table>
                    <TableHeader><TableRow className="bg-slate-50"><TableHead>Material</TableHead><TableHead>Consumo</TableHead><TableHead>Merma</TableHead><TableHead>Precio ref.</TableHead><TableHead className="text-right">Coste/{selected.unidad_base}</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
                    <TableBody>
                      {detail.materials.length === 0 ? <TableRow><TableCell colSpan={6} className="h-24 text-center text-slate-500">Añade los materiales que forman esta unidad.</TableCell></TableRow> : detail.materials.map((row) => {
                        const total = number(row.cantidad_por_unidad) * (1 + (number(row.merma_pct) + number(selected.merma_general_pct)) / 100) * number(row.precio_unitario_referencia);
                        return <TableRow key={row.id}>
                          <TableCell><div className="font-medium text-slate-900">{row.descripcion}</div><div className="font-mono text-xs text-slate-500">{row.referencia || 'Sin referencia'}</div></TableCell>
                          <TableCell className="font-mono">{quantity(row.cantidad_por_unidad)} {row.unidad}</TableCell>
                          <TableCell className="font-mono">{quantity(row.merma_pct)}%</TableCell>
                          <TableCell className="font-mono">{money(row.precio_unitario_referencia)}/{row.unidad}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{money(total)}</TableCell>
                          <TableCell><Button variant="ghost" size="icon" onClick={() => removeRow.mutate({ table: 'sistema_rendimiento_materiales', id: row.id })}><Trash2 className="h-4 w-4 text-slate-400" /></Button></TableCell>
                        </TableRow>;
                      })}
                    </TableBody>
                  </Table>
                </div>
              </section>

              <section className="border-b border-slate-200 p-5 md:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold text-slate-950"><Clock3 className="h-4 w-4 text-amber-700" /> Mano de obra</h3>
                    <p className="mt-1 text-xs text-slate-500">Horas necesarias por oficio para ejecutar 1 {selected.unidad_base}.</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={openLaborDialog}><Plus className="h-4 w-4" /> Añadir</Button>
                </div>
                <div className="overflow-x-auto border border-slate-200">
                  <Table>
                    <TableHeader><TableRow className="bg-slate-50"><TableHead>Oficio</TableHead><TableHead>Referencia</TableHead><TableHead>Horas/{selected.unidad_base}</TableHead><TableHead>Coste/h</TableHead><TableHead className="text-right">Coste/{selected.unidad_base}</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
                    <TableBody>
                      {detail.labor.length === 0 ? <TableRow><TableCell colSpan={6} className="h-24 text-center text-slate-500">Añade las horas previstas por oficio.</TableCell></TableRow> : detail.labor.map((row) => <TableRow key={row.id}>
                        <TableCell className="font-medium text-slate-900">{row.oficio}</TableCell>
                        <TableCell className="text-sm text-slate-600">{row.rol_referencia || '—'} · {row.tipo_hora}</TableCell>
                        <TableCell className="font-mono">{quantity(row.horas_por_unidad)} h</TableCell>
                        <TableCell className="font-mono">{money(row.coste_hora_referencia)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{money(number(row.horas_por_unidad) * number(row.coste_hora_referencia))}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => removeRow.mutate({ table: 'sistema_rendimiento_mano_obra', id: row.id })}><Trash2 className="h-4 w-4 text-slate-400" /></Button></TableCell>
                      </TableRow>)}
                    </TableBody>
                  </Table>
                </div>
              </section>

              <section className="p-5 md:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold text-slate-950"><Boxes className="h-4 w-4 text-slate-700" /> Maquinaria, transporte y subcontrata</h3>
                    <p className="mt-1 text-xs text-slate-500">Costes directos que no son material ni mano de obra propia.</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setOtherDialog(true)}><Plus className="h-4 w-4" /> Añadir</Button>
                </div>
                {detail.others.length === 0 ? <div className="border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Sin otros medios definidos.</div> : <div className="divide-y divide-slate-200 border border-slate-200">{detail.others.map((row) => <div key={row.id} className="flex items-center justify-between gap-4 p-3 text-sm"><div><strong>{row.descripcion}</strong><div className="text-xs text-slate-500">{row.tipo} · {quantity(row.cantidad_por_unidad)} {row.unidad}</div></div><div className="flex items-center gap-3"><strong className="font-mono">{money(number(row.cantidad_por_unidad) * number(row.coste_unitario_referencia))}</strong><Button variant="ghost" size="icon" onClick={() => removeRow.mutate({ table: 'sistema_rendimiento_otros_costes', id: row.id })}><Trash2 className="h-4 w-4 text-slate-400" /></Button></div></div>)}</div>}
              </section>
            </>
          )}
        </main>
      </div>

      <Dialog open={systemDialog} onOpenChange={setSystemDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nuevo sistema constructivo</DialogTitle><DialogDescription>Define la unidad que vas a medir. Los recursos se añaden después.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2"><Label>Código *</Label><Input value={systemForm.codigo} onChange={(e) => setSystemForm({ ...systemForm, codigo: e.target.value })} placeholder="PLA-TAB-001" /></div>
            <div className="space-y-2"><Label>Nombre *</Label><Input value={systemForm.nombre} onChange={(e) => setSystemForm({ ...systemForm, nombre: e.target.value })} placeholder="Tabique de pladur 13 mm" /></div>
            <div className="space-y-2"><Label>Familia</Label><Select value={systemForm.categoria} onValueChange={(value) => setSystemForm({ ...systemForm, categoria: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Unidad base</Label><Select value={systemForm.unidad_base} onValueChange={(value) => setSystemForm({ ...systemForm, unidad_base: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNITS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Merma general (%)</Label><Input type="number" min="0" max="100" step="0.1" value={systemForm.merma_general_pct} onChange={(e) => setSystemForm({ ...systemForm, merma_general_pct: e.target.value })} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Descripción técnica</Label><Textarea value={systemForm.descripcion} onChange={(e) => setSystemForm({ ...systemForm, descripcion: e.target.value })} placeholder="Incluye alcance, espesores y condiciones de ejecución." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSystemDialog(false)}>Cancelar</Button><Button onClick={() => createSystem.mutate()} disabled={!systemForm.codigo.trim() || !systemForm.nombre.trim() || createSystem.isPending}>{createSystem.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear sistema</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={materialDialog} onOpenChange={setMaterialDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Añadir material</DialogTitle><DialogDescription>Selecciona del almacén para traer su precio actual o escribe un material aún no catalogado.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label>Material del catálogo</Label><Select value={materialForm.material_id || 'manual'} onValueChange={(value) => value === 'manual' ? setMaterialForm(EMPTY_MATERIAL) : onCatalogMaterial(value)}><SelectTrigger><SelectValue placeholder="Seleccionar material" /></SelectTrigger><SelectContent><SelectItem value="manual">Definir manualmente</SelectItem>{(materialsCatalogQuery.data || []).map((item) => <SelectItem key={item.id} value={item.id}>{item.codigo} · {item.nombre || item.descripcion}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Descripción *</Label><Input value={materialForm.descripcion} onChange={(e) => setMaterialForm({ ...materialForm, descripcion: e.target.value })} /></div>
            <div className="space-y-2"><Label>Referencia</Label><Input value={materialForm.referencia} onChange={(e) => setMaterialForm({ ...materialForm, referencia: e.target.value })} /></div>
            <div className="space-y-2"><Label>Cantidad por unidad *</Label><Input type="number" min="0" step="0.0001" value={materialForm.cantidad_por_unidad} onChange={(e) => setMaterialForm({ ...materialForm, cantidad_por_unidad: e.target.value })} /></div>
            <div className="space-y-2"><Label>Unidad</Label><Select value={materialForm.unidad} onValueChange={(value) => setMaterialForm({ ...materialForm, unidad: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MATERIAL_UNITS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Merma (%)</Label><Input type="number" min="0" max="100" step="0.1" value={materialForm.merma_pct} onChange={(e) => setMaterialForm({ ...materialForm, merma_pct: e.target.value })} /></div>
            <div className="space-y-2"><Label>Precio de referencia *</Label><Input type="number" min="0" step="0.0001" value={materialForm.precio_unitario_referencia} onChange={(e) => setMaterialForm({ ...materialForm, precio_unitario_referencia: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setMaterialDialog(false)}>Cancelar</Button><Button onClick={() => addMaterial.mutate()} disabled={!materialForm.descripcion.trim() || number(materialForm.cantidad_por_unidad) <= 0 || addMaterial.isPending}>Añadir material</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={laborDialog} onOpenChange={setLaborDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Añadir mano de obra</DialogTitle><DialogDescription>El coste horario queda guardado en esta revisión; las obras históricas no cambiarán.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label>Oficio o tarea *</Label><Input value={laborForm.oficio} onChange={(e) => setLaborForm({ ...laborForm, oficio: e.target.value })} placeholder="Oficial montador de pladur" /></div>
            <div className="space-y-2"><Label>Rol de referencia</Label><Select value={laborForm.rol_referencia} onValueChange={(value) => onLaborRate(value, laborForm.tipo_hora)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tecnico">Técnico</SelectItem><SelectItem value="encargado">Encargado</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Tipo de hora</Label><Select value={laborForm.tipo_hora} onValueChange={(value) => onLaborRate(laborForm.rol_referencia, value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ordinaria">Ordinaria</SelectItem><SelectItem value="extra_laborable">Extra laborable</SelectItem><SelectItem value="extra_festivo">Extra festivo</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Horas por unidad *</Label><Input type="number" min="0" step="0.0001" value={laborForm.horas_por_unidad} onChange={(e) => setLaborForm({ ...laborForm, horas_por_unidad: e.target.value })} /></div>
            <div className="space-y-2"><Label>Coste por hora *</Label><Input type="number" min="0" step="0.01" value={laborForm.coste_hora_referencia} onChange={(e) => setLaborForm({ ...laborForm, coste_hora_referencia: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setLaborDialog(false)}>Cancelar</Button><Button onClick={() => addLabor.mutate()} disabled={!laborForm.oficio.trim() || number(laborForm.horas_por_unidad) <= 0 || addLabor.isPending}>Añadir mano de obra</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={otherDialog} onOpenChange={setOtherDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Añadir otro coste directo</DialogTitle><DialogDescription>Maquinaria, transporte, alquiler o subcontrata necesarios para la unidad.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2"><Label>Tipo</Label><Select value={otherForm.tipo} onValueChange={(value) => setOtherForm({ ...otherForm, tipo: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="maquinaria">Maquinaria</SelectItem><SelectItem value="transporte">Transporte</SelectItem><SelectItem value="subcontrata">Subcontrata</SelectItem><SelectItem value="otro">Otro</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Descripción *</Label><Input value={otherForm.descripcion} onChange={(e) => setOtherForm({ ...otherForm, descripcion: e.target.value })} /></div>
            <div className="space-y-2"><Label>Cantidad</Label><Input type="number" min="0" step="0.0001" value={otherForm.cantidad_por_unidad} onChange={(e) => setOtherForm({ ...otherForm, cantidad_por_unidad: e.target.value })} /></div>
            <div className="space-y-2"><Label>Unidad</Label><Input value={otherForm.unidad} onChange={(e) => setOtherForm({ ...otherForm, unidad: e.target.value })} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Coste unitario</Label><Input type="number" min="0" step="0.01" value={otherForm.coste_unitario_referencia} onChange={(e) => setOtherForm({ ...otherForm, coste_unitario_referencia: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOtherDialog(false)}>Cancelar</Button><Button onClick={() => addOther.mutate()} disabled={!otherForm.descripcion.trim() || number(otherForm.cantidad_por_unidad) <= 0 || addOther.isPending}>Añadir coste</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BibliotecaRendimientos;
