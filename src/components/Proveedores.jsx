import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, PlusCircle, Truck, Package, Edit, FileDown } from 'lucide-react';
import { Helmet } from 'react-helmet';
import ProveedoresTable from './ProveedoresTable';
import * as XLSX from 'xlsx';

const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

const ProveedorForm = ({ proveedor, onSave, onCancel }) => {
    const { user } = useAuth();
    const isEditing = !!proveedor;
    const [formData, setFormData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (proveedor) {
            setFormData({ ...proveedor, activo: proveedor.activo ? 'Activo' : 'Inactivo' });
        } else {
            setFormData({ nombre: '', cif: '', email: '', telefono: '', contacto: '', direccion: '', activo: 'Activo' });
        }
    }, [proveedor]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    };
    
    const handleSelectChange = (value) => {
        setFormData(prev => ({...prev, activo: value}));
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.nombre?.trim()) newErrors.nombre = 'El nombre es obligatorio.';
        if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email inválido.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSaving(true);
        const { id, ...dataToSave } = formData;
        dataToSave.activo = dataToSave.activo === 'Activo';

        let query;
        if (isEditing) {
            query = supabase.from('proveedores').update(dataToSave).eq('id', id);
        } else {
            dataToSave.created_by = user.id;
            query = supabase.from('proveedores').insert([dataToSave]);
        }
        
        const { error } = await query;
        setIsSaving(false);
        
        if (error) {
            toast({ title: `Error al ${isEditing ? 'actualizar' : 'crear'}`, description: error.message, variant: "destructive" });
        } else {
            toast({ 
                title: `Proveedor ${isEditing ? 'actualizado' : 'creado'}`,
                description: `${dataToSave.nombre} ha sido guardado correctamente.`,
                className: "bg-green-50 border-green-200"
            });
            onSave();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre Comercial <span className="text-red-500">*</span></Label>
                    <Input id="nombre" name="nombre" value={formData.nombre || ''} onChange={handleInputChange} className={errors.nombre ? "border-red-500" : ""} placeholder="Ej: Materiales Construcción S.L." />
                    {errors.nombre && <p className="text-xs text-red-500">{errors.nombre}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cif">CIF/NIF</Label>
                    <Input id="cif" name="cif" value={formData.cif || ''} onChange={handleInputChange} placeholder="B12345678" />
                </div>
            </div>
            
            <div className="space-y-2">
                <Label htmlFor="contacto">Persona de Contacto</Label>
                <Input id="contacto" name="contacto" value={formData.contacto || ''} onChange={handleInputChange} placeholder="Nombre del representante" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleInputChange} className={errors.email ? "border-red-500" : ""} placeholder="contacto@proveedor.com" />
                    {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input id="telefono" name="telefono" value={formData.telefono || ''} onChange={handleInputChange} placeholder="+34 ..." />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="direccion">Dirección Fiscal / Almacén</Label>
                <Textarea id="direccion" name="direccion" value={formData.direccion || ''} onChange={handleInputChange} placeholder="Dirección completa..." />
            </div>

            <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={formData.activo || 'Activo'} onValueChange={handleSelectChange}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Activo">Activo (Disponible)</SelectItem>
                        <SelectItem value="Inactivo">Inactivo (Bloqueado)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" disabled={isSaving} className="bg-primary text-primary-foreground">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                    {isEditing ? 'Actualizar' : 'Crear Proveedor'}
                </Button>
            </DialogFooter>
        </form>
    );
};


