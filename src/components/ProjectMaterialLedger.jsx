import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, Loader2, PackageCheck, RotateCcw, Warehouse } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const number = (value) => Number(value || 0);
const quantity = (value) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(number(value));
const currency = (value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(number(value));
const rowKey = (row) => [row.producto_catalogo_id, row.material_id, row.descripcion, row.referencia, row.unidad].filter(Boolean).join('|');

const ProjectMaterialLedger = ({ projectId, canManage = false }) => {
  const [returnRow, setReturnRow] = useState(null);
  const [assignmentId, setAssignmentId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const balanceQuery = useQuery({
    queryKey: ['obra_materiales_balance', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_obra_materiales_balance').select('*').eq('obra_id', projectId).order('descripcion');
      if (error) throw error;
      return data || [];
    },
  });

  const availableQuery = useQuery({
    queryKey: ['obra_materiales_devolucion_disponible', projectId],
    enabled: !!projectId && canManage,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_obra_materiales_devolucion_disponible').select('*').eq('obra_id', projectId).gt('cantidad_disponible', 0).order('fecha_factura', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const totals = useMemo(() => (balanceQuery.data || []).reduce((acc, row) => ({
    purchased: acc.purchased + number(row.coste_compra),
    warehouse: acc.warehouse + number(row.coste_desde_almacen),
    returned: acc.returned + number(row.coste_devuelto),
    net: acc.net + number(row.coste_neto),
  }), { purchased: 0, warehouse: 0, returned: 0, net: 0 }), [balanceQuery.data]);

  const candidates = useMemo(() => {
    if (!returnRow) return [];
    return (availableQuery.data || []).filter((item) => (
      (returnRow.producto_catalogo_id && item.producto_catalogo_id === returnRow.producto_catalogo_id)
      || (returnRow.material_id && item.material_almacen_id === returnRow.material_id)
      || (item.descripcion === returnRow.descripcion && item.unidad === returnRow.unidad)
    ));
  }, [availableQuery.data, returnRow]);

  const selectedAssignment = candidates.find((item) => item.origen_id === assignmentId) || null;

  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['obra_materiales_balance', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['obra_materiales_devolucion_disponible', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['obra_materiales_control', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['project_material_expenses', projectId] }),
  ]);

  const returnMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(returnQuantity);
      if (!assignmentId) throw new Error('Selecciona el origen del material.');
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Indica una cantidad válida.');
      if (amount > number(selectedAssignment?.cantidad_disponible)) throw new Error('La cantidad supera las unidades disponibles de esa compra.');
      const isWarehouseExit = selectedAssignment?.origen_tipo === 'almacen';
      const { data, error } = await supabase.rpc(
        isWarehouseExit ? 'ia360_devolver_salida_obra_almacen' : 'ia360_devolver_material_obra_almacen',
        isWarehouseExit
          ? {
              p_movimiento_salida_id: assignmentId,
              p_cantidad: amount,
              p_observaciones: notes.trim() || null,
            }
          : {
              p_asignacion_id: assignmentId,
              p_cantidad: amount,
              p_observaciones: notes.trim() || null,
            },
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'No se pudo registrar la devolución.');
      return data;
    },
    onSuccess: async (result) => {
      await refresh();
      toast({ title: 'Material devuelto al almacén', description: `${quantity(result.cantidad_devuelta)} unidades y ${currency(result.coste_descontado_obra)} descontados de la obra.` });
      setReturnRow(null);
      setAssignmentId('');
      setReturnQuantity('');
      setNotes('');
    },
    onError: (error) => toast({ variant: 'destructive', title: 'No se pudo registrar la devolución', description: error.message }),
  });

  const openReturn = (row) => {
    const matching = (availableQuery.data || []).filter((item) => (
      (row.producto_catalogo_id && item.producto_catalogo_id === row.producto_catalogo_id)
      || (row.material_id && item.material_almacen_id === row.material_id)
      || (item.descripcion === row.descripcion && item.unidad === row.unidad)
    ));
    setReturnRow(row);
    setAssignmentId(matching[0]?.origen_id || '');
    setReturnQuantity('');
    setNotes('');
  };

  if (balanceQuery.isLoading) return <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (balanceQuery.error) return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">No se pudo cargar el balance de materiales: {balanceQuery.error.message}</div>;

  const rows = balanceQuery.data || [];

  return (
    <Card className="overflow-hidden border-border/60 shadow-none">
      <CardHeader className="border-b border-border/50 bg-muted/20 p-4 md:p-5">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-blue-700" />
          <CardTitle className="text-lg">Balance real de materiales</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">Compras y salidas de almacén menos las devoluciones. El gasto fiscal permanece intacto; cambia únicamente el coste imputado a la obra.</p>
        <div className="mt-3 flex flex-wrap items-stretch overflow-hidden rounded-md border border-border/60 bg-background">
          <div className="min-w-36 flex-1 px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Comprado</p><p className="font-mono text-lg font-semibold tabular-nums">{currency(totals.purchased)}</p></div>
          <div className="min-w-36 flex-1 border-l border-border/50 px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Desde almacén</p><p className="font-mono text-lg font-semibold tabular-nums text-blue-700">+ {currency(totals.warehouse)}</p></div>
          <div className="min-w-36 flex-1 border-l border-border/50 px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Devuelto</p><p className="font-mono text-lg font-semibold tabular-nums text-amber-700">− {currency(totals.returned)}</p></div>
          <div className="min-w-40 flex-1 border-l border-border/50 bg-emerald-50/40 px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Coste neto obra</p><p className="font-mono text-xl font-bold tabular-nums text-emerald-800">{currency(totals.net)}</p></div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center"><Warehouse className="mb-2 h-7 w-7 text-muted-foreground/60" /><p className="font-medium">Sin movimientos de materiales</p><p className="mt-1 text-sm text-muted-foreground">Aparecerán al asignar líneas de factura o sacar material del almacén.</p></div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/20"><TableRow className="hover:bg-transparent"><TableHead className="min-w-[220px]">Material</TableHead><TableHead className="text-right">Comprado</TableHead><TableHead className="text-right">Almacén → obra</TableHead><TableHead className="text-right">Devuelto</TableHead><TableHead className="text-right">Consumo neto</TableHead><TableHead className="text-right">Coste neto</TableHead>{canManage && <TableHead className="w-[150px]" />}</TableRow></TableHeader>
            <TableBody>{rows.map((row) => {
              const canReturn = (availableQuery.data || []).some((item) => number(item.cantidad_disponible) > 0 && ((row.producto_catalogo_id && item.producto_catalogo_id === row.producto_catalogo_id) || (row.material_id && item.material_almacen_id === row.material_id) || (item.descripcion === row.descripcion && item.unidad === row.unidad)));
              return <TableRow key={rowKey(row)}><TableCell><p className="font-medium">{row.descripcion}</p><p className="text-xs text-muted-foreground">{row.referencia || 'Sin referencia'} · {row.movimientos} movimiento(s)</p></TableCell><TableCell className="text-right font-mono tabular-nums">{quantity(row.cantidad_comprada)} {row.unidad}</TableCell><TableCell className="text-right font-mono tabular-nums text-blue-700">{quantity(row.cantidad_desde_almacen)} {row.unidad}</TableCell><TableCell className="text-right font-mono tabular-nums text-amber-700">{quantity(row.cantidad_devuelta)} {row.unidad}</TableCell><TableCell className="text-right font-mono font-semibold tabular-nums">{quantity(row.cantidad_neta)} {row.unidad}</TableCell><TableCell className="text-right font-mono font-semibold tabular-nums">{currency(row.coste_neto)}</TableCell>{canManage && <TableCell className="text-right"><Button variant="outline" size="sm" disabled={!canReturn || availableQuery.isLoading} onClick={() => openReturn(row)}><RotateCcw className="mr-2 h-3.5 w-3.5" />Devolver</Button></TableCell>}</TableRow>;
            })}</TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!returnRow} onOpenChange={(open) => !open && setReturnRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Devolver material al almacén</DialogTitle><DialogDescription>Se descontarán las unidades y el coste de esta obra y aumentará el stock del almacén. La factura y el gasto fiscal no se modifican.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Material</Label><p className="mt-1 rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm font-medium">{returnRow?.descripcion}</p></div>
            <div><Label>Origen del material</Label><Select value={assignmentId} onValueChange={setAssignmentId}><SelectTrigger><SelectValue placeholder="Selecciona el origen" /></SelectTrigger><SelectContent>{candidates.map((item) => <SelectItem key={`${item.origen_tipo}:${item.origen_id}`} value={item.origen_id}>{item.proveedor_nombre || 'Proveedor'} · {item.numero_factura || 'Sin número'} · quedan {quantity(item.cantidad_disponible)} {item.unidad}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="return-quantity">Cantidad a devolver ({selectedAssignment?.unidad || returnRow?.unidad})</Label><Input id="return-quantity" type="number" min="0" step="0.001" max={selectedAssignment?.cantidad_disponible || undefined} value={returnQuantity} onChange={(event) => setReturnQuantity(event.target.value)} /></div>
            <div><Label htmlFor="return-notes">Observación</Label><Input id="return-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej. sobrante al finalizar instalación" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReturnRow(null)}>Cancelar</Button><Button onClick={() => returnMutation.mutate()} disabled={returnMutation.isPending || !assignmentId}>{returnMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}Confirmar devolución</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ProjectMaterialLedger;
