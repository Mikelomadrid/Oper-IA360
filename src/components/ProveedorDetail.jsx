import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, ArrowLeft, Edit, Trash2, FileText, Calculator, Receipt } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const ProveedorFormModal = ({ isOpen, onOpenChange, proveedor, onSave }) => {
    const { user } = useAuth();
    const isEditing = !!proveedor;
    const [formData, setFormData] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(isEditing ? { ...proveedor, activo: proveedor.activo ? 'Activo' : 'Inactivo' } : { activo: 'Activo' });
        }
    }, [isOpen, proveedor, isEditing]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (value) => {
        setFormData(prev => ({ ...prev, activo: value }));
    };

    const handleSubmit = async () => {
        if (!formData.nombre) {
            toast({ title: "Nombre requerido", description: "El nombre del proveedor es obligatorio.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        const { error } = await supabase
            .from('proveedores')
            .update({
                nombre: formData.nombre,
                telefono: formData.telefono,
                email: formData.email,
                direccion: formData.direccion,
                cif: formData.cif,
                activo: formData.activo === 'Activo',
                cp: formData.cp,
                ciudad: formData.ciudad,
                provincia: formData.provincia,
                pais: formData.pais,
                contacto: formData.contacto,
            })
            .eq('id', proveedor.id);

        setIsSaving(false);
        if (error) {
            toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Proveedor actualizado", description: "Los datos se han guardado correctamente." });
            onSave();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Proveedor</DialogTitle>
                    <DialogDescription>Modifica los datos del proveedor.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-2">
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="nombre" className="text-right">Nombre</Label><Input id="nombre" name="nombre" value={formData.nombre || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="cif" className="text-right">CIF/NIF</Label><Input id="cif" name="cif" value={formData.cif || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="email" className="text-right">Email</Label><Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="telefono" className="text-right">Teléfono</Label><Input id="telefono" name="telefono" value={formData.telefono || ''} onChange={handleInputChange} className="col-span-3" /></div>
                     <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="contacto" className="text-right">Contacto</Label><Input id="contacto" name="contacto" value={formData.contacto || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="direccion" className="text-right">Dirección</Label><Textarea id="direccion" name="direccion" value={formData.direccion || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="cp" className="text-right">CP</Label><Input id="cp" name="cp" value={formData.cp || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="ciudad" className="text-right">Ciudad</Label><Input id="ciudad" name="ciudad" value={formData.ciudad || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="provincia" className="text-right">Provincia</Label><Input id="provincia" name="provincia" value={formData.provincia || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="pais" className="text-right">País</Label><Input id="pais" name="pais" value={formData.pais || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="estado" className="text-right">Estado</Label>
                        <Select value={formData.activo} onValueChange={handleSelectChange}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Selecciona un estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Activo">Activo</SelectItem>
                                <SelectItem value="Inactivo">Inactivo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const ProveedorDetail = ({ proveedorId, navigate }) => {
    const { sessionRole } = useAuth();
    const [generalData, setGeneralData] = useState(null);
    const [gastos, setGastos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingGastos, setLoadingGastos] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);

    const canManage = useMemo(() => sessionRole.rol === 'admin' || sessionRole.rol === 'encargado', [sessionRole]);

    const fetchGeneralData = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('proveedores')
            .select('*')
            .eq('id', proveedorId)
            .single();

        if (error || !data) {
            toast({ title: 'Error al cargar proveedor', description: error?.message || 'El proveedor no fue encontrado.', variant: 'destructive' });
            navigate('/crm/proveedores');
        } else {
            setGeneralData(data);
        }
        setLoading(false);
    }, [proveedorId, navigate]);

    const fetchGastos = useCallback(async () => {
        setLoadingGastos(true);
        const { data, error } = await supabase
            .from('gastos')
            .select('*')
            .eq('proveedor_id', proveedorId)
            .order('fecha_emision', { ascending: false });

        if (!error) {
            setGastos(data || []);
        } else {
            console.error("Error fetching gastos:", error);
        }
        setLoadingGastos(false);
    }, [proveedorId]);

    useEffect(() => {
        fetchGeneralData();
        fetchGastos();
    }, [fetchGeneralData, fetchGastos]);

    const handleDelete = async () => {
        const { error } = await supabase.from('proveedores').delete().eq('id', proveedorId);
        if (error) {
            toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Proveedor eliminado" });
            navigate('/crm/proveedores');
        }
    };

    const summary = useMemo(() => {
        const totalInvoices = gastos.length;
        const totalBase = gastos.reduce((sum, g) => sum + (Number(g.monto_bruto) || 0), 0);
        const averageTicket = totalInvoices > 0 ? totalBase / totalInvoices : 0;
        return { totalInvoices, totalBase, averageTicket };
    }, [gastos]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('es-ES');
    };

    const getStatusBadge = (status) => {
        const s = status?.toLowerCase() || 'pendiente';
        switch (s) {
            case 'pagada': return <Badge className="bg-green-100 text-green-800 border-green-200">Pagada</Badge>;
            case 'pendiente': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendiente</Badge>;
            case 'vencida': return <Badge className="bg-red-100 text-red-800 border-red-200">Vencida</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };
    
    if (loading) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!generalData) {
        return <div className="p-8 text-center">Proveedor no encontrado.</div>;
    }

    return (
        <div className="p-4 md:p-8">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex justify-between items-center mb-6">
                    <Button variant="ghost" onClick={() => navigate('/crm/proveedores')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Proveedores
                    </Button>
                    {canManage && (
                        <div className="flex gap-2">
                             <Button onClick={() => setIsFormModalOpen(true)}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Eliminar</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Seguro que quieres eliminar este proveedor?</AlertDialogTitle>
                                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(generalData.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    )}
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{generalData.nombre ? generalData.nombre.toUpperCase() : 'Proveedor'}</CardTitle>
                        <CardDescription>
                            <span className="font-mono">{generalData.cif || '-'}</span> · {generalData.email || '-'} · {generalData.telefono || '-'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Nombre</p><p>{generalData.nombre ? generalData.nombre.toUpperCase() : '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">CIF</p><p>{generalData.cif || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Email</p><p>{generalData.email || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Teléfono</p><p>{generalData.telefono || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Persona de Contacto</p><p>{generalData.contacto || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Dirección</p><p>{generalData.direccion || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Código Postal</p><p>{generalData.cp || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Ciudad</p><p>{generalData.ciudad || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Provincia</p><p>{generalData.provincia || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">País</p><p>{generalData.pais || '-'}</p></div>
                             <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Estado</p><p>{generalData.activo ? 'Activo' : 'Inactivo'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Fecha de Creación</p><p>{new Date(generalData.fecha_creacion).toLocaleDateString()}</p></div>
                        </div>
                    </CardContent>
                </Card>

                {/* Section Historial de Gastos */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5" /> Historial de Gastos
                        </CardTitle>
                        <CardDescription>Facturas y gastos asociados a este proveedor.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingGastos ? (
                            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                        ) : (
                            <div className="space-y-6">
                                {/* Summary Block */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card className="bg-muted/20 border shadow-none">
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <div className="p-3 bg-blue-100 text-blue-700 rounded-full">
                                                <Receipt className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground">Total Facturas</p>
                                                <p className="text-2xl font-bold">{summary.totalInvoices}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-muted/20 border shadow-none">
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <div className="p-3 bg-green-100 text-green-700 rounded-full">
                                                <Calculator className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground">Total Base (Sin IVA)</p>
                                                <p className="text-2xl font-bold">{formatCurrency(summary.totalBase)}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-muted/20 border shadow-none">
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <div className="p-3 bg-purple-100 text-purple-700 rounded-full">
                                                <span className="font-bold text-lg">Avg</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground">Ticket Medio</p>
                                                <p className="text-2xl font-bold">{formatCurrency(summary.averageTicket)}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Table */}
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Nº Factura</TableHead>
                                                <TableHead>Fecha Emisión</TableHead>
                                                <TableHead className="text-right">Base Imponible</TableHead>
                                                <TableHead className="text-right">Total (con IVA)</TableHead>
                                                <TableHead className="text-center">Estado</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {gastos.length > 0 ? (
                                                gastos.map((gasto) => (
                                                    <TableRow key={gasto.id}>
                                                        <TableCell className="font-medium">{gasto.numero_factura || '-'}</TableCell>
                                                        <TableCell>{formatDate(gasto.fecha_emision)}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(gasto.monto_bruto)}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(gasto.total_con_iva)}</TableCell>
                                                        <TableCell className="text-center">{getStatusBadge(gasto.estado_pago)}</TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                        No hay gastos registrados para este proveedor.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                 {canManage && <ProveedorFormModal isOpen={isFormModalOpen} onOpenChange={setIsFormModalOpen} proveedor={generalData} onSave={() => { setIsFormModalOpen(false); fetchGeneralData(); }} />}
            </motion.div>
        </div>
    );
};

export default ProveedorDetail;