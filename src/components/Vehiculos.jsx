import React, { useState, useEffect } from 'react';
import { 
    Truck, Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Car, Wrench, 
    Eye, AlertTriangle, AlertCircle, UserPlus, User, Map as MapIcon, List as ListIcon 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

// --- Helper Components ---

const VehicleForm = ({ vehicle, isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        matricula: '',
        marca: '',
        modelo: '',
        anio: new Date().getFullYear(),
        numero_bastidor: '',
        tipo: 'furgoneta',
        estado: 'activo',
        km_actuales: 0,
        foto_principal: null,
        latitud: '',
        longitud: ''
    });
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (vehicle) {
                setFormData({
                    matricula: vehicle.matricula || '',
                    marca: vehicle.marca || '',
                    modelo: vehicle.modelo || '',
                    anio: vehicle.anio || new Date().getFullYear(),
                    numero_bastidor: vehicle.numero_bastidor || '',
                    tipo: vehicle.tipo || 'furgoneta',
                    estado: vehicle.estado || 'activo',
                    km_actuales: vehicle.km_actuales || 0,
                    foto_principal: vehicle.foto_principal || null,
                    latitud: vehicle.latitud || '',
                    longitud: vehicle.longitud || ''
                });
            } else {
                setFormData({
                    matricula: '',
                    marca: '',
                    modelo: '',
                    anio: new Date().getFullYear(),
                    numero_bastidor: '',
                    tipo: 'furgoneta',
                    estado: 'activo',
                    km_actuales: 0,
                    foto_principal: null,
                    latitud: '',
                    longitud: ''
                });
            }
        }
    }, [isOpen, vehicle]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `vehiculos/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('vehiculos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('vehiculos').getPublicUrl(filePath);
            setFormData(prev => ({ ...prev, foto_principal: publicUrl }));
            toast({ title: 'Imagen subida correctamente' });
        } catch (error) {
            console.error('Error uploading image:', error);
            toast({ title: 'Error al subir imagen', description: error.message, variant: 'destructive' });
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const { error } = await supabase.rpc('rpc_upsert_vehiculo', {
                p_id: vehicle ? vehicle.id : null,
                p_matricula: formData.matricula,
                p_marca: formData.marca,
                p_modelo: formData.modelo,
                p_anio: parseInt(formData.anio),
                p_numero_bastidor: formData.numero_bastidor,
                p_tipo: formData.tipo,
                p_estado: formData.estado,
                p_km_actuales: parseInt(formData.km_actuales),
                p_foto_principal: formData.foto_principal,
                p_latitud: formData.latitud ? parseFloat(formData.latitud) : null,
                p_longitud: formData.longitud ? parseFloat(formData.longitud) : null
            });

            if (error) throw error;

            toast({ title: vehicle ? 'Vehículo actualizado' : 'Vehículo creado' });
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving vehicle:', error);
            toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{vehicle ? 'Editar Vehículo' : 'Añadir Nuevo Vehículo'}</DialogTitle>
                    <DialogDescription>Introduce los detalles del vehículo.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="matricula">Matrícula</Label>
                            <Input id="matricula" name="matricula" value={formData.matricula} onChange={handleInputChange} required placeholder="1234ABC" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="marca">Marca</Label>
                            <Input id="marca" name="marca" value={formData.marca} onChange={handleInputChange} required placeholder="Ford" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="modelo">Modelo</Label>
                            <Input id="modelo" name="modelo" value={formData.modelo} onChange={handleInputChange} required placeholder="Transit" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="anio">Año</Label>
                            <Input id="anio" name="anio" type="number" value={formData.anio} onChange={handleInputChange} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="numero_bastidor">Nº Bastidor (VIN)</Label>
                        <Input id="numero_bastidor" name="numero_bastidor" value={formData.numero_bastidor} onChange={handleInputChange} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={formData.tipo} onValueChange={(val) => handleSelectChange('tipo', val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="furgoneta">Furgoneta</SelectItem>
                                    <SelectItem value="turismo">Turismo</SelectItem>
                                    <SelectItem value="camion">Camión</SelectItem>
                                    <SelectItem value="moto">Moto</SelectItem>
                                    <SelectItem value="otro">Otro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Estado</Label>
                            <Select value={formData.estado} onValueChange={(val) => handleSelectChange('estado', val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="activo">Activo</SelectItem>
                                    <SelectItem value="taller">En Taller</SelectItem>
                                    <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                                    <SelectItem value="baja">De Baja</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="km_actuales">Kilometraje</Label>
                            <Input id="km_actuales" name="km_actuales" type="number" value={formData.km_actuales} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="latitud">Latitud</Label>
                            <Input id="latitud" name="latitud" type="number" step="any" value={formData.latitud} onChange={handleInputChange} placeholder="40.4167" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="longitud">Longitud</Label>
                            <Input id="longitud" name="longitud" type="number" step="any" value={formData.longitud} onChange={handleInputChange} placeholder="-3.7037" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Foto Principal</Label>
                        <Input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
                        {isUploading && <p className="text-sm text-muted-foreground animate-pulse">Subiendo imagen...</p>}
                        {formData.foto_principal && (
                            <div className="mt-2 relative h-32 w-full overflow-hidden rounded-md border">
                                <img src={formData.foto_principal} alt="Vista previa" className="h-full w-full object-cover" />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" disabled={isSaving || isUploading}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Guardar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const AssignVehicleForm = ({ vehicleId, isOpen, onClose, onSave }) => {
    const [empleados, setEmpleados] = useState([]);
    const [loadingEmpleados, setLoadingEmpleados] = useState(true);
    const [formData, setFormData] = useState({ empleado: '', notas: '' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const fetchEmpleados = async () => {
                setLoadingEmpleados(true);
                const { data, error } = await supabase
                    .from('empleados')
                    .select('id, nombre, apellidos')
                    .eq('activo', true)
                    .order('nombre');
                
                if (!error) setEmpleados(data || []);
                setLoadingEmpleados(false);
            };
            fetchEmpleados();
            setFormData({ empleado: '', notas: '' });
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const { error } = await supabase.rpc('rpc_asignar_vehiculo', {
                p_vehiculo_id: vehicleId,
                p_empleado_id: formData.empleado,
                p_fecha_asignacion: new Date().toISOString().split('T')[0], 
                p_notas: formData.notas
            });

            if (error) throw error;

            toast({ title: "Vehículo asignado correctamente" });
            onSave();
            onClose();
        } catch (err) {
            console.error(err);
            toast({ title: "Error", description: err.message || "Error al asignar", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Asignar Vehículo</DialogTitle>
                    <DialogDescription>Selecciona el empleado al que se asignará este vehículo.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Empleado</Label>
                        <Select onValueChange={v => setFormData({...formData, empleado: v})}>
                            <SelectTrigger>
                                <SelectValue placeholder={loadingEmpleados ? "Cargando..." : "Seleccionar empleado"} />
                            </SelectTrigger>
                            <SelectContent>
                                {empleados.map(e => (
                                    <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Notas (Opcional)</Label>
                        <textarea 
                            className="flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.notas} 
                            onChange={e => setFormData({...formData, notas: e.target.value})} 
                            placeholder="Comentarios sobre la asignación..."
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" disabled={isSaving || !formData.empleado}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Asignar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const AlertsPanel = ({ navigate }) => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                const { data, error } = await supabase.from('vehiculos_alertas').select('*');
                if (error) throw error;
                
                const activeAlerts = (data || []).filter(a => 
                    a.itv_caducada || a.seguro_vencido || 
                    a.itv_proxima_alerta || a.seguro_proximo || 
                    a.mantenimiento_por_km || a.km_desactualizados
                );

                activeAlerts.sort((a, b) => {
                    const aSevere = a.itv_caducada || a.seguro_vencido;
                    const bSevere = b.itv_caducada || b.seguro_vencido;
                    if (aSevere && !bSevere) return -1;
                    if (!aSevere && bSevere) return 1;
                    return 0;
                });

                setAlerts(activeAlerts);
            } catch (err) {
                console.error("Error loading alerts:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAlerts();
    }, []);

    if (loading) return <div className="h-32 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    if (alerts.length === 0) return null;

    return (
        <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" /> 
                Alertas de Flota ({alerts.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alerts.map((alert) => {
                    const isSevere = alert.itv_caducada || alert.seguro_vencido;
                    const borderColor = isSevere ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
                    
                    return (
                        <Card key={alert.vehiculo_id} className={cn("border-l-4 shadow-sm", borderColor)}>
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-lg flex items-center gap-2">
                                            {alert.matricula}
                                            {isSevere && <AlertCircle className="h-4 w-4 text-red-600" />}
                                        </div>
                                        <div className="text-sm text-muted-foreground mb-2">{alert.marca} {alert.modelo}</div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => navigate(`/inventario/vehiculos/${alert.vehiculo_id}`)}>
                                        Ver vehículo
                                    </Button>
                                </div>
                                
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {alert.itv_caducada && <Badge variant="destructive">ITV Caducada</Badge>}
                                    {alert.seguro_vencido && <Badge variant="destructive">Seguro Vencido</Badge>}
                                    {alert.itv_proxima_alerta && <Badge variant="outline" className="border-yellow-500 text-yellow-700">ITV Próxima</Badge>}
                                    {alert.seguro_proximo && <Badge variant="outline" className="border-yellow-500 text-yellow-700">Seguro Próximo</Badge>}
                                    {alert.mantenimiento_por_km && <Badge variant="outline" className="border-orange-500 text-orange-700">Mantenimiento Req.</Badge>}
                                    {alert.km_desactualizados && <Badge variant="secondary">KM Desactualizados</Badge>}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

const Vehiculos = ({ navigate }) => {
    const { sessionRole } = useAuth();
    // Allow 'tecnico' to VIEW, but keep management restricted to admin/encargado
    const canView = ['admin', 'encargado', 'tecnico'].includes(sessionRole?.rol);
    const canManage = ['admin', 'encargado'].includes(sessionRole?.rol);

    const [vehicles, setVehicles] = useState([]);
    const [activeAssignments, setActiveAssignments] = useState({}); 
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ tipo: 'todos', estado: 'todos' });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [assigningVehicleId, setAssigningVehicleId] = useState(null);
    const [page, setPage] = useState(0);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
    const PAGE_SIZE = 10;

    useEffect(() => {
        if (sessionRole?.loaded) {
            if (canView) {
                fetchVehicles();
            } else {
                toast({ title: 'Acceso denegado', description: 'No tienes permisos para ver esta sección.', variant: 'destructive' });
                navigate('/dashboard');
            }
        }
    }, [sessionRole, canView, navigate, page, filters]);

    useEffect(() => {
        if (canView) fetchVehicles();
    }, [searchTerm]);

    const fetchVehicles = async () => {
        setLoading(true);
        try {
            // Fetch vehicles
            let query = supabase
                .from('vehiculos')
                .select('*', { count: 'exact' });

            if (searchTerm) {
                query = query.or(`matricula.ilike.%${searchTerm}%,marca.ilike.%${searchTerm}%,modelo.ilike.%${searchTerm}%`);
            }
            if (filters.tipo !== 'todos') {
                query = query.eq('tipo', filters.tipo);
            }
            if (filters.estado !== 'todos') {
                query = query.eq('estado', filters.estado);
            }

            if (viewMode === 'list') {
                query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).order('created_at', { ascending: false });
            } else {
                // Map view: fetch all matching (limit to 1000 to be safe)
                query = query.limit(1000).order('created_at', { ascending: false });
            }

            const { data: vehiclesData, error: vehiclesError } = await query;
            if (vehiclesError) throw vehiclesError;

            setVehicles(vehiclesData || []);

            // Fetch active assignments for these vehicles
            if (vehiclesData && vehiclesData.length > 0) {
                const vehicleIds = vehiclesData.map(v => v.id);
                const { data: assignmentsData, error: assignmentsError } = await supabase
                    .from('vehiculo_asignaciones')
                    .select('vehiculo_id, empleado_id, empleados(nombre, apellidos)')
                    .in('vehiculo_id', vehicleIds)
                    .is('fecha_fin', null);

                if (assignmentsError) console.error("Error active assignments:", assignmentsError);

                const assignmentsMap = {};
                if (assignmentsData) {
                    assignmentsData.forEach(a => {
                        assignmentsMap[a.vehiculo_id] = a.empleados;
                    });
                }
                setActiveAssignments(assignmentsMap);
            } else {
                setActiveAssignments({});
            }

        } catch (error) {
            console.error('Error fetching vehicles:', error);
            toast({ title: 'Error al cargar vehículos', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    // Re-fetch when switching view modes to adjust pagination
    useEffect(() => {
        if (canView) fetchVehicles();
    }, [viewMode]);

    const handleDelete = async (id) => {
        try {
            const { error } = await supabase.from('vehiculos').delete().eq('id', id);
            if (error) throw error;
            toast({ title: 'Vehículo eliminado' });
            fetchVehicles();
        } catch (error) {
            toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
        }
    };

    const [globalStats, setGlobalStats] = useState({ total: 0, active: 0, workshop: 0 });
    
    useEffect(() => {
        if (!canView) return;
        const fetchStats = async () => {
            const { data } = await supabase.from('vehiculos').select('estado');
            if (data) {
                setGlobalStats({
                    total: data.length,
                    active: data.filter(v => v.estado === 'activo').length,
                    workshop: data.filter(v => v.estado === 'taller' || v.estado === 'mantenimiento').length
                });
            }
        };
        fetchStats();
    }, [vehicles, canView]);

    const handleAssignClick = (vehicleId) => {
        setAssigningVehicleId(vehicleId);
        setIsAssignModalOpen(true);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Flota de Vehículos</h1>
                    <p className="text-muted-foreground">Gestión y control de la flota de vehículos de la empresa.</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-muted p-1 rounded-lg flex items-center">
                        <Button 
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-8"
                            onClick={() => setViewMode('list')}
                        >
                            <ListIcon className="h-4 w-4 mr-2" /> Lista
                        </Button>
                        <Button 
                            variant={viewMode === 'map' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-8"
                            onClick={() => setViewMode('map')}
                        >
                            <MapIcon className="h-4 w-4 mr-2" /> Mapa
                        </Button>
                    </div>
                    {canManage && (
                        <Button onClick={() => { setEditingVehicle(null); setIsModalOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4" /> Añadir Vehículo
                        </Button>
                    )}
                </div>
            </div>

            {canManage && <AlertsPanel navigate={navigate} />}

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Vehículos</CardTitle>
                        <Truck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{globalStats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">En Activo</CardTitle>
                        <Car className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{globalStats.active}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">En Taller / Mto.</CardTitle>
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{globalStats.workshop}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por matrícula, marca, modelo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <div className="flex gap-2">
                    <Select value={filters.estado} onValueChange={(val) => setFilters(prev => ({ ...prev, estado: val }))}>
                        <SelectTrigger className="w-[180px]">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los estados</SelectItem>
                            <SelectItem value="activo">Activo</SelectItem>
                            <SelectItem value="taller">En Taller</SelectItem>
                            <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                            <SelectItem value="baja">De Baja</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={filters.tipo} onValueChange={(val) => setFilters(prev => ({ ...prev, tipo: val }))}>
                        <SelectTrigger className="w-[180px]">
                            <Truck className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los tipos</SelectItem>
                            <SelectItem value="furgoneta">Furgoneta</SelectItem>
                            <SelectItem value="turismo">Turismo</SelectItem>
                            <SelectItem value="camion">Camión</SelectItem>
                            <SelectItem value="moto">Moto</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {viewMode === 'list' ? (
                <>
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">Foto</TableHead>
                                        <TableHead>Matrícula</TableHead>
                                        <TableHead className="hidden md:table-cell">Marca / Modelo</TableHead>
                                        <TableHead className="hidden md:table-cell">Año</TableHead>
                                        <TableHead className="hidden md:table-cell">Tipo</TableHead>
                                        <TableHead>Asignado a</TableHead>
                                        <TableHead className="hidden md:table-cell">Kilometraje</TableHead>
                                        <TableHead className="hidden md:table-cell">Estado</TableHead>
                                        <TableHead className="text-right hidden md:table-cell">
                                            {canManage ? "Acciones" : ""}
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="h-24 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                            </TableCell>
                                        </TableRow>
                                    ) : vehicles.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                                                No se encontraron vehículos.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        vehicles.map((vehicle) => {
                                            const assignedEmp = activeAssignments[vehicle.id];
                                            
                                            return (
                                                <TableRow 
                                                    key={vehicle.id} 
                                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => navigate(`/inventario/vehiculos/${vehicle.id}`)}
                                                >
                                                    <TableCell>
                                                        <div className="h-12 w-12 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                                                            {vehicle.foto_principal ? (
                                                                <img src={vehicle.foto_principal} alt={vehicle.matricula} className="h-full w-full object-cover" />
                                                            ) : (
                                                                <Truck className="h-6 w-6 text-muted-foreground/50" />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-medium">{vehicle.matricula}</TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        <div className="flex flex-col">
                                                            <span>{vehicle.marca}</span>
                                                            <span className="text-xs text-muted-foreground">{vehicle.modelo}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">{vehicle.anio}</TableCell>
                                                    <TableCell className="hidden md:table-cell capitalize">{vehicle.tipo}</TableCell>
                                                    <TableCell>
                                                        {assignedEmp ? (
                                                            <div className="flex items-center gap-2">
                                                                <User className="h-3 w-3" />
                                                                <span className="font-medium">{assignedEmp.nombre} {assignedEmp.apellidos}</span>
                                                            </div>
                                                        ) : (
                                                            <Badge variant="outline" className="text-muted-foreground border-dashed">Sin asignar</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">{vehicle.km_actuales?.toLocaleString()} km</TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        <Badge variant={
                                                            vehicle.estado === 'activo' ? 'success' :
                                                            vehicle.estado === 'taller' ? 'warning' :
                                                            vehicle.estado === 'baja' ? 'destructive' : 'secondary'
                                                        } className={cn(
                                                            vehicle.estado === 'activo' && "bg-green-100 text-green-800 hover:bg-green-200",
                                                            vehicle.estado === 'taller' && "bg-orange-100 text-orange-800 hover:bg-orange-200",
                                                            vehicle.estado === 'mantenimiento' && "bg-blue-100 text-blue-800 hover:bg-blue-200"
                                                        )}>
                                                            {vehicle.estado.toUpperCase()}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right hidden md:table-cell">
                                                        {canManage && (
                                                            <div onClick={(e) => e.stopPropagation()}>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                                            <MoreHorizontal className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem onClick={() => navigate(`/inventario/vehiculos/${vehicle.id}`)}>
                                                                            <Eye className="mr-2 h-4 w-4" /> Ver detalles
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => handleAssignClick(vehicle.id)}>
                                                                            <UserPlus className="mr-2 h-4 w-4" /> Asignar empleado
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => { setEditingVehicle(vehicle); setIsModalOpen(true); }}>
                                                                            <Edit className="mr-2 h-4 w-4" /> Editar
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <AlertDialog>
                                                                            <AlertDialogTrigger asChild>
                                                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                                                                </DropdownMenuItem>
                                                                            </AlertDialogTrigger>
                                                                            <AlertDialogContent>
                                                                                <AlertDialogHeader>
                                                                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                                                    <AlertDialogDescription>
                                                                                        Esta acción no se puede deshacer. Se eliminará permanentemente el vehículo.
                                                                                    </AlertDialogDescription>
                                                                                </AlertDialogHeader>
                                                                                <AlertDialogFooter>
                                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                                    <AlertDialogAction onClick={() => handleDelete(vehicle.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                                                        Eliminar
                                                                                    </AlertDialogAction>
                                                                                </AlertDialogFooter>
                                                                            </AlertDialogContent>
                                                                        </AlertDialog>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <div className="flex justify-between items-center">
                        <div className="text-sm text-muted-foreground">
                            Página {page + 1}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                                Anterior
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={vehicles.length < PAGE_SIZE}>
                                Siguiente
                            </Button>
                        </div>
                    </div>
                </>
            ) : (
                <Card className="h-[600px] overflow-hidden">
                    <MapContainer 
                        center={[40.416775, -3.703790]} 
                        zoom={6} 
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer 
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {vehicles.map((v) => (
                            (v.latitud && v.longitud) ? (
                                <Marker key={v.id} position={[v.latitud, v.longitud]}>
                                    <Popup>
                                        <div className="font-bold text-lg">{v.matricula}</div>
                                        <div className="text-sm">{v.marca} {v.modelo}</div>
                                        <div className="text-xs text-muted-foreground mt-1 capitalize">{v.estado}</div>
                                        {activeAssignments[v.id] && (
                                            <div className="text-xs font-medium mt-1 flex items-center gap-1">
                                                <User className="h-3 w-3" /> 
                                                {activeAssignments[v.id].nombre} {activeAssignments[v.id].apellidos}
                                            </div>
                                        )}
                                        <Button size="sm" className="mt-2 w-full" onClick={() => navigate(`/inventario/vehiculos/${v.id}`)}>
                                            Ver ficha
                                        </Button>
                                    </Popup>
                                </Marker>
                            ) : null
                        ))}
                    </MapContainer>
                </Card>
            )}

            <VehicleForm
                vehicle={editingVehicle}
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingVehicle(null); }}
                onSave={fetchVehicles}
            />

            <AssignVehicleForm
                vehicleId={assigningVehicleId}
                isOpen={isAssignModalOpen}
                onClose={() => { setIsAssignModalOpen(false); setAssigningVehicleId(null); }}
                onSave={fetchVehicles}
            />
        </div>
    );
};

export default Vehiculos;