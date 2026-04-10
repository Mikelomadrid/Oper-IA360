import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, Share2, Calculator, TrendingUp, Users, Package, Euro, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);

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

// ─── Main Component ───

const SharedProjectSettlementTab = ({ projectId, budget, sharingModel }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ... (rest of the component remains similar until Calculations) ...
  // Ensure the prop is used in the Calculations block (already done in previous step)
  // Now updating the UI details below...


  // Form state for partner data
  const [nombreSocio, setNombreSocio] = useState('');
  const [costePersonalSocio, setCostePersonalSocio] = useState('');
  const [costeMaterialesSocio, setCosteMaterialesSocio] = useState('');
  const [notas, setNotas] = useState('');
  const [isDirty, setIsDirty] = useState(false);

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

  // 2. Fetch existing partner data
  const { data: socioData, isLoading: loadingSocio } = useQuery({
    queryKey: ['settlement_socio', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obras_compartidas_socios')
        .select('*')
        .eq('proyecto_id', projectId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') {
        console.warn('[Settlement] Error fetching socio:', error.message);
        return null;
      }
      return data;
    },
    enabled: !!projectId
  });

  // Populate form when socio data loads
  React.useEffect(() => {
    if (socioData && !isDirty) {
      setNombreSocio(socioData.nombre_socio || '');
      setCostePersonalSocio(String(socioData.coste_personal || ''));
      setCosteMaterialesSocio(String(socioData.coste_materiales || ''));
      setNotas(socioData.notas || '');
    }
  }, [socioData]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. Save / Upsert mutation
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
      queryClient.invalidateQueries({ queryKey: ['settlement_socio', projectId] });
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
      coste_personal: Number(costePersonalSocio) || 0,
      coste_materiales: Number(costeMaterialesSocio) || 0,
      notas: notas.trim() || null,
      updated_at: new Date().toISOString()
    });
  };

  // ─── Calculations ───

  const presupuesto = Number(budget) || costs?.presupuesto || 0;
  const miCostePersonal = costs?.personal || 0;
  const miCosteMateriales = costs?.materiales || 0;
  const miCostoTotal = miCostePersonal + miCosteMateriales;

  const socioCostePersonal = Number(costePersonalSocio) || 0;
  const socioCosteMateriales = Number(costeMaterialesSocio) || 0;
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

  const isLoading = loadingCosts || loadingSocio;

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

        {/* ── Column 2: Costes del Socio (Manual) ── */}
        <Card className="shadow-lg border-border/50 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white pb-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              <CardTitle className="text-lg">Empresa Colaboradora</CardTitle>
            </div>
            <CardDescription className="text-orange-100/80 text-xs">Introduce los datos manualmente</CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
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
            <div className="space-y-2">
              <Label htmlFor="coste_personal_socio" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Coste Personal (€)
              </Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="coste_personal_socio"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costePersonalSocio}
                  onChange={(e) => { setCostePersonalSocio(e.target.value); setIsDirty(true); }}
                  placeholder="0.00"
                  className="pl-10 h-11 font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coste_materiales_socio" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Coste Materiales (Sin IVA) (€)
              </Label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="coste_materiales_socio"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costeMaterialesSocio}
                  onChange={(e) => { setCosteMaterialesSocio(e.target.value); setIsDirty(true); }}
                  placeholder="0.00"
                  className="pl-10 h-11 font-mono"
                />
              </div>
            </div>
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

      {/* ── Save Button ── */}
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
          Guardar Datos del Socio
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

    </div>
  );
};

export default SharedProjectSettlementTab;
