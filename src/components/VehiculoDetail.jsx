import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    ArrowLeft, Truck, Calendar, Gauge, AlertTriangle, FileText, 
    Settings, Shield, History, Users, Upload, Download, Trash2, Plus,
    CheckCircle2, AlertCircle, ExternalLink, Wrench, UserCheck,
    MapPin, Edit, Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import KilometrajeModal from '@/components/KilometrajeModal';

// --- Helper Components ---

const StatusBadge = ({ status }) => {
    const styles = {
        activo: "bg-green-100 text-green-800 border-green-200",
        taller: "bg-orange-100 text-orange-800 border-orange-200",
        mantenimiento: "bg-blue-100 text-blue-800 border-blue-200",
        baja: "bg-red-100 text-red-800 border-red-200",
        default: "bg-gray-100 text-gray-800 border-gray-200"
    };
    return (
        <Badge variant="outline" className={cn("capitalize", styles[status] || styles.default)}>
            {status}
        </Badge>
    );
};

const ExpiryAlert = ({ date, label }) => {
    if (!date) return null;
    const days = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
    
    if (days < 0) {
        return <span className="text-red-600 font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Caducado ({Math.abs(days)} días)</span>;
    }
    if (days <= 30) {
        return <span className="text-orange-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Caduca en {days} días</span>;
    }
    return <span className="text-green-600">{new Date(date).toLocaleDateString()}</span>;
};

// --- Main Component ---

