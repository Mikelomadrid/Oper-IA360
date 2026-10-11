import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/components/ui/use-toast';
import {
    Loader2, Palmtree, ShieldAlert, BookOpen, UserCheck, UserX,
    CheckCircle2, XCircle, Clock, Calendar as CalendarIcon, Plus, AlertTriangle, Building2
} from 'lucide-react';
import { format, differenceInDays, isWithinInterval, parseISO, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const EmployeeAusencias = () => {
    const { empleadoId, sessionRole } = useAuth();
    const isAdmin = sessionRole?.rol === 'admin';

    const [loading, setLoading] = useState(true);
    const [saldoVacaciones, setSaldoVacaciones] = useState(null);
    const [ausencias, setAusencias] = useState([]);
    const [solicitudes, setSolicitudes] = useState([]);
    const [pendientesEmpleados, setPendientesEmpleados] = useState([]);
    const [procesando, setProcesando] = useState(null);
    const [actionDialog, setActionDialog] = useState({ open: false, type: null, sol: null });
    const [actionNote, setActionNote] = useState('');

    // Lista de empleados (para que el admin pueda registrar ausencias a terceros)
    const [empleados, setEmpleados] = useState([]);

    // Cierres de empresa
    const [cierresEmpresa, setCierresEmpresa] = useState([]);

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [modalData, setModalData] = useState({ range: { from: undefined, to: undefined }, notas: '', tipo: 'vacaciones', empleadoId: '' });
    const [errorCierre, setErrorCierre] = useState(null);

    // Solo roles internos que de verdad registran ausencias
    const empleadosRegistrables = empleados.filter(e => ['admin', 'encargado', 'tecnico'].includes(e.rol));

    // ── Cargar lista de empleados (solo admin) ──
    const fetchEmpleados = useCallback(async () => {
        if (!isAdmin) return;
        const { data } = await supabase
            .from('v_empleados_selector')
            .select('id, display_name, rol')
            .order('display_name');
        setEmpleados(data || []);
    }, [isAdmin]);

    // ── Cargar cierres de empresa ──
    const fetchCierres = useCallback(async () => {
        const { data } = await supabase
            .from('vacaciones_empresa')
            .select('*')
            .eq('activo', true)
            .order('fecha_inicio', { ascending: true });
        setCierresEmpresa(data || []);
    }, []);

    // ── Carga de datos propios ──
    const fetchData = useCallback(async () => {
        if (!empleadoId) return;
        setLoading(true);
        try {
            const { data: empData } = await supabase.from('empleados').select('dias_vacaciones_restantes').eq('id', empleadoId).single();
            if (empData) setSaldoVacaciones(empData.dias_vacaciones_restantes ?? 30);

            const { data: dataAusencias } = await supabase.from('ausencias_empleados').select('*').eq('empleado_id', empleadoId).order('fecha_inicio', { ascending: false });
            setAusencias(dataAusencias || []);

            if (!isAdmin) {
                const { data: dataSols } = await supabase.from('vacaciones_solicitudes').select('*').eq('empleado_id', empleadoId).order('created_at', { ascending: false });
                setSolicitudes(dataSols || []);
            }
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos.' });
        } finally {
            setLoading(false);
        }
    }, [empleadoId, isAdmin]);

    // ── Carga de solicitudes pendientes (solo admin) ──
    const fetchPendientes = useCallback(async () => {
        if (!isAdmin) return;
        try {
            const { data } = await supabase.from('v_vacaciones_solicitudes').select('*').eq('estado', 'pendiente').order('created_at', { ascending: true });
            setPendientesEmpleados(data || []);
        } catch (err) { console.error(err); }
    }, [isAdmin]);

    useEffect(() => { fetchData(); fetchCierres(); fetchEmpleados(); }, [fetchData, fetchCierres, fetchEmpleados]);

    useEffect(() => {
        if (!isAdmin) return;
        fetchPendientes();
        const channel = supabase
            .channel('employee-ausencias-pendientes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vacaciones_solicitudes' }, () => {
                fetchPendientes();
                toast({ title: '🔔 Nueva solicitud de vacaciones', description: 'Un empleado ha enviado una nueva solicitud.' });
            })
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [isAdmin, fetchPendientes]);

    // ── Verificar si un rango solapa con algún cierre de empresa ──
    const getRangoSolapaCierre = useCallback((from, to) => {
        if (!from) return null;
        const rangeEnd = to || from;
        for (const cierre of cierresEmpresa) {
            const cierreStart = parseISO(cierre.fecha_inicio);
            const cierreEnd = parseISO(cierre.fecha_fin);
            // Hay solapamiento si: rangeStart <= cierreEnd && rangeEnd >= cierreStart
            if (from <= cierreEnd && rangeEnd >= cierreStart) {
                return cierre;
            }
        }
        return null;
    }, [cierresEmpresa]);

    // ── Cuando cambia el rango en el modal, validar contra cierres ──
    const handleRangeChange = (range) => {
        const newRange = range || { from: undefined, to: undefined };
        setModalData(prev => ({ ...prev, range: newRange }));
        if (newRange.from) {
            const cierre = getRangoSolapaCierre(newRange.from, newRange.to);
            setErrorCierre(cierre || null);
        } else {
            setErrorCierre(null);
        }
    };

    // ── Días bloqueados en el calendario: pasados + cierres de empresa ──
    const isDayDisabled = (date) => {
        const today = new Date(new Date().setHours(0, 0, 0, 0));
        if (date < today) return true;
        // Comprobar si cae dentro de algún cierre
        for (const cierre of cierresEmpresa) {
            const cierreStart = parseISO(cierre.fecha_inicio);
            const cierreEnd = parseISO(cierre.fecha_fin);
            if (isWithinInterval(date, { start: cierreStart, end: cierreEnd })) return true;
        }
        return false;
    };

    // ── Aprobar / Rechazar (admin) ──
    const handleProcesarSolicitud = async () => {
        if (!actionDialog.sol) return;
        setProcesando(actionDialog.sol.id);
        try {
            const { data, error } = await supabase.rpc('process_vacation_request', {
                p_request_id: actionDialog.sol.id,
                p_action: actionDialog.type,
                p_admin_id: sessionRole?.id || null,
                p_response_notes: actionNote,
            });
            if (error) throw error;
            if (!data.success) throw new Error(data.message);
            toast({ title: actionDialog.type === 'approve' ? '✅ Solicitud aprobada' : '❌ Solicitud rechazada' });
            setActionDialog({ open: false, type: null, sol: null });
            setActionNote('');
            fetchPendientes();
            fetchData();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setProcesando(null);
        }
    };

    // ── Admin: registrar ausencia (propia o de cualquier empleado) ──
    const handleAdminRegistrar = async () => {
        const targetId = modalData.empleadoId || empleadoId;
        if (!targetId) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Selecciona el empleado.' });
            return;
        }
        if (!modalData.range?.from) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Selecciona las fechas.' });
            return;
        }
        const from = modalData.range.from;
        const to = modalData.range.to || from;
        const days = differenceInDays(to, from) + 1;
        const target = empleados.find(e => e.id === targetId);
        const targetNombre = target?.display_name?.trim() || 'el empleado';
        const esOtro = targetId !== empleadoId;
        setSubmitting(true);
        try {
            if (modalData.tipo === 'vacaciones') {
                await supabase.rpc('increment_vacation_balance', { p_empleado_id: targetId, p_days: -days });
            }
            const { error } = await supabase.from('ausencias_empleados').insert({
                empleado_id: targetId,
                tipo: modalData.tipo,
                fecha_inicio: format(from, 'yyyy-MM-dd'),
                fecha_fin: format(to, 'yyyy-MM-dd'),
                notas: modalData.notas,
                admin_id: sessionRole?.id || null,
            });
            if (error) throw error;
            toast({
                title: 'Ausencia registrada correctamente',
                description: esOtro ? `Registrada para ${targetNombre}. Aparecerá en su ficha y en el Centro de Ausencias.` : undefined,
            });
            setIsModalOpen(false);
            setModalData({ range: { from: undefined, to: undefined }, notas: '', tipo: 'vacaciones', empleadoId: empleadoId || '' });
            setErrorCierre(null);
            fetchData();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    // ── Empleado: crear solicitud pendiente ──
    const handleEmpleadoSolicitar = async () => {
        if (!modalData.range?.from) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Selecciona las fechas.' });
            return;
        }
        // Bloqueo por cierre de empresa
        if (errorCierre) {
            toast({
                variant: 'destructive',
                title: 'Fechas no disponibles',
                description: `Esas fechas corresponden al cierre de empresa: "${errorCierre.nombre}". Ya tienes esos días registrados automáticamente.`,
            });
            return;
        }
        const from = modalData.range.from;
        const to = modalData.range.to || from;
        const days = differenceInDays(to, from) + 1;
        if (days <= 0) { toast({ variant: 'destructive', title: 'Rango inválido' }); return; }
        setSubmitting(true);
        try {
            const { error } = await supabase.from('vacaciones_solicitudes').insert({
                empleado_id: empleadoId,
                fecha_inicio: format(from, 'yyyy-MM-dd'),
                fecha_fin: format(to, 'yyyy-MM-dd'),
                dias_solicitados: days,
                notas_solicitud: modalData.notas,
                estado: 'pendiente',
            });
            if (error) throw error;
            toast({ title: 'Solicitud enviada', description: 'Quedará pendiente de aprobación.' });
            setIsModalOpen(false);
            setModalData({ range: { from: undefined, to: undefined }, notas: '', tipo: 'vacaciones', empleadoId: empleadoId || '' });
            setErrorCierre(null);
            fetchData();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const getBadgeConfig = (tipo) => {
        switch (tipo) {
            case 'vacaciones':         return { label: 'Vacaciones',        icon: Palmtree,    className: 'bg-blue-100 text-blue-700 border-blue-200' };
            case 'vacaciones_empresa': return { label: 'Cierre empresa',    icon: Building2,   className: 'bg-orange-100 text-orange-700 border-orange-200' };
            case 'baja':               return { label: 'Baja Médica',       icon: ShieldAlert,  className: 'bg-red-100 text-red-700 border-red-200' };
            case 'permiso_admin':      return { label: 'Permiso',           icon: UserCheck,    className: 'bg-purple-100 text-purple-700 border-purple-200' };
            case 'formacion':          return { label: 'Formación',         icon: BookOpen,     className: 'bg-cyan-100 text-cyan-700 border-cyan-200' };
            case 'sin_justificar':     return { label: 'Sin Justificar',    icon: AlertTriangle, className: 'bg-amber-100 text-amber-700 border-amber-200' };
            default:                   return { label: tipo,                icon: UserX,        className: 'bg-gray-100 text-gray-700 border-gray-200' };
        }
    };

    const getStatusBadge = (estado) => {
        switch (estado) {
            case 'aprobada':  return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Aprobada</Badge>;
            case 'rechazada': return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rechazada</Badge>;
            default:          return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 animate-pulse"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    const diasSeleccionados = modalData.range?.from
        ? (modalData.range?.to ? differenceInDays(modalData.range.to, modalData.range.from) + 1 : 1)
        : 0;

    const registrandoOtro = isAdmin && modalData.empleadoId && modalData.empleadoId !== empleadoId;

    return (
        <div className="p-6 w-full">

            {/* Cabecera */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full mb-6">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Palmtree className="w-8 h-8 text-primary" />
                        {isAdmin ? 'Mis Ausencias' : 'Gestión de Ausencias'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isAdmin ? 'Registra ausencias propias o del equipo y gestiona las solicitudes.' : 'Consulta tu historial y solicita tus vacaciones.'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Card className="bg-primary/5 border-primary/20 min-w-[200px]">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="bg-background p-2 rounded-full shadow-sm"><Palmtree className="w-5 h-5 text-primary" /></div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo</p>
                                <p className="text-2xl font-bold">{saldoVacaciones} <span className="text-sm font-normal text-muted-foreground">días</span></p>
                            </div>
                        </CardContent>
                    </Card>
                    <Button onClick={() => { setErrorCierre(null); setModalData(p => ({ ...p, empleadoId: empleadoId || '' })); setIsModalOpen(true); }} size="lg">
                        <Plus className="w-4 h-4 mr-2" />
                        {isAdmin ? 'Registrar ausencia' : 'Nueva solicitud'}
                    </Button>
                </div>
            </div>

            {/* ── BANNER CIERRES DE EMPRESA (visible para empleados) ── */}
            {!isAdmin && cierresEmpresa.length > 0 && (
                <div className="mb-6 rounded-xl border border-orange-300 bg-orange-50 dark:bg-orange-900/20 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-orange-600 shrink-0" />
                        <span className="font-semibold text-orange-800 dark:text-orange-200 text-sm">Periodos de cierre de empresa</span>
                    </div>
                    <ul className="space-y-0.5">
                        {cierresEmpresa.map(c => (
                            <li key={c.id} className="text-xs text-orange-700 dark:text-orange-300 flex items-center gap-1">
                                <span className="font-medium">{c.nombre}:</span>
                                {format(parseISO(c.fecha_inicio), "d 'de' MMMM", { locale: es })} – {format(parseISO(c.fecha_fin), "d 'de' MMMM yyyy", { locale: es })}
                                <span className="text-orange-500 ml-1">(ya registradas automáticamente, no cuentan como días personales)</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* ── SOLICITUDES PENDIENTES DE EMPLEADOS (solo admin) ── */}
            {isAdmin && (
                pendientesEmpleados.length > 0 ? (
                    <div className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20 overflow-hidden shadow-sm">
                        <div className="flex items-center gap-3 px-4 py-3 bg-amber-400/20 border-b border-amber-300">
                            <span className="text-lg animate-bounce">🔔</span>
                            <span className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                                {pendientesEmpleados.length} solicitud{pendientesEmpleados.length > 1 ? 'es' : ''} de vacaciones pendiente{pendientesEmpleados.length > 1 ? 's' : ''} de resolución
                            </span>
                        </div>
                        <div className="divide-y divide-amber-200">
                            {pendientesEmpleados.map(sol => (
                                <div key={sol.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-semibold text-amber-900 dark:text-amber-100 text-sm">{sol.empleado_nombre}</span>
                                        <span className="text-xs text-amber-700 dark:text-amber-300">
                                            {format(new Date(sol.fecha_inicio), 'd MMM', { locale: es })} – {format(new Date(sol.fecha_fin), 'd MMM yyyy', { locale: es })}
                                            {' · '}<strong>{sol.dias_solicitados} día{sol.dias_solicitados !== 1 ? 's' : ''}</strong>
                                        </span>
                                        {sol.notas_solicitud && <span className="text-xs text-amber-600 italic">"{sol.notas_solicitud}"</span>}
                                        <span className="text-[10px] text-amber-500">Solicitado el {format(new Date(sol.created_at), 'dd/MM/yyyy')}</span>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8 px-3 text-xs" disabled={procesando === sol.id}
                                            onClick={() => setActionDialog({ open: true, type: 'approve', sol })}>
                                            {procesando === sol.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓ Aprobar'}
                                        </Button>
                                        <Button size="sm" variant="destructive" className="h-8 px-3 text-xs" disabled={procesando === sol.id}
                                            onClick={() => setActionDialog({ open: true, type: 'reject', sol })}>
                                            ✕ Rechazar
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl border border-green-200 bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300 text-sm">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        No hay solicitudes pendientes del equipo.
                    </div>
                )
            )}

            {/* ── HISTORIAL PROPIO DEL ADMIN ── */}
            {isAdmin && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Mis ausencias registradas</CardTitle>
                        <CardDescription>Vacaciones y ausencias registradas directamente.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Fechas</TableHead>
                                    <TableHead className="text-center">Días</TableHead>
                                    <TableHead>Notas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ausencias.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground">No hay ausencias registradas todavía.</TableCell></TableRow>
                                ) : (
                                    ausencias.map(a => {
                                        const badge = getBadgeConfig(a.tipo);
                                        const Icon = badge.icon;
                                        const days = differenceInDays(new Date(a.fecha_fin), new Date(a.fecha_inicio)) + 1;
                                        return (
                                            <TableRow key={a.id}>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn("flex w-fit items-center gap-1", badge.className)}>
                                                        <Icon className="w-3 h-3" /> {badge.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                                                        {format(new Date(a.fecha_inicio), 'dd/MM/yyyy')} – {format(new Date(a.fecha_fin), 'dd/MM/yyyy')}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-semibold">{days} días</TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">{a.notas || '–'}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* ── VISTA EMPLEADO: solicitudes + historial ── */}
            {!isAdmin && (
                <Tabs defaultValue="solicitudes" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="solicitudes">Mis Solicitudes de Vacaciones</TabsTrigger>
                        <TabsTrigger value="historial">Historial Oficial de Ausencias</TabsTrigger>
                    </TabsList>

                    <TabsContent value="solicitudes" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Estado de Solicitudes</CardTitle>
                                <CardDescription>Seguimiento de tus peticiones enviadas a administración.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha Solicitud</TableHead>
                                            <TableHead>Fechas Deseadas</TableHead>
                                            <TableHead className="text-center">Días</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Comentarios</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {solicitudes.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No has realizado ninguna solicitud todavía.</TableCell></TableRow>
                                        ) : (
                                            solicitudes.map(sol => (
                                                <TableRow key={sol.id} className={sol.estado === 'pendiente' ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}>
                                                    <TableCell className="text-muted-foreground text-xs">{format(new Date(sol.created_at), 'dd/MM/yyyy')}</TableCell>
                                                    <TableCell className="font-medium">
                                                        {format(new Date(sol.fecha_inicio), 'd MMM')} – {format(new Date(sol.fecha_fin), 'd MMM yyyy', { locale: es })}
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold">{sol.dias_solicitados}</TableCell>
                                                    <TableCell>{getStatusBadge(sol.estado)}</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground italic">{sol.notas_solicitud || '–'}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="historial">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Registro Oficial</CardTitle>
                                <CardDescription>Bajas médicas, permisos y vacaciones confirmadas.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Fechas</TableHead>
                                            <TableHead className="text-center">Duración</TableHead>
                                            <TableHead>Notas</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {ausencias.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground">No hay registros oficiales en tu historial.</TableCell></TableRow>
                                        ) : (
                                            ausencias.map(a => {
                                                const badge = getBadgeConfig(a.tipo);
                                                const Icon = badge.icon;
                                                const days = differenceInDays(new Date(a.fecha_fin), new Date(a.fecha_inicio)) + 1;
                                                return (
                                                    <TableRow key={a.id} className={a.tipo === 'vacaciones_empresa' ? 'bg-orange-50/40 dark:bg-orange-900/10' : ''}>
                                                        <TableCell>
                                                            <Badge variant="outline" className={cn("flex w-fit items-center gap-1", badge.className)}>
                                                                <Icon className="w-3 h-3" /> {badge.label}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                                                                {format(new Date(a.fecha_inicio), 'dd/MM/yyyy')} – {format(new Date(a.fecha_fin), 'dd/MM/yyyy')}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center font-semibold">{days} días</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">{a.notas || '–'}</TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}

            {/* ── MODAL APROBAR/RECHAZAR ── */}
            <Dialog open={actionDialog.open} onOpenChange={o => { if (!o) { setActionDialog({ open: false, type: null, sol: null }); setActionNote(''); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{actionDialog.type === 'approve' ? '✅ Aprobar solicitud' : '❌ Rechazar solicitud'}</DialogTitle>
                        <DialogDescription>
                            {actionDialog.type === 'approve'
                                ? `Se registrarán ${actionDialog.sol?.dias_solicitados} días de vacaciones para ${actionDialog.sol?.empleado_nombre} y se descontarán de su saldo.`
                                : `La solicitud de ${actionDialog.sol?.empleado_nombre} será marcada como rechazada.`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Nota de respuesta (opcional)</Label>
                        <Textarea className="mt-2" placeholder={actionDialog.type === 'reject' ? 'Motivo del rechazo...' : 'Observaciones...'} value={actionNote} onChange={e => setActionNote(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setActionDialog({ open: false, type: null, sol: null }); setActionNote(''); }}>Cancelar</Button>
                        <Button
                            className={actionDialog.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                            variant={actionDialog.type === 'reject' ? 'destructive' : 'default'}
                            onClick={handleProcesarSolicitud}
                            disabled={!!procesando}
                        >
                            {procesando && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
                            {actionDialog.type === 'approve' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── MODAL NUEVA AUSENCIA / SOLICITUD ── */}
            <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) setErrorCierre(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isAdmin ? '📅 Registrar ausencia' : '🏖 Solicitar vacaciones'}</DialogTitle>
                        <DialogDescription>
                            {isAdmin
                                ? 'Como administrador, la ausencia se registra directamente sin necesidad de aprobación.'
                                : 'Tu solicitud quedará pendiente hasta que administración la apruebe o rechace.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {isAdmin && (
                            <div className="space-y-2">
                                <Label>Empleado</Label>
                                <Select value={modalData.empleadoId} onValueChange={v => setModalData(p => ({ ...p, empleadoId: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar empleado..." /></SelectTrigger>
                                    <SelectContent>
                                        {empleadosRegistrables.map(e => (
                                            <SelectItem key={e.id} value={e.id || 'unknown'}>
                                                {e.display_name?.trim()}{e.id === empleadoId ? ' (yo)' : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {isAdmin && (
                            <div className="space-y-2">
                                <Label>Tipo de ausencia</Label>
                                <Select value={modalData.tipo} onValueChange={v => setModalData(p => ({ ...p, tipo: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="vacaciones">Vacaciones</SelectItem>
                                        <SelectItem value="baja">Baja Médica</SelectItem>
                                        <SelectItem value="permiso_admin">Permiso</SelectItem>
                                        <SelectItem value="formacion">Formación</SelectItem>
                                        <SelectItem value="sin_justificar">Sin Justificar</SelectItem>
                                    </SelectContent>
                                </Select>
                                {modalData.tipo === 'vacaciones' && (
                                    <p className="text-xs text-amber-600 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        {registrandoOtro
                                            ? 'Se descontarán días del saldo del empleado seleccionado.'
                                            : 'Se descontarán días de tu saldo automáticamente.'}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Aviso de cierres dentro del modal (solo empleados) */}
                        {!isAdmin && cierresEmpresa.length > 0 && (
                            <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                                <Building2 className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                                <div className="text-xs text-orange-700">
                                    <span className="font-semibold">Días bloqueados por cierre de empresa:</span>
                                    {cierresEmpresa.map(c => (
                                        <span key={c.id} className="block">
                                            {c.nombre}: {format(parseISO(c.fecha_inicio), "d MMM", { locale: es })} – {format(parseISO(c.fecha_fin), "d MMM yyyy", { locale: es })}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Fechas</Label>
                            <div className="border rounded-md p-2 flex justify-center">
                                <Calendar
                                    mode="range"
                                    selected={modalData.range}
                                    onSelect={handleRangeChange}
                                    numberOfMonths={1}
                                    locale={es}
                                    disabled={isDayDisabled}
                                />
                            </div>

                            {/* Error de solapamiento con cierre */}
                            {errorCierre && (
                                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-300 px-3 py-2">
                                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                    <div className="text-xs text-red-700">
                                        <p className="font-semibold">Fechas no disponibles</p>
                                        <p>Las fechas seleccionadas incluyen el periodo de <strong>{errorCierre.nombre}</strong> ({format(parseISO(errorCierre.fecha_inicio), "d MMM", { locale: es })} – {format(parseISO(errorCierre.fecha_fin), "d MMM yyyy", { locale: es })}). Esos días ya están registrados automáticamente y no cuentan como días personales.</p>
                                    </div>
                                </div>
                            )}

                            {diasSeleccionados > 0 && !errorCierre && (
                                <p className="text-sm text-center font-medium text-primary">
                                    {modalData.range?.from && format(modalData.range.from, 'd MMM', { locale: es })}
                                    {modalData.range?.to && modalData.range.to !== modalData.range.from && ` – ${format(modalData.range.to, 'd MMM yyyy', { locale: es })}`}
                                    {' · '}<strong>{diasSeleccionados} día{diasSeleccionados !== 1 ? 's' : ''}</strong>
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Comentario (opcional)</Label>
                            <Textarea placeholder={isAdmin ? 'Notas internas...' : 'Motivo, detalles...'} value={modalData.notas} onChange={(e) => setModalData(p => ({ ...p, notas: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsModalOpen(false); setErrorCierre(null); }}>Cancelar</Button>
                        <Button
                            onClick={isAdmin ? handleAdminRegistrar : handleEmpleadoSolicitar}
                            disabled={submitting || !modalData.range?.from || !!errorCierre || (isAdmin && !modalData.empleadoId)}
                            className={isAdmin ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isAdmin ? 'Registrar directamente' : 'Enviar solicitud'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default EmployeeAusencias;
