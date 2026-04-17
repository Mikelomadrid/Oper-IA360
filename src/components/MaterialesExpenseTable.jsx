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
import { Edit, Trash2, FileText, PackageX, Eye, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Helper for currency format
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

const MaterialesExpenseTable = ({ gastos = [], onEdit, onDelete, onPreview }) => {
  if (!gastos || gastos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-muted/5 rounded-xl border border-dashed">
          <PackageX className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm">No se encontraron gastos para este proyecto.</p>
      </div>
    );
  }

  return (
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
            <TableHead>Archivo</TableHead>
            <TableHead className="text-right font-bold">Total</TableHead>
            <TableHead className="w-[140px] text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gastos.map((gasto) => (
            <TableRow key={gasto.id} className="group hover:bg-muted/5 transition-colors">
              <TableCell className="font-medium text-xs whitespace-nowrap">
                {formatDate(gasto.fecha_emision)}
              </TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">
                {gasto.numero_factura || '-'}
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
              <TableCell>
                {gasto.adjunto_factura?.url_almacenamiento ? (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      onClick={() => onPreview && onPreview(gasto)}
                      title="Ver factura"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100" title="Descargar factura">
                      <a href={gasto.adjunto_factura.signed_url || gasto.adjunto_factura.preview_url || gasto.adjunto_factura.url_almacenamiento} download={gasto.adjunto_factura.nombre_archivo || `factura-${gasto.id}`} rel="noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Sin archivo</span>
                )}
              </TableCell>
              <TableCell className="text-right font-bold text-sm tabular-nums text-foreground">
                {formatCurrency(gasto.total_con_iva)}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
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
  );
};

export default MaterialesExpenseTable;