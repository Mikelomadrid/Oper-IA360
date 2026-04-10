import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, AlertTriangle, Trash2, Briefcase, CheckCircle, XCircle, UserPlus, Loader2, Edit, Save, MoreVertical, ShieldAlert, Coffee, Smartphone, Building2, LayoutGrid, List, Mail, FileSpreadsheet, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Helmet } from 'react-helmet';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EmployeeMonthlyReportModal from '@/components/EmployeeMonthlyReportModal';

const EmployeeForm = ({ employee, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        nombre: '',
        apellidos: '',
        email: '',
        telefono: '',
        telefono_empresa: '',
        dni_nie: '',
        rol: 'tecnico',
        costo_por_hora: '',
        activo: true,
    });
    const [loading, setLoading] = useState(false);
    const isEditing = !!employee;

    useEffect(() => {
        if (isEditing && employee) {
            setFormData({
                nombre: employee.nombre || '',
                apellidos: employee.apellidos || '',
                email: employee.email || '',
                telefono: employee.telefono || '',
                telefono_empresa: employee.telefono_empresa || '',
                dni_nie: employee.dni_nie || '',
                rol: employee.rol || 'tecnico',
                costo_por_hora: employee.costo_por_hora || '',
                activo: employee.activo,
            });
        } else {
            setFormData({
                nombre: '',
                apellidos: '',
                email: '',
                telefono: '',
                telefono_empresa: '',
                dni_nie: '',
                rol: 'tecnico',
                costo_por_hora: '',
                activo: true,
            });
        }
    }, [employee, isEditing]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => ({...prev, [name]: value}));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // 1. Create/Update basic employee data via RPC (handles auth user creation if needed)
        const { data, error } = await supabase.rpc('admin_set_empleado', {
            p_email: formData.email,
            p_rol: formData.rol,
            p_costo: parseFloat(formData.costo_por_hora) || 0,
            p_activo: formData.activo,
            p_nombre: formData.nombre,
            p_apellidos: formData.apellidos,
        });

        if (error) {
            setLoading(false);
            toast({ variant: 'destructive', title: 'Error al guardar', description: error.message });
            return;
        }

        // 2. Update extra fields directly on the table (RPC might not cover all new fields like dni_nie)
        if (data && data.empleado_id) {
            const { error: updateError } = await supabase
                .from('empleados')
                .update({
                    telefono: formData.telefono,
                    telefono_empresa: formData.telefono_empresa,
                    dni_nie: formData.dni_nie
                })
                .eq('id', data.empleado_id);

            if (updateError) {
                console.error("Error updating extra fields:", updateError);
                toast({ variant: 'destructive', title: 'Aviso', description: 'Usuario guardado pero hubo un error al guardar los datos extendidos.' });
            } else {
                toast({ title: '¡Éxito!', description: `Empleado ${isEditing ? 'actualizado' : 'creado'} correctamente.` });
            }
        } else {
            toast({ title: '¡Éxito!', description: `Empleado guardado correctamente.` });
        }

        setLoading(false);
        onSave();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} required />
                </div>
                <div>
                    <Label htmlFor="apellidos">Apellidos</Label>
                    <Input id="apellidos" name="apellidos" value={formData.apellidos} onChange={handleChange} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required disabled={isEditing} />
                    {isEditing && <p className="text-xs text-muted-foreground mt-1">El email no se puede cambiar una vez creado.</p>}
                </div>
                <div>
                    <Label htmlFor="dni_nie" className="flex items-center gap-2"><CreditCard className="w-3 h-3" /> DNI / NIE</Label>
                    <Input id="dni_nie" name="dni_nie" value={formData.dni_nie} onChange={handleChange} placeholder="12345678A" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="telefono" className="flex items-center gap-2"><Smartphone className="w-3 h-3" /> Teléfono Personal</Label>
                    <Input id="telefono" name="telefono" value={formData.telefono} onChange={handleChange} placeholder="+34 600 000 000" />
                </div>
                <div>
                    <Label htmlFor="telefono_empresa" className="flex items-center gap-2"><Building2 className="w-3 h-3" /> Teléfono Empresa</Label>
                    <Input id="telefono_empresa" name="telefono_empresa" value={formData.telefono_empresa} onChange={handleChange} placeholder="+34 600 000 000" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="rol">Rol</Label>
                    <Select name="rol" onValueChange={(value) => handleSelectChange('rol', value)} value={formData.rol}>
                        <SelectTrigger id="rol">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="encargado">Encargado</SelectItem>
                            <SelectItem value="tecnico">Técnico</SelectItem>
                            <SelectItem value="colaborador">Colaborador</SelectItem>
                            <SelectItem value="finca_admin">Admin Finca</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="costo_por_hora">Coste por Hora (€)</Label>
                    <Input id="costo_por_hora" name="costo_por_hora" type="number" step="0.01" value={formData.costo_por_hora} onChange={handleChange} />
                </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isEditing ? <Save className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />)}
                    {loading ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Empleado')}
                </Button>
            </div>
        </form>
    );
};


