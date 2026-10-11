import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2, Save, Share2, Calculator, TrendingUp, Users, Package, Euro,
  CheckCircle2, AlertTriangle, Plus, Pencil, Trash2, Receipt
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value + 'T00:00:00').toLocaleDateString('es-ES');
};

const emptyGasto = { id: null, concepto: '', importe: '', fecha: new Date().toISOString().slice(0, 10), notas: '' };
const emptyPersonal = { id: null, nombre_persona: '', fecha: new Date().toISOString().slice(0, 10), horas: '', importe: '', notas: '' };

// ─── Sub-components ───

const CostCard = ({ icon: Icon, label, value, color = 'blue', sublabel, auto }) => (
  <div className={`flex items-center gap-4 p-4 rounded-xl border bg-${color}-50/30 dark:bg-${color}-950/20 border-${color}-200/50 dark:border-${color}-800/30`}>
    <div className={`p-3 rounded-xl bg-${color}-100 dark:bg-${color}-900/50 text-${color}-600 dark:text-${color}-400 shrink-0`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(value)}</p>
      {sublabel && <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p>}
    </div>
    {auto && (
      <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 shrink-0">
        AUTO
      </Badge>
    )}
  </div>
);

const ResultRow = ({ label, value, bold, highlight, className = '' }) => (
  <div className={`flex justify-between items-center py-3 px-4 ${highlight ? 'bg-primary/5 rounded-lg' : ''} ${className}`}>
    <span className={`text-sm ${bold ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
    <span className={`font-mono ${bold ? 'text-lg font-extrabold text-primary' : 'text-base font-semibold text-foreground'}`}>
      {formatCurrency(value)}
    </span>
  </div>
);

// Lista compacta de líneas (gastos o personal) con alta/edición/borrado.
// Vive dentro de la tarjeta "Empresa Colaboradora", debajo de los totales AUTO.
const SocioLineItemsSection = ({ title, icon: Icon, items, total, onAdd, onEdit, onDelete, renderRow, color = 'orange' }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className={`text-xs uppercase tracking-wider font-semibold text-${color}-700 dark:text-${color}-400 flex items-center gap-1.5`}>
        <Icon className="w-3.5 h-3.5" /> {title}
      </span>
      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onAdd}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Añadir
      </Button>
    </div>
    {items.length === 0 ? (
      <p className="text-xs text-muted-foreground italic px-1 py-2">Sin líneas registradas.</p>
    ) : (
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="text-sm">
                {renderRow(item)}
                <TableCell className="w-16 py-1.5">
                  <div className="flex gap-0.5 justify-end">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(item)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onDelete(item.id)}>
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )}
    <div className="flex justify-between items-center px-1 pt-1">
      <span className="text-xs text-muted-foreground">Total líneas</span>
      <span className="text-sm font-semibold font-mono">{formatCurrency(total)}</span>
    </div>
  </div>
);

// ─── Main Component ───

const SharedProjectSettlementTab = ({ projectId, budget, sharingModel }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { sessionRole } = useAuth();
  const empleadoId = sessionRole?.empleado_id || sessionRole?.id || null;

  // Form state for partner identity (nombre / notas) — los costes ya NO se editan a mano
  const [nombreSocio, setNombreSocio] = useState('');
  const [notas, setNotas] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const [gastoDialogOpen, setGastoDialogOpen] = useState(false);
  const [gastoDraft, setGastoDraft] = useState(emptyGasto);
  const [savingGasto, setSavingGasto] = useState(false);

  const [personalDialogOpen, setPersonalDialogOpen] = useState(false);
  const [personalDraft, setPersonalDraft] = useState(emptyPersonal);
  const [savingPersonal, setSavingPersonal] = useState(false);

  // 1. Fetch own KPIs (labor and net materials)
  const { data: costs, isLoading: loadingCosts } = useQuery({
    queryKey: ['settlement_costs', projectId],
    queryFn: async () => {
      // Fetch Labor Cost from formal view
      const { data: laborData } = await supabase
        .from('ui_v_proyecto_mano_obra_totales_v2')
        .select('coste_total_mano_obra')
        .eq('proyecto_id', projectId)
        .maybeSingle();

      // Fetch Net Material Cost (sum of monto_neto)
      const { data: materialsData } = await supabase
        .from('gastos')
        .select('monto_neto')
        .eq('proyecto_id', projectId);

      // Fetch Budget
      const { data: projectData } = await supabase
        .from('proyectos')
        .select('presupuesto_aceptado')
        .eq('id', projectId)
        .maybeSingle();

      const netMaterials = materialsData?.reduce((acc, curr) => acc + (Number(curr.monto_neto) || 0), 0) || 0;

      return {
        presupuesto: Number(projectData?.presupuesto_aceptado || 0),
        personal: Number(laborData?.coste_total_mano_obra || 0),
        materiales: netMaterials
      };
    },
    enabled: !!projectId
  });

  // 2. Fetch existing partner data (nombre, notas, y coste_personal/coste_materiales
  //    que ahora se recalculan solos en Supabase a partir de las líneas de detalle)
  const { data: socioData, isLoading: loadingSocio } = useQuery({
    queryKey: ['settlement_socio', projectId],
    queryFn: async () => {
      let { data, error } = await supabase
        .from('obras_compartidas_socios')
        .select('*')
        .eq('proyecto_id', projectId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') {
        console.warn('[Settlement] Error fetching socio:', error.message);
        return null;
      }
      if (!data) {
        const { data: created, error: createError } = await supabase
          .from('obras_compartidas_socios')
          .insert({ proyecto_id: projectId })
          .select('*')
          .single();
        if (createError) {
          console.warn('[Settlement] Error creating socio:', createError.message);
          return null;
        }
        data = created;
      }
      return data;
    },
    enabled: !!projectId
  });

  // 3. Fetch partner's detail lines
  const { data: gastosSocio = [], isLoading: loadingGastos } = useQuery({
    queryKey: ['settlement_socio_gastos', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obras_compartidas_gastos')
        .select('*')
        .eq('proyecto_id', projectId)
        .order('fecha', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId
  });

  const { data: personalSocio = [], isLoading: loadingPersonal } = useQuery({
    queryKey: ['settlement_socio_personal', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obras_compartidas_personal')
        .select('*')
        .eq('proyecto_id', projectId)
        .order('fecha', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId
  });

  // Populate identity form when socio data loads
  React.useEffect(() => {
    if (socioData && !isDirty) {
      setNombreSocio(socioData.nombre_socio || '');
      setNotas(socioData.notas || '');
    }
  }, [socioData]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshSocio = () => {
    queryClient.invalidateQueries({ queryKey: ['settlement_socio', projectId] });
    queryClient.invalidateQueries({ queryKey: ['settlement_socio_gastos', projectId] });
    queryClient.invalidateQueries({ queryKey: ['settlement_socio_personal', projectId] });
  };

  // 4. Save identity (nombre / notas)
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('obras_compartidas_socios')
        .upsert(payload, { onConflict: 'proyecto_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: '✅ Datos del socio guardados', description: 'La liquidación se ha actualizado correctamente.' });
      setIsDirty(false);
      refreshSocio();
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error al guardar', description: error.message });
    }
  });

  const handleSave = () => {
    if (!nombreSocio.trim()) {
      toast({ variant: 'destructive', title: 'Nombre requerido', description: 'Introduce el nombre de la empresa colaboradora.' });
      return;
    }
    saveMutation.mutate({
      ...(socioData?.id ? { id: socioData.id } : {}),
      proyecto_id: projectId,
      nombre_socio: nombreSocio.trim(),
      notas: notas.trim() || null,
      updated_at: new Date().toISOString()
    });
  };

  // ─── Gastos CRUD ───
  const openNewGasto = () => { setGastoDraft(emptyGasto); setGastoDialogOpen(true); };
  const openEditGasto = (g) => { setGastoDraft({ id: g.id, concepto: g.concepto, importe: g.importe, fecha: g.fecha, notas: g.notas || '' }); setGastoDialogOpen(true); };

  const handleSaveGasto = async () => {
    if (!gastoDraft.concepto || !gastoDraft.importe) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Concepto e importe son obligatorios' });
      return;
    }
    setSavingGasto(true);
    try {
      const payload = {
        proyecto_id: projectId,
        concepto: gastoDraft.concepto,
        importe: Number(gastoDraft.importe),
        fecha: gastoDraft.fecha,
        notas: gastoDraft.notas || null,
      };
      if (gastoDraft.id) {
        const { error } = await supabase.from('obras_compartidas_gastos').update(payload).eq('id', gastoDraft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('obras_compartidas_gastos').insert({ ...payload, created_by: empleadoId });
        if (error) throw error;
      }
      setGastoDialogOpen(false);
      refreshSocio();
      toast({ title: gastoDraft.id ? 'Gasto actualizado' : 'Gasto añadido' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo guardar el gasto', description: err.message });
    } finally {
      setSavingGasto(false);
    }
  };

  const handleDeleteGasto = async (id) => {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    try {
      const { error } = await supabase.from('obras_compartidas_gastos').delete().eq('id', id);
      if (error) throw error;
      refreshSocio();
      toast({ title: 'Gasto eliminado' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo eliminar', description: err.message });
    }
  };

  // ─── Personal CRUD ───
  const openNewPersonal = () => { setPersonalDraft(emptyPersonal); setPersonalDialogOpen(true); };
  const openEditPersonal = (p) => {
    setPersonalDraft({ id: p.id, nombre_persona: p.nombre_persona, fecha: p.fecha, horas: p.horas ?? '', importe: p.importe, notas: p.notas || '' });
    setPersonalDialogOpen(true);
  };

  const handleSavePersonal = async () => {
    if (!personalDraft.nombre_persona || !personalDraft.importe) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Nombre e importe son obligatorios' });
      return;
    }
    setSavingPersonal(true);
    try {
      const payload = {
        proyecto_id: projectId,
        nombre_persona: personalDraft.nombre_persona,
        fecha: personalDraft.fecha,
        horas: personalDraft.horas === '' ? null : Number(personalDraft.horas),
        importe: Number(personalDraft.importe),
        notas: personalDraft.notas || null,
      };
      if (personalDraft.id) {
        const { error } = await supabase.from('obras_compartidas_personal').update(payload).eq('id', personalDraft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('obras_compartidas_personal').insert({ ...payload, created_by: empleadoId });
        if (error) throw error;
      }
      setPersonalDialogOpen(false);
      refreshSocio();
      toast({ title: personalDraft.id ? 'Registro actualizado' : 'Personal añadido' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo guardar', description: err.message });
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleDeletePersonal = async (id) => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    try {
      const { error } = await supabase.from('obras_compartidas_personal').delete().eq('id', id);
      if (error) throw error;
      refreshSocio();
      toast({ title: 'Registro eliminado' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo eliminar', description: err.message });
    }
  };

  // ─── Calculations ───

  const presupuesto = Number(budget) || costs?.presupuesto || 0;
  const miCostePersonal = costs?.personal || 0;
  const miCosteMateriales = costs?.materiales || 0;
  const miCostoTotal = miCostePersonal + miCosteMateriales;

  // Los costes del socio ya no son estado local: vienen de la fila que el trigger
  // de Supabase mantiene al día a partir de obras_compartidas_gastos/_personal.
  const socioCostePersonal = Number(socioData?.coste_personal) || 0;
  const socioCosteMateriales = Number(socioData?.coste_materiales) || 0;
  const socioCostoTotal = socioCostePersonal + socioCosteMateriales;

  const costesGlobales = miCostoTotal + socioCostoTotal;
  const margenBeneficioTotal = presupuesto - costesGlobales;

  // ── Lógica de Reparto ──
  let miMargen = 0;
  let socioMargen = 0;

  if (sharingModel === 'mixto' && costesGlobales > 0) {
    // 50% Fijo, 50% Proporcional
    const bloqueFijoTotal = margenBeneficioTotal * 0.5;
    const bloqueProporcionalTotal = margenBeneficioTotal * 0.5;

    // Reparto Fijo (1/2 cada uno)
    const miParteFija = bloqueFijoTotal / 2;
    const socioParteFija = bloqueFijoTotal / 2;

    // Reparto Proporcional (Coste Empresa / Coste Total)
    const miPesoCoste = miCostoTotal / costesGlobales;
    const socioPesoCoste = socioCostoTotal / costesGlobales;

    const miParteProp = bloqueProporcionalTotal * miPesoCoste;
    const socioParteProp = bloqueProporcionalTotal * socioPesoCoste;

    miMargen = miParteFija + miParteProp;
    socioMargen = socioParteFija + socioParteProp;
  } else {
    // Modelo Fijo (50/50 tradicional) o caso base si no hay costes para el peso
    miMargen = margenBeneficioTotal / 2;
    socioMargen = margenBeneficioTotal / 2;
  }

  const miCobro = miCostoTotal + miMargen;
  const socioCobro = socioCostoTotal + socioMargen;
  const verificacion = miCobro + socioCobro;

  const isLoading = loadingCosts || loadingSocio || loadingGastos || loadingPersonal;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 pb-2">
        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
          <Share2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Liquidación de Obra Compartida</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Reparto de beneficios entre empresas colaboradoras</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Column 1: Costes Propios (Auto) ── */}
        <Card className="shadow-lg border-border/50 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white pb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <CardTitle className="text-lg">Tu Empresa</CardTitle>
            </div>
            <CardDescription className="text-blue-100/80 text-xs">Costes calculados automáticamente</CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <CostCard icon={Users} label="Coste Personal" value={miCostePersonal} color="blue" sublabel="Horas fichadas × tarifa/hora" auto />
            <CostCard icon={Package} label="Coste Materiales (Sin IVA)" value={miCosteMateriales} color="indigo" sublabel="Base imponible de facturas" auto />
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-foreground">Total Gastos</span>
                <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">{formatCurrency(miCostoTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Column 2: Costes del Socio (líneas de detalle) ── */}
        <Card className="shadow-lg border-border/50 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white pb-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              <CardTitle className="text-lg">Empresa Colaboradora</CardTitle>
            </div>
            <CardDescription className="text-orange-100/80 text-xs">Nombre + líneas de gastos y personal que ellos han pagado</CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="nombre_socio" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Nombre de la Empresa
              </Label>
              <Input
                id="nombre_socio"
                value={nombreSocio}
                onChange={(e) => { setNombreSocio(e.target.value); setIsDirty(true); }}
                placeholder="Ej: Mikelo, Lolo..."
                className="h-11 font-medium"
              />
            </div>

            <CostCard icon={Users} label="Coste Personal" value={socioCostePersonal} color="orange" sublabel="Suma de las líneas de personal" auto />
            <CostCard icon={Package} label="Coste Materiales" value={socioCosteMateriales} color="red" sublabel="Suma de las líneas de gastos" auto />

            <SocioLineItemsSection
              title="Gastos"
              icon={Receipt}
              items={gastosSocio}
              total={gastosSocio.reduce((s, g) => s + Number(g.importe || 0), 0)}
              onAdd={openNewGasto}
              onEdit={openEditGasto}
              onDelete={handleDeleteGasto}
              color="red"
              renderRow={(g) => (
                <>
                  <TableCell className="py-1.5">
                    <div className="text-xs font-medium">{g.concepto}</div>
                    <div className="text-[10px] text-muted-foreground">{formatDate(g.fecha)}</div>
                  </TableCell>
                  <TableCell className="text-right py-1.5 text-xs font-mono font-semibold">{formatCurrency(g.importe)}</TableCell>
                </>
              )}
            />

            <SocioLineItemsSection
              title="Personal"
              icon={Users}
              items={personalSocio}
              total={personalSocio.reduce((s, p) => s + Number(p.importe || 0), 0)}
              onAdd={openNewPersonal}
              onEdit={openEditPersonal}
              onDelete={handleDeletePersonal}
              color="orange"
              renderRow={(p) => (
                <>
                  <TableCell className="py-1.5">
                    <div className="text-xs font-medium">{p.nombre_persona}</div>
                    <div className="text-[10px] text-muted-foreground">{formatDate(p.fecha)}{p.horas ? ` · ${p.horas}h` : ''}</div>
                  </TableCell>
                  <TableCell className="text-right py-1.5 text-xs font-mono font-semibold">{formatCurrency(p.importe)}</TableCell>
                </>
              )}
            />

            <div className="space-y-2">
              <Label htmlFor="notas_socio" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Notas (opcional)
              </Label>
              <Textarea
                id="notas_socio"
                value={notas}
                onChange={(e) => { setNotas(e.target.value); setIsDirty(true); }}
                placeholder="Apuntes sobre la colaboración..."
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-foreground">Total Gastos</span>
                <span className="text-xl font-extrabold text-orange-600 dark:text-orange-400 font-mono">{formatCurrency(socioCostoTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Save Button (solo nombre + notas; los costes se guardan solos) ── */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending || !isDirty}
          className="px-8 py-5 h-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/20 rounded-xl text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Save className="w-5 h-5 mr-2" />
          )}
          Guardar Nombre / Notas del Socio
        </Button>
      </div>

      {/* ── Settlement Results ── */}
      <Card className="shadow-xl border-0 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-amber-400" />
            <CardTitle className="text-lg text-white">Cálculo de Liquidación</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">

          {/* Summary */}
          <div className="px-6 py-4 space-y-1 border-b border-white/10">
            <div className="flex justify-between items-center py-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-300 text-sm">Presupuesto Total de la Obra</span>
                <Badge variant="outline" className="text-[10px] py-0 border-white/20 text-slate-400">
                  {sharingModel === 'mixto' ? 'Modelo Mixto' : 'Modelo Fijo'}
                </Badge>
              </div>
              <span className="text-lg font-bold text-white font-mono">{formatCurrency(presupuesto)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-300 text-sm">Total Costes (Base Imponible)</span>
              <span className="font-semibold text-red-300 font-mono">- {formatCurrency(costesGlobales)}</span>
            </div>
            <div className="flex justify-between items-center py-3 bg-white/5 rounded-lg px-4 mt-2">
              <span className="font-bold text-amber-300 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Margen de Beneficio Total
              </span>
              <span className={`text-xl font-extrabold font-mono ${margenBeneficioTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(margenBeneficioTotal)}
              </span>
            </div>

            {sharingModel === 'mixto' && costesGlobales > 0 && (
              <div className="flex flex-col gap-2 pt-3 pb-1 border-t border-white/5 mt-3">
                <div className="flex justify-between text-[11px] text-slate-400 italic">
                  <span>Bloque Fijo (50%)</span>
                  <span>{formatCurrency(margenBeneficioTotal * 0.5)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 italic">
                  <span>Bloque Proporcional (50%)</span>
                  <span>{formatCurrency(margenBeneficioTotal * 0.5)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-1 border-t border-white/5 pt-2">
                  <div className="text-[10px] text-blue-300/70">Peso Tu Empresa (Gasto s/IVA): {((miCostoTotal / costesGlobales) * 100).toFixed(1)}%</div>
                  <div className="text-[10px] text-orange-300/70">Peso Socio (Gasto s/IVA): {((socioCostoTotal / costesGlobales) * 100).toFixed(1)}%</div>
                </div>
              </div>
            )}
          </div>

          {/* Final Distribution */}
          <div className="px-6 py-5">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4">Resultado Final: ¿Cuánto cobra cada uno?</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tu empresa */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 p-5">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <p className="text-xs uppercase tracking-wider font-semibold text-blue-300 mb-1">Tu Empresa</p>
                <p className="text-3xl font-extrabold text-white font-mono">{formatCurrency(miCobro)}</p>
                <p className="text-xs text-blue-200/60 mt-2">
                  {formatCurrency(miCostoTotal)} gastos + {formatCurrency(miMargen)} beneficio
                </p>
              </div>

              {/* Socio */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-600/20 to-red-600/20 border border-orange-500/30 p-5">
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <p className="text-xs uppercase tracking-wider font-semibold text-orange-300 mb-1">
                  {nombreSocio || 'Socio'}
                </p>
                <p className="text-3xl font-extrabold text-white font-mono">{formatCurrency(socioCobro)}</p>
                <p className="text-xs text-orange-200/60 mt-2">
                  {formatCurrency(socioCostoTotal)} gastos + {formatCurrency(socioMargen)} beneficio
                </p>
              </div>
            </div>

            {/* Verification */}
            <div className="mt-4 flex items-center justify-center gap-2 py-3 rounded-lg bg-white/5 border border-white/10">
              {Math.abs(verificacion - presupuesto) < 0.01 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-300 font-medium">
                    Verificación: {formatCurrency(miCobro)} + {formatCurrency(socioCobro)} = {formatCurrency(verificacion)} ✓
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-yellow-300 font-medium">
                    Introduce los datos del socio para calcular la liquidación
                  </span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog: gasto del socio */}
      <Dialog open={gastoDialogOpen} onOpenChange={setGastoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{gastoDraft.id ? 'Editar gasto' : 'Nuevo gasto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Concepto</Label>
              <Input
                value={gastoDraft.concepto}
                onChange={(e) => setGastoDraft({ ...gastoDraft, concepto: e.target.value })}
                placeholder="Ej: Material eléctrico, alquiler andamio..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Importe (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={gastoDraft.importe}
                  onChange={(e) => setGastoDraft({ ...gastoDraft, importe: e.target.value })}
                />
              </div>
              <div>
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={gastoDraft.fecha}
                  onChange={(e) => setGastoDraft({ ...gastoDraft, fecha: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={gastoDraft.notas}
                onChange={(e) => setGastoDraft({ ...gastoDraft, notas: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGastoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveGasto} disabled={savingGasto}>
              {savingGasto && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: personal del socio */}
      <Dialog open={personalDialogOpen} onOpenChange={setPersonalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{personalDraft.id ? 'Editar registro' : 'Nuevo personal'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input
                value={personalDraft.nombre_persona}
                onChange={(e) => setPersonalDraft({ ...personalDraft, nombre_persona: e.target.value })}
                placeholder="Nombre de la persona"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={personalDraft.fecha}
                  onChange={(e) => setPersonalDraft({ ...personalDraft, fecha: e.target.value })}
                />
              </div>
              <div>
                <Label>Horas (opcional)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={personalDraft.horas}
                  onChange={(e) => setPersonalDraft({ ...personalDraft, horas: e.target.value })}
                />
              </div>
              <div>
                <Label>Importe (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={personalDraft.importe}
                  onChange={(e) => setPersonalDraft({ ...personalDraft, importe: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={personalDraft.notas}
                onChange={(e) => setPersonalDraft({ ...personalDraft, notas: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPersonalDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePersonal} disabled={savingPersonal}>
              {savingPersonal && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default SharedProjectSettlementTab;
