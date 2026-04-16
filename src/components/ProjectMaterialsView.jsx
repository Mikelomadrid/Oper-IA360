import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Plus, Search, Download, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import MaterialExpenseModal from '@/components/MaterialExpenseModal';
import MaterialesExpenseTable from '@/components/MaterialesExpenseTable';
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

const isPreviewableImage = (url = '', fileName = '') => /\.(jpg|jpeg|png|webp|gif)$/i.test(url || fileName);
const isPdfFile = (url = '', fileName = '') => /\.pdf$/i.test(url || fileName);
const getAttachmentUrl = (gasto) => gasto?.adjunto_factura?.url_almacenamiento || null;
const getAttachmentName = (gasto) => gasto?.adjunto_factura?.nombre_archivo || 'factura';

const FacturaPreviewDialog = ({ gasto, open, onOpenChange }) => {
    const fileUrl = getAttachmentUrl(gasto);
    const fileName = getAttachmentName(gasto);

    if (!gasto) return null;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-4xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>Factura adjunta</AlertDialogTitle>
                    <AlertDialogDescription>
                        {gasto.numero_factura || 'Sin número'} · {gasto.proveedor?.nombre || 'Proveedor sin asignar'}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {!fileUrl ? (
                    <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                        Este gasto no tiene archivo adjunto.
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="text-sm text-muted-foreground truncate">{fileName}</div>
                            <div className="flex gap-2">
                                <Button asChild variant="outline" size="sm">
                                    <a href={fileUrl} target="_blank" rel="noreferrer">Abrir</a>
                                </Button>
                                <Button asChild size="sm">
                                    <a href={fileUrl} download={fileName} target="_blank" rel="noreferrer">
                                        <Download className="w-4 h-4 mr-2" />Descargar
                                    </a>
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-muted/10 min-h-[500px] overflow-hidden flex items-center justify-center">
                            {isPreviewableImage(fileUrl, fileName) ? (
                                <img src={fileUrl} alt={fileName} className="max-h-[70vh] w-full object-contain" />
                            ) : isPdfFile(fileUrl, fileName) ? (
                                <iframe title={fileName} src={fileUrl} className="w-full h-[70vh]" />
                            ) : (
                                <div className="text-center text-sm text-muted-foreground p-8 space-y-3">
                                    <FileText className="w-10 h-10 mx-auto opacity-60" />
                                    <div>No hay vista previa integrada para este tipo de archivo.</div>
                                    <Button asChild variant="outline" size="sm">
                                        <a href={fileUrl} target="_blank" rel="noreferrer">Abrir archivo</a>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel>Cerrar</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

const ProjectMaterialsView = ({ projectId }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expenseToEdit, setExpenseToEdit] = useState(null);
    const [expenseToDelete, setExpenseToDelete] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [previewGasto, setPreviewGasto] = useState(null);

    // Fetch Expenses
    const { data: gastos, isLoading, error, refetch } = useQuery({
        queryKey: ['project_material_expenses', projectId],
        queryFn: async () => {
            if (!projectId) return [];
            
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
                    adjunto_factura:adjuntos(id, nombre_archivo, url_almacenamiento)
                `)
                .eq('proyecto_id', projectId)
                .order('fecha_emision', { ascending: false });
            
            if (error) throw error;
            return (data || []).map((gasto) => ({
                ...gasto,
                adjunto_factura: Array.isArray(gasto.adjunto_factura)
                    ? gasto.adjunto_factura.find((item) => item?.url_almacenamiento) || null
                    : gasto.adjunto_factura || null,
            }));
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
        setExpenseToEdit(null);
        setIsModalOpen(true);
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
                        onPreview={setPreviewGasto}
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

            <FacturaPreviewDialog
                gasto={previewGasto}
                open={!!previewGasto}
                onOpenChange={(open) => {
                    if (!open) setPreviewGasto(null);
                }}
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