const EmployeeFormModal = ({ isOpen, onOpenChange, onSaveSuccess, employee }) => {
    const isEditing = !!employee;
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Editar Empleado' : 'Crear Empleado'}</DialogTitle>
                    <DialogDescription>
                        {isEditing ? 'Modifica los datos del empleado.' : 'Introduce los datos para el nuevo empleado.'}
                    </DialogDescription>
                </DialogHeader>
                <EmployeeForm employee={employee} onSave={onSaveSuccess} onCancel={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    );
};

const DeleteEmployeeDialog = ({ employee, isOpen, onOpenChange, onDeleteSuccess }) => {
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('admin_eliminar_empleado', { p_empleado_id: employee.id });
        setLoading(false);

        if (error) {
            toast({ variant: 'destructive', title: 'Error al eliminar', description: error.message });
        } else {
            if (data === true) {
                toast({ title: '¡Eliminado!', description: 'El empleado ha sido eliminado permanentemente.' });
            } else {
                toast({ title: 'Empleado desactivado', description: 'El empleado tenía registros asociados y ha sido desactivado en lugar de eliminarse.' });
            }
            onDeleteSuccess();
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>¿Confirmar eliminación?</DialogTitle>
                    <DialogDescription>
                        Vas a eliminar a <span className="font-bold">{employee?.nombre} {employee?.apellidos}</span>.
                        Si el empleado tiene fichajes, gastos u otros registros, se marcará como inactivo en lugar de borrarse. Esta acción es irreversible.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                        Eliminar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const EmployeeCard = ({ employee, fichajeStatus = 'offline', onSelect, onEdit, onDelete }) => {
    // Determinar color del indicador de estado de fichaje
    const dotColor = {
        working: "bg-green-500",
        paused: "bg-orange-500",
        offline: "bg-red-500"
    }[fichajeStatus] || "bg-red-500";

    const dotTitle = {
        working: "Trabajando",
        paused: "En Pausa",
        offline: "Fuera de turno"
    }[fichajeStatus];

    const getStatusInfo = (emp) => {
        if (emp.baja) {
            return { text: 'Baja', icon: <ShieldAlert className="h-3 w-3 mr-1" />, className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50' };
        }
        if (emp.vacaciones) {
            return { text: 'Vacaciones', icon: <Coffee className="h-3 w-3 mr-1" />, className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50' };
        }
        if (emp.activo) {
            return { text: 'Activo', icon: <CheckCircle className="h-3 w-3 mr-1" />, className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50' };
        }
        return { text: 'Inactivo', icon: <XCircle className="h-3 w-3 mr-1" />, className: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700' };
    };
    
    const statusInfo = getStatusInfo(employee);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(employee.id)}
            className="bg-card rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 cursor-pointer flex flex-col items-center p-3 md:p-5 relative group overflow-hidden"
        >
            <div className="absolute top-1 right-1 md:top-2 md:right-2 z-10 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-muted-foreground/70 hover:text-foreground rounded-full hover:bg-muted/80">
                            <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(employee); }}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(employee); }} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="relative mb-2 md:mb-3 mt-1 md:mt-0">
                <div className="w-12 h-12 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-background shadow-sm bg-muted flex items-center justify-center ring-1 ring-border/50">
                    {employee.foto_url ? (
                        <img src={employee.foto_url} alt={employee.nombre} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-lg md:text-3xl font-bold text-muted-foreground/40 select-none">
                            {employee.nombre ? employee.nombre.charAt(0).toUpperCase() : '?'}
                        </span>
                    )}
                </div>
                <span className={cn(
                    "absolute bottom-0 right-0 w-3 h-3 md:w-5 md:h-5 border-2 border-card rounded-full ring-1 ring-transparent",
                    dotColor
                )} title={dotTitle} />
            </div>

            <div className="text-center w-full space-y-0.5 md:space-y-1 min-w-0">
                <h3 className="text-xs md:text-base font-bold text-foreground truncate w-full px-1 leading-tight">
                    {employee.display_name}
                </h3>
                <div className="flex items-center justify-center gap-1.5 text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    <Briefcase className="w-3 h-3 hidden md:block opacity-70" />
                    <span className="truncate max-w-[90%]">
                        {employee.rol === 'finca_admin' ? 'Admin Finca' : employee.rol}
                    </span>
                </div>
            </div>

            <div className="mt-2 md:mt-4 w-full flex justify-center">
                 <Badge variant="outline" className={cn("text-[9px] md:text-[10px] px-1.5 py-0 h-4 md:h-5 font-normal border", statusInfo.className)}>
                    {statusInfo.icon}
                    {statusInfo.text}
                </Badge>
            </div>
        </motion.div>
    );
};

