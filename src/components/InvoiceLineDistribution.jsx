import React, { useMemo } from 'react';
import { Building2, CheckCircle2, CircleDollarSign, Plus, RotateCcw, Warehouse, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const DESTINO_GENERAL = 'general';
export const DESTINO_ALMACEN = 'almacen';
export const destinoObra = (obraId) => `obra:${obraId}`;

export const parseDestino = (value) => {
  if (value === DESTINO_GENERAL) return { destino_tipo: 'general', obra_id: null };
  if (value === DESTINO_ALMACEN) return { destino_tipo: 'almacen', obra_id: null };
  if (value?.startsWith('obra:')) return { destino_tipo: 'obra', obra_id: value.slice(5) };
  return null;
};

export const destinoToValue = (asignacion) => {
  if (asignacion?.destino_tipo === 'obra' && asignacion.obra_id) return destinoObra(asignacion.obra_id);
  return asignacion?.destino_tipo || '';
};

export const buildDefaultAssignments = (linea, destinoPrincipal) => {
  const destino = parseDestino(destinoPrincipal);
  if (!destino) return [];
  return [{ ...destino, cantidad: Number(linea.cantidad || 0) }];
};

const destinoLabel = (asignacion, proyectos) => {
  if (asignacion?.destino_tipo === 'general') return 'Gastos generales';
  if (asignacion?.destino_tipo === 'almacen') return 'Almacén propio';
  if (asignacion?.destino_tipo === 'obra') {
    return proyectos.find((proyecto) => proyecto.id === asignacion.obra_id)?.nombre_proyecto || 'Obra no disponible';
  }
  return 'Sin destino';
};

export const DestinationSelect = ({ value, onValueChange, proyectos, className = '' }) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger className={className}>
      <SelectValue placeholder="Selecciona el destino" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={DESTINO_GENERAL}>
        <span className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4" />Gastos generales</span>
      </SelectItem>
      <SelectItem value={DESTINO_ALMACEN}>
        <span className="flex items-center gap-2"><Warehouse className="h-4 w-4" />Almacén propio</span>
      </SelectItem>
      {proyectos.map((proyecto) => (
        <SelectItem key={proyecto.id} value={destinoObra(proyecto.id)}>
          <span className="flex items-center gap-2"><Building2 className="h-4 w-4" />{proyecto.nombre_proyecto}</span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const InvoiceLineDistribution = ({ linea, proyectos, destinoPrincipal, enabled, onChange }) => {
  const assignments = useMemo(() => (
    linea.asignaciones?.length
      ? linea.asignaciones
      : buildDefaultAssignments(linea, destinoPrincipal)
  ), [linea, destinoPrincipal]);

  const cantidadLinea = Number(linea.cantidad || 0);
  const cantidadAsignada = assignments.reduce((total, item) => total + Number(item.cantidad || 0), 0);
  const diferencia = Number((cantidadLinea - cantidadAsignada).toFixed(3));
  const isBalanced = Math.abs(diferencia) <= 0.001 && assignments.length > 0;

  const commit = (next) => onChange(next.map((item) => ({
    destino_tipo: item.destino_tipo,
    obra_id: item.destino_tipo === 'obra' ? item.obra_id : null,
    cantidad: Number(item.cantidad || 0),
  })));

  const updateAssignment = (index, patch) => {
    commit(assignments.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const updateDestination = (index, value) => {
    const destino = parseDestino(value);
    if (destino) updateAssignment(index, destino);
  };

  const splitAssignment = () => {
    if (!assignments.length) return;
    const sourceIndex = assignments.reduce((largest, item, index) => (
      Number(item.cantidad || 0) > Number(assignments[largest]?.cantidad || 0) ? index : largest
    ), 0);
    const source = assignments[sourceIndex];
    const sourceQty = Number(source.cantidad || 0);
    const secondQty = Number((sourceQty / 2).toFixed(3));
    const firstQty = Number((sourceQty - secondQty).toFixed(3));
    const next = assignments.map((item, index) => index === sourceIndex ? { ...item, cantidad: firstQty } : item);
    next.splice(sourceIndex + 1, 0, { ...source, cantidad: secondQty });
    commit(next);
  };

  const removeAssignment = (index) => {
    const next = assignments.filter((_, itemIndex) => itemIndex !== index);
    if (!next.length) {
      onChange([]);
      return;
    }
    commit(next);
  };

  if (!enabled) {
    const summary = assignments.length === 1
      ? destinoLabel(assignments[0], proyectos)
      : `${assignments.length} destinos`;
    return (
      <Badge variant="outline" className="h-6 max-w-full gap-1.5 border-primary/20 bg-primary/5 text-[11px] text-primary">
        {assignments[0]?.destino_tipo === 'almacen' ? <Warehouse className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
        <span className="truncate">{summary}</span>
      </Badge>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border/70 bg-background/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Distribución de unidades</p>
        <div className="flex items-center gap-2">
          <Badge className={isBalanced ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-800'} variant="outline">
            {isBalanced ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
            {cantidadAsignada} / {cantidadLinea} {linea.unidad || 'ud'}
          </Badge>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onChange([])}>
            <RotateCcw className="mr-1 h-3 w-3" />Usar destino principal
          </Button>
        </div>
      </div>

      {assignments.map((assignment, index) => (
        <div key={`${index}-${destinoToValue(assignment)}`} className="grid grid-cols-[minmax(0,1fr)_90px_30px] items-center gap-2">
          <DestinationSelect
            value={destinoToValue(assignment)}
            onValueChange={(value) => updateDestination(index, value)}
            proyectos={proyectos}
            className="h-8 text-xs"
          />
          <Input
            type="number"
            min="0"
            step="0.001"
            value={assignment.cantidad}
            onChange={(event) => updateAssignment(index, { cantidad: event.target.value })}
            className="h-8 text-right text-xs tabular-nums"
            aria-label={`Cantidad asignada ${index + 1}`}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => removeAssignment(index)}
            disabled={assignments.length === 1}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={splitAssignment}>
          <Plus className="mr-1 h-3 w-3" />Dividir entre destinos
        </Button>
        {!isBalanced && (
          <p className="text-xs font-medium text-amber-700">
            {diferencia > 0 ? `Faltan ${diferencia}` : `Sobran ${Math.abs(diferencia)}`} {linea.unidad || 'ud'} por asignar
          </p>
        )}
      </div>
    </div>
  );
};

export default InvoiceLineDistribution;
