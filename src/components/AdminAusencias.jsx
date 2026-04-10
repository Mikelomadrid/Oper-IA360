import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2, Plus, Trash2, Edit, UserX, Search, RefreshCw, Calendar as CalendarIcon,
    Palmtree, ShieldAlert, BookOpen, UserCheck, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
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

const AdminAusencias = () => {
    const { sessionRole } = useAuth();

    // Data State
    const [ausencias, setAusencias] = useState([]);
    const [solicitudes, setSolicitudes] = useState([]);
    const [empleados, setEmpleados] = useState([]);

    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', empleadoId: 'all', type: 'all' });
    const [solicitudesFilter, setSolicitudesFilter] = useState('pendiente'); // 'pendiente' | 'all'

    // Modal State (Absences)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        id: null,
        empleado_id: '',
        tipo: 'baja',
        range: { from: undefined, to: undefined },
        notas: ''
    });
    const [saving, setSaving] = useState(false);
    const [originalAusencia, setOriginalAusencia] = useState(null);

    // Delete State
    const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, id: null });
    const [deleting, setDeleting] = useState(false);

    // Approval/Rejection State
    const [actionDialog, setActionDialog] = useState({ isOpen: false, type: null, solicitud: null });
    const [actionNote, setActionNote] = useState('');
    const [processingAction, setProcessingAction] = useState(false);

    // Request Edit/Delete State
    const [isRequestEditOpen, setIsRequestEditOpen] = useState(false);
    const [requestEditData, setRequestEditData] = useState({ id: null, range: { from: undefined, to: undefined }, notas: '' });
    const [requestDeleteDialogOpen, setRequestDeleteDialogOpen] = useState(false);
    const [requestToDelete, setRequestToDelete] = useState(null);

    const canManage = ['admin', 'encargado'].includes(sessionRole?.rol);

    const fetchBaseData = useCallback(async () => {
        try {
            const { data: emps } = await supabase
                .from('v_empleados_selector')
                .select('id, display_name, rol')
                .order('display_name');
            setEmpleados(emps || []);
        } catch (err) {
            console.error(err);
        }
    }, []);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch Official Absences
            let queryAusencias = supabase
                .from('ausencias_empleados')
                .select(`
                    *,
                    empleado:empleados!ausencias_empleados_empleado_id_fkey(id, nombre, apellidos),
                    registrado_por:empleados!ausencias_empleados_admin_id_fkey(nombre, apellidos)
                `)
                .order('fecha_inicio', { ascending: false });

            if (filters.empleadoId && filters.empleadoId !== 'all') {
                queryAusencias = queryAusencias.eq('empleado_id', filters.empleadoId);
            }
            if (filters.type && filters.type !== 'all') {
                queryAusencias = queryAusencias.eq('tipo', filters.type);
            }

            const { data: dataAus, error: errAus } = await queryAusencias;
            if (errAus) throw errAus;

            // 2. Fetch Requests
            let querySolicitudes = supabase
                .from('v_vacaciones_solicitudes') // Using view for joined names
                .select('*')
                .order('created_at', { ascending: false });

            if (filters.empleadoId && filters.empleadoId !== 'all') {
                querySolicitudes = querySolicitudes.eq('empleado_id', filters.empleadoId);
            }

            const { data: dataSol, error: errSol } = await querySolicitudes;
            if (errSol) throw errSol;

            // Client-side filtering
            let filteredAusencias = dataAus || [];
            if (filters.search) {
                const lowerSearch = filters.search.toLowerCase();
                filteredAusencias = filteredAusencias.filter(a =>
                    (a.empleado?.nombre + ' ' + a.empleado?.apellidos).toLowerCase().includes(lowerSearch) ||
                    (a.notas || '').toLowerCase().includes(lowerSearch)
                );
            }
            setAusencias(filteredAusencias);
            setSolicitudes(dataSol || []);

        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        if (canManage) {
            fetchBaseData();
            fetchAllData();
        }
    }, [canManage, fetchBaseData, fetchAllData]);

    // --- ABSENCE MANAGEMENT (Create/Edit/Delete Official Records) ---

    const handleOpenModal = (ausencia = null) => {
        if (ausencia) {
            setIsEditing(true);
            setOriginalAusencia(ausencia);
            setFormData({
                id: ausencia.id,
                empleado_id: ausencia.empleado_id,
                tipo: ausencia.tipo,
                range: {
                    from: new Date(ausencia.fecha_inicio),
                    to: new Date(ausencia.fecha_fin)
                },
                notas: ausencia.notas || ''
            });
        } else {
            setIsEditing(false);
            setOriginalAusencia(null);
            setFormData({
                id: null,
                empleado_id: '',
                tipo: 'baja',
                range: { from: undefined, to: undefined },
                notas: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSaveAbsence = async () => {
        if (!formData.empleado_id || !formData.range.from) {
            toast({ variant: 'destructive', title: 'Error', description: 'Faltan campos obligatorios.' });
            return;
        }

        const startDate = formData.range.from;
        const endDate = formData.range.to || formData.range.from;
        const duration = differenceInDays(endDate, startDate) + 1;

        setSaving(true);
        try {
            // Revert previous balance impact if editing
            if (isEditing && originalAusencia?.tipo === 'vacaciones') {
                const oldDuration = differenceInDays(new Date(originalAusencia.fecha_fin), new Date(originalAusencia.fecha_inicio)) + 1;
                await supabase.rpc('increment_vacation_balance', { p_empleado_id: originalAusencia.empleado_id, p_days: oldDuration });
            }

            // Apply new balance impact
            if (formData.tipo === 'vacaciones') {
                // If editing, we just deducted the old days back, so now we subtract new duration.
                // If creating, we subtract duration.
                // NOTE: We don't check for insufficient balance strictly here to allow Admin overrides.
                await supabase.rpc('increment_vacation_balance', { p_empleado_id: formData.empleado_id, p_days: -duration });
            }

            const payload = {
                empleado_id: formData.empleado_id,
                tipo: formData.tipo,
                fecha_inicio: format(startDate, 'yyyy-MM-dd'),
                fecha_fin: format(endDate, 'yyyy-MM-dd'),
                notas: formData.notas,
                admin_id: sessionRole?.id
            };

            if (isEditing) {
                await supabase.from('ausencias_empleados').update(payload).eq('id', formData.id);
                toast({ title: 'Actualizado', description: 'Registro actualizado.' });
            } else {
                await supabase.from('ausencias_empleados').insert(payload);
                toast({ title: 'Creado', description: 'Ausencia registrada.' });
            }

            setIsModalOpen(false);
            fetchAllData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAbsence = async () => {
        if (!deleteDialog.id) return;
        setDeleting(true);
        try {
            const { data: ausencia } = await supabase.from('ausencias_empleados').select('*').eq('id', deleteDialog.id).single();
            if (ausencia && ausencia.tipo === 'vacaciones') {
                const duration = differenceInDays(new Date(ausencia.fecha_fin), new Date(ausencia.fecha_inicio)) + 1;
                await supabase.rpc('increment_vacation_balance', { p_empleado_id: ausencia.empleado_id, p_days: duration });
            }
            await supabase.from('ausencias_empleados').delete().eq('id', deleteDialog.id);
            toast({ title: 'Eliminado', description: 'Registro eliminado correctamente.' });
            setDeleteDialog({ isOpen: false, id: null });
            fetchAllData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setDeleting(false);
        }
    };

    // --- REQUESTS MANAGEMENT (Approve/Reject/CRUD) ---

    const handleProcessRequest = async () => {
        if (!actionDialog.solicitud) return;
        setProcessingAction(true);
        try {
            const { data, error } = await supabase.rpc('process_vacation_request', {
                p_request_id: actionDialog.solicitud.id,
                p_action: actionDialog.type, // 'approve' or 'reject'
                p_admin_id: sessionRole?.id,
                p_response_notes: actionNote
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.message);

            toast({
                title: actionDialog.type === 'approve' ? 'Solicitud Aprobada' : 'Solicitud Rechazada',
                description: actionDialog.type === 'approve' ? 'Se ha creado el registro de ausencia y descontado el saldo.' : 'Se ha notificado el rechazo.'
            });
            setActionDialog({ isOpen: false, type: null, solicitud: null });
            setActionNote('');
            fetchAllData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al procesar', description: error.message });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleEditRequest = (req) => {
        setRequestEditData({
            id: req.id,
            range: { from: new Date(req.fecha_inicio), to: new Date(req.fecha_fin) },
            notas: req.notas_solicitud || ''
        });
        setIsRequestEditOpen(true);
    };

    const handleSaveRequestEdit = async () => {
        if (!requestEditData.range.from) return;
        setProcessingAction(true);
        try {
            const startDate = requestEditData.range.from;
            const endDate = requestEditData.range.to || startDate;
            const days = differenceInDays(endDate, startDate) + 1;

            const { error } = await supabase.from('vacaciones_solicitudes').update({
                fecha_inicio: format(startDate, 'yyyy-MM-dd'),
                fecha_fin: format(endDate, 'yyyy-MM-dd'),
                dias_solicitados: days,
                notas_solicitud: requestEditData.notas
            }).eq('id', requestEditData.id);

            if (error) throw error;
            toast({ title: 'Solicitud actualizada' });
            setIsRequestEditOpen(false);
            fetchAllData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleDeleteRequest = async () => {
        if (!requestToDelete) return;
        setDeleting(true);
        try {
            const { error } = await supabase.from('vacaciones_solicitudes').delete().eq('id', requestToDelete.id);
            if (error) throw error;
            toast({ title: 'Solicitud eliminada' });
            setRequestDeleteDialogOpen(false);
            setRequestToDelete(null);
            fetchAllData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setDeleting(false);
        }
    };

    // --- RENDER HELPERS ---

    const getBadgeConfig = (tipo) => {
        switch (tipo) {
            case 'vacaciones': return { label: 'Vacaciones', icon: Palmtree, className: 'bg-blue-100 text-blue-700 border-blue-200' };
            case 'baja': return { label: 'Baja Médica', icon: ShieldAlert, className: 'bg-red-100 text-red-700 border-red-200' };
            case 'permiso_admin': return { label: 'Permiso', icon: UserCheck, className: 'bg-purple-100 text-purple-700 border-purple-200' };
            case 'formacion': return { label: 'Formación', icon: BookOpen, className: 'bg-cyan-100 text-cyan-700 border-cyan-200' };
            default: return { label: tipo, icon: UserX, className: 'bg-gray-100 text-gray-700 border-gray-200' };
        }
    };

    if (!canManage) return <div className="p-8 text-center">Acceso Denegado</div>;

    const filteredSolicitudes = solicitudesFilter === 'pendiente'
        ? solicitudes.filter(s => s.estado === 'pendiente')
        : solicitudes;

    return (
        <div className="p-4 md:p-8 space-y-6 w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <UserX className="w-8 h-8 text-primary" /> Centro de Ausencias
                    </h1>
                    <p className="text-muted-foreground">Gestión de solicitudes y registro oficial de bajas/vacaciones.</p>
                </div>
            </div>

            {/* FILTROS GLOBALES */}
            <div className="bg-card p-4 rounded-lg border shadow-sm flex flex-col md:flex-row gap-4 items-end md:items-center mb-6">
                <div className="w-full md:w-64 relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar..."
                        className="pl-9"
                        value={filters.search}
                        onChange={(e) => setFilters(p => ({ ...p, search: e.target.value }))}
                    />
                </div>
                <div className="w-full md:w-48">
                    <Select value={filters.empleadoId} onValueChange={(v) => setFilters(p => ({ ...p, empleadoId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Empleado" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los empleados</SelectItem>
                            {empleados.map(e => (
                                // Guardrail: Ensure value is not empty
                                <SelectItem key={e.id} value={e.id || "unknown"}>{e.display_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button variant="ghost" size="icon" onClick={fetchAllData} disabled={loading} title="Recargar">
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </Button>
            </div>

            <Tabs defaultValue="solicitudes" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="solicitudes" className="relative">
                        Gestión de Solicitudes
                        {solicitudes.filter(s => s.estado === 'pendiente').length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">
                                {solicitudes.filter(s => s.estado === 'pendiente').length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="registros">Registros Oficiales</TabsTrigger>
                </TabsList>

                {/* TAB 1: SOLICITUDES */}
                <TabsContent value="solicitudes" className="space-y-4">
                    <div className="flex justify-between items-center bg-muted/30 p-2 rounded-lg border">
                        <div className="flex gap-2">
                            <Button
                                variant={solicitudesFilter === 'pendiente' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setSolicitudesFilter('pendiente')}
                            >
                                Pendientes ({solicitudes.filter(s => s.estado === 'pendiente').length})
                            </Button>
                            <Button
                                variant={solicitudesFilter === 'all' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setSolicitudesFilter('all')}
                            >
                                Historial Completo ({solicitudes.length})
                            </Button>
                        </div>
                    </div>

                    <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha Petición</TableHead>
                                    <TableHead>Empleado</TableHead>
                                    <TableHead>Fechas Solicitadas</TableHead>
                                    <TableHead className="text-center">Días</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Notas</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
                                ) : filteredSolicitudes.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No hay solicitudes en esta vista.</TableCell></TableRow>
                                ) : (
                                    filteredSolicitudes.map(sol => (
                                        <TableRow key={sol.id}>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {format(new Date(sol.created_at), 'dd/MM/yyyy')}
                                            </TableCell>
                                            <TableCell className="font-medium">{sol.empleado_nombre}</TableCell>
                                            <TableCell>
                                                {format(new Date(sol.fecha_inicio), 'dd MMM')} - {format(new Date(sol.fecha_fin), 'dd MMM yyyy', { locale: es })}
                                            </TableCell>
                                            <TableCell className="text-center font-bold">{sol.dias_solicitados}</TableCell>
                                            <TableCell>
                                                {sol.estado === 'pendiente' && <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendiente</Badge>}
                                                {sol.estado === 'aprobada' && <Badge className="bg-green-100 text-green-700 border-green-200">Aprobada</Badge>}
                                                {sol.estado === 'rechazada' && <Badge className="bg-red-100 text-red-700 border-red-200">Rechazada</Badge>}
                                            </TableCell>
                                            <TableCell className="text-xs max-w-[150px] truncate text-muted-foreground" title={sol.notas_solicitud}>
                                                {sol.notas_solicitud || '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    {sol.estado === 'pendiente' ? (
                                                        <>
                                                            <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-white" onClick={() => setActionDialog({ isOpen: true, type: 'approve', solicitud: sol })}>
                                                                Aprobar
                                                            </Button>
                                                            <Button size="sm" variant="destructive" className="h-7" onClick={() => setActionDialog({ isOpen: true, type: 'reject', solicitud: sol })}>
                                                                Rechazar
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditRequest(sol)}>
                                                                <Edit className="w-3 h-3" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <div className="flex gap-1">
                                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditRequest(sol)}>
                                                                <Edit className="w-3 h-3" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { setRequestToDelete(sol); setRequestDeleteDialogOpen(true); }}>
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                {/* TAB 2: REGISTROS OFICIALES (OLD LOGIC) */}
                <TabsContent value="registros" className="space-y-4">
                    <div className="flex justify-between">
                        <div className="w-full md:w-48">
                            <Select value={filters.type} onValueChange={(v) => setFilters(p => ({ ...p, type: v }))}>
                                <SelectTrigger><SelectValue placeholder="Tipo de Ausencia" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los tipos</SelectItem>
                                    <SelectItem value="baja">Baja Médica</SelectItem>
                                    <SelectItem value="vacaciones">Vacaciones</SelectItem>
                                    <SelectItem value="permiso_admin">Permiso</SelectItem>
                                    <SelectItem value="formacion">Formación</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={() => handleOpenModal()}>
                            <Plus className="w-4 h-4 mr-2" /> Registrar Directamente
                        </Button>
                    </div>

                    <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Empleado</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Fechas</TableHead>
                                    <TableHead className="text-center">Días</TableHead>
                                    <TableHead>Notas</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
                                ) : ausencias.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No se encontraron registros.</TableCell></TableRow>
                                ) : (
                                    ausencias.map(ausencia => {
                                        const badgeInfo = getBadgeConfig(ausencia.tipo);
                                        const Icon = badgeInfo.icon;
                                        const days = differenceInDays(new Date(ausencia.fecha_fin), new Date(ausencia.fecha_inicio)) + 1;

                                        return (
                                            <TableRow key={ausencia.id}>
                                                <TableCell className="font-medium">
                                                    {ausencia.empleado?.nombre} {ausencia.empleado?.apellidos}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn("flex w-fit items-center gap-1", badgeInfo.className)}>
                                                        <Icon className="w-3 h-3" /> {badgeInfo.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {format(new Date(ausencia.fecha_inicio), 'dd/MM/yy')} - {format(new Date(ausencia.fecha_fin), 'dd/MM/yy')}
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-muted-foreground">
                                                    {days}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                                    {ausencia.notas || '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenModal(ausencia)}>
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ isOpen: true, id: ausencia.id })}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>

            {/* MODAL APPROVE/REJECT */}
            <Dialog open={actionDialog.isOpen} onOpenChange={(o) => { if (!o) { setActionDialog({ isOpen: false, type: null, solicitud: null }); setActionNote(''); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actionDialog.type === 'approve' ? 'Aprobar Solicitud' : 'Rechazar Solicitud'}
                        </DialogTitle>
                        <DialogDescription>
                            {actionDialog.type === 'approve'
                                ? `Esta acción creará el registro de ausencia oficial y descontará ${actionDialog.solicitud?.dias_solicitados} días del saldo.`
                                : 'La solicitud será marcada como rechazada y se notificará al empleado.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Notas de respuesta (Opcional)</Label>
                        <Textarea
                            placeholder={actionDialog.type === 'reject' ? "Motivo del rechazo..." : "Observaciones..."}
                            value={actionNote}
                            onChange={(e) => setActionNote(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setActionDialog({ isOpen: false, type: null, solicitud: null })}>Cancelar</Button>
                        <Button
                            variant={actionDialog.type === 'reject' ? 'destructive' : 'default'}
                            className={actionDialog.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                            onClick={handleProcessRequest}
                            disabled={processingAction}
                        >
                            {processingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {actionDialog.type === 'approve' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL EDIT REQUEST */}
            <Dialog open={isRequestEditOpen} onOpenChange={setIsRequestEditOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Editar Solicitud</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Fechas</Label>
                            <div className="border rounded-md p-2 flex justify-center">
                                <Calendar
                                    mode="range"
                                    selected={requestEditData.range}
                                    onSelect={(r) => setRequestEditData(p => ({ ...p, range: r || { from: undefined, to: undefined } }))}
                                    locale={es}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Notas</Label>
                            <Textarea value={requestEditData.notas} onChange={(e) => setRequestEditData(p => ({ ...p, notas: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRequestEditOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveRequestEdit} disabled={processingAction}>
                            {processingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL DIRECT CREATE/EDIT (ABSENCE) */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Editar Registro Oficial' : 'Registrar Ausencia Directa'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Empleado</Label>
                            <Select
                                value={formData.empleado_id}
                                onValueChange={(v) => setFormData(p => ({ ...p, empleado_id: v }))}
                                disabled={isEditing}
                            >
                                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>
                                    {empleados.map(e => (
                                        // Guardrail: Ensure value is not empty
                                        <SelectItem key={e.id} value={e.id || "unknown"}>{e.display_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={formData.tipo} onValueChange={(v) => setFormData(p => ({ ...p, tipo: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="baja">Baja Médica</SelectItem>
                                    <SelectItem value="vacaciones">Vacaciones</SelectItem>
                                    <SelectItem value="permiso_admin">Permiso</SelectItem>
                                    <SelectItem value="formacion">Formación</SelectItem>
                                </SelectContent>
                            </Select>
                            {formData.tipo === 'vacaciones' && (
                                <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Se descontarán días del saldo automáticamente.</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Fechas</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formData.range.from && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.range.from ? (
                                            formData.range.to ?
                                                `${format(formData.range.from, "dd/MM/yyyy")} - ${format(formData.range.to, "dd/MM/yyyy")}`
                                                : format(formData.range.from, "dd/MM/yyyy")
                                        ) : <span>Seleccionar rango</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="range"
                                        selected={formData.range}
                                        onSelect={(r) => setFormData(p => ({ ...p, range: r || { from: undefined, to: undefined } }))}
                                        numberOfMonths={2}
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>Notas</Label>
                            <Textarea
                                value={formData.notas}
                                onChange={(e) => setFormData(p => ({ ...p, notas: e.target.value }))}
                                placeholder="Detalles adicionales..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveAbsence} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DELETE CONFIRMATION (ABSENCE) */}
            <AlertDialog open={deleteDialog.isOpen} onOpenChange={(o) => !o && setDeleteDialog({ isOpen: false, id: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar registro oficial?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará el registro de ausencia permanentemente.
                            Si es 'Vacaciones', los días se devolverán al saldo.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAbsence} className="bg-destructive hover:bg-destructive/90">
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* DELETE CONFIRMATION (REQUEST) */}
            <AlertDialog open={requestDeleteDialogOpen} onOpenChange={setRequestDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar solicitud?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción es irreversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteRequest} className="bg-destructive hover:bg-destructive/90">
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default AdminAusencias;