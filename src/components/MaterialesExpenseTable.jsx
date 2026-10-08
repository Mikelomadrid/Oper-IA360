import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, FileText, PackageX, Eye, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFacturaViewer } from '@/hooks/useFacturaViewer';
import FacturaViewerModal from '@/components/FacturaViewerModal';

// Helper for currency format
const number = (value) => Number(value || 0);

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);
};

// Helper for date format
const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    });
};

const MaterialesExpenseTable = ({ gastos = [], onEdit, onDelete, onReturnToProvider, canManage = false }) => {
  const { visorFactura, abrirFacturaEscaneada, cerrarVisor, paginaSiguiente, paginaAnterior, irAPagina } = useFacturaViewer();

  if (!gastos || gastos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-muted/5 rounded-xl border border-dashed">
          <PackageX className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm">No se encontraron gastos para este proyecto.</p>
      </div>
    );
  }

  return (
    <>
    <div className="relative overflow-hidden rounded-xl border shadow-sm bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[100px]">Fecha</TableHead>
            <TableHead className="w-[120px]">Nº Factura</TableHead>
            <TableHead className="min-w-[150px]">Proveedor</TableHead>
            <TableHead className="hidden md:table-cell">Concepto</TableHead>
            <TableHead className="text-right">Base</TableHead>
            <TableHead className="text-right w-[80px]">IVA</TableHead>
            <TableHead className="text-right font-bold">Total</TableHead>
            <TableHead className="w-[160px] text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gastos.map((gasto) => (
            <TableRow key={gasto.id} className="group hover:bg-muted/5 transition-colors">
              <TableCell className="font-medium text-xs whitespace-nowrap">
                {formatDate(gasto.fecha_emision)}
              </TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">
                <span className="block">{gasto.numero_factura || '-'}</span>
                {number(gasto.devolucion_proveedor?.devoluciones_pendientes) > 0 && (
                  <Badge className="mt-1 border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-sans text-amber-800 hover:bg-amber-50">
                    Abono pendiente · {formatCurrency(gasto.devolucion_proveedor?.importe_pendiente_abono)}
                  </Badge>
                )}
                {number(gasto.devolucion_proveedor?.devoluciones_pendientes) === 0 && number(gasto.devolucion_proveedor?.devoluciones_abonadas) > 0 && (
                  <Badge className="mt-1 border-emerald-300 bg-emerald-50 px-1.5 py-0 text-[10px] font-sans text-emerald-800 hover:bg-emerald-50">
                    Abonada
                  </Badge>
                )}
              </TableCell>
              <TableCell className="font-medium text-sm truncate max-w-[180px]">
                {gasto.proveedor?.nombre || 'Proveedor Desconocido'}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="text-sm line-clamp-1" title={gasto.concepto}>
                  {gasto.concepto || 'Sin concepto'}
                </span>
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {formatCurrency(gasto.monto_neto)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-xs tabular-nums">
                {gasto.iva ? `${(gasto.iva * 100).toFixed(0)}%` : '0%'}
              </TableCell>
              <TableCell className="text-right font-bold text-sm tabular-nums text-foreground">
                {formatCurrency(gasto.total_con_iva)}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  {gasto.tiene_documento_factura && gasto.factura_gasto_id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                      onClick={() => abrirFacturaEscaneada(gasto.factura_gasto_id)}
                      title={`Ver factura escaneada (${gasto.num_documentos_factura || 1})`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {canManage && gasto.factura_gasto_id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-amber-700 hover:bg-amber-50 hover:text-amber-900"
                      onClick={() => onReturnToProvider?.(gasto)}
                      title="Devolver materiales al proveedor"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => onEdit(gasto)}
                    title="Editar factura"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onDelete(gasto)}
                    title="Eliminar factura"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    <FacturaViewerModal
      visor={visorFactura}
      onClose={cerrarVisor}
      onPrev={paginaAnterior}
      onNext={paginaSiguiente}
      onSelect={irAPagina}
    />
    </>
  );
};

export default MaterialesExpenseTable;
