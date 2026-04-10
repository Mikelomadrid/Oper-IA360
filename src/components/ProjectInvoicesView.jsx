import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Receipt, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

const ProjectInvoicesView = ({ projectId }) => {
    // Fetch data from 'facturas_emitidas' (Invoices sent to clients)
    // Table 'facturas_emitidas' is verified to have: numero_factura, fecha_emision, monto_total, estado
    const { data: facturas, isLoading, error } = useQuery({
        queryKey: ['project_invoices', projectId],
        queryFn: async () => {
            if (!projectId) return [];
            
            const { data, error } = await supabase
                .from('facturas_emitidas')
                .select('*')
                .eq('proyecto_id', projectId)
                .order('fecha_emision', { ascending: false });
            
            if (error) throw error;
            return data || [];
        },
        enabled: !!projectId
    });

    const totalFacturado = facturas?.reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0) || 0;

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200">
                Error cargando facturas: {error.message}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Card className="w-full sm:w-auto bg-muted/30">
                    <CardContent className="p-3 flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                            <Receipt className="w-4 h-4 text-green-700 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase">Total Facturado</p>
                            <p className="text-lg font-bold text-foreground">{formatCurrency(totalFacturado)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-0">
                    {facturas.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <AlertCircle className="h-12 w-12 mb-3 opacity-20" />
                            <p>No hay facturas emitidas para este proyecto.</p>
                        </div>
                    ) : (
                        <div className="relative overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Nº Factura</TableHead>
                                        <TableHead>Fecha Emisión</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="text-right">Importe Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {facturas.map((factura) => (
                                        <TableRow key={factura.id}>
                                            <TableCell className="font-medium">
                                                {factura.numero_factura}
                                            </TableCell>
                                            <TableCell>
                                                {formatDate(factura.fecha_emision)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`capitalize ${
                                                    factura.estado === 'pagada' ? 'bg-green-100 text-green-800 border-green-200' :
                                                    factura.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {factura.estado}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-bold">
                                                {formatCurrency(factura.monto_total)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ProjectInvoicesView;