const Proveedores = ({ navigate }) => {
    const [items, setItems] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [isExporting, setIsExporting] = useState(false);

    const debouncedSearchTerm = useDebounce(searchText, 300);
    const { sessionRole } = useAuth();
    const observer = useRef();
    const PAGE_SIZE = 50;

    const canManage = useMemo(() => sessionRole.rol === 'admin' || sessionRole.rol === 'encargado', [sessionRole]);

    useEffect(() => {
        if (sessionRole.loaded && sessionRole.rol === 'colaborador') {
             toast({ title: 'Acceso restringido', variant: 'destructive' });
             navigate('/dashboard');
        }
    }, [sessionRole, navigate]);

    const fetchPage = useCallback(async (currentOffset, isSearch) => {
        if (sessionRole.rol === 'colaborador') return;

        if(isSearch) {
            setLoading(true);
            setItems([]);
        } else {
            setLoadingMore(true);
        }

        const { data, error } = await supabase.rpc('api_proveedor_search_v2', {
            p_q: debouncedSearchTerm || null,
            p_limit: PAGE_SIZE,
            p_offset: currentOffset
        });

        if (error) {
            toast({ title: 'Error al cargar proveedores', description: error.message, variant: 'destructive' });
        } else {
            // Apply client-side sorting by name since the RPC doesn't have an order_by parameter
            const sortedData = [...data].sort((a, b) => a.nombre.localeCompare(b.nombre));
            setItems(prev => isSearch ? sortedData : [...prev, ...sortedData]);
            setHasMore(data.length === PAGE_SIZE);
            setOffset(currentOffset + data.length);
        }

        setLoading(false);
        setLoadingMore(false);
    }, [debouncedSearchTerm, sessionRole.rol]);

    useEffect(() => {
        setOffset(0);
        fetchPage(0, true);
    }, [debouncedSearchTerm, fetchPage]);
    
    const lastElementRef = useCallback(node => {
        if (loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                fetchPage(offset, false);
            }
        });
        if (node) observer.current.observe(node);
    }, [loadingMore, hasMore, offset, fetchPage]);

    const handleRefresh = () => {
        setFormOpen(false);
        setEditingItem(null);
        setOffset(0);
        fetchPage(0, true);
    };

    const handleDelete = async (id) => {
        const { error } = await supabase.from('proveedores').delete().eq('id', id);
        if (error) {
            toast({ title: 'Error al eliminar', description: 'Es probable que el proveedor tenga facturas o productos asociados.', variant: 'destructive' });
        } else {
            toast({ title: 'Proveedor eliminado' });
            // Optimistic update
            setItems(prev => prev.filter(item => item.id !== id));
        }
    };

    const handleExportExcel = async () => {
        try {
            setIsExporting(true);
            // Fetch ALL providers for export, not just the paginated/filtered set
            const { data, error } = await supabase
                .from('proveedores')
                .select('*')
                .order('nombre', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                toast({ title: 'Exportación cancelada', description: 'No hay proveedores para exportar.', variant: 'warning' });
                return;
            }

            const exportData = data.map(prov => ({
                'Nombre Comercial': prov.nombre,
                'CIF/NIF': prov.cif || '',
                'Contacto': prov.contacto || '',
                'Teléfono': prov.telefono || '',
                'Email': prov.email || '',
                'Dirección': prov.direccion || '',
                'Municipio': prov.ciudad || '', // Some records use ciudad
                'Provincia': prov.provincia || '',
                'CP': prov.cp || '',
                'Estado': prov.activo ? 'Activo' : 'Inactivo',
                'Fecha Alta': prov.fecha_creacion ? new Date(prov.fecha_creacion).toLocaleDateString() : ''
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            
            // Auto-width columns
            const wscols = Object.keys(exportData[0]).map(key => ({ wch: Math.max(key.length, 20) }));
            ws['!cols'] = wscols;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Proveedores");

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Proveedores_${dateStr}.xlsx`);

            toast({ title: 'Exportación exitosa', description: 'El archivo se ha descargado correctamente.', className: "bg-green-50 border-green-200" });

        } catch (error) {
            console.error('Export error:', error);
            toast({ title: 'Error en la exportación', description: error.message, variant: 'destructive' });
        } finally {
            setIsExporting(false);
        }
    };

    if (sessionRole.rol === 'colaborador') return null;

    return (
        <div className="p-6 md:p-10 space-y-8 bg-gray-50/50 dark:bg-background min-h-screen">
            <Helmet><title>Proveedores | OrkaRefor ERP</title></Helmet>
            
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Truck className="h-8 w-8 text-primary" />
                        Proveedores y Suministros
                    </h1>
                    <p className="text-muted-foreground mt-1">Gestión de compras, datos de contacto y facturación.</p>
                </div>
                {canManage && (
                    <Button 
                        onClick={() => { setEditingItem(null); setFormOpen(true); }} 
                        size="lg"
                        className="shadow-md hover:shadow-lg transition-all"
                    >
                        <PlusCircle className="mr-2 h-5 w-5" /> 
                        Nuevo Proveedor
                    </Button>
                )}
            </motion.div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.1 }}
                className="bg-card rounded-xl shadow-sm border border-border"
            >
                <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row items-center gap-4 justify-between">
                    <div className="relative flex-1 max-w-md w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar por nombre, CIF, contacto..." 
                            value={searchText} 
                            onChange={(e) => setSearchText(e.target.value)} 
                            className="pl-9 bg-background focus-visible:ring-primary/20" 
                        />
                    </div>
                    <Button 
                        variant="outline" 
                        onClick={handleExportExcel} 
                        disabled={isExporting}
                        className="w-full sm:w-auto"
                    >
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileDown className="mr-2 h-4 w-4"/>}
                        Exportar Excel
                    </Button>
                </div>

                <div className="p-0">
                    <ProveedoresTable
                        items={items}
                        loading={loading}
                        navigate={navigate}
                        canManage={canManage}
                        onEdit={(item) => { setEditingItem(item); setFormOpen(true); }}
                        onDelete={handleDelete}
                        lastElementRef={lastElementRef}
                    />
                </div>
                
                {loadingMore && (
                    <div className="flex justify-center items-center py-6 border-t">
                        <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                    </div>
                )}
            </motion.div>

            <Dialog open={isFormOpen} onOpenChange={(open) => { if(!open) setEditingItem(null); setFormOpen(open); }}>
                <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl">
                            {editingItem ? <Edit className="h-5 w-5" /> : <Package className="h-6 w-6 text-primary" />}
                            {editingItem ? 'Editar Proveedor' : 'Alta de Nuevo Proveedor'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingItem ? 'Modifica los datos del proveedor.' : 'Registra un nuevo proveedor en la base de datos.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <ProveedorForm proveedor={editingItem} onSave={handleRefresh} onCancel={() => setFormOpen(false)} />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Proveedores;