const VehiculoDetail = ({ vehiculoId, navigate }) => {
    const { sessionRole } = useAuth();
    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("general");
    
    // Data States
    const [seguros, setSeguros] = useState([]);
    const [itvs, setItvs] = useState([]);
    const [mantenimientos, setMantenimientos] = useState([]);
    const [kms, setKms] = useState([]);
    const [asignaciones, setAsignaciones] = useState([]);
    const [documentos, setDocumentos] = useState([]);
    const [empleados, setEmpleados] = useState([]);

    // Editing State for Maintenance
    const [editingMaintenance, setEditingMaintenance] = useState(null);

    // Modals State
    const [modalOpen, setModalOpen] = useState({
        editGeneral: false,
        seguro: false,
        itv: false,
        mantenimiento: false,
        asignacion: false
    });
    
    const [isKmModalOpen, setIsKmModalOpen] = useState(false);

    const canManage = ['admin', 'encargado'].includes(sessionRole?.rol);
    const canRegisterKm = ['admin', 'encargado', 'tecnico'].includes(sessionRole?.rol);

    // --- Fetching Data ---

    const fetchVehicleData = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('vehiculos').select('*').eq('id', vehiculoId).single();
            if (error) throw error;
            setVehicle(data);
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo cargar el vehículo.', variant: 'destructive' });
            navigate('/inventario/vehiculos');
        }
    }, [vehiculoId, navigate]);

    const fetchData = useCallback(async () => {
        if (!vehiculoId) return;
        
        setLoading(true);
        await fetchVehicleData();

        const p1 = supabase.from('vehiculo_seguros').select('*').eq('vehiculo_id', vehiculoId).order('fecha_fin', { ascending: false });
        const p2 = supabase.from('vehiculo_itv').select('*').eq('vehiculo_id', vehiculoId).order('fecha_itv', { ascending: false });
        const p3 = supabase.from('vehiculo_mantenimientos').select('*').eq('vehiculo_id', vehiculoId).order('fecha', { ascending: false });
        const p4 = supabase.from('vehiculo_km_registro').select('*, empleados(nombre, apellidos)').eq('vehiculo_id', vehiculoId).order('fecha', { ascending: false });
        // Enhanced fetch for assignments to get all employee data needed for cards
        const p5 = supabase.from('vehiculo_asignaciones').select('*, empleados(id, nombre, apellidos, telefono, foto_url, rol)').eq('vehiculo_id', vehiculoId).order('fecha_asignacion', { ascending: false });
        const p6 = supabase.storage.from('vehiculos').list(`${vehiculoId}/documentos`);
        const p7 = supabase.from('empleados').select('id, nombre, apellidos').eq('activo', true).order('nombre');

        const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([p1, p2, p3, p4, p5, p6, p7]);

        setSeguros(r1.data || []);
        setItvs(r2.data || []);
        setMantenimientos(r3.data || []);
        setKms(r4.data || []);
        setAsignaciones(r5.data || []);
        setDocumentos(r6.data || []);
        setEmpleados(r7.data || []);

        setLoading(false);
    }, [vehiculoId, fetchVehicleData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Actions ---

    const handleFileUpload = async (file, path) => {
        if (!file) return null;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${path}/${fileName}`;
        
        const { error } = await supabase.storage.from('vehiculos').upload(filePath, file);
        if (error) throw error;
        
        const { data } = supabase.storage.from('vehiculos').getPublicUrl(filePath);
        return data.publicUrl;
    };

    const handleDeleteMaintenance = async (id) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este registro de mantenimiento?')) return;
        try {
            const { error } = await supabase.from('vehiculo_mantenimientos').delete().eq('id', id);
            if (error) throw error;
            toast({ title: 'Mantenimiento eliminado' });
            refreshTab('mantenimiento');
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const refreshTab = async (tab) => {
        switch(tab) {
            case 'general': await fetchVehicleData(); break;
            case 'seguros': 
                const { data: s } = await supabase.from('vehiculo_seguros').select('*').eq('vehiculo_id', vehiculoId).order('fecha_fin', { ascending: false });
                setSeguros(s || []);
                break;
            case 'itv':
                const { data: i } = await supabase.from('vehiculo_itv').select('*').eq('vehiculo_id', vehiculoId).order('fecha_itv', { ascending: false });
                setItvs(i || []);
                break;
            case 'mantenimiento':
                const { data: m } = await supabase.from('vehiculo_mantenimientos').select('*').eq('vehiculo_id', vehiculoId).order('fecha', { ascending: false });
                setMantenimientos(m || []);
                break;
            case 'km':
                const { data: k } = await supabase.from('vehiculo_km_registro').select('*, empleados(nombre, apellidos)').eq('vehiculo_id', vehiculoId).order('fecha', { ascending: false }).order('created_at', { ascending: false });
                setKms(k || []);
                await fetchVehicleData(); // update current km in header
                break;
            case 'asignaciones':
                const { data: a } = await supabase.from('vehiculo_asignaciones').select('*, empleados(id, nombre, apellidos, telefono, foto_url, rol)').eq('vehiculo_id', vehiculoId).order('fecha_asignacion', { ascending: false });
                setAsignaciones(a || []);
                break;
            case 'documentos':
                const { data: d } = await supabase.storage.from('vehiculos').list(`${vehiculoId}/documentos`);
                setDocumentos(d || []);
                break;
        }
    };

    // --- Modals Content & Logic ---

    const GeneralEditForm = () => {
        const [formData, setFormData] = useState({ ...vehicle });
        const [saving, setSaving] = useState(false);

        const handleSubmit = async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
                const { error } = await supabase.rpc('rpc_upsert_vehiculo', {
                    p_id: vehicle.id,
                    p_matricula: formData.matricula,
                    p_marca: formData.marca,
                    p_modelo: formData.modelo,
                    p_anio: parseInt(formData.anio),
                    p_numero_bastidor: formData.numero_bastidor,
                    p_tipo: formData.tipo,
                    p_estado: formData.estado,
                    p_km_actuales: parseInt(formData.km_actuales),
                    p_foto_principal: vehicle.foto_principal,
                    p_latitud: formData.latitud ? parseFloat(formData.latitud) : null,
                    p_longitud: formData.longitud ? parseFloat(formData.longitud) : null
                });
                if (error) throw error;
                toast({ title: "Vehículo actualizado" });
                setModalOpen(prev => ({...prev, editGeneral: false}));
                refreshTab('general');
            } catch (err) {
                toast({ title: "Error", description: err.message, variant: "destructive" });
            } finally {
                setSaving(false);
            }
        };

        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><Label>Matrícula</Label><Input value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} /></div>
                    <div><Label>Marca</Label><Input value={formData.marca} onChange={e => setFormData({...formData, marca: e.target.value})} /></div>
                    <div><Label>Modelo</Label><Input value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} /></div>
                    <div><Label>Año</Label><Input type="number" value={formData.anio} onChange={e => setFormData({...formData, anio: e.target.value})} /></div>
                    <div><Label>Bastidor</Label><Input value={formData.numero_bastidor} onChange={e => setFormData({...formData, numero_bastidor: e.target.value})} /></div>
                    <div><Label>KM Actuales</Label><Input type="number" value={formData.km_actuales} onChange={e => setFormData({...formData, km_actuales: e.target.value})} /></div>
                    <div>
                        <Label>Tipo</Label>
                        <Select value={formData.tipo} onValueChange={v => setFormData({...formData, tipo: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="furgoneta">Furgoneta</SelectItem>
                                <SelectItem value="turismo">Turismo</SelectItem>
                                <SelectItem value="camion">Camión</SelectItem>
                                <SelectItem value="moto">Moto</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Estado</Label>
                        <Select value={formData.estado} onValueChange={v => setFormData({...formData, estado: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="activo">Activo</SelectItem>
                                <SelectItem value="taller">Taller</SelectItem>
                                <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                                <SelectItem value="baja">Baja</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label>Latitud</Label><Input type="number" step="any" value={formData.latitud || ''} onChange={e => setFormData({...formData, latitud: e.target.value})} placeholder="Ej: 40.4167" /></div>
                    <div><Label>Longitud</Label><Input type="number" step="any" value={formData.longitud || ''} onChange={e => setFormData({...formData, longitud: e.target.value})} placeholder="Ej: -3.7037" /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin mr-2" /> : null} Guardar</Button></DialogFooter>
            </form>
        );
    };

    const SeguroForm = () => {
        const [formData, setFormData] = useState({ aseguradora: '', poliza: '', inicio: '', fin: '', importe: '' });
        const [file, setFile] = useState(null);
        const [saving, setSaving] = useState(false);

        const handleSubmit = async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
                let url = null;
                if (file) url = await handleFileUpload(file, `vehiculos/${vehiculoId}/seguros`);
                
                const { error } = await supabase.rpc('rpc_registrar_seguro', {
                    p_vehiculo_id: vehiculoId,
                    p_aseguradora: formData.aseguradora,
                    p_numero_poliza: formData.poliza,
                    p_fecha_inicio: formData.inicio,
                    p_fecha_fin: formData.fin,
                    p_importe: parseFloat(formData.importe),
                    p_documento_pdf: url
                });
                if (error) throw error;
                toast({ title: "Seguro registrado" });
                setModalOpen(prev => ({...prev, seguro: false}));
                refreshTab('seguros');
            } catch (err) {
                toast({ title: "Error", description: err.message, variant: "destructive" });
            } finally { setSaving(false); }
        };

        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><Label>Aseguradora</Label><Input required value={formData.aseguradora} onChange={e => setFormData({...formData, aseguradora: e.target.value})} /></div>
                    <div><Label>Nº Póliza</Label><Input required value={formData.poliza} onChange={e => setFormData({...formData, poliza: e.target.value})} /></div>
                    <div><Label>Fecha Inicio</Label><Input type="date" required value={formData.inicio} onChange={e => setFormData({...formData, inicio: e.target.value})} /></div>
                    <div><Label>Fecha Fin</Label><Input type="date" required value={formData.fin} onChange={e => setFormData({...formData, fin: e.target.value})} /></div>
                    <div><Label>Importe Anual</Label><Input type="number" step="0.01" value={formData.importe} onChange={e => setFormData({...formData, importe: e.target.value})} /></div>
                    <div><Label>Documento (PDF)</Label><Input type="file" accept=".pdf,image/*" onChange={e => setFile(e.target.files[0])} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>Registrar</Button></DialogFooter>
            </form>
        );
    };

    const ITVForm = () => {
        const [formData, setFormData] = useState({ fecha: '', proxima: '', resultado: 'favorable' });
        const [file, setFile] = useState(null);
        const [saving, setSaving] = useState(false);

        const handleSubmit = async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
                let url = null;
                if (file) url = await handleFileUpload(file, `vehiculos/${vehiculoId}/itv`);
                
                const { error } = await supabase.rpc('rpc_registrar_itv', {
                    p_vehiculo_id: vehiculoId,
                    p_fecha_itv: formData.fecha,
                    p_fecha_proxima: formData.proxima,
                    p_resultado: formData.resultado,
                    p_documento_pdf: url
                });
                if (error) throw error;
                toast({ title: "ITV registrada" });
                setModalOpen(prev => ({...prev, itv: false}));
                refreshTab('itv');
            } catch (err) {
                toast({ title: "Error", description: err.message, variant: "destructive" });
            } finally { setSaving(false); }
        };

        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><Label>Fecha ITV</Label><Input type="date" required value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} /></div>
                    <div><Label>Próxima ITV</Label><Input type="date" required value={formData.proxima} onChange={e => setFormData({...formData, proxima: e.target.value})} /></div>
                    <div>
                        <Label>Resultado</Label>
                        <Select value={formData.resultado} onValueChange={v => setFormData({...formData, resultado: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="favorable">Favorable</SelectItem>
                                <SelectItem value="desfavorable">Desfavorable</SelectItem>
                                <SelectItem value="negativa">Negativa</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label>Informe (PDF)</Label><Input type="file" accept=".pdf,image/*" onChange={e => setFile(e.target.files[0])} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>Registrar</Button></DialogFooter>
            </form>
        );
    };

    const MantenimientoForm = () => {
        const [formData, setFormData] = useState({
            fecha: editingMaintenance?.fecha || new Date().toISOString().split('T')[0],
            tipo: editingMaintenance?.tipo || 'revision',
            km: editingMaintenance?.km_realizados || '',
            coste: editingMaintenance?.coste || '',
            descripcion: editingMaintenance?.descripcion || ''
        });
        const [file, setFile] = useState(null);
        const [saving, setSaving] = useState(false);

        const handleSubmit = async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
                let url = editingMaintenance?.factura_pdf || null;
                if (file) url = await handleFileUpload(file, `vehiculos/${vehiculoId}/mantenimiento`);
                
                if (editingMaintenance) {
                    // UPDATE
                    const { error } = await supabase.from('vehiculo_mantenimientos').update({
                        tipo: formData.tipo,
                        fecha: formData.fecha,
                        km_realizados: formData.km ? parseInt(formData.km) : null,
                        coste: formData.coste ? parseFloat(formData.coste) : 0,
                        descripcion: formData.descripcion,
                        factura_pdf: url
                    }).eq('id', editingMaintenance.id);
                    
                    if (error) throw error;
                    toast({ title: "Mantenimiento actualizado" });
                } else {
                    // CREATE via RPC
                    const { error } = await supabase.rpc('rpc_crear_mantenimiento', {
                        p_vehiculo_id: vehiculoId,
                        p_tipo: formData.tipo,
                        p_fecha: formData.fecha,
                        p_km_realizados: formData.km ? parseInt(formData.km) : null,
                        p_coste: formData.coste ? parseFloat(formData.coste) : 0,
                        p_descripcion: formData.descripcion,
                        p_factura_pdf: url
                    });
                    
                    if (error) throw error;
                    toast({ title: "Mantenimiento registrado" });
                }
                
                setModalOpen(prev => ({...prev, mantenimiento: false}));
                refreshTab('mantenimiento');
                if (formData.km && (!editingMaintenance || parseInt(formData.km) > vehicle.km_actuales)) refreshTab('general');
            } catch (err) {
                toast({ title: "Error", description: err.message, variant: "destructive" });
            } finally { setSaving(false); }
        };

        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><Label>Fecha</Label><Input type="date" required value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} /></div>
                    <div>
                        <Label>Tipo</Label>
                        <Select value={formData.tipo} onValueChange={v => setFormData({...formData, tipo: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="revision">Revisión</SelectItem>
                                <SelectItem value="averia">Avería</SelectItem>
                                <SelectItem value="neumaticos">Neumáticos</SelectItem>
                                <SelectItem value="lunas">Lunas</SelectItem>
                                <SelectItem value="otro">Otro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label>KM Realizados</Label><Input type="number" value={formData.km} onChange={e => setFormData({...formData, km: e.target.value})} /></div>
                    <div><Label>Coste Total</Label><Input type="number" step="0.01" value={formData.coste} onChange={e => setFormData({...formData, coste: e.target.value})} /></div>
                    <div className="col-span-2"><Label>Descripción</Label><Textarea value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} /></div>
                    <div className="col-span-2">
                        <Label>Factura/Adjunto</Label>
                        <Input type="file" onChange={e => setFile(e.target.files[0])} />
                        {editingMaintenance?.factura_pdf && !file && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center">
                                <CheckCircle2 className="w-3 h-3 mr-1 text-green-600" /> Archivo actual disponible
                            </p>
                        )}
                    </div>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : (editingMaintenance ? 'Guardar Cambios' : 'Registrar')}</Button></DialogFooter>
            </form>
        );
    };

    const AsignacionForm = () => {
        const [formData, setFormData] = useState({ empleado: '', fecha: new Date().toISOString().split('T')[0], notas: '' });
        const [saving, setSaving] = useState(false);

        const handleSubmit = async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
                const { error } = await supabase.rpc('rpc_asignar_vehiculo', {
                    p_vehiculo_id: vehiculoId,
                    p_empleado_id: formData.empleado,
                    p_fecha_asignacion: formData.fecha,
                    p_notas: formData.notas
                });
                if (error) throw error;
                toast({ title: "Vehículo asignado" });
                setModalOpen(prev => ({...prev, asignacion: false}));
                refreshTab('asignaciones');
            } catch (err) {
                toast({ title: "Error", description: err.message, variant: "destructive" });
            } finally { setSaving(false); }
        };

        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <Label>Empleado</Label>
                    <Select onValueChange={v => setFormData({...formData, empleado: v})}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                        <SelectContent>
                            {empleados.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div><Label>Fecha Inicio</Label><Input type="date" required value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} /></div>
                <div><Label>Notas</Label><Textarea value={formData.notas} onChange={e => setFormData({...formData, notas: e.target.value})} /></div>
                <DialogFooter><Button type="submit" disabled={saving}>Asignar</Button></DialogFooter>
            </form>
        );
    };

    // --- Sub-component: File Manager for Documents Tab ---
    const DocumentsTab = () => {
        const [uploading, setUploading] = useState(false);

        const uploadDoc = async (e) => {
            const file = e.target.files[0];
            if(!file) return;
            setUploading(true);
            try {
                const filePath = `${vehiculoId}/documentos/${file.name}`;
                const { error } = await supabase.storage.from('vehiculos').upload(filePath, file);
                if(error) throw error;
                toast({ title: "Documento subido" });
                refreshTab('documentos');
            } catch (err) {
                toast({ title: "Error al subir", description: err.message, variant: "destructive" });
            } finally { setUploading(false); }
        };

        const deleteDoc = async (name) => {
            if(!window.confirm('¿Seguro que quieres eliminar este archivo?')) return;
            try {
                const { error } = await supabase.storage.from('vehiculos').remove([`${vehiculoId}/documentos/${name}`]);
                if(error) throw error;
                toast({ title: "Documento eliminado" });
                refreshTab('documentos');
            } catch (err) {
                toast({ title: "Error", description: err.message, variant: "destructive" });
            }
        };

        const getUrl = (name) => supabase.storage.from('vehiculos').getPublicUrl(`${vehiculoId}/documentos/${name}`).data.publicUrl;

        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Documentación del Vehículo</h3>
                    <div className="relative">
                        <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={uploadDoc} disabled={uploading} />
                        <Button disabled={uploading}>{uploading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />} Subir Documento</Button>
                    </div>
                </div>
                {documentos.length === 0 ? <div className="text-center py-8 text-muted-foreground">No hay documentos.</div> : 
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documentos.map((doc, i) => (
                        <Card key={i} className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
                                <span className="truncate font-medium" title={doc.name}>{doc.name}</span>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" onClick={() => window.open(getUrl(doc.name), '_blank')}><Download className="h-4 w-4" /></Button>
                                {canManage && <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteDoc(doc.name)}><Trash2 className="h-4 w-4" /></Button>}
                            </div>
                        </Card>
                    ))}
                </div>}
            </div>
        );
    };

    // --- Asignación Actual Section ---
    const activeAssignment = useMemo(() => {
        return asignaciones.find(a => !a.fecha_fin);
    }, [asignaciones]);

    if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    if (!vehicle) return <div className="p-8 text-center">Vehículo no encontrado.</div>;

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex items-start gap-6">
                <Button variant="ghost" size="icon" onClick={() => navigate('/inventario/vehiculos')} className="mt-1">
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <div className="flex-1">
                    <div className="flex flex-col md:flex-row gap-6 bg-card border rounded-xl p-6 shadow-sm">
                        <div className="w-40 h-40 bg-muted rounded-lg flex items-center justify-center overflow-hidden border shrink-0">
                            {vehicle.foto_principal ? 
                                <img src={vehicle.foto_principal} alt="Foto vehículo" className="w-full h-full object-cover" /> : 
                                <Truck className="h-16 w-16 text-muted-foreground/30" />
                            }
                        </div>
                        <div className="flex-1 space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                <div>
                                    <h1 className="text-3xl font-bold">{vehicle.marca} {vehicle.modelo}</h1>
                                    <div className="flex items-center gap-3 mt-2">
                                        <Badge className="text-lg px-3 py-1 bg-zinc-800 text-white font-mono tracking-wider">{vehicle.matricula}</Badge>
                                        <StatusBadge status={vehicle.estado} />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {canRegisterKm && (
                                        <Button onClick={() => setIsKmModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
                                            <Gauge className="mr-2 h-4 w-4" /> Registrar KM
                                        </Button>
                                    )}
                                    {canManage && (
                                        <Button variant="outline" onClick={() => setModalOpen(p => ({...p, editGeneral: true}))}>
                                            <Settings className="mr-2 h-4 w-4" /> Editar
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                                <div className="p-3 bg-muted/30 rounded-lg border">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Calendar className="h-4 w-4" /> Año</div>
                                    <div className="font-semibold text-lg">{vehicle.anio}</div>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg border">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Gauge className="h-4 w-4" /> Kilometraje</div>
                                    <div className="font-semibold text-lg">{vehicle.km_actuales?.toLocaleString()} km</div>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg border">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Truck className="h-4 w-4" /> Tipo</div>
                                    <div className="font-semibold text-lg capitalize">{vehicle.tipo}</div>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg border">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><MapPin className="h-4 w-4" /> Ubicación</div>
                                    <div className="font-mono text-sm truncate" title={`${vehicle.latitud || ''}, ${vehicle.longitud || ''}`}>
                                        {vehicle.latitud ? `${vehicle.latitud}, ${vehicle.longitud}` : 'Sin coordenadas'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-card border">
                    <TabsTrigger value="general" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><FileText className="mr-2 h-4 w-4" /> General</TabsTrigger>
                    <TabsTrigger value="asignaciones" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Users className="mr-2 h-4 w-4" /> Asignaciones</TabsTrigger>
                    <TabsTrigger value="seguros" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Shield className="mr-2 h-4 w-4" /> Seguros</TabsTrigger>
                    <TabsTrigger value="itv" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><CheckCircle2 className="mr-2 h-4 w-4" /> ITV</TabsTrigger>
                    <TabsTrigger value="mantenimiento" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Wrench className="mr-2 h-4 w-4" /> Mantenimiento</TabsTrigger>
                    <TabsTrigger value="km" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Gauge className="mr-2 h-4 w-4" /> Kilometraje</TabsTrigger>
                    <TabsTrigger value="documentos" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><FileText className="mr-2 h-4 w-4" /> Documentos</TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    <TabsContent value="general">
                        <Card>
                            <CardHeader><CardTitle>Detalles del Vehículo</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4 border-b pb-2"><span className="text-muted-foreground">Marca</span><span className="col-span-2 font-medium">{vehicle.marca}</span></div>
                                    <div className="grid grid-cols-3 gap-4 border-b pb-2"><span className="text-muted-foreground">Modelo</span><span className="col-span-2 font-medium">{vehicle.modelo}</span></div>
                                    <div className="grid grid-cols-3 gap-4 border-b pb-2"><span className="text-muted-foreground">Matrícula</span><span className="col-span-2 font-medium">{vehicle.matricula}</span></div>
                                    <div className="grid grid-cols-3 gap-4 border-b pb-2"><span className="text-muted-foreground">Año Fabricación</span><span className="col-span-2 font-medium">{vehicle.anio}</span></div>
                                </div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4 border-b pb-2"><span className="text-muted-foreground">Bastidor (VIN)</span><span className="col-span-2 font-medium font-mono">{vehicle.numero_bastidor}</span></div>
                                    <div className="grid grid-cols-3 gap-4 border-b pb-2"><span className="text-muted-foreground">Tipo</span><span className="col-span-2 font-medium capitalize">{vehicle.tipo}</span></div>
                                    <div className="grid grid-cols-3 gap-4 border-b pb-2"><span className="text-muted-foreground">Estado</span><span className="col-span-2"><StatusBadge status={vehicle.estado} /></span></div>
                                    <div className="grid grid-cols-3 gap-4 border-b pb-2"><span className="text-muted-foreground">KM Actuales</span><span className="col-span-2 font-medium">{vehicle.km_actuales?.toLocaleString()} km</span></div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="asignaciones" className="space-y-6">
                        {/* Current Assignment Card */}
                        {activeAssignment ? (
                            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-l-4 border-l-primary">
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex items-center gap-2 text-primary">
                                        <UserCheck className="h-5 w-5" /> Asignación Actual
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                                        <Avatar className="h-24 w-24 border-4 border-white shadow-sm">
                                            <AvatarImage src={activeAssignment.empleados?.foto_url} />
                                            <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                                                {activeAssignment.empleados?.nombre?.charAt(0)}
                                                {activeAssignment.empleados?.apellidos?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        
                                        <div className="flex-1 text-center md:text-left space-y-2">
                                            <h3 className="text-2xl font-bold text-foreground">
                                                {activeAssignment.empleados?.nombre} {activeAssignment.empleados?.apellidos}
                                            </h3>
                                            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                                                <Badge variant="secondary" className="px-3">{activeAssignment.empleados?.rol?.toUpperCase()}</Badge>
                                                {activeAssignment.empleados?.telefono && (
                                                    <span className="flex items-center text-sm text-muted-foreground">
                                                        <Phone className="h-3 w-3 mr-1" /> {activeAssignment.empleados?.telefono}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                                <div className="p-3 bg-background rounded-lg border">
                                                    <span className="text-muted-foreground block mb-1">Fecha de Inicio</span>
                                                    <span className="font-semibold text-foreground text-lg">
                                                        {new Date(activeAssignment.fecha_asignacion).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {activeAssignment.notas && (
                                                    <div className="p-3 bg-background rounded-lg border">
                                                        <span className="text-muted-foreground block mb-1">Notas</span>
                                                        <span className="text-foreground italic">"{activeAssignment.notas}"</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {canManage && (
                                            <Button variant="outline" onClick={() => setModalOpen(p => ({...p, asignacion: true}))}>
                                                <Users className="mr-2 h-4 w-4" /> Reasignar
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="bg-muted/20 border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                                    <Truck className="h-12 w-12 text-muted-foreground/30 mb-4" />
                                    <h3 className="text-lg font-medium">Sin Asignación Actual</h3>
                                    <p className="text-muted-foreground mb-6 max-w-sm">Este vehículo no está asignado a ningún empleado actualmente.</p>
                                    {canManage && (
                                        <Button onClick={() => setModalOpen(p => ({...p, asignacion: true}))}>
                                            <Plus className="mr-2 h-4 w-4" /> Asignar Ahora
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* History Table */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <History className="h-5 w-5 text-muted-foreground" /> Historial de Asignaciones
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Empleado</TableHead>
                                            <TableHead>Inicio</TableHead>
                                            <TableHead>Fin</TableHead>
                                            <TableHead>Duración</TableHead>
                                            <TableHead>Notas</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {asignaciones.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    No hay historial de asignaciones.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            asignaciones.map(a => {
                                                const startDate = new Date(a.fecha_asignacion);
                                                const endDate = a.fecha_fin ? new Date(a.fecha_fin) : new Date();
                                                const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                                                
                                                return (
                                                    <TableRow key={a.id} className={cn(!a.fecha_fin && "bg-primary/5")}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Avatar className="h-8 w-8">
                                                                    <AvatarImage src={a.empleados?.foto_url} />
                                                                    <AvatarFallback>{a.empleados?.nombre?.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <span className="font-medium block">{a.empleados?.nombre} {a.empleados?.apellidos}</span>
                                                                    <span className="text-xs text-muted-foreground capitalize">{a.empleados?.rol}</span>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{startDate.toLocaleDateString()}</TableCell>
                                                        <TableCell>
                                                            {a.fecha_fin ? (
                                                                new Date(a.fecha_fin).toLocaleDateString()
                                                            ) : (
                                                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Actual</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground text-xs">
                                                            {durationDays} días {a.fecha_fin ? '' : '(en curso)'}
                                                        </TableCell>
                                                        <TableCell className="max-w-[200px] truncate text-muted-foreground italic">
                                                            {a.notas || '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="seguros">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Historial de Seguros</CardTitle>
                                {canManage && <Button onClick={() => setModalOpen(p => ({...p, seguro: true}))}><Plus className="mr-2 h-4 w-4" /> Registrar Seguro</Button>}
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Aseguradora</TableHead><TableHead>Póliza</TableHead><TableHead>Inicio</TableHead><TableHead>Fin (Vencimiento)</TableHead><TableHead>Importe</TableHead><TableHead>Doc</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {seguros.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No hay seguros registrados.</TableCell></TableRow> :
                                        seguros.map(s => (
                                            <TableRow key={s.id}>
                                                <TableCell className="font-medium">{s.aseguradora}</TableCell>
                                                <TableCell className="font-mono">{s.numero_poliza}</TableCell>
                                                <TableCell>{new Date(s.fecha_inicio).toLocaleDateString()}</TableCell>
                                                <TableCell><ExpiryAlert date={s.fecha_fin} /></TableCell>
                                                <TableCell>{formatCurrency(s.importe_anual)}</TableCell>
                                                <TableCell>{s.documento_pdf ? <Button variant="ghost" size="sm" onClick={() => window.open(s.documento_pdf, '_blank')}><FileText className="h-4 w-4" /></Button> : '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="itv">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Inspecciones Técnicas (ITV)</CardTitle>
                                {canManage && <Button onClick={() => setModalOpen(p => ({...p, itv: true}))}><Plus className="mr-2 h-4 w-4" /> Registrar ITV</Button>}
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Fecha Inspección</TableHead><TableHead>Resultado</TableHead><TableHead>Próxima ITV</TableHead><TableHead>Doc</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {itvs.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No hay registros de ITV.</TableCell></TableRow> :
                                        itvs.map(i => (
                                            <TableRow key={i.id}>
                                                <TableCell>{new Date(i.fecha_itv).toLocaleDateString()}</TableCell>
                                                <TableCell><Badge variant={i.resultado === 'favorable' ? 'success' : 'destructive'} className={i.resultado === 'favorable' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{i.resultado.toUpperCase()}</Badge></TableCell>
                                                <TableCell><ExpiryAlert date={i.fecha_proxima} /></TableCell>
                                                <TableCell>{i.documento_pdf ? <Button variant="ghost" size="sm" onClick={() => window.open(i.documento_pdf, '_blank')}><FileText className="h-4 w-4" /></Button> : '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="mantenimiento">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Registro de Mantenimiento</CardTitle>
                                {canManage && <Button onClick={() => { setEditingMaintenance(null); setModalOpen(p => ({...p, mantenimiento: true})); }}><Plus className="mr-2 h-4 w-4" /> Añadir Mantenimiento</Button>}
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>KM</TableHead>
                                            <TableHead>Descripción</TableHead>
                                            <TableHead>Coste</TableHead>
                                            <TableHead>Factura</TableHead>
                                            {canManage && <TableHead className="text-right">Acciones</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {mantenimientos.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No hay mantenimientos registrados.</TableCell></TableRow> :
                                        mantenimientos.map(m => (
                                            <TableRow key={m.id}>
                                                <TableCell>{new Date(m.fecha).toLocaleDateString()}</TableCell>
                                                <TableCell className="capitalize"><Badge variant="outline">{m.tipo}</Badge></TableCell>
                                                <TableCell>{m.km_realizados?.toLocaleString()} km</TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={m.descripcion}>{m.descripcion}</TableCell>
                                                <TableCell>{formatCurrency(m.coste)}</TableCell>
                                                <TableCell>{m.factura_pdf ? <Button variant="ghost" size="sm" onClick={() => window.open(m.factura_pdf, '_blank')}><FileText className="h-4 w-4" /></Button> : '-'}</TableCell>
                                                {canManage && (
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => { setEditingMaintenance(m); setModalOpen(p => ({...p, mantenimiento: true})); }}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="text-destructive hover:text-destructive hover:bg-destructive/10" 
                                                                onClick={() => handleDeleteMaintenance(m.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="km">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <Card className="lg:col-span-2">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>Historial de Kilometraje</CardTitle>
                                    {canRegisterKm && (
                                        <Button onClick={() => setIsKmModalOpen(true)}>
                                            <Plus className="mr-2 h-4 w-4" /> Registrar KM
                                        </Button>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Lectura (KM)</TableHead><TableHead>Registrado Por</TableHead><TableHead>Observación</TableHead><TableHead>Foto</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {kms.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No hay lecturas.</TableCell></TableRow> :
                                            kms.map(k => (
                                                <TableRow key={k.id}>
                                                    <TableCell>{new Date(k.fecha).toLocaleDateString()}</TableCell>
                                                    <TableCell className="font-mono font-bold">{k.km.toLocaleString()}</TableCell>
                                                    <TableCell>{k.empleados?.nombre} {k.empleados?.apellidos}</TableCell>
                                                    <TableCell className="text-muted-foreground italic max-w-[200px] truncate">{k.observacion || '-'}</TableCell>
                                                    <TableCell>{k.foto_contador ? 
                                                        <Dialog>
                                                            <DialogTrigger asChild><Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button></DialogTrigger>
                                                            <DialogContent className="max-w-3xl"><img src={k.foto_contador} alt="Contador" className="w-full h-auto rounded" /></DialogContent>
                                                        </Dialog> : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle>Evolución</CardTitle></CardHeader>
                                <CardContent className="h-[300px]">
                                    {kms.length > 1 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={[...kms].reverse()}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="fecha" tickFormatter={d => new Date(d).toLocaleDateString()} fontSize={12} />
                                                <YAxis />
                                                <RechartsTooltip labelFormatter={d => new Date(d).toLocaleDateString()} />
                                                <Line type="monotone" dataKey="km" stroke="#16a34a" strokeWidth={2} dot={{r:4}} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : <div className="flex items-center justify-center h-full text-muted-foreground">Insuficientes datos</div>}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="documentos">
                        <DocumentsTab />
                    </TabsContent>
                </div>
            </Tabs>

            {/* --- Modals --- */}
            <Dialog open={modalOpen.editGeneral} onOpenChange={o => setModalOpen(p => ({...p, editGeneral: o}))}>
                <DialogContent className="sm:max-w-[600px]"><DialogHeader><DialogTitle>Editar Información</DialogTitle></DialogHeader><GeneralEditForm /></DialogContent>
            </Dialog>
            <Dialog open={modalOpen.seguro} onOpenChange={o => setModalOpen(p => ({...p, seguro: o}))}>
                <DialogContent className="sm:max-w-[600px]"><DialogHeader><DialogTitle>Nuevo Seguro</DialogTitle></DialogHeader><SeguroForm /></DialogContent>
            </Dialog>
            <Dialog open={modalOpen.itv} onOpenChange={o => setModalOpen(p => ({...p, itv: o}))}>
                <DialogContent className="sm:max-w-[600px]"><DialogHeader><DialogTitle>Registrar ITV</DialogTitle></DialogHeader><ITVForm /></DialogContent>
            </Dialog>
            <Dialog open={modalOpen.mantenimiento} onOpenChange={o => setModalOpen(p => ({...p, mantenimiento: o}))}>
                <DialogContent className="sm:max-w-[600px]"><DialogHeader><DialogTitle>{editingMaintenance ? 'Editar Mantenimiento' : 'Añadir Mantenimiento'}</DialogTitle></DialogHeader><MantenimientoForm /></DialogContent>
            </Dialog>
            <Dialog open={modalOpen.asignacion} onOpenChange={o => setModalOpen(p => ({...p, asignacion: o}))}>
                <DialogContent className="sm:max-w-[500px]"><DialogHeader><DialogTitle>Nueva Asignación</DialogTitle></DialogHeader><AsignacionForm /></DialogContent>
            </Dialog>

            <KilometrajeModal 
                isOpen={isKmModalOpen} 
                onClose={() => setIsKmModalOpen(false)} 
                vehicle={vehicle} 
                onSave={() => refreshTab('km')} 
            />
        </div>
    );
};

export default VehiculoDetail;