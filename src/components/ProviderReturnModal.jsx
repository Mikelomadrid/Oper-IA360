import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, PackageX, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const number = (value) => Number(value || 0);
const quantity = (value) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(number(value));
const currency = (value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(number(value));

const ProviderReturnModal = ({ open, onOpenChange, factura, projectId, onSuccess }) => {
  const [amounts, setAmounts] = useState({});
  const [reason, setReason] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setAmounts({});
      setReason('');
    }
  }, [open, factura?.factura_gasto_id]);

  const linesQuery = useQuery({
    queryKey: ['provider_return_available_lines', factura?.factura_gasto_id, projectId],
    enabled: open && !!factura?.factura_gasto_id && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_devolucion_proveedor_lineas_disponibles')
        .select('*')
        .eq('factura_id', factura.factura_gasto_id)
        .eq('obra_id', projectId)
        .gt('cantidad_disponible', 0)
        .order('descripcion');
      if (error) throw error;
      return data || [];
    },
  });

  const selectedLines = useMemo(() => (linesQuery.data || [])
    .map((line) => ({
      ...line,
      cantidad_devolver: number(amounts[line.asignacion_id]),
    }))
    .filter((line) => line.cantidad_devolver > 0), [linesQuery.data, amounts]);

  const estimatedBase = useMemo(() => selectedLines.reduce(
    (sum, line) => sum + line.cantidad_devolver * number(line.precio_unitario),
    0,
  ), [selectedLines]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error('Indica el motivo de la devolución.');
      if (selectedLines.length === 0) throw new Error('Indica las unidades que se devuelven.');
      const invalid = selectedLines.find((line) => line.cantidad_devolver > number(line.cantidad_disponible));
      if (invalid) throw new Error(`Solo quedan ${quantity(invalid.cantidad_disponible)} ${invalid.unidad} de ${invalid.descripcion}.`);

      const { data, error } = await supabase.rpc('ia360_crear_devolucion_proveedor', {
        p_factura_id: factura.factura_gasto_id,
        p_obra_id: projectId,
        p_motivo: reason.trim(),
        p_lineas: selectedLines.map((line) => ({
          asignacion_id: line.asignacion_id,
          cantidad: line.cantidad_devolver,
        })),
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'No se pudo registrar la devolución.');
      return data;
    },
    onSuccess: async (result) => {
      toast({
        title: 'Devolución pendiente de abono',
        description: `${currency(result.importe_pendiente_abono)} descontados de la obra. No se ha modificado el almacén ni Contasimple.`,
      });
      await onSuccess?.(result);
      onOpenChange(false);
    },
    onError: (error) => toast({
      variant: 'destructive',
      title: 'No se pudo registrar la devolución',
      description: error.message,
    }),
  });

  const updateAmount = (line, rawValue) => {
    const value = rawValue === '' ? '' : Math.max(0, Number(rawValue));
    setAmounts((current) => ({ ...current, [line.asignacion_id]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !mutation.isPending && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>Devolver materiales al proveedor</DialogTitle>
            <Badge className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-50">Pendiente de abono</Badge>
          </div>
          <DialogDescription>
            Factura {factura?.numero_factura || 'sin número'} · {factura?.proveedor?.nombre || 'Proveedor'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p>Las unidades y el coste se descontarán ahora de esta obra. El material no entrará en el almacén y no se enviará nada a Contasimple hasta recibir la factura de abono.</p>
        </div>

        <div className="max-h-[42vh] overflow-auto rounded-md border border-border/60">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-muted/30">
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Comprado</TableHead>
                <TableHead className="text-right">Ya devuelto</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead className="w-[150px] text-right">A devolver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linesQuery.isLoading && <TableRow><TableCell colSpan={5} className="h-28 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></TableCell></TableRow>}
              {linesQuery.error && <TableRow><TableCell colSpan={5} className="h-24 text-center text-sm text-red-700">{linesQuery.error.message}</TableCell></TableRow>}
              {!linesQuery.isLoading && !linesQuery.error && (linesQuery.data || []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground"><PackageX className="mx-auto mb-2 h-6 w-6 opacity-50" /><p>No quedan materiales disponibles para devolver en esta factura.</p></TableCell></TableRow>
              )}
              {(linesQuery.data || []).map((line) => {
                const alreadyReturned = number(line.cantidad_devuelta_almacen) + number(line.cantidad_devuelta_proveedor);
                const currentAmount = amounts[line.asignacion_id] ?? '';
                const invalid = currentAmount !== '' && number(currentAmount) > number(line.cantidad_disponible);
                return (
                  <TableRow key={line.asignacion_id}>
                    <TableCell><p className="font-medium">{line.descripcion}</p><p className="text-xs text-muted-foreground">{line.referencia || 'Sin referencia'} · {currency(line.precio_unitario)}/{line.unidad}</p></TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">{quantity(line.cantidad_comprada)} {line.unidad}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">{quantity(alreadyReturned)} {line.unidad}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">{quantity(line.cantidad_disponible)} {line.unidad}</TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Unidades de ${line.descripcion}`}
                        type="number"
                        min="0"
                        step="0.001"
                        max={line.cantidad_disponible}
                        value={currentAmount}
                        onChange={(event) => updateAmount(line, event.target.value)}
                        className={invalid ? 'border-red-400 text-right font-mono' : 'text-right font-mono'}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="space-y-2">
            <Label htmlFor="provider-return-reason">Motivo de la devolución</Label>
            <Textarea id="provider-return-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. material sobrante, referencia incorrecta o defecto" rows={3} />
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pendiente de recuperar</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-800">{currency(estimatedBase)}</p>
            <p className="mt-2 text-xs text-muted-foreground">Base estimada hasta recibir el abono.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || selectedLines.length === 0 || !reason.trim()} className="bg-amber-700 text-white hover:bg-amber-800">
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            Confirmar devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProviderReturnModal;