const EmployeesContent = ({ navigate }) => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState(null);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [deletingEmployee, setDeletingEmployee] = useState(null);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [showInactive, setShowInactive] = useState(false);
    const [viewMode, setViewMode] = useState('cluster'); // 'cluster' | 'list'
    const [fichajeStatuses, setFichajeStatuses] = useState({});
    const isMounted = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const fetchEmployees = useCallback(async () => {
        setLoading(true);
        setApiError(null);
        
        // Fetch full employee data including dni_nie
        const { data, error } = await supabase
            .from('empleados')
            .select('*')
            .order('rol, nombre', { ascending: true });

        if (isMounted.current) {
            if (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los empleados.' });
                setApiError('Error al cargar los datos. ' + error.message);
            } else {
                // Add display_name for compatibility with existing components
                const processedData = data.map(emp => ({
                    ...emp,
                    display_name: `${emp.nombre} ${emp.apellidos || ''}`.trim()
                }));
                setEmployees(processedData);
            }
            setLoading(false);
        }
    }, []);

    // Fetch real-time check-in statuses
    const fetchFichajeStatuses = useCallback(async () => {
        try {
            // 1. Get all open sessions (active check-ins)
            const { data: activeSessions, error: errorSessions } = await supabase
                .from('control_horario')
                .select('id, empleado_id')
                .is('hora_salida', null);

            if (!isMounted.current) return;

            if (errorSessions) {
                console.error('Error fetching active sessions:', errorSessions);
                return;
            }

            if (!activeSessions || activeSessions.length === 0) {
                setFichajeStatuses({});
                return;
            }

            const activeSessionIds = activeSessions.map(s => s.id);
            
            // 2. Check for active pauses within those sessions
            const { data: activePauses, error: errorPauses } = await supabase
                .from('pausas')
                .select('fichaje_id')
                .in('fichaje_id', activeSessionIds)
                .is('hora_fin_pausa', null);

            if (errorPauses) {
                console.error('Error fetching active pauses:', errorPauses);
            }

            const pausedFichajeIds = new Set((activePauses || []).map(p => p.fichaje_id));
            const newStatuses = {};

            // 3. Determine status for each employee with an active session
            activeSessions.forEach(session => {
                if (pausedFichajeIds.has(session.id)) {
                    newStatuses[session.empleado_id] = 'paused'; // Orange
                } else {
                    newStatuses[session.empleado_id] = 'working'; // Green
                }
            });

            if (isMounted.current) setFichajeStatuses(newStatuses);

        } catch (err) {
            console.error('Unexpected error fetching statuses:', err);
        }
    }, []);

    useEffect(() => {
        fetchEmployees();
        fetchFichajeStatuses();

        // Realtime subscriptions for status updates
        const channel = supabase.channel('employees-status-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'control_horario' }, () => fetchFichajeStatuses())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pausas' }, () => fetchFichajeStatuses())
            .subscribe();
            
        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchEmployees, fetchFichajeStatuses]);
    
    const handleSelectEmployee = (id) => {
        navigate(`/personal/empleados/${id}`);
    };
    
    const handleFormSuccess = () => {
        setCreateModalOpen(false);
        setEditingEmployee(null);
        fetchEmployees();
    }

    const handleDeleteSuccess = () => {
        setDeletingEmployee(null);
        fetchEmployees();
    }

    const filteredEmployees = employees.filter(emp => {
        if (showInactive) return true;
        return emp.activo && !emp.baja && !emp.vacaciones;
    });

    const getStatusInfo = (emp) => {
        if (emp.baja) return { text: 'Baja', className: 'text-red-700 bg-red-100 border-red-200' };
        if (emp.vacaciones) return { text: 'Vacaciones', className: 'text-amber-700 bg-amber-100 border-amber-200' };
        if (emp.activo) return { text: 'Activo', className: 'text-green-700 bg-green-100 border-green-200' };
        return { text: 'Inactivo', className: 'text-zinc-700 bg-zinc-100 border-zinc-200' };
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full p-8"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    }

    return (
        <div className="p-6 w-full">
            <Helmet>
                <title>Equipo | OrkaRefor ERP</title>
            </Helmet>

            <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.4 }} 
                className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 max-w-[1600px] mx-auto"
            >
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Equipo</h1>
                    <p className="text-xs md:text-sm text-muted-foreground">Gestión de personal y accesos.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full md:w-auto">
                    <div className="flex items-center bg-muted rounded-lg p-1 border">
                        <Button 
                            variant={viewMode === 'cluster' ? 'default' : 'ghost'} 
                            size="icon" 
                            className="h-8 w-8 rounded-md"
                            onClick={() => setViewMode('cluster')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant={viewMode === 'list' ? 'default' : 'ghost'} 
                            size="icon" 
                            className="h-8 w-8 rounded-md"
                            onClick={() => setViewMode('list')}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 bg-card p-2 rounded-lg border shadow-sm">
                        <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
                        <Label htmlFor="show-inactive" className="text-xs cursor-pointer">Mostrar inactivos</Label>
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button 
                            variant="outline"
                            onClick={() => setIsReportModalOpen(true)}
                            className="w-full md:w-auto shadow-sm border-green-600 text-green-700 hover:bg-green-50"
                        >
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Reporte Mensual
                        </Button>
                        <Button onClick={() => setCreateModalOpen(true)} className="w-full md:w-auto shadow-sm">
                            <UserPlus className="mr-2 h-4 w-4"/>
                            Crear Empleado
                        </Button>
                    </div>
                </div>
            </motion.div>
            
            {apiError && <div className="bg-red-500/10 border border-red-500/50 text-red-600 p-4 rounded-lg mb-6 flex justify-between items-center text-sm"><p>{apiError}</p><Button variant="ghost" size="sm" onClick={fetchEmployees}>Reintentar</Button></div>}
            
            <AnimatePresence mode="wait">
                {employees.length === 0 && !loading ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 text-muted-foreground bg-card/50 rounded-xl border border-dashed max-w-[1600px] mx-auto mt-6">
                        <Users className="mx-auto h-12 w-12 opacity-50" />
                        <h3 className="mt-4 text-lg font-medium">No hay empleados registrados</h3>
                        <p className="mt-1 text-sm opacity-80">Empieza por crear el primer miembro de tu equipo.</p>
                    </motion.div>
                ) : filteredEmployees.length === 0 && !loading ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 text-muted-foreground bg-card/50 rounded-xl border border-dashed max-w-[1600px] mx-auto mt-6">
                        <Users className="mx-auto h-12 w-12 opacity-50" />
                        <h3 className="mt-4 text-lg font-medium">No se encontraron empleados activos</h3>
                        <p className="mt-1 text-sm opacity-80">Prueba a activar el filtro para ver empleados ausentes o inactivos.</p>
                    </motion.div>
                ) : viewMode === 'list' ? (
                    <motion.div 
                        key="list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="bg-card rounded-xl border shadow-sm overflow-hidden max-w-[1600px] mx-auto mt-6"
                    >
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="w-[50%] sm:w-[30%] pl-4">Empleado</TableHead>
                                    <TableHead className="hidden md:table-cell">Rol</TableHead>
                                    <TableHead className="hidden lg:table-cell">Contacto</TableHead>
                                    <TableHead className="hidden sm:table-cell">Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEmployees.map(emp => {
                                    const status = getStatusInfo(emp);
                                    const currentFichajeStatus = fichajeStatuses[emp.id] || 'offline';
                                    const listDotColor = {
                                        working: "bg-green-500",
                                        paused: "bg-orange-500",
                                        offline: "bg-red-500"
                                    }[currentFichajeStatus] || "bg-red-500";

                                    return (
                                        <TableRow 
                                            key={emp.id} 
                                            onClick={() => handleSelectEmployee(emp.id)}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        >
                                            <TableCell className="pl-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative shrink-0">
                                                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center border overflow-hidden">
                                                            {emp.foto_url ? (
                                                                <img src={emp.foto_url} alt={emp.nombre} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-xs font-bold text-muted-foreground">
                                                                    {emp.nombre ? emp.nombre.charAt(0).toUpperCase() : '?'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className={cn(
                                                            "absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-background rounded-full ring-1 ring-transparent",
                                                            listDotColor
                                                        )} title={currentFichajeStatus} />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-medium truncate">{emp.display_name}</span>
                                                        {/* Mobile only info */}
                                                        <div className="md:hidden flex flex-col gap-0.5 mt-0.5">
                                                             <span className="text-[10px] text-muted-foreground capitalize">{emp.rol === 'finca_admin' ? 'Admin Finca' : emp.rol}</span>
                                                             <span className="text-[10px] text-muted-foreground truncate">{emp.email}</span>
                                                             {status.text !== 'Activo' && (
                                                                <span className={cn("text-[9px] px-1 py-0.5 rounded-sm bg-muted w-fit mt-0.5", status.className)}>
                                                                    {status.text}
                                                                </span>
                                                             )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell"><Badge variant="outline" className="capitalize">{emp.rol === 'finca_admin' ? 'Admin Finca' : emp.rol}</Badge></TableCell>
                                            <TableCell className="hidden lg:table-cell">
                                                <div className="flex flex-col text-xs text-muted-foreground gap-1">
                                                    <div className="flex items-center gap-1"><Mail className="w-3 h-3"/> {emp.email}</div>
                                                    {emp.telefono && <div className="flex items-center gap-1"><Smartphone className="w-3 h-3"/> {emp.telefono}</div>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                <Badge variant="outline" className={cn("border bg-opacity-20", status.className)}>
                                                    {status.text}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right align-middle">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditingEmployee(emp); }}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeletingEmployee(emp); }}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </motion.div>
                ) : (
                    <motion.div 
                        key="cluster"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6 max-w-[1600px] mx-auto mt-6"
                    >
                        {filteredEmployees.map(emp => (
                            <EmployeeCard 
                                key={emp.id} 
                                employee={emp} 
                                fichajeStatus={fichajeStatuses[emp.id] || 'offline'}
                                onSelect={() => handleSelectEmployee(emp.id)}
                                onEdit={(employee) => setEditingEmployee(employee)}
                                onDelete={(employee) => setDeletingEmployee(employee)}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
            
            <EmployeeFormModal 
                isOpen={isCreateModalOpen || !!editingEmployee} 
                onOpenChange={(open) => {
                    if (!open) {
                        setCreateModalOpen(false);
                        setEditingEmployee(null);
                    }
                }}
                onSaveSuccess={handleFormSuccess}
                employee={editingEmployee}
            />

            <EmployeeMonthlyReportModal 
                isOpen={isReportModalOpen} 
                onClose={() => setIsReportModalOpen(false)} 
            />

            {deletingEmployee && (
                <DeleteEmployeeDialog
                    employee={deletingEmployee}
                    isOpen={!!deletingEmployee}
                    onOpenChange={() => setDeletingEmployee(null)}
                    onDeleteSuccess={handleDeleteSuccess}
                />
            )}

        </div>
    );
};

const Employees = ({ navigate }) => {
    const { sessionRole, loadingAuth } = useAuth();

    if (loadingAuth) {
        return <div className="flex items-center justify-center h-full p-8"><Loader2 className="h-10 w-10 animate-spin text-primary"/></div>;
    }

    if (!['admin', 'encargado'].includes(sessionRole.rol)) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <AlertTriangle className="w-16 h-16 text-yellow-400 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
                <p className="text-muted-foreground">No tienes permisos para gestionar empleados.</p>
            </div>
        );
    }

    return <EmployeesContent navigate={navigate} />;
};

export default Employees;