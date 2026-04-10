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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/components/ui/use-toast';
import {
    Loader2, Palmtree, ShieldAlert, BookOpen, UserCheck, UserX,
    CalendarPlus, Info, CheckCircle2, XCircle, Clock, Calendar as CalendarIcon,
    Plus
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const EmployeeAusencias = () => {
    const { user, empleadoId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saldoVacaciones, setSaldoVacaciones] = useState(null);
    const [ausencias, setAusencias] = useState([]);
    const [solicitudes, setSolicitudes] = useState([]);

    // Request Modal State
    const [isRequestOpen, setIsRequestOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [requestData, setRequestData] = useState({
        range: { from: undefined, to: undefined },
        notas: ''
    });

    const fetchData = useCallback(async () => {
        if (!empleadoId) return;
        setLoading(true);
        try {
            // 1. Get Employee Balance
            const { data: empData } = await supabase
                .from('empleados')
                .select('dias_vacaciones_restantes')
                .eq('id', empleadoId)
                .single();

            if (empData) {
                setSaldoVacaciones(empData.dias_vacaciones_restantes ?? 30);
            }

            // 2. Get Official Absences (Approved/Registered)
            const { data: dataAusencias, error: errAus } = await supabase
                .from('ausencias_empleados')
                .select('*')
                .eq('empleado_id', empleadoId)
                .order('fecha_inicio', { ascending: false });

            if (errAus) throw errAus;
            setAusencias(dataAusencias || []);

            // 3. Get Vacation Requests
            const { data: dataSols, error: errSol } = await supabase
                .from('vacaciones_solicitudes')
                .select('*')
                .eq('empleado_id', empleadoId)
                .order('created_at', { ascending: false });

            if (errSol) throw errSol;
            setSolicitudes(dataSols || []);

        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos.' });
        } finally {
            setLoading(false);
        }
    }, [empleadoId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSubmitRequest = async () => {
        if (!requestData.range?.from) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Debes seleccionar al menos una fecha de inicio.' });
            return;
        }

        const from = requestData.range.from;
        const to = requestData.range.to || from;
        const days = differenceInDays(to, from) + 1;

        if (days <= 0) {
            toast({ variant: 'destructive', title: 'Rango inválido', description: 'La fecha fin debe ser posterior a la de inicio.' });
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase.from('vacaciones_solicitudes').insert({
                empleado_id: empleadoId,
                fecha_inicio: format(from, 'yyyy-MM-dd'),
                fecha_fin: format(to, 'yyyy-MM-dd'),
                dias_solicitados: days,
                notas_solicitud: requestData.notas,
                estado: 'pendiente'
            });

            if (error) throw error;

            toast({ title: 'Solicitud enviada', description: 'Tu solicitud de vacaciones ha sido registrada.' });
            setIsRequestOpen(false);
            setRequestData({ range: { from: undefined, to: undefined }, notas: '' });
            fetchData(); // Refresh lists
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al solicitar', description: error.message });
        } finally {
            setSubmitting(false);
        }
    };

    const getBadgeConfig = (tipo) => {
        switch (tipo) {
            case 'vacaciones': return { label: 'Vacaciones', icon: Palmtree, className: 'bg-blue-100 text-blue-700 border-blue-200' };
            case 'baja': return { label: 'Baja Médica', icon: ShieldAlert, className: 'bg-red-100 text-red-700 border-red-200' };
            case 'permiso_admin': return { label: 'Permiso', icon: UserCheck, className: 'bg-purple-100 text-purple-700 border-purple-200' };
            case 'formacion': return { label: 'Formación', icon: BookOpen, className: 'bg-cyan-100 text-cyan-700 border-cyan-200' };
            default: return { label: tipo, icon: UserX, className: 'bg-gray-100 text-gray-700 border-gray-200' };
        }
    };

    const getStatusBadge = (estado) => {
        switch (estado) {
            case 'aprobada': return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Aprobada</Badge>;
            case 'rechazada': return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rechazada</Badge>;
            default: return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <div className="p-6 w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Palmtree className="w-8 h-8 text-primary" /> Gestión de Ausencias
                    </h1>
                    <p className="text-muted-foreground">Consulta tu historial y solicita tus vacaciones.</p>
                </div>

                <Card className="bg-primary/5 border-primary/20 w-full md:w-auto min-w-[250px]">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-background p-2 rounded-full shadow-sm"><Palmtree className="w-5 h-5 text-primary" /></div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo Disponible</p>
                                <p className="text-2xl font-bold text-foreground">{saldoVacaciones} <span className="text-sm font-normal text-muted-foreground">días</span></p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="solicitudes" className="w-full mt-6">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="solicitudes">Mis Solicitudes de Vacaciones</TabsTrigger>
                    <TabsTrigger value="historial">Historial Oficial de Ausencias</TabsTrigger>
                </TabsList>

                <TabsContent value="solicitudes" className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => setIsRequestOpen(true)} className="shadow-sm">
                            <Plus className="w-4 h-4 mr-2" /> Nueva Solicitud
                        </Button>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Estado de Solicitudes</CardTitle>
                            <CardDescription>Seguimiento de tus peticiones de vacaciones enviadas a administración.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha Solicitud</TableHead>
                                        <TableHead>Fechas Deseadas</TableHead>
                                        <TableHead className="text-center">Días</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Comentarios Admin</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {solicitudes.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No has realizado ninguna solicitud todavía.</TableCell></TableRow>
                                    ) : (
                                        solicitudes.map(sol => (
                                            <TableRow key={sol.id}>
                                                <TableCell className="text-muted-foreground text-xs">
                                                    {format(new Date(sol.created_at), 'dd/MM/yyyy')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">
                                                        {format(new Date(sol.fecha_inicio), 'd MMM')} - {format(new Date(sol.fecha_fin), 'd MMM yyyy', { locale: es })}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-bold">
                                                    {sol.dias_solicitados}
                                                </TableCell>
                                                <TableCell>
                                                    {getStatusBadge(sol.estado)}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground italic">
                                                    {sol.notas_solicitud || '-'}
                                                </TableCell>
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
                            <CardDescription>Bajas médicas, permisos y vacaciones ya disfrutadas o confirmadas.</CardDescription>
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
                                                <TableRow key={a.id}>
                                                    <TableCell>
                                                        <Badge variant="outline" className={cn("flex w-fit items-center gap-1", badge.className)}>
                                                            <Icon className="w-3 h-3" /> {badge.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                                                            {format(new Date(a.fecha_inicio), 'dd/MM/yyyy')} - {format(new Date(a.fecha_fin), 'dd/MM/yyyy')}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-semibold">
                                                        {days} días
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
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
            </Tabs>

            {/* MODAL NUEVA SOLICITUD */}
            <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Solicitar Vacaciones</DialogTitle>
                        <DialogDescription>
                            Envía una petición de vacaciones para aprobación.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Fechas Deseadas</Label>
                            <div className="border rounded-md p-2 flex justify-center">
                                <Calendar
                                    mode="range"
                                    selected={requestData.range}
                                    onSelect={(range) => setRequestData(prev => ({ ...prev, range: range || { from: undefined, to: undefined } }))}
                                    numberOfMonths={1}
                                    locale={es}
                                    disabled={(date) => date < new Date()}
                                />
                            </div>
                            {requestData.range?.from && (
                                <p className="text-sm text-center font-medium text-primary">
                                    Del {format(requestData.range.from, 'd MMM')} al {requestData.range.to ? format(requestData.range.to, 'd MMM yyyy') : '...'}
                                    {requestData.range.to && ` (${differenceInDays(requestData.range.to, requestData.range.from) + 1} días)`}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Comentario (Opcional)</Label>
                            <Textarea
                                placeholder="Motivo, detalles..."
                                value={requestData.notas}
                                onChange={(e) => setRequestData(p => ({ ...p, notas: e.target.value }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRequestOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubmitRequest} disabled={submitting || !requestData.range?.from}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enviar Solicitud
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default EmployeeAusencias;