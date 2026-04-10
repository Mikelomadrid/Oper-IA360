import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { 
    PlusCircle, Loader2, X, Edit, Pencil, 
    Search, Calendar, User, ClipboardList, CheckCircle2, Clock, AlertCircle, 
    MoreHorizontal, Truck, Package, LayoutList, LayoutTemplate, Trash2, PackageCheck,
    Check, ChevronsUpDown, AlertTriangle
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { AsyncSearchableSelector } from '@/components/AsyncSearchableSelector';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import RequestMaterialModal from './RequestMaterialModal'; // Re-use the nice modal

const statusColors = {
  pendiente: 'bg-amber-500 hover:bg-amber-600',
  aprobada: 'bg-blue-500 hover:bg-blue-600',
  gestionada: 'bg-indigo-500 hover:bg-indigo-600',
  entregada: 'bg-purple-500 hover:bg-purple-600',
  recibido: 'bg-emerald-500 hover:bg-emerald-600',
  rechazado: 'bg-red-500 hover:bg-red-600',
  cancelada: 'bg-slate-500 hover:bg-slate-600',
};

const statusLabels = {
    pendiente: 'Pendiente',
    aprobada: 'Aprobada',
    gestionada: 'Gestionada',
    entregada: 'Entregada',
    recibido: 'Recibido',
    rechazado: 'Rechazado',
    cancelada: 'Cancelada'
};

const GESTION_STATUSES = ['gestionada', 'entregada', 'recibido'];

const getDestinationLabel = (req) => {
    if (req.header.parte_id) {
        return (
            <span className="flex items-center gap-1">
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">
                    {req.header.parte_custom_id || 'Parte'}
                </span>
                <span className="truncate max-w-[150px]">{req.header.parte_cliente_nombre}</span>
            </span>
        );
    }
    if (req.header.proyecto_id) {
        return (
            <span className="flex items-center gap-1 truncate max-w-[200px]">
                🏗️ {req.header.proyecto_nombre}
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1 text-muted-foreground italic">
            🏢 Nave / Taller
        </span>
    );
};

const RequestsTableView = ({ requests, onSelect, canManage }) => {
    return (
        <div className="rounded-md border bg-card shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">ID</TableHead>
                        <TableHead className="w-[120px]">Fecha</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Solicitante</TableHead>
                        <TableHead className="w-[100px]">Tipo</TableHead>
                        <TableHead className="text-center w-[80px]">Items</TableHead>
                        <TableHead className="w-[120px]">Estado</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {requests.map((req) => (
                        <TableRow 
                            key={req.header.solicitud_id} 
                            onClick={() => onSelect(req)}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                            <TableCell className="font-mono text-xs text-muted-foreground">
                                {req.header.solicitud_id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="text-sm">
                                {format(new Date(req.header.fecha_solicitud), "d MMM yyyy", { locale: es })}
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                                {getDestinationLabel(req)}
                            </TableCell>
                            <TableCell className="text-sm">
                                <div className="flex items-center gap-2">
                                    <User size={14} className="text-muted-foreground" />
                                    {req.header.empleado_nombre}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2 capitalize text-sm">
                                    {req.header.tipo === 'material' ? <Package size={14} className="text-blue-500"/> : <Truck size={14} className="text-orange-500"/>}
                                    {req.header.tipo}
                                </div>
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge variant="outline" className="font-normal">
                                    {req.items.length}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge className={cn("text-[10px] text-white hover:text-white font-normal", statusColors[req.header.estado_solicitud] || 'bg-gray-400')}>
                                    {statusLabels[req.header.estado_solicitud]}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                    {requests.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                No se encontraron pedidos que coincidan con los filtros.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

const UpdateRequestStatus = ({ request, onUpdated }) => {
    const [newStatus, setNewStatus] = useState(request.header.estado_solicitud);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setNewStatus(request.header.estado_solicitud);
        setNotes('');
    }, [request]);

    const handleUpdate = async () => {
        setLoading(true);
        const { error } = await supabase.rpc('api_actualizar_solicitud_material_estado', {
            p_solicitud_id: request.header.solicitud_id,
            p_estado: newStatus,
            p_notas: notes
        });

        setLoading(false);
        if (error) {
            toast({ variant: 'destructive', title: 'Error al actualizar', description: error.message });
        } else {
            toast({ title: 'Estado actualizado correctamente' });
            onUpdated();
        }
    };

    return (
        <Card className="bg-muted/20 border-dashed">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Edit className="h-4 w-4 text-muted-foreground"/> 
                    Gestionar Estado
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="estado-solicitud" className="text-xs text-muted-foreground">Nuevo Estado</Label>
                        <Select value={newStatus} onValueChange={setNewStatus}>
                            <SelectTrigger id="estado-solicitud" className="bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pendiente">Pendiente</SelectItem>
                                <SelectItem value="gestionada">Gestionada</SelectItem>
                                <SelectItem value="entregada">Entregada</SelectItem>
                                <SelectItem value="cancelada">Cancelada</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="admin-notas" className="text-xs text-muted-foreground">Notas de Gestión</Label>
                        <Input 
                            id="admin-notas" 
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)} 
                            placeholder="Opcional..." 
                            className="bg-background"
                        />
                    </div>
                </div>
            </CardContent>
            <CardFooter className="pt-0 justify-end">
                <Button onClick={handleUpdate} disabled={loading || newStatus === request.header.estado_solicitud} size="sm">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Actualizar Estado
                </Button>
            </CardFooter>
        </Card>
    );
}

const StatCard = ({ title, count, icon: Icon, className, onClick, active }) => (
    <Card 
        className={cn(
            "cursor-pointer hover:shadow-md transition-all border-l-4", 
            active ? "ring-2 ring-primary ring-offset-1" : "",
            className
        )}
        onClick={onClick}
    >
        <CardContent className="p-4 flex items-center justify-between">
            <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-bold">{count}</h3>
            </div>
            <div className={cn("p-2 rounded-full opacity-80", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Icon size={20} />
            </div>
        </CardContent>
    </Card>
);

const MaterialRequests = ({ onUpdate }) => {
    const { sessionRole } = useAuth();
    const [viewMode, setViewMode] = useState('list'); // Changed default to 'list'
    const [requests, setRequests] = useState([]);
    // Added fields for Partes and Nave/Taller display logic
    const _REQUESTS_V2_VIEW_QUERY_BASE = "solicitud_id, fecha_solicitud, tipo, estado_solicitud, notas, proyecto_id, proyecto_nombre, parte_id, parte_custom_id, parte_cliente_nombre, empleado_solicitante_id, empleado_nombre, detalle_id, descripcion, cantidad, unidad, referencia_interna, preparada, material_id";
    const [filters, setFilters] = useState({ estado: null, tipo: null, proyecto: null, empleado: null });
    const [searchTerm, setSearchTerm] = useState('');
    const [proyectos, setProyectos] = useState([]);
    const [availableMaterials, setAvailableMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedRequest, setSelectedRequest] = useState(null); 
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    
    // Legacy edit logic removed as creating new one is preferred, but keeping minimal update logic
    const [updatingItemId, setUpdatingItemId] = useState(null);

    // Stock deduction Dialog state
    const [insufficientStockDialogOpen, setInsufficientStockDialogOpen] = useState(false);
    const [pendingItemUpdate, setPendingItemUpdate] = useState(null);

    const canManage = sessionRole.rol === 'admin' || sessionRole.rol === 'encargado';

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase.from('v_solicitudes_material_detalle_v2').select(_REQUESTS_V2_VIEW_QUERY_BASE);

            if (!canManage) {
                query = query.eq('empleado_solicitante_id', sessionRole.empleadoId);
            }

            // Apply DB filters
            if (filters.estado) {
                if (Array.isArray(filters.estado)) {
                    query = query.in('estado_solicitud', filters.estado);
                } else {
                    query = query.eq('estado_solicitud', filters.estado);
                }
            }
            if (filters.tipo) query = query.eq('tipo', filters.tipo);
            if (filters.proyecto) query = query.eq('proyecto_id', filters.proyecto);
            if (canManage && filters.empleado) query = query.eq('empleado_solicitante_id', filters.empleado);

            query = query.order('fecha_solicitud', { ascending: false });

            const { data, error } = await query;

            if (error) throw error;

            setRequests(data || []);
            setError(null);
        } catch (error) {
            console.error("Error fetching requests:", error);
            setError(error.message);
            toast({ variant: 'destructive', title: 'Error al cargar solicitudes', description: error.message });
        } finally {
            setLoading(false);
        }
    }, [filters, _REQUESTS_V2_VIEW_QUERY_BASE, canManage, sessionRole.empleadoId]);
    
    const refreshAll = useCallback(() => {
        fetchRequests();
        if (onUpdate && canManage) {
            onUpdate();
        }
    }, [fetchRequests, onUpdate, canManage]);

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    const fetchEmpleados = async (search) => {
        const { data, error } = await supabase.rpc('sel_empleados', { p_q: search });
        if (error) throw error;
        return data.map(e => ({ value: e.id, label: e.label }));
    };

    useEffect(() => {
        const fetchFilterData = async () => {
            const { data, error } = await supabase.from('v_proyectos_selector').select('id, nombre');
            if (!error) setProyectos(data);
            
            const { data: matData } = await supabase.from('materiales').select('id, nombre, descripcion, codigo, unidad_medida, stock_actual').order('nombre');
            setAvailableMaterials(matData || []);
        };
        fetchFilterData();
    }, []);

    const groupedRequests = useMemo(() => {
        return requests.reduce((acc, req) => {
            if (!acc[req.solicitud_id]) {
                acc[req.solicitud_id] = {
                    header: {
                        solicitud_id: req.solicitud_id,
                        fecha_solicitud: req.fecha_solicitud,
                        tipo: req.tipo,
                        estado_solicitud: req.estado_solicitud,
                        notas: req.notas,
                        proyecto_id: req.proyecto_id,
                        proyecto_nombre: req.proyecto_nombre,
                        parte_id: req.parte_id,
                        parte_custom_id: req.parte_custom_id,
                        parte_cliente_nombre: req.parte_cliente_nombre,
                        empleado_solicitante_id: req.empleado_solicitante_id,
                        empleado_nombre: req.empleado_nombre,
                    },
                    items: [],
                };
            }
            acc[req.solicitud_id].items.push({
                detalle_id: req.detalle_id,
                descripcion: req.descripcion,
                cantidad: req.cantidad,
                unidad: req.unidad,
                referencia_interna: req.referencia_interna,
                preparada: req.preparada,
                material_id: req.material_id, // include material_id
            });
            return acc;
        }, {});
    }, [requests]);

    const filteredGroupedRequests = useMemo(() => {
        let result = Object.values(groupedRequests);
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(r => 
                r.header.proyecto_nombre?.toLowerCase().includes(lower) ||
                r.header.parte_custom_id?.toLowerCase().includes(lower) ||
                r.header.empleado_nombre?.toLowerCase().includes(lower) ||
                r.items.some(i => i.descripcion.toLowerCase().includes(lower))
            );
        }
        return result.sort((a, b) => new Date(b.header.fecha_solicitud) - new Date(a.header.fecha_solicitud));
    }, [groupedRequests, searchTerm]);

    const stats = useMemo(() => {
        const all = Object.values(groupedRequests);
        return {
            total: all.length,
            pending: all.filter(r => r.header.estado_solicitud === 'pendiente').length,
            processed: all.filter(r => GESTION_STATUSES.includes(r.header.estado_solicitud)).length,
        };
    }, [groupedRequests]);

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value === 'all' ? null : value }));
    };

    const handleRowClick = (request) => {
        setSelectedRequest(request);
        setViewMode('split'); // Switch to split view when a request is selected from the list
    };
    
    const handleRequestUpdated = () => {
        refreshAll();
        // If the current view is 'split' and the selected request was updated, re-select it to refresh its details
        // Otherwise, clear selection if in 'list' mode or if selected request was deleted
        if (viewMode === 'split' && selectedRequest && requests.some(r => r.solicitud_id === selectedRequest.header.solicitud_id)) {
             // Re-fetch details for the specific request if still exists
            const updatedRequest = filteredGroupedRequests.find(r => r.header.solicitud_id === selectedRequest.header.solicitud_id);
            if (updatedRequest) {
                setSelectedRequest(updatedRequest);
            } else {
                setSelectedRequest(null);
            }
        } else {
            setSelectedRequest(null);
        }
    }
    
    const handleDeleteRequest = async (solicitudId) => {
        const { error } = await supabase.rpc('api_eliminar_solicitud_material', { p_solicitud_id: solicitudId });
        if (error) {
            toast({ variant: 'destructive', title: 'Error al eliminar', description: error.message });
        } else {
            toast({ title: 'Solicitud eliminada' });
            setSelectedRequest(null); // Clear selected request after deletion
            handleRequestUpdated(); // Refresh the list
        }
    };

    const executePreparadaChange = async (detalleId, checked, materialId, quantity) => {
        setUpdatingItemId(detalleId);
        
        // Use the new RPC that handles stock deduction
        const { error } = await supabase.rpc('api_toggle_item_preparado', {
            p_detalle_id: detalleId,
            p_preparada: checked,
            p_force: true // Always force if we got here (either sufficient stock or user confirmed)
        });

        if (error) {
             toast({ variant: 'destructive', title: 'Error', description: error.message });
        } else {
             // Refresh request data logic...
             handleRequestUpdated();
             
             const msg = checked 
                ? (materialId ? 'Material preparado y descontado de stock' : 'Material marcado como preparado')
                : (materialId ? 'Material devuelto a stock' : 'Material desmarcado');
             toast({ title: msg });
        }
        setUpdatingItemId(null);
        setInsufficientStockDialogOpen(false);
        setPendingItemUpdate(null);
    }

    const handlePreparadaChange = async (detalleId, checked) => {
        const item = selectedRequest.items.find(i => i.detalle_id === detalleId);
        if (!item) return;

        // Fetch material info if it exists AND we are marking as prepared (to check stock)
        // If unmarking (checked=false), we just restore stock, no check needed.
        let material = null;
        if (checked && item.material_id) {
             const { data, error } = await supabase.from('materiales').select('stock_actual, nombre').eq('id', item.material_id).single();
             if (!error) material = data;
        }

        if (checked && material) {
            // Check if stock is sufficient
            if (material.stock_actual < item.cantidad) {
                setPendingItemUpdate({ 
                    id: detalleId, 
                    checked, 
                    materialId: item.material_id, 
                    quantity: item.cantidad,
                    currentStock: material.stock_actual,
                    itemName: material.nombre || item.descripcion
                });
                setInsufficientStockDialogOpen(true);
                return;
            }
        }

        // Proceed if stock sufficient or manual item or unchecking
        await executePreparadaChange(detalleId, checked, item.material_id, item.cantidad);
    };

    return (
        <>
            <Helmet>
                <title>Pedidos de Material | OrkaRefor ERP</title>
            </Helmet>
            
            {/* --- REPLACED OLD MODAL WITH NEW COMPONENT --- */}
            <RequestMaterialModal 
                isOpen={isCreateModalOpen} 
                onClose={() => setCreateModalOpen(false)} 
                onSuccess={refreshAll} 
                availableMaterials={availableMaterials}
            />

            <div className="flex h-[calc(100vh-4rem)] bg-background overflow-hidden">
                
                {/* --- LIST VIEW MODE --- */}
                {viewMode === 'list' && (
                    <div className="flex-1 flex flex-col min-w-0 bg-background/50">
                        {/* Header Bar */}
                        <div className="border-b p-4 flex flex-col gap-4 bg-background">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <h1 className="text-xl font-bold flex items-center gap-2">
                                        <Package className="text-primary" size={22}/> Pedidos
                                    </h1>
                                    
                                    {/* View Toggle */}
                                    <div className="flex items-center bg-muted rounded-lg p-1 gap-1 border">
                                        <Button 
                                            variant={viewMode === 'split' ? 'ghost' : 'secondary'} 
                                            size="icon" 
                                            className="h-7 w-7"
                                            onClick={() => setViewMode('split')}
                                            title="Vista Cluster"
                                        >
                                            <LayoutTemplate size={16} />
                                        </Button>
                                        <Button 
                                            variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                                            size="icon" 
                                            className="h-7 w-7"
                                            onClick={() => setViewMode('list')}
                                            title="Vista Lista"
                                        >
                                            <LayoutList size={16} />
                                        </Button>
                                    </div>
                                </div>

                                <Button size="sm" onClick={() => setCreateModalOpen(true)}>
                                    <PlusCircle className="mr-2 h-4 w-4"/> Nuevo Pedido
                                </Button>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                <div 
                                    className={cn("flex flex-col border-l-4 pl-3 py-1 cursor-pointer transition-colors", filters.estado === 'pendiente' ? "border-amber-500 bg-amber-50 dark:bg-amber-900/10" : "border-amber-500/30 hover:bg-muted/50")}
                                    onClick={() => handleFilterChange('estado', filters.estado === 'pendiente' ? 'all' : 'pendiente')}
                                >
                                    <span className="text-xs text-muted-foreground uppercase">Pendientes</span>
                                    <span className="text-xl font-bold">{stats.pending}</span>
                                </div>
                                <div 
                                    className={cn("flex flex-col border-l-4 pl-3 py-1 cursor-pointer transition-colors", 
                                        (Array.isArray(filters.estado) || GESTION_STATUSES.includes(filters.estado)) 
                                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10" 
                                        : "border-indigo-500/30 hover:bg-muted/50"
                                    )}
                                    onClick={() => handleFilterChange('estado', GESTION_STATUSES)} 
                                >
                                    <span className="text-xs text-muted-foreground uppercase">Gestión</span>
                                    <span className="text-xl font-bold">{stats.processed}</span>
                                </div>
                                <div 
                                    className={cn("flex flex-col border-l-4 pl-3 py-1 cursor-pointer transition-colors", !filters.estado ? "border-slate-500 bg-slate-50 dark:bg-slate-900/10" : "border-slate-500/30 hover:bg-muted/50")}
                                    onClick={() => handleFilterChange('estado', 'all')}
                                >
                                    <span className="text-xs text-muted-foreground uppercase">Total</span>
                                    <span className="text-xl font-bold">{stats.total}</span>
                                </div>
                            </div>

                            {/* Filters Row */}
                            <div className="flex gap-4 items-center flex-wrap">
                                <div className="relative flex-1 max-w-sm min-w-[200px]">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Buscar..." 
                                        className="pl-9 h-9"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Select value={filters.tipo || 'all'} onValueChange={value => handleFilterChange('tipo', value)}>
                                    <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Tipo"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los tipos</SelectItem>
                                        <SelectItem value="material">Material</SelectItem>
                                        <SelectItem value="herramienta">Herramienta</SelectItem>
                                    </SelectContent>
                                </Select>
                                {canManage && (
                                    <AsyncSearchableSelector
                                        fetcher={fetchEmpleados}
                                        selected={filters.empleado}
                                        onSelect={(value) => handleFilterChange('empleado', value)}
                                        placeholder="Filtrar por empleado"
                                        className="h-9 w-[200px]"
                                    />
                                )}
                                {(filters.estado || filters.tipo || filters.proyecto || filters.empleado || searchTerm) && (
                                    <Button variant="ghost" size="sm" onClick={() => { setFilters({ estado: null, tipo: null, proyecto: null, empleado: null }); setSearchTerm(''); }} className="h-9 px-2">
                                        <X className="h-4 w-4 mr-1"/> Limpiar
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Table Content */}
                        <div className="flex-1 overflow-auto p-4">
                            {loading ? (
                                <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary"/></div>
                            ) : (
                                <RequestsTableView 
                                    requests={filteredGroupedRequests} 
                                    onSelect={(req) => {
                                        setSelectedRequest(req);
                                        setViewMode('split');
                                    }} 
                                    canManage={canManage}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* --- SPLIT VIEW MODE (Existing Sidebar + Detail) --- */}
                {viewMode === 'split' && (
                    <>
                        {/* Sidebar (Request List) */}
                        <div className={cn("transition-all duration-300 w-full md:w-96 border-r flex flex-col bg-muted/10", selectedRequest ? "hidden md:flex" : "flex")}>
                            {/* ... (Sidebar content remains mostly same, condensed for brevity) ... */}
                            {/* Stats Header */}
                            <div className="p-4 space-y-4 border-b bg-background">
                                <div className="flex justify-between items-center">
                                    <h1 className="text-xl font-bold flex items-center gap-2"><Package className="text-primary" size={22}/> Pedidos</h1>
                                    <div className="flex items-center gap-2">
                                        {/* View Toggle Inside Sidebar */}
                                        <div className="flex items-center bg-muted rounded-lg p-1 gap-1 border">
                                            <Button 
                                                variant={viewMode === 'split' ? 'secondary' : 'ghost'} 
                                                size="icon" 
                                                className="h-7 w-7"
                                                onClick={() => setViewMode('split')}
                                                title="Vista Cluster"
                                            >
                                                <LayoutTemplate size={14} />
                                            </Button>
                                            <Button 
                                                variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                                                size="icon" 
                                                className="h-7 w-7"
                                                onClick={() => setViewMode('list')}
                                                title="Vista Lista"
                                            >
                                                <LayoutList size={14} />
                                            </Button>
                                        </div>
                                        <Button size="sm" onClick={() => setCreateModalOpen(true)} className="shadow-sm h-8 px-2">
                                            <PlusCircle className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <StatCard 
                                        title="Pendiente" 
                                        count={stats.pending} 
                                        icon={Clock} 
                                        className="border-amber-500" 
                                        active={filters.estado === 'pendiente'}
                                        onClick={() => handleFilterChange('estado', filters.estado === 'pendiente' ? 'all' : 'pendiente')}
                                    />
                                    <StatCard 
                                        title="Gestión" 
                                        count={stats.processed} 
                                        icon={CheckCircle2} 
                                        className="border-indigo-500" 
                                        active={Array.isArray(filters.estado) || GESTION_STATUSES.includes(filters.estado)}
                                        onClick={() => handleFilterChange('estado', GESTION_STATUSES)}
                                    />
                                    <StatCard 
                                        title="Total" 
                                        count={stats.total} 
                                        icon={Package} 
                                        className="border-slate-500"
                                        active={!filters.estado}
                                        onClick={() => handleFilterChange('estado', 'all')}
                                    />
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Buscar pedido, proyecto..." 
                                        className="pl-9 bg-muted/30"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                    <Select value={filters.tipo || 'all'} onValueChange={value => handleFilterChange('tipo', value)}>
                                        <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Tipo"/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            <SelectItem value="material">Material</SelectItem>
                                            <SelectItem value="herramienta">Herramienta</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {canManage && (
                                        <AsyncSearchableSelector
                                            fetcher={fetchEmpleados}
                                            selected={filters.empleado}
                                            onSelect={(value) => handleFilterChange('empleado', value)}
                                            placeholder="Empleado"
                                            className="h-8 w-[140px] text-xs"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Requests List */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {loading && <div className="py-10 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground"/></div>}
                                
                                {!loading && filteredGroupedRequests.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                                        <div className="bg-muted/50 p-4 rounded-full mb-3">
                                            <PackageCheck className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <h3 className="font-medium text-base">Sin pedidos</h3>
                                        <p className="text-sm text-muted-foreground mt-1">No hay pedidos que coincidan con los filtros.</p>
                                    </div>
                                )}

                                {filteredGroupedRequests.map((req) => (
                                    <Card 
                                        key={req.header.solicitud_id} 
                                        onClick={() => handleRowClick(req)} 
                                        className={cn(
                                            "cursor-pointer transition-all hover:shadow-md border-l-4 border-l-transparent", 
                                            selectedRequest?.header.solicitud_id === req.header.solicitud_id 
                                                ? "bg-primary/5 border-l-primary shadow-sm" 
                                                : "hover:border-l-muted-foreground/30"
                                        )}
                                    >
                                        <CardContent className="p-3 space-y-2">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="font-semibold text-sm line-clamp-1">
                                                    {getDestinationLabel(req)}
                                                </div>
                                                <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-5 font-normal text-white", statusColors[req.header.estado_solicitud])}>
                                                    {statusLabels[req.header.estado_solicitud] || req.header.estado_solicitud}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <User size={12} /> 
                                                <span className="truncate">{req.header.empleado_nombre}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar size={12} />
                                                    <span>{format(new Date(req.header.fecha_solicitud), "d MMM", { locale: es })}</span>
                                                </div>
                                                <div className="flex items-center gap-1 font-medium text-foreground">
                                                    <ClipboardList size={12} />
                                                    <span>{req.items.length} ítems</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        {/* Main Detail Area (Only in Split View) */}
                        <div className={cn("flex-1 flex flex-col bg-background transition-all duration-300", !selectedRequest ? "hidden md:flex" : "flex")}>
                            {selectedRequest ? (
                                <>
                                    {/* Detail Header */}
                                    <div className="h-16 border-b flex items-center justify-between px-6 shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <Button variant="ghost" size="icon" className="md:hidden shrink-0 -ml-2" onClick={() => setSelectedRequest(null)}>
                                                <X size={20}/>
                                            </Button>
                                            <div className="flex flex-col min-w-0">
                                                <h2 className="text-lg font-semibold truncate flex items-center gap-2">
                                                    {getDestinationLabel(selectedRequest)}
                                                </h2>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <span>ID: {selectedRequest.header.solicitud_id.slice(0,8)}</span>
                                                    <span>•</span>
                                                    <span>{format(new Date(selectedRequest.header.fecha_solicitud), "PPP p", { locale: es })}</span>
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {canManage && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal size={16} />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        {/* EDIT Removed for now as new modal handles creation well, and editing logic is complex with mixed types. Re-add later if critical. */}
                                                        {/* 
                                                        <DropdownMenuItem onClick={() => setEditModalOpen(true)}>
                                                            <Pencil className="mr-2 h-4 w-4" /> Editar Solicitud
                                                        </DropdownMenuItem> 
                                                        <DropdownMenuSeparator /> 
                                                        */}
                                                        <DropdownMenuItem onClick={() => handleDeleteRequest(selectedRequest.header.solicitud_id)} className="text-destructive focus:text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar Solicitud
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                    </div>

                                    {/* Detail Scroll Area */}
                                    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                                        
                                        {/* Header Card Info */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <Card className="bg-muted/30 border-none shadow-none">
                                                <CardHeader className="p-4 pb-2">
                                                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Solicitante</CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-4 pt-0 font-semibold text-sm flex items-center gap-2">
                                                    <User size={16} className="text-primary"/> {selectedRequest.header.empleado_nombre}
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-muted/30 border-none shadow-none">
                                                <CardHeader className="p-4 pb-2">
                                                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Tipo</CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-4 pt-0 font-semibold text-sm capitalize flex items-center gap-2">
                                                    {selectedRequest.header.tipo === 'material' ? <Package size={16} className="text-blue-500"/> : <Truck size={16} className="text-orange-500"/>}
                                                    {selectedRequest.header.tipo}
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-muted/30 border-none shadow-none">
                                                <CardHeader className="p-4 pb-2">
                                                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Estado Actual</CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-4 pt-0">
                                                    <Badge className={cn("text-white", statusColors[selectedRequest.header.estado_solicitud] || 'bg-gray-400')}>
                                                        {statusLabels[selectedRequest.header.estado_solicitud]}
                                                    </Badge>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {selectedRequest.header.notas && (
                                            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-md text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100 dark:border-amber-600">
                                                <h4 className="font-semibold flex items-center gap-2 mb-1"><AlertCircle size={16}/> Notas de la solicitud:</h4>
                                                <p className="whitespace-pre-wrap">{selectedRequest.header.notas}</p>
                                            </div>
                                        )}

                                        <div>
                                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                                <ClipboardList className="text-primary" size={20} /> Lista de Artículos
                                            </h3>
                                            <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
                                                <Table>
                                                    <TableHeader className="bg-muted/50">
                                                        <TableRow>
                                                            {canManage && <TableHead className="w-[60px] text-center">Prep.</TableHead>}
                                                            <TableHead>Descripción</TableHead>
                                                            <TableHead className="text-right w-[100px]">Cantidad</TableHead>
                                                            <TableHead className="w-[80px]">Unidad</TableHead>
                                                            <TableHead className="w-[120px]">Referencia</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {selectedRequest.items.map(item => (
                                                            <TableRow key={item.detalle_id} className={cn(item.preparada && "bg-green-50/50 dark:bg-green-900/10")}>
                                                                {canManage && (
                                                                    <TableCell className="text-center">
                                                                        {updatingItemId === item.detalle_id ? (
                                                                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                                                                        ) : (
                                                                            <Checkbox
                                                                                checked={item.preparada}
                                                                                onCheckedChange={(checked) => handlePreparadaChange(item.detalle_id, checked)}
                                                                                aria-label="Marcar como preparada"
                                                                                className="mx-auto block"
                                                                            />
                                                                        )}
                                                                    </TableCell>
                                                                )}
                                                                <TableCell className={cn("font-medium", item.preparada && "text-muted-foreground line-through")}>{item.descripcion}</TableCell>
                                                                <TableCell className="text-right">{item.cantidad}</TableCell>
                                                                <TableCell className="text-muted-foreground text-xs uppercase">{item.unidad}</TableCell>
                                                                <TableCell className="text-muted-foreground text-xs font-mono">{item.referencia_interna || '-'}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>

                                        {canManage && (
                                            <>
                                                <Separator />
                                                <UpdateRequestStatus request={selectedRequest} onUpdated={handleRequestUpdated} />
                                            </>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                                    <div className="bg-muted/30 p-6 rounded-full mb-6 animate-pulse">
                                        <PackageCheck size={64} strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-xl font-semibold text-foreground">Selecciona un pedido</h3>
                                    <p className="max-w-xs text-center mt-2">Elige un pedido de la lista de la izquierda para ver sus detalles, gestionar ítems o cambiar su estado.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <AlertDialog open={insufficientStockDialogOpen} onOpenChange={setInsufficientStockDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Stock Insuficiente
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            El material <strong>"{pendingItemUpdate?.itemName}"</strong> tiene un stock actual de {pendingItemUpdate?.currentStock}. 
                            Estás intentando preparar una salida de {pendingItemUpdate?.quantity}.
                            <br/><br/>
                            ¿Deseas forzar la operación? El stock quedará en negativo.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setInsufficientStockDialogOpen(false);
                            setPendingItemUpdate(null);
                        }}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                            if (pendingItemUpdate) {
                                executePreparadaChange(
                                    pendingItemUpdate.id, 
                                    pendingItemUpdate.checked, 
                                    pendingItemUpdate.materialId, 
                                    pendingItemUpdate.quantity
                                );
                            }
                        }}>Confirmar y descontar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default MaterialRequests;