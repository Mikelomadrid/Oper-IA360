import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CalendarCheck, CalendarPlus as CalendarIcon, PlusCircle, Trash2, Edit, UserX, Upload, Settings, ShieldCheck, Lock } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn, safeFormat } from '@/lib/utils';
import { Switch } from "@/components/ui/switch";
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
import { motion } from 'framer-motion';

const AdminCalendarView = () => {
    const { user, sessionRole } = useAuth(); // Use sessionRole instead of raw user for permissions
    const [solicitudes, setSolicitudes] = useState([]);
    const [festivos, setFestivos] = useState([]);
    const [ausencias, setAusencias] = useState([]); 
    const [empleados, setEmpleados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [employeeId, setEmployeeId] = useState(null);
    
    // Config State
    const [vacationConfig, setVacationConfig] = useState(null);
    const [companyClosures, setCompanyClosures] = useState([]);
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [closureModalOpen, setClosureModalOpen] = useState(false);
    const [closureForm, setClosureForm] = useState({ name: '', start_date: undefined, end_date: undefined, is_mandatory: true });

    const [festivoModal, setFestivoModal] = useState({ isOpen: false, isEditing: false });
    const [festivoForm, setFestivoForm] = useState({ id: null, fecha: undefined, descripcion: '', tipo: 'nacional', import_text: '' }); 
    
    const [ausenciaModal, setAusenciaModal] = useState({ isOpen: false, isEditing: false }); 
    const [ausenciaForm, setAusenciaForm] = useState({ id: null, empleado_id: '', range: { from: undefined, to: undefined }, tipo: 'baja', notas: '' }); 
    const [originalAusencia, setOriginalAusencia] = useState(null); 
    
    const [selectedEmployeeBalance, setSelectedEmployeeBalance] = useState(null);
    const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, type: null, id: null });

    const canManage = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado';

    useEffect(() => {
        const loadIds = async () => {
            if (!user) return;
            const { data: empData } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).maybeSingle();
            if (empData) setEmployeeId(empData.id);
        }
        loadIds();
    }, [user]);

    const fetchDropdowns = async () => {
        const { data: empleadosData } = await supabase.from('v_empleados_selector').select('id, display_name, email');
        setEmpleados(empleadosData || []);
    };

    const fetchConfig = async () => {
        const { data: config } = await supabase.from('vacation_config').select('*').order('effective_date', { ascending: false }).limit(1).single();
        const { data: closures } = await supabase.from('company_closures').select('*').order('start_date', { ascending: true });
        
        setVacationConfig(config);
        setCompanyClosures(closures || []);
    };

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date();
            const startStr = format(today, 'yyyy-MM-dd');
            const endOfNextYear = new Date(today.getFullYear() + 1, 11, 31);
            const endStr = format(endOfNextYear, 'yyyy-MM-dd');

            const [
                { data: solicitudesData }, { data: festivosData }, { data: ausenciasData }
            ] = await Promise.all([
                supabase.from('v_vacaciones_solicitudes').select('*').order('created_at', { ascending: false }),
                supabase.from('calendario_festivos')
                    .select('*')
                    .gte('fecha', startStr)
                    .lte('fecha', endStr)
                    .order('fecha', { ascending: true }),
                supabase.from('ausencias_empleados').select(
                    `*, empleado:v_empleados_selector!ausencias_empleados_empleado_id_fkey(display_name)`
                ).order('fecha_inicio', { ascending: true }) 
            ]);

            setSolicitudes(solicitudesData || []);
            setFestivos(festivosData || []);
            setAusencias(ausenciasData || []);
            await fetchDropdowns();
            await fetchConfig();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error cargando datos', description: error.message });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);
    
    // --- VACATION POLICY LOGIC ---
    
    const handleSaveClosure = async () => {
        if (!closureForm.name || !closureForm.start_date || !closureForm.end_date) {
            toast({ variant: 'destructive', title: 'Error', description: 'Completa todos los campos del cierre.' });
            return;
        }
        setActionLoading('closure');
        try {
            const { error } = await supabase.from('company_closures').insert([{
                name: closureForm.name,
                start_date: format(closureForm.start_date, 'yyyy-MM-dd'),
                end_date: format(closureForm.end_date, 'yyyy-MM-dd'),
                is_mandatory: closureForm.is_mandatory
            }]);
            if (error) throw error;
            toast({ title: 'Cierre Configurado', description: 'El cierre de empresa ha sido guardado.' });
            setClosureModalOpen(false);
            setClosureForm({ name: '', start_date: undefined, end_date: undefined, is_mandatory: true });
            fetchConfig();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteClosure = async (id) => {
        try {
            await supabase.from('company_closures').delete().eq('id', id);
            toast({ title: 'Cierre Eliminado' });
            fetchConfig();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };

    // --- FESTIVOS CRUD ---
    const openFestivoModal = (data = null) => {
        if (data) {
            setFestivoForm({ ...data, fecha: new Date(data.fecha), import_text: '' });
            setFestivoModal({ isOpen: true, isEditing: true });
        } else {
            setFestivoForm({ id: null, fecha: undefined, descripcion: '', tipo: 'nacional', import_text: '' });
            setFestivoModal({ isOpen: true, isEditing: false });
        }
    };
    
    const handleSaveFestivo = async (isImport = false) => {
        if (!isImport && (!festivoForm.fecha || !festivoForm.descripcion || !festivoForm.tipo)) { return toast({ variant: 'destructive', title: 'Error', description: 'Rellena todos los campos.' }); }
        
        setActionLoading('festivo_save');
        try {
            if (isImport) {
                await handleImportFestivos(festivoForm.import_text);
            } else if (festivoModal.isEditing) {
                const dataToSave = { fecha: format(festivoForm.fecha, 'yyyy-MM-dd'), descripcion: festivoForm.descripcion, tipo: festivoForm.tipo };
                const { error } = await supabase.from('calendario_festivos').update(dataToSave).eq('id', festivoForm.id);
                if (error) throw error;
                toast({ title: 'Festivo Actualizado' });
            } else {
                const dataToSave = { fecha: format(festivoForm.fecha, 'yyyy-MM-dd'), descripcion: festivoForm.descripcion, tipo: festivoForm.tipo };
                const { error } = await supabase.from('calendario_festivos').insert([dataToSave]);
                if (error) throw error;
                toast({ title: 'Festivo Creado' });
            }
            setFestivoModal({ isOpen: false, isEditing: false });
            fetchAllData();
        } catch (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); } finally { setActionLoading(null); }
    };

    const handleImportFestivos = async (text) => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) throw new Error('No hay datos para importar.');

        const dataToInsert = [];
        const regex = /(\d{1,2}\/\d{1,2}\/\d{4})\s*(.*?)(?:\s*\[(NACIONAL|AUTONOMICA|LOCAL|CONVENIO)\])?$/i;
        
        for (const line of lines) {
            const match = line.match(regex);
            if (match) {
                try {
                    const [datePart, descPart, typeTag] = [match[1], match[2].trim(), match[3]];
                    const [day, month, year] = datePart.split('/');
                    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                    
                    if (!isNaN(date)) {
                        dataToInsert.push({
                            fecha: format(date, 'yyyy-MM-dd'),
                            descripcion: descPart,
                            tipo: (typeTag || 'CONVENIO').toLowerCase(), 
                        });
                    }
                } catch (e) {
                    console.error("Error parsing line:", line, e);
                }
            }
        }

        if (dataToInsert.length === 0) throw new Error('No se pudo parsear ninguna fecha válida (formato DD/MM/YYYY).');

        const { error } = await supabase.from('calendario_festivos').insert(dataToInsert);
        if (error) throw error;
        toast({ title: 'Importación Exitosa', description: `Se han añadido ${dataToInsert.length} días festivos al calendario.` });
    };

    // --- AUSENCIAS CRUD ---
    const fetchEmployeeBalance = async (id) => {
        if (!id) { setSelectedEmployeeBalance(null); return; }
        const { data } = await supabase.from('empleados').select('dias_vacaciones_restantes').eq('id', id).maybeSingle();
        setSelectedEmployeeBalance(data?.dias_vacaciones_restantes ?? 30);
    };

    const openAusenciaModal = async (data = null) => {
        if (data) {
            setOriginalAusencia(data);
            setAusenciaForm({ 
                ...data, 
                empleado_id: data.empleado_id, 
                range: { from: new Date(data.fecha_inicio), to: new Date(data.fecha_fin) } 
            });
            await fetchEmployeeBalance(data.empleado_id);
            setAusenciaModal({ isOpen: true, isEditing: true });
        } else {
            setOriginalAusencia(null);
            setAusenciaForm({ id: null, empleado_id: '', range: { from: undefined, to: undefined }, tipo: 'baja', notas: '' });
            setSelectedEmployeeBalance(null);
            setAusenciaModal({ isOpen: true, isEditing: false });
        }
    };

    const handleSaveAusencia = async () => {
        const { id, empleado_id, range, tipo, notas } = ausenciaForm;
        if (!empleado_id || !range.from) { 
            return toast({ variant: 'destructive', title: 'Error', description: 'Faltan campos obligatorios.' }); 
        }
        
        const startDate = range.from;
        const endDate = range.to || range.from;
        const duration = differenceInDays(endDate, startDate) + 1;

        setActionLoading('ausencia_save');

        try {
            let balanceDiff = 0;
            if (ausenciaModal.isEditing && originalAusencia?.tipo === 'vacaciones') {
                const oldDuration = differenceInDays(new Date(originalAusencia.fecha_fin), new Date(originalAusencia.fecha_inicio)) + 1;
                balanceDiff += oldDuration;
            }
            if (tipo === 'vacaciones') {
                balanceDiff -= duration;
            }

            if (balanceDiff !== 0) {
                await supabase.rpc('increment_vacation_balance', { p_empleado_id: empleado_id, p_days: balanceDiff });
            }

            const dataToSave = {
                empleado_id, tipo, notas, admin_id: employeeId,
                fecha_inicio: format(startDate, 'yyyy-MM-dd'),
                fecha_fin: format(endDate, 'yyyy-MM-dd'),
            };

            if (ausenciaModal.isEditing) {
                await supabase.from('ausencias_empleados').update(dataToSave).eq('id', id);
                toast({ title: 'Actualizado' });
            } else {
                await supabase.from('ausencias_empleados').insert([dataToSave]);
                toast({ title: 'Registrado' });
            }
            setAusenciaModal({ isOpen: false, isEditing: false });
            fetchAllData();
        } catch (error) { 
            toast({ variant: 'destructive', title: 'Error', description: error.message }); 
        } finally { 
            setActionLoading(null); 
        }
    };

    const executeDelete = async () => {
        const { type, id } = deleteDialog;
        setDeleteDialog({ isOpen: false, type: null, id: null });
        
        if (type === 'festivo') {
            await supabase.from('calendario_festivos').delete().eq('id', id);
            toast({ title: 'Festivo Eliminado' });
        } else if (type === 'ausencia') {
            const { data: ausencia } = await supabase.from('ausencias_empleados').select('*').eq('id', id).single();
            if (ausencia?.tipo === 'vacaciones') {
                const duration = differenceInDays(new Date(ausencia.fecha_fin), new Date(ausencia.fecha_inicio)) + 1;
                await supabase.rpc('increment_vacation_balance', { p_empleado_id: ausencia.empleado_id, p_days: duration });
            }
            await supabase.from('ausencias_empleados').delete().eq('id', id);
            toast({ title: 'Ausencia Eliminada' });
        } else if (type === 'solicitud') {
            await supabase.from('vacaciones_solicitudes').delete().eq('id', id);
            toast({ title: 'Solicitud Eliminada' });
        }
        fetchAllData();
    };

    const handleUpdateSolicitud = async (solicitudId, nuevoEstado) => {
        if (!employeeId) return;
        setActionLoading(solicitudId);
        try {
            await supabase.from('vacaciones_solicitudes').update({ estado: nuevoEstado, fecha_respuesta: new Date().toISOString(), admin_id: employeeId }).eq('id', solicitudId);
            toast({ title: `Solicitud ${nuevoEstado.toUpperCase()}` });
            fetchAllData();
        } catch (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); } finally { setActionLoading(null); }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-3 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="flex flex-col sm:flex-row md:items-center justify-between gap-3 md:gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-foreground tracking-tight">
                            <CalendarCheck className="w-7 h-7 md:w-8 md:h-8 text-primary" /> 
                            <span className="truncate">Calendario y Personal</span>
                        </h1>
                        <p className="text-xs md:text-sm text-muted-foreground mt-1 ml-1 md:ml-11">Gestión unificada de solicitudes, ausencias y festivos.</p>
                    </div>
                    {canManage && (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setConfigModalOpen(true)}>
                                <Settings className="mr-2 h-4 w-4" /> Configuración 2026
                            </Button>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* VACATION POLICY INFO 2026 */}
            {vacationConfig && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-full"><ShieldCheck className="w-5 h-5 text-blue-600" /></div>
                        <div>
                            <h3 className="font-bold text-blue-900">Política de Vacaciones 2026 Activa</h3>
                            <p className="text-sm text-blue-700 mt-1">
                                {vacationConfig.annual_days} días laborales anuales. 
                                Obligatorio: {vacationConfig.mandatory_blocks_count} bloque(s) de {vacationConfig.mandatory_block_days} días.
                            </p>
                        </div>
                    </div>
                    {companyClosures.length > 0 && (
                        <div className="text-xs text-blue-800 bg-blue-100/50 px-3 py-2 rounded border border-blue-200">
                            <strong>Cierres de Empresa:</strong>
                            <ul className="list-disc pl-4 mt-1">
                                {companyClosures.map(c => (
                                    <li key={c.id}>{c.name}: {safeFormat(new Date(c.start_date), 'dd/MM')} - {safeFormat(new Date(c.end_date), 'dd/MM/yyyy')}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                {/* SOLICITUDES PANEL */}
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="shadow-sm border border-border/60 rounded-xl overflow-hidden h-full">
                        <CardHeader className="bg-muted/20 border-b pb-4"><CardTitle className="text-lg font-bold flex items-center gap-2"><CalendarIcon className="w-5 h-5"/> Solicitudes Pendientes</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader><TableRow><TableHead>Empleado</TableHead><TableHead>Fechas</TableHead><TableHead>Días</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {solicitudes.filter(s => s.estado === 'pendiente').length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No hay solicitudes pendientes.</TableCell></TableRow>
                                    ) : (
                                        solicitudes.filter(s => s.estado === 'pendiente').map(s => (
                                            <TableRow key={s.id}>
                                                <TableCell className="font-medium">{s.empleado_display_name}</TableCell>
                                                <TableCell className="text-xs">{safeFormat(new Date(s.fecha_inicio), 'dd/MM')} - {safeFormat(new Date(s.fecha_fin), 'dd/MM/yy')}</TableCell>
                                                <TableCell><Badge variant="secondary">{s.dias_solicitados}</Badge></TableCell>
                                                <TableCell className="text-right space-x-1">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-100" onClick={() => handleUpdateSolicitud(s.id, 'aprobada')} disabled={!!actionLoading}><Settings className="h-4 w-4" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-100" onClick={() => handleUpdateSolicitud(s.id, 'rechazada')} disabled={!!actionLoading}><Trash2 className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* AUSENCIAS PANEL */}
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                    <Card className="shadow-sm border border-border/60 rounded-xl overflow-hidden h-full">
                        <CardHeader className="bg-muted/20 border-b pb-4 flex flex-row justify-between items-center">
                            <CardTitle className="text-lg font-bold flex items-center gap-2"><UserX className="w-5 h-5"/> Ausencias Oficiales</CardTitle>
                            <Button size="sm" variant="ghost" onClick={() => openAusenciaModal()}><PlusCircle className="w-4 h-4"/></Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader><TableRow><TableHead>Empleado</TableHead><TableHead>Motivo</TableHead><TableHead>Fechas</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {ausencias.slice(0, 5).map(a => (
                                        <TableRow key={a.id}>
                                            <TableCell className="font-medium">{a.empleado?.display_name}</TableCell>
                                            <TableCell><Badge variant="outline">{a.tipo}</Badge></TableCell>
                                            <TableCell className="text-xs">{safeFormat(new Date(a.fecha_inicio), 'dd/MM')} - {safeFormat(new Date(a.fecha_fin), 'dd/MM')}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => openAusenciaModal(a)}><Edit className="h-3 w-3"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {ausencias.length === 0 && <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Sin registros.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
            
            {/* FESTIVOS */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="shadow-sm border border-border/60 rounded-xl overflow-hidden">
                    <CardHeader className="bg-muted/20 border-b pb-4 flex flex-row justify-between items-center">
                        <CardTitle className="text-lg font-bold flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-red-600"/> Días Festivos</CardTitle>
                        <Button size="sm" onClick={() => openFestivoModal()}><PlusCircle className="w-4 h-4 mr-2"/> Gestionar</Button>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[300px] overflow-auto">
                        <Table>
                            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Descripción</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {festivos.map(f => (
                                    <TableRow key={f.id}>
                                        <TableCell className="font-medium text-red-600">{safeFormat(new Date(f.fecha), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>{f.descripcion}</TableCell>
                                        <TableCell><Badge variant="outline">{f.tipo}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button size="icon" variant="ghost" onClick={() => setDeleteDialog({ isOpen: true, type: 'festivo', id: f.id })}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </motion.div>

            {/* MODALS */}
            
            {/* POLICY CONFIG MODAL */}
            <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Configuración Política de Vacaciones (2026+)</DialogTitle>
                        <DialogDescription>Ajusta las reglas globales para el cálculo de vacaciones laborales.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-6 py-4">
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Settings className="w-4 h-4"/> Reglas Generales</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Días Laborales Anuales</Label>
                                    <Input value={vacationConfig?.annual_days || 22} readOnly className="bg-muted" />
                                </div>
                                <div>
                                    <Label>Bloques Obligatorios</Label>
                                    <Input value={`${vacationConfig?.mandatory_blocks_count || 2} bloques de ${vacationConfig?.mandatory_block_days || 5} días`} readOnly className="bg-muted" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">* Para modificar reglas base, contacta con soporte técnico.</p>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold flex items-center gap-2"><Lock className="w-4 h-4"/> Cierres de Empresa (Agosto)</h4>
                                <Button size="sm" variant="outline" onClick={() => setClosureModalOpen(true)}><PlusCircle className="w-3 h-3 mr-1"/> Añadir Cierre</Button>
                            </div>
                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Fechas</TableHead><TableHead>Obligatorio</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {companyClosures.map(c => (
                                            <TableRow key={c.id}>
                                                <TableCell>{c.name}</TableCell>
                                                <TableCell>{safeFormat(new Date(c.start_date), 'dd/MM/yyyy')} - {safeFormat(new Date(c.end_date), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell>{c.is_mandatory ? <Badge>Sí</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="icon" variant="ghost" onClick={() => handleDeleteClosure(c.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {companyClosures.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground h-12">No hay cierres configurados.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={() => setConfigModalOpen(false)}>Cerrar</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ADD CLOSURE MODAL */}
            <Dialog open={closureModalOpen} onOpenChange={setClosureModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nuevo Cierre de Empresa</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2"><Label>Nombre</Label><Input value={closureForm.name} onChange={e => setClosureForm(p => ({...p, name: e.target.value}))} placeholder="Ej: Cierre Agosto 2026"/></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Inicio</Label><Input type="date" onChange={e => setClosureForm(p => ({...p, start_date: e.target.value ? new Date(e.target.value) : undefined}))}/></div>
                            <div className="space-y-2"><Label>Fin</Label><Input type="date" onChange={e => setClosureForm(p => ({...p, end_date: e.target.value ? new Date(e.target.value) : undefined}))}/></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch checked={closureForm.is_mandatory} onCheckedChange={c => setClosureForm(p => ({...p, is_mandatory: c}))} id="mandatory-mode"/>
                            <Label htmlFor="mandatory-mode">Descontar automáticamente del saldo</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setClosureModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveClosure} disabled={actionLoading === 'closure'}>{actionLoading === 'closure' && <Loader2 className="animate-spin mr-2 h-4 w-4"/>} Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* FESTIVO MODAL */}
            {/* Reusing existing logic but simplified for brevity in this focused update */}
            <Dialog open={festivoModal.isOpen} onOpenChange={() => setFestivoModal({ isOpen: false, isEditing: false })}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader><DialogTitle>{festivoModal.isEditing ? 'Editar Festivo' : 'Nuevo Festivo'}</DialogTitle></DialogHeader>
                    <Tabs defaultValue={festivoModal.isEditing ? 'manual' : 'importar'}>
                        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="manual">Manual</TabsTrigger><TabsTrigger value="importar">Importar</TabsTrigger></TabsList>
                        <TabsContent value="manual" className="space-y-4 py-4">
                            <div className="space-y-2"><Label>Descripción</Label><Input value={festivoForm.descripcion} onChange={e => setFestivoForm(p => ({...p, descripcion: e.target.value}))}/></div>
                            <div className="space-y-2"><Label>Tipo</Label><Select value={festivoForm.tipo} onValueChange={v => setFestivoForm(p => ({...p, tipo: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="nacional">Nacional</SelectItem><SelectItem value="autonomica">Autonómica</SelectItem><SelectItem value="local">Local</SelectItem><SelectItem value="convenio">Convenio</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Fecha</Label><div className="border p-2 rounded"><Calendar mode="single" selected={festivoForm.fecha} onSelect={d => setFestivoForm(p => ({...p, fecha: d}))} locale={es}/></div></div>
                            <Button onClick={() => handleSaveFestivo(false)} className="w-full">Guardar</Button>
                        </TabsContent>
                        <TabsContent value="importar" className="space-y-4 py-4">
                            <Textarea placeholder="DD/MM/YYYY Descripción [TIPO]" value={festivoForm.import_text} onChange={e => setFestivoForm(p => ({...p, import_text: e.target.value}))} className="h-32"/>
                            <Button onClick={() => handleSaveFestivo(true)} className="w-full">Importar</Button>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* AUSENCIA MODAL */}
            <Dialog open={ausenciaModal.isOpen} onOpenChange={() => setAusenciaModal({ isOpen: false, isEditing: false })}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{ausenciaModal.isEditing ? 'Editar Ausencia' : 'Nueva Ausencia'}</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2"><Label>Empleado</Label><Select value={ausenciaForm.empleado_id} onValueChange={v => { setAusenciaForm(p => ({...p, empleado_id: v})); fetchEmployeeBalance(v); }} disabled={ausenciaModal.isEditing}><SelectTrigger><SelectValue placeholder="Seleccionar..."/></SelectTrigger><SelectContent>{empleados.map(e => <SelectItem key={e.id} value={e.id}>{e.display_name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label>Tipo</Label><Select value={ausenciaForm.tipo} onValueChange={v => setAusenciaForm(p => ({...p, tipo: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="baja">Baja</SelectItem><SelectItem value="vacaciones">Vacaciones</SelectItem><SelectItem value="permiso_admin">Permiso</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label>Fechas</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full text-left font-normal">{ausenciaForm.range.from ? `${safeFormat(ausenciaForm.range.from, 'dd/MM/yyyy')} - ${ausenciaForm.range.to ? safeFormat(ausenciaForm.range.to, 'dd/MM/yyyy') : '...'}` : 'Seleccionar rango'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="range" selected={ausenciaForm.range} onSelect={r => setAusenciaForm(p => ({...p, range: r || {from: undefined, to: undefined}}))} locale={es}/></PopoverContent></Popover></div>
                        <div className="space-y-2"><Label>Notas</Label><Textarea value={ausenciaForm.notas} onChange={e => setAusenciaForm(p => ({...p, notas: e.target.value}))}/></div>
                    </div>
                    <DialogFooter><Button onClick={handleSaveAusencia}>Guardar</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DELETE ALERT */}
            <AlertDialog open={deleteDialog.isOpen} onOpenChange={o => !o && setDeleteDialog({ isOpen: false, type: null, id: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>¿Eliminar?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={executeDelete} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
};

export default AdminCalendarView;