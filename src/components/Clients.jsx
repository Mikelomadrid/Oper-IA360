import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Loader2, UserPlus, Building2, User, MapPin, Phone, Mail, CheckCircle2, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ClientesTable from './ClientesTable';
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

export const ClientForm = ({ client, onSave, onCancel }) => {
    const [clientType, setClientType] = useState('particular');
    const [formData, setFormData] = useState({
        nombre: '', // Mapped to Nombre Fiscal / Razón Social or Nombre for Particular
        contacto: '',
        cif: '',
        email: '',
        telefono: '',
        calle_numero: '',
        municipio: '',
        provincia: '',
        codigo_postal: ''
    });
    const [errors, setErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (client) {
            setFormData({
                nombre: client.nombre || '',
                contacto: client.contacto || '',
                cif: client.cif || '',
                email: client.email || '',
                telefono: client.telefono || '',
                calle_numero: client.calle_numero || client.direccion || '',
                municipio: client.municipio || '',
                provincia: client.provincia || '',
                codigo_postal: client.codigo_postal || ''
            });
            // Try to infer client type based on data
            // If CIF starts with a letter, it is likely a company (NIF for companies usually starts with letter)
            // Or if persona_contacto is filled and different from nombre (likely company name vs person name)
            if (client.cif && /^[A-Za-z]/.test(client.cif)) {
                setClientType('empresa');
            } else if (client.contacto && client.contacto !== client.nombre) {
                setClientType('empresa');
            } else {
                setClientType('particular');
            }
        } else {
            setFormData({ nombre: '', contacto: '', cif: '', email: '', telefono: '', calle_numero: '', municipio: '', provincia: '', codigo_postal: '' });
            setClientType('particular');
        }
    }, [client]);

    const validate = () => {
        const newErrors = {};
        if (!formData.nombre.trim()) newErrors.nombre = 'Este campo es obligatorio.';
        if (clientType === 'empresa' && !formData.cif.trim()) newErrors.cif = 'El CIF es obligatorio para empresas.';
        if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'El formato del email no es válido.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (validate()) {
            setIsSaving(true);
            await onSave({
                ...formData,
                direccion: formData.calle_numero // Sync direccion for backward compatibility
            });
            setIsSaving(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (errors[e.target.name]) {
            setErrors({ ...errors, [e.target.name]: null });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo de Cliente Selector */}
            <div className="space-y-3">
                <Label className="text-base font-medium">Tipo de Cliente</Label>
                <RadioGroup 
                    value={clientType} 
                    onValueChange={setClientType} 
                    className="flex gap-4"
                >
                    <div 
                        onClick={() => setClientType('particular')}
                        className={`flex items-center space-x-2 border p-4 rounded-lg flex-1 cursor-pointer transition-all ${
                            clientType === 'particular' 
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
                            : 'hover:bg-muted/50 border-input'
                        }`}
                    >
                        <RadioGroupItem value="particular" id="r-particular" />
                        <Label htmlFor="r-particular" className="flex items-center gap-2 cursor-pointer w-full font-semibold">
                            <User className="w-4 h-4" /> Particular
                        </Label>
                    </div>
                    <div 
                        onClick={() => setClientType('empresa')}
                        className={`flex items-center space-x-2 border p-4 rounded-lg flex-1 cursor-pointer transition-all ${
                            clientType === 'empresa' 
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
                            : 'hover:bg-muted/50 border-input'
                        }`}
                    >
                        <RadioGroupItem value="empresa" id="r-empresa" />
                        <Label htmlFor="r-empresa" className="flex items-center gap-2 cursor-pointer w-full font-semibold">
                            <Building2 className="w-4 h-4" /> Empresa
                        </Label>
                    </div>
                </RadioGroup>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2 pb-2 border-b text-primary">
                        <User className="w-4 h-4" /> Datos de Contacto
                    </h3>
                    
                    <div className="space-y-2">
                        <Label htmlFor="nombre">
                            {clientType === 'empresa' ? 'Razón Social / Nombre Fiscal' : 'Nombre Completo'} <span className="text-red-500">*</span>
                        </Label>
                        <Input 
                            id="nombre" 
                            name="nombre"
                            placeholder={clientType === 'empresa' ? "Ej. Construcciones SL" : "Ej. Juan Pérez"}
                            value={formData.nombre}
                            onChange={handleChange}
                            className={errors.nombre ? "border-red-500" : ""}
                        />
                        {errors.nombre && <p className="text-xs text-red-500">{errors.nombre}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="contacto">Persona de Contacto</Label>
                        <Input 
                            id="contacto" 
                            name="contacto" 
                            value={formData.contacto} 
                            onChange={handleChange} 
                            placeholder="Ej: María García" 
                        />
                    </div>

                    <AnimatePresence>
                        {clientType === 'empresa' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-4 overflow-hidden"
                            >
                                <div className="space-y-2">
                                    <Label htmlFor="cif">CIF / NIF <span className="text-red-500">*</span></Label>
                                    <Input 
                                        id="cif" 
                                        name="cif"
                                        placeholder="B12345678"
                                        value={formData.cif}
                                        onChange={handleChange}
                                        className={errors.cif ? "border-red-500" : ""}
                                    />
                                    {errors.cif && <p className="text-xs text-red-500">{errors.cif}</p>}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="telefono">Teléfono</Label>
                            <div className="relative">
                                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    id="telefono" 
                                    name="telefono"
                                    className="pl-9"
                                    placeholder="600 000 000"
                                    value={formData.telefono}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    id="email" 
                                    name="email"
                                    className={errors.email ? "pl-9 border-red-500" : "pl-9"}
                                    type="email"
                                    placeholder="cliente@email.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                        </div>
                    </div>
                    
                    {clientType === 'particular' && (
                        <div className="space-y-2">
                            <Label htmlFor="cif">DNI / NIF (Opcional)</Label>
                            <Input 
                                id="cif" 
                                name="cif"
                                placeholder="12345678X"
                                value={formData.cif}
                                onChange={handleChange}
                            />
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2 pb-2 border-b text-primary">
                        <MapPin className="w-4 h-4" /> Ubicación del Servicio
                    </h3>
                    
                    <div className="space-y-2">
                        <Label htmlFor="calle_numero">Dirección Completa</Label>
                        <Input 
                            id="calle_numero" 
                            name="calle_numero"
                            placeholder="C/ Ejemplo, 123, 4ºA"
                            value={formData.calle_numero}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="municipio">Municipio</Label>
                            <Input 
                                id="municipio" 
                                name="municipio"
                                placeholder="Madrid"
                                value={formData.municipio}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="codigo_postal">C. Postal</Label>
                            <Input 
                                id="codigo_postal" 
                                name="codigo_postal"
                                placeholder="28001"
                                value={formData.codigo_postal}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="provincia">Provincia</Label>
                        <Input 
                            id="provincia" 
                            name="provincia"
                            placeholder="Madrid"
                            value={formData.provincia}
                            onChange={handleChange}
                        />
                    </div>
                </div>
            </div>

            <DialogFooter className="pt-6 border-t mt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" disabled={isSaving} className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[140px]">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    {isSaving ? 'Guardando...' : client ? 'Actualizar Cliente' : 'Crear Cliente'}
                </Button>
            </DialogFooter>
        </form>
    );
};


const Clients = ({ navigate }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [isExporting, setIsExporting] = useState(false);

    const observer = useRef();
    const debouncedSearchTerm = useDebounce(searchTerm, 350);
    const { sessionRole } = useAuth();

    const PAGE_SIZE = 50;

    const canCreate = useMemo(() => {
        const role = sessionRole.rol;
        return role === 'admin' || role === 'encargado';
    }, [sessionRole.rol]);

    const canEdit = useMemo(() => {
        const role = sessionRole.rol;
        return role === 'admin' || role === 'encargado';
    }, [sessionRole.rol]);

    const canDelete = useMemo(() => {
        return sessionRole.rol === 'admin';
    }, [sessionRole.rol]);

    useEffect(() => {
        if (!sessionRole.loaded) return;

        if (sessionRole.rol === 'colaborador') {
            toast({
                title: 'Acceso Denegado',
                description: 'No tienes permisos para acceder a la gestión de clientes.',
                variant: 'destructive'
            });
            navigate('/dashboard');
        }
    }, [sessionRole, navigate]);


    const fetchClients = useCallback(async (currentOffset, isSearch) => {
        if (sessionRole.rol === 'colaborador') return;
        
        if(isSearch) {
            setLoading(true);
            setItems([]); // Clear items on new search
        } else {
            setLoadingMore(true);
        }

        let query = supabase
            .from('clientes')
            .select('*')
            .order('nombre', { ascending: true })
            .range(currentOffset, currentOffset + PAGE_SIZE - 1);

        if (debouncedSearchTerm) {
            const search = `%${debouncedSearchTerm}%`;
            query = query.or(`nombre.ilike.${search},contacto.ilike.${search},cif.ilike.${search},telefono.ilike.${search},email.ilike.${search}`);
        }

        const { data, error } = await query;

        if (error) {
            toast({
                title: 'Error al cargar clientes',
                description: error.code === '42501' ? "No tienes permisos para ver los clientes." : error.message,
                variant: 'destructive',
            });
        } else {
            setItems(prev => isSearch ? data : [...prev, ...data]);
            setHasMore(data.length === PAGE_SIZE);
            setOffset(currentOffset + data.length);
        }
        setLoading(false);
        setLoadingMore(false);
    }, [debouncedSearchTerm, sessionRole.rol]);

    useEffect(() => {
        setOffset(0);
        fetchClients(0, true);
    }, [debouncedSearchTerm, fetchClients]); 
    
    const lastClientElementRef = useCallback(node => {
        if (loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                fetchClients(offset, false);
            }
        });
        if (node) observer.current.observe(node);
    }, [loadingMore, hasMore, offset, fetchClients]);

    const handleSaveClient = async (formData) => {
        let result;
        const isEditing = !!editingClient;

        if (isEditing) {
            const { data, error } = await supabase
                .from('clientes')
                .update(formData)
                .eq('id', editingClient.id)
                .select()
                .single();
            result = { data, error };
        } else {
            const { data, error } = await supabase
                .from('clientes')
                .insert(formData)
                .select()
                .single();
            result = { data, error };
        }

        if (result.error) {
            let description = result.error.message;
            if (result.error.code === '23505') {
                description = 'El CIF/NIF ya existe para otro cliente.';
            }
            toast({
                title: `Error al ${isEditing ? 'actualizar' : 'crear'} cliente`,
                description,
                variant: 'destructive'
            });
        } else {
            toast({
                title: `Cliente ${isEditing ? 'actualizado' : 'creado'}`,
                description: `${result.data.nombre} ha sido guardado correctamente.`,
                className: "bg-green-50 border-green-200"
            });
            setIsModalOpen(false);
            setEditingClient(null);
            setOffset(0);
            fetchClients(0, true);
        }
    };

    const handleDeleteClient = async (clientId) => {
        if (!canDelete) return;
        
        const { error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', clientId);

        if (error) {
            toast({
                title: 'Error al eliminar cliente',
                description: "Es posible que el cliente tenga proyectos asociados.",
                variant: 'destructive'
            });
        } else {
            toast({
                title: 'Cliente eliminado',
                description: 'El cliente ha sido eliminado correctamente.'
            });
            // Optimistic update
            setItems(prev => prev.filter(c => c.id !== clientId));
        }
    };

    const handleExportExcel = async () => {
        try {
            setIsExporting(true);
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .order('nombre', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                toast({ title: 'Exportación cancelada', description: 'No hay clientes para exportar.', variant: 'warning' });
                return;
            }

            const exportData = data.map(client => {
                let inferredType = 'Particular';
                if (client.cif && /^[A-Za-z]/.test(client.cif)) {
                    inferredType = 'Empresa';
                } else if (client.contacto && client.contacto !== client.nombre) {
                    inferredType = 'Empresa';
                }

                return {
                    'Nombre / Razón Social': client.nombre,
                    'Contacto': client.contacto || '',
                    'CIF/NIF': client.cif || '',
                    'Teléfono': client.telefono || '',
                    'Email': client.email || '',
                    'Tipo Cliente': inferredType,
                    'Dirección': client.direccion || client.calle_numero || '',
                    'Municipio': client.municipio || '',
                    'Provincia': client.provincia || '',
                    'Código Postal': client.codigo_postal || '',
                    'Fecha Alta': client.fecha_creacion ? new Date(client.fecha_creacion).toLocaleDateString() : ''
                };
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            
            // Auto-width columns based on content (approximate)
            const wscols = Object.keys(exportData[0]).map(key => ({ wch: Math.max(key.length, 20) }));
            ws['!cols'] = wscols;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Clientes");

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Clientes_${dateStr}.xlsx`);

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
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Building2 className="h-8 w-8 text-primary" />
                            Cartera de Clientes
                        </h1>
                        <p className="text-muted-foreground mt-1">Administra la información y contactos de tus clientes.</p>
                    </div>
                    {canCreate && (
                        <Button 
                            onClick={() => { setEditingClient(null); setIsModalOpen(true); }} 
                            size="lg" 
                            className="shadow-md hover:shadow-lg transition-all"
                        >
                            <UserPlus className="w-5 h-5 mr-2" />
                            Crear Nuevo Cliente
                        </Button>
                    )}
                </div>
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
                            placeholder="Buscar por nombre, contacto, CIF..."
                            className="pl-9 bg-background focus-visible:ring-primary/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button 
                        variant="outline" 
                        onClick={handleExportExcel} 
                        disabled={isExporting} 
                        className="w-full sm:w-auto"
                    >
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                        Exportar Excel
                    </Button>
                </div>

                <div className="p-0">
                    <ClientesTable
                        items={items}
                        loading={loading}
                        navigate={navigate}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={(client) => { setEditingClient(client); setIsModalOpen(true); }}
                        onDelete={handleDeleteClient}
                        lastElementRef={lastClientElementRef}
                    />
                </div>
                
                {loadingMore && (
                     <div className="flex justify-center items-center py-6 border-t">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                )}
            </motion.div>

            <Dialog open={isModalOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingClient(null); setIsModalOpen(isOpen); }}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl flex items-center gap-2">
                            {editingClient ? <Building2 className="h-6 w-6 text-primary" /> : <UserPlus className="h-6 w-6 text-primary" />}
                            {editingClient ? 'Editar Cliente' : 'Alta de Nuevo Cliente'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingClient ? 'Modifica los datos del cliente seleccionado.' : 'Introduce la información del nuevo cliente para registrarlo en el sistema.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <ClientForm
                            client={editingClient}
                            onSave={handleSaveClient}
                            onCancel={() => { setIsModalOpen(false); setEditingClient(null); }}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Clients;