import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import MaterialExpenseModal from '@/components/MaterialExpenseModal';
import MaterialesExpenseTable from '@/components/MaterialesExpenseTable';
import ProjectMaterialAudit from '@/components/ProjectMaterialAudit';
import ProjectMaterialLedger from '@/components/ProjectMaterialLedger';
import ProviderReturnModal from '@/components/ProviderReturnModal';
import { toast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Helper for currency format
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);
};

const ProjectMaterialsView = ({ projectId, canManage = false }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expenseToEdit, setExpenseToEdit] = useState(null);
    const [expenseToDelete, setExpenseToDelete] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [providerReturnExpense, setProviderReturnExpense] = useState(null);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Fetch Expenses
    const { data: gastos, isLoading, error, refetch } = useQuery({
        queryKey: ['project_material_expenses', projectId],
        queryFn: async () => {
            if (!projectId) return [];
            
            // Se añade el embed a facturas_gastos para poder mostrar el botón "ver factura escaneada"
            // en MaterialesExpenseTable. Se usa el hint !facturas_gastos_gasto_id_fkey porque
            // gasto_etiquetas_rel.gasto_id tiene FKs tanto a gastos.id como a facturas_gastos.id,
            // lo que crea un camino indirecto adicional entre 'gastos' y 'facturas_gastos' y
            // PostgREST no puede elegir automáticamente cuál usar (error "more than one relationship").
            const { data, error } = await supabase
                .from('gastos')
                .select(`
                    id,
                    fecha_emision,
                    numero_factura,
                    concepto,
                    monto_neto,
                    iva,
                    total_con_iva,
                    proveedor_id,
                    proveedor:proveedores(nombre),
                    facturas_gastos!facturas_gastos_gasto_id_fkey(id, documento_principal_id, documentos_ids)
                `)
                .eq('proyecto_id', projectId)
                .order('fecha_emision', { ascending: false });
            
            if (error) throw error;

            // Una factura repartida entre obra y almacén se contabiliza con cabecera
            // general, por lo que su gasto no tiene proyecto_id. Aun así, las líneas
            // destinadas a esta obra deben aparecer aquí para permitir consultar la
            // factura y gestionar devoluciones al proveedor.
            const { data: distributedAssignments, error: distributedAssignmentsError } = await supabase
                .from('factura_gasto_linea_asignaciones')
                .select('factura_id, importe_base')
                .eq('obra_id', projectId)
                .eq('destino_tipo', 'obra');
            if (distributedAssignmentsError) throw distributedAssignmentsError;

            const allocatedBaseByInvoice = new Map();
            (distributedAssignments || []).forEach((assignment) => {
                allocatedBaseByInvoice.set(
                    assignment.factura_id,
                    (allocatedBaseByInvoice.get(assignment.factura_id) || 0) + Number(assignment.importe_base || 0)
                );
            });

            const distributedInvoiceIds = [...allocatedBaseByInvoice.keys()];
            let distributedInvoices = [];
            if (distributedInvoiceIds.length > 0) {
                const { data: invoiceRows, error: invoiceRowsError } = await supabase
                    .from('facturas_gastos')
                    .select('id, gasto_id, documento_principal_id, documentos_ids')
                    .in('id', distributedInvoiceIds);
                if (invoiceRowsError) throw invoiceRowsError;
                distributedInvoices = invoiceRows || [];
            }

            const directGastoIds = new Set((data || []).map((gasto) => gasto.id));
            const distributedGastoIds = [...new Set(
                distributedInvoices
                    .map((invoice) => invoice.gasto_id)
                    .filter((gastoId) => gastoId && !directGastoIds.has(gastoId))
            )];

            let distributedGastos = [];
            if (distributedGastoIds.length > 0) {
                const { data: gastoRows, error: gastoRowsError } = await supabase
                    .from('gastos')
                    .select(`
                        id,
                        fecha_emision,
                        numero_factura,
                        concepto,
                        monto_neto,
                        iva,
                        total_con_iva,
                        proveedor_id,
                        proveedor:proveedores(nombre)
                    `)
                    .in('id', distributedGastoIds);
                if (gastoRowsError) throw gastoRowsError;
                distributedGastos = gastoRows || [];
            }

            const { data: returnSummaries, error: returnSummariesError } = await supabase
                .from('v_devoluciones_proveedor_resumen_factura')
                .select('*')
                .eq('obra_id', projectId);
            if (returnSummariesError) throw returnSummariesError;
            const returnSummaryByInvoice = new Map((returnSummaries || []).map((summary) => [summary.factura_id, summary]));

            const { data: pendingReturns, error: pendingReturnsError } = await supabase
                .from('devoluciones_proveedor')
                .select('id, factura_origen_id, obra_id, motivo, importe_base_estimado, created_at')
                .eq('obra_id', projectId)
                .eq('estado', 'pendiente_abono')
                .order('created_at', { ascending: false });
            if (pendingReturnsError) throw pendingReturnsError;
            const pendingReturnByInvoice = new Map();
            (pendingReturns || []).forEach((item) => {
                if (!pendingReturnByInvoice.has(item.factura_origen_id)) {
                    pendingReturnByInvoice.set(item.factura_origen_id, item);
                }
            });

            // facturas_gastos puede venir como array u objeto según cómo infiera PostgREST la relación
            // (no hay constraint UNIQUE en gasto_id, así que por defecto es array; se maneja de forma defensiva).
            const directRows = (data || []).map(gasto => {
                const fgRaw = gasto.facturas_gastos;
                const facturaInfo = Array.isArray(fgRaw) ? (fgRaw[0] || null) : (fgRaw || null);
                const numDocumentosFactura = Array.isArray(facturaInfo?.documentos_ids) ? facturaInfo.documentos_ids.length : 0;

                return {
                    ...gasto,
                    factura_gasto_id: facturaInfo?.id || null,
                    documento_principal_id: facturaInfo?.documento_principal_id || null,
                    num_documentos_factura: numDocumentosFactura,
                    tiene_documento_factura: !!facturaInfo?.documento_principal_id,
                    devolucion_proveedor: facturaInfo?.id ? returnSummaryByInvoice.get(facturaInfo.id) || null : null,
                    devolucion_pendiente: facturaInfo?.id ? pendingReturnByInvoice.get(facturaInfo.id) || null : null,
                };
            });

            const distributedGastoById = new Map(distributedGastos.map((gasto) => [gasto.id, gasto]));
            const distributedRows = distributedInvoices.flatMap((facturaInfo) => {
                const gasto = distributedGastoById.get(facturaInfo.gasto_id);
                if (!gasto) return [];

                const montoAsignado = Number(allocatedBaseByInvoice.get(facturaInfo.id) || 0);
                const tipoIva = Number(gasto.iva || 0);
                const numDocumentosFactura = Array.isArray(facturaInfo.documentos_ids) ? facturaInfo.documentos_ids.length : 0;

                return [{
                    ...gasto,
                    id: `distribuida-${facturaInfo.id}-${projectId}`,
                    gasto_origen_id: gasto.id,
                    monto_neto: montoAsignado,
                    total_con_iva: Math.round((montoAsignado * (1 + tipoIva) + Number.EPSILON) * 100) / 100,
                    concepto: `${gasto.concepto || 'Factura distribuida'} · Parte asignada a esta obra`,
                    factura_gasto_id: facturaInfo.id,
                    documento_principal_id: facturaInfo.documento_principal_id || null,
                    num_documentos_factura: numDocumentosFactura,
                    tiene_documento_factura: !!facturaInfo.documento_principal_id,
                    devolucion_proveedor: returnSummaryByInvoice.get(facturaInfo.id) || null,
                    devolucion_pendiente: pendingReturnByInvoice.get(facturaInfo.id) || null,
                    solo_lectura_distribuida: true,
                }];
            });

            return [...directRows, ...distributedRows].sort((a, b) =>
                String(b.fecha_emision || '').localeCompare(String(a.fecha_emision || ''))
            );
        },
        enabled: !!projectId
    });

    const filteredGastos = gastos?.filter(gasto => 
        (gasto.concepto?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (gasto.proveedor?.nombre?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (gasto.numero_factura?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ) || [];

    const totalBase = filteredGastos.reduce((acc, curr) => acc + (Number(curr.monto_neto) || 0), 0);
    const totalIVA = filteredGastos.reduce((acc, curr) => acc + (Number(curr.total_con_iva) - Number(curr.monto_neto) || 0), 0);
    const totalGeneral = filteredGastos.reduce((acc, curr) => acc + (Number(curr.total_con_iva) || 0), 0);

    // Create / Edit Handlers
    const handleAdd = () => {
        const returnTo = `/gestion/obras/${projectId}?tab=materiales`;
        navigate(`/administracion/gastos/scanner?obraId=${encodeURIComponent(projectId)}&returnTo=${encodeURIComponent(returnTo)}`);
    };

    const handleEdit = (gasto) => {
        setExpenseToEdit(gasto);
        setIsModalOpen(true);
    };

    // Delete Handlers
    const handleDeleteClick = (gasto) => {
        setExpenseToDelete(gasto);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!expenseToDelete) return;
        
        try {
            // Delete child rows first (partidas_gasto) just in case cascade isn't set, though it should be.
            // But explicit is safer for frontend logic sometimes.
            await supabase.from('partidas_gasto').delete().eq('gasto_id', expenseToDelete.id);
            
            const { error } = await supabase
                .from('gastos')
                .delete()
                .eq('id', expenseToDelete.id);

            if (error) throw error;

            toast({ title: 'Gasto eliminado', description: 'La factura se ha eliminado correctamente.' });
            refetch();
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el gasto.' });
        } finally {
            setDeleteDialogOpen(false);
            setExpenseToDelete(null);
        }
    };

    const handleModalSuccess = () => {
        refetch();
    };

    const handleProviderReturnSuccess = async () => {
        await Promise.all([
            refetch(),
            queryClient.invalidateQueries({ queryKey: ['obra_materiales_balance', projectId] }),
            queryClient.invalidateQueries({ queryKey: ['obra_materiales_devolucion_disponible', projectId] }),
            queryClient.invalidateQueries({ queryKey: ['obra_materiales_control', projectId] }),
        ]);
    };

    const handleUploadCreditNote = (gasto) => {
        const returnId = gasto?.devolucion_pendiente?.id;
        if (!returnId) return;
        const returnTo = `/gestion/obras/${projectId}?tab=materiales`;
        navigate(`/administracion/gastos/scanner?devolucionProveedorId=${encodeURIComponent(returnId)}&returnTo=${encodeURIComponent(returnTo)}`);
    };

    if (isLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>;
    }

    if (error) {
        return (
            <div className="p-6 text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 flex items-center justify-center">
                Error cargando gastos: {error.message}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <ProjectMaterialLedger projectId={projectId} canManage={canManage} />
            <ProjectMaterialAudit projectId={projectId} canManage={canManage} />

            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row justify-end items-center gap-4">
                 <Button 
                    onClick={handleAdd}
                    className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 rounded-xl px-6 py-5 h-auto transition-all hover:scale-[1.02] active:scale-[0.98]"
                 >
                    <Plus className="w-5 h-5 mr-2" />
                    <span className="font-semibold text-base">Añadir Factura</span>
                 </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="shadow-sm border-l-4 border-l-blue-500 bg-card">
                    <CardContent className="p-4 md:p-6 flex flex-col justify-center">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Base Imponible</p>
                        <p className="text-xl md:text-2xl font-bold text-foreground mt-1">{formatCurrency(totalBase)}</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-purple-500 bg-card">
                    <CardContent className="p-4 md:p-6 flex flex-col justify-center">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">IVA Total</p>
                        <p className="text-xl md:text-2xl font-bold text-foreground mt-1">{formatCurrency(totalIVA)}</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900">
                    <CardContent className="p-4 md:p-6 flex flex-col justify-center">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Gasto</p>
                        <p className="text-xl md:text-2xl font-bold text-green-700 dark:text-green-400 mt-1">{formatCurrency(totalGeneral)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter & Table */}
            <Card className="shadow-md border-border/50">
                <CardHeader className="p-4 md:p-6 border-b bg-muted/5">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-bold">Listado de Gastos</CardTitle>
                            <CardDescription>Facturas y compras de materiales asignadas al proyecto</CardDescription>
                        </div>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar por concepto, proveedor..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <MaterialesExpenseTable 
                        gastos={filteredGastos} 
                        onEdit={handleEdit} 
                        onDelete={handleDeleteClick} 
                        onReturnToProvider={setProviderReturnExpense}
                        onUploadCreditNote={handleUploadCreditNote}
                        canManage={canManage}
                    />
                </CardContent>
            </Card>

            <MaterialExpenseModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                projectId={projectId}
                expenseToEdit={expenseToEdit}
                onSuccess={handleModalSuccess}
            />

            <ProviderReturnModal
                open={!!providerReturnExpense}
                onOpenChange={(open) => !open && setProviderReturnExpense(null)}
                factura={providerReturnExpense}
                projectId={projectId}
                onSuccess={handleProviderReturnSuccess}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará la factura 
                            {expenseToDelete && <span className="font-bold"> {expenseToDelete.numero_factura}</span>}
                            {' '}y todos sus datos asociados permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ProjectMaterialsView;
