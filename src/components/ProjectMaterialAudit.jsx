import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PackageOpen,
  Plus,
  RefreshCw,
  Scale,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const STATUS = {
  dentro_prevision: {
    label: 'Dentro de previsión',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  },
  exceso_cantidad: {
    label: 'Exceso de unidades',
    className: 'border-red-200 bg-red-50 text-red-700',
    icon: AlertTriangle,
  },
  exceso_coste: {
    label: 'Sobrecoste',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: AlertTriangle,
  },
  no_previsto: {
    label: 'No previsto',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: PackageOpen,
  },
  unidad_incompatible: {
    label: 'Revisar unidad',
    className: 'border-red-200 bg-red-50 text-red-700',
    icon: Scale,
  },
};

const EMPTY_PLAN = {
  descripcion: '',
  referencia: '',
  unidad: 'ud',
  cantidad_prevista: '',
  precio_unitario_previsto: '',
};

const asNumber = (value) => Number(value || 0);
const formatQuantity = (value) => new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
}).format(asNumber(value));
const formatCurrency = (value) => new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
}).format(asNumber(value));

function AuditBadge({ status }) {
  const config = STATUS[status] || STATUS.no_previsto;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`gap-1 whitespace-nowrap font-medium ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

const ProjectMaterialAudit = ({ projectId, canManage = false }) => {
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const queryClient = useQueryClient();
  const { sessionRole } = useAuth();
  const { toast } = useToast();

  const controlQuery = useQuery({
    queryKey: ['obra_materiales_control', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_obra_materiales_control')
        .select('*')
        .eq('obra_id', projectId)
        .order('estado_auditoria')
        .order('descripcion');
      if (error) throw error;
      return data || [];
    },
  });

  const invoiceQuery = useQuery({
    queryKey: ['facturas_material_auditoria', projectId],
    enabled: !!projectId && canManage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_factura_material_auditoria')
        .select('*')
        .eq('obra_id', projectId)
        .order('fecha_factura', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const pendingInvoices = useMemo(() => {
    const groups = new Map();
    for (const line of invoiceQuery.data || []) {
      if (line.partida_gasto_id) continue;
      const current = groups.get(line.factura_id) || {
        facturaId: line.factura_id,
        numero: line.numero_factura || 'Sin número',
        proveedor: line.proveedor_nombre || 'Proveedor sin identificar',
        fecha: line.fecha_factura,
        lines: [],
      };
      current.lines.push(line);
      groups.set(line.factura_id, current);
    }
    return [...groups.values()].map((invoice) => ({
      ...invoice,
      ready: invoice.lines.length > 0 && invoice.lines.every((line) => line.validacion_estado === 'validada'),
    }));
  }, [invoiceQuery.data]);

  const totals = useMemo(() => (controlQuery.data || []).reduce((acc, row) => {
    acc.planned += asNumber(row.coste_previsto);
    acc.actual += asNumber(row.coste_real);
    if (!['dentro_prevision'].includes(row.estado_auditoria)) acc.alerts += 1;
    return acc;
  }, { planned: 0, actual: 0, alerts: 0 }), [controlQuery.data]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['obra_materiales_control', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['facturas_material_auditoria', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project_material_expenses', projectId] }),
    ]);
  };

  const createPlan = useMutation({
    mutationFn: async () => {
      const quantity = Number(plan.cantidad_prevista);
      const price = Number(plan.precio_unitario_previsto);
      if (!plan.descripcion.trim()) throw new Error('Escribe la descripción del material.');
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad prevista debe ser mayor que cero.');
      if (!Number.isFinite(price) || price < 0) throw new Error('El precio previsto no puede ser negativo.');

      const { error } = await supabase.from('obra_materiales_previstos').insert({
        obra_id: projectId,
        descripcion: plan.descripcion.trim(),
        referencia: plan.referencia.trim() || null,
        unidad: plan.unidad.trim() || 'ud',
        cantidad_prevista: quantity,
        precio_unitario_previsto: price,
        origen: 'manual',
        estado: 'confirmado',
        confirmado_por: sessionRole?.empleadoId || sessionRole?.id || null,
        confirmado_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setPlan(EMPTY_PLAN);
      setShowPlanForm(false);
      await refresh();
      toast({ title: 'Material previsto añadido', description: 'Ya se usará para auditar las próximas facturas.' });
    },
    onError: (error) => toast({
      variant: 'destructive',
      title: 'No se pudo añadir el material',
      description: error.message,
    }),
  });

  const processInvoice = useMutation({
    mutationFn: async (invoice) => {
      if (!invoice.ready) throw new Error('Primero hay que validar todas las líneas OCR de esta factura.');
      const employeeId = sessionRole?.empleadoId || sessionRole?.id;
      if (!employeeId) throw new Error('No se ha podido identificar al empleado que contabiliza.');
      const { data, error } = await supabase.rpc('ia360_contabilizar_factura_materiales_erp', {
        p_factura_id: invoice.facturaId,
        p_usuario_id: employeeId,
        p_estado_pago: 'pendiente_pago',
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'No se pudo contabilizar la factura.');
      return data;
    },
    onSuccess: async (result) => {
      await refresh();
      toast({
        title: 'Factura contabilizada en la obra',
        description: `${result.lineas_procesadas || 0} líneas procesadas; ${result.no_previstas || 0} requieren revisión.`,
      });
    },
    onError: (error) => toast({
      variant: 'destructive',
      title: 'No se pudo contabilizar',
      description: error.message,
    }),
  });

  const rows = controlQuery.data || [];
  const deviation = totals.actual - totals.planned;

  return (
    <Card className="overflow-hidden border-border/60 shadow-none">
      <CardHeader className="border-b border-border/50 bg-muted/20 p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-blue-700" />
              <CardTitle className="text-lg">Control previsto ↔ facturado</CardTitle>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Cantidades y costes sin IVA, trazados desde cada línea de factura.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={refresh} disabled={controlQuery.isFetching || invoiceQuery.isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${(controlQuery.isFetching || invoiceQuery.isFetching) ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => setShowPlanForm((value) => !value)}>
                {showPlanForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {showPlanForm ? 'Cerrar' : 'Añadir previsto'}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border/60 bg-border/60 lg:grid-cols-4">
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Material previsto</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatCurrency(totals.planned)}</p>
          </div>
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Material facturado</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatCurrency(totals.actual)}</p>
          </div>
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Desviación</p>
            <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${deviation > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {deviation > 0 ? '+' : ''}{formatCurrency(deviation)}
            </p>
          </div>
          <div className="bg-background px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Requieren atención</p>
            <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${totals.alerts ? 'text-amber-800' : 'text-emerald-700'}`}>
              {totals.alerts}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {showPlanForm && canManage && (
          <form
            className="grid gap-3 border-b border-border/50 bg-blue-50/40 p-4 md:grid-cols-12"
            onSubmit={(event) => { event.preventDefault(); createPlan.mutate(); }}
          >
            <div className="md:col-span-4">
              <Label htmlFor="plan-description" className="text-xs">Material previsto</Label>
              <Input id="plan-description" value={plan.descripcion} onChange={(event) => setPlan((current) => ({ ...current, descripcion: event.target.value }))} placeholder="Ej. Cable 3×2,5 mm²" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="plan-reference" className="text-xs">Referencia</Label>
              <Input id="plan-reference" value={plan.referencia} onChange={(event) => setPlan((current) => ({ ...current, referencia: event.target.value }))} placeholder="Opcional" />
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="plan-unit" className="text-xs">Unidad</Label>
              <Input id="plan-unit" value={plan.unidad} onChange={(event) => setPlan((current) => ({ ...current, unidad: event.target.value }))} placeholder="ud" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="plan-quantity" className="text-xs">Cantidad</Label>
              <Input id="plan-quantity" type="number" min="0" step="0.001" value={plan.cantidad_prevista} onChange={(event) => setPlan((current) => ({ ...current, cantidad_prevista: event.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="plan-price" className="text-xs">Precio/ud.</Label>
              <Input id="plan-price" type="number" min="0" step="0.0001" value={plan.precio_unitario_previsto} onChange={(event) => setPlan((current) => ({ ...current, precio_unitario_previsto: event.target.value }))} />
            </div>
            <div className="flex items-end md:col-span-1">
              <Button className="w-full" type="submit" disabled={createPlan.isPending}>
                {createPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
              </Button>
            </div>
          </form>
        )}

        {canManage && pendingInvoices.length > 0 && (
          <div className="border-b border-border/50 bg-amber-50/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-950">Facturas pendientes de pasar a unidades de obra</p>
                <p className="text-xs text-amber-800">Solo se habilitan cuando todas sus líneas OCR están validadas.</p>
              </div>
              <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900">{pendingInvoices.length}</Badge>
            </div>
            <div className="space-y-2">
              {pendingInvoices.map((invoice) => (
                <div key={invoice.facturaId} className="flex flex-col gap-2 rounded-md border border-amber-200/80 bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{invoice.proveedor} · {invoice.numero}</p>
                    <p className="text-xs text-muted-foreground">{invoice.lines.length} líneas · {invoice.fecha || 'Fecha sin identificar'}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={invoice.ready ? 'default' : 'outline'}
                    disabled={!invoice.ready || processInvoice.isPending}
                    onClick={() => processInvoice.mutate(invoice)}
                  >
                    {processInvoice.isPending && processInvoice.variables?.facturaId === invoice.facturaId
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <ClipboardCheck className="mr-2 h-4 w-4" />}
                    {invoice.ready ? 'Contabilizar materiales' : 'Pendiente de validación'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {controlQuery.isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando trazabilidad de materiales…
          </div>
        ) : controlQuery.error ? (
          <div className="m-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            No se pudo cargar el control: {controlQuery.error.message}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
            <PackageOpen className="mb-3 h-8 w-8 text-muted-foreground/60" />
            <p className="font-medium">Todavía no hay materiales que comparar</p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Añade el desglose previsto o contabiliza una factura OCR para empezar a cruzar cantidades y costes.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[220px]">Material</TableHead>
                <TableHead className="text-right">Previsto</TableHead>
                <TableHead className="text-right">Facturado</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead className="text-right">Coste previsto</TableHead>
                <TableHead className="text-right">Coste real</TableHead>
                <TableHead>Auditoría</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const quantityDelta = asNumber(row.desviacion_cantidad);
                return (
                  <TableRow key={row.material_previsto_id || `${row.producto_catalogo_id || row.descripcion}-${row.unidad}-${index}`}>
                    <TableCell>
                      <p className="font-medium text-foreground">{row.descripcion}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{row.facturas || 0} factura(s) trazadas</p>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatQuantity(row.cantidad_prevista)} {row.unidad}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatQuantity(row.cantidad_real)} {row.unidad}</TableCell>
                    <TableCell className={`text-right font-mono font-semibold tabular-nums ${quantityDelta > 0 ? 'text-red-700' : quantityDelta < 0 ? 'text-blue-700' : 'text-muted-foreground'}`}>
                      {quantityDelta > 0 ? '+' : ''}{formatQuantity(quantityDelta)} {row.unidad}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrency(row.coste_previsto)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">{formatCurrency(row.coste_real)}</TableCell>
                    <TableCell><AuditBadge status={row.estado_auditoria} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectMaterialAudit;
