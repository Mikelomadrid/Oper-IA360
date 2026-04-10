import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Save, X, UserPlus, Trash2, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const PersonnelAssignmentModal = ({ isOpen, onClose, executionId, executionTitle, onSave, onAssignmentComplete }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Data
    const [employees, setEmployees] = useState([]);
    
    // Form State (Stores auth_user_id, NOT row id)
    const [encargadoUid, setEncargadoUid] = useState('');
    const [tecnicosUids, setTecnicosUids] = useState([]);
    const [availableTechnicians, setAvailableTechnicians] = useState([]);

    useEffect(() => {
        if (isOpen) {
            loadData();
        } else {
            // Reset state on close
            setEncargadoUid('');
            setTecnicosUids([]);
        }
    }, [isOpen, executionId]);

    // Filter available technicians (exclude already selected and the assigned responsible)
    useEffect(() => {
        setAvailableTechnicians(
            employees.filter(e => 
                !tecnicosUids.includes(e.auth_user_id) && e.auth_user_id !== encargadoUid
            )
        );
    }, [employees, tecnicosUids, encargadoUid]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Employees - Explicitly selecting auth_user_id
            const { data: emps, error: empError } = await supabase
                .from('empleados')
                .select('id, auth_user_id, nombre, apellidos, rol, foto_url')
                .eq('activo', true)
                .order('nombre');
            
            if (empError) throw empError;
            
            // Filter only employees with linked users
            const validEmps = (emps || []).filter(e => e.auth_user_id);
            setEmployees(validEmps);

            // 2. Fetch Current Assignments if executionId exists
            if (executionId) {
                const { data: assigns, error: assignError } = await supabase
                    .from('ejecucion_asignaciones_v2')
                    .select('user_id, rol')
                    .eq('ejecucion_id', executionId);

                if (assignError) throw assignError;

                // Assignments use auth_user_id in user_id column
                const currentEncargado = assigns.find(a => a.rol === 'encargado')?.user_id;
                const currentTecnicos = assigns.filter(a => a.rol === 'tecnico').map(a => a.user_id);

                if (currentEncargado) setEncargadoUid(currentEncargado);
                if (currentTecnicos.length > 0) setTecnicosUids(currentTecnicos);
            }

        } catch (error) {
            console.error("Error loading data:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos.' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddTechnician = (techUid) => {
        if (techUid && !tecnicosUids.includes(techUid)) {
            setTecnicosUids([...tecnicosUids, techUid]);
        }
    };

    const handleRemoveTechnician = (techUid) => {
        setTecnicosUids(tecnicosUids.filter(uid => uid !== techUid));
    };

    const handleSave = async () => {
        if (!encargadoUid) {
            toast({ variant: 'destructive', title: 'Falta Responsable', description: 'Debes asignar un responsable de obra.' });
            return;
        }

        setSaving(true);
        try {
            // Call RPC to update assignments atomically using auth_user_ids
            const { error } = await supabase.rpc('rpc_asignar_ejecucion_v2', {
                p_ejecucion_id: executionId,
                p_tecnicos: tecnicosUids,
                p_encargado: encargadoUid
            });

            if (error) throw error;

            toast({ title: 'Asignaciones actualizadas', description: 'El personal ha sido asignado correctamente.' });
            
            // Trigger callbacks
            if (onSave) onSave();
            if (onAssignmentComplete) onAssignmentComplete();
            
            onClose();

        } catch (error) {
            console.error("Error saving assignments:", error);
            toast({ variant: 'destructive', title: 'Error al guardar', description: error.message || 'Ocurrió un error inesperado.' });
        } finally {
            setSaving(false);
        }
    };

    // Helper to get employee object by auth_user_id
    const getEmpByUid = (uid) => employees.find(e => e.auth_user_id === uid);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden bg-white dark:bg-slate-950 border-0 rounded-xl shadow-2xl">
                {/* Header with Gradient */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Users className="w-5 h-5" /> Asignación de Personal
                    </DialogTitle>
                    <DialogDescription className="text-blue-100 mt-1">
                        Gestiona el equipo para: <span className="font-semibold text-white">{executionTitle}</span>
                    </DialogDescription>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-white/20 rounded-full"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-6 space-y-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                            <p className="text-sm text-slate-500 mt-2">Cargando personal...</p>
                        </div>
                    ) : (
                        <>
                            {/* Section 1: Encargado / Responsable */}
                            <div className="space-y-3">
                                <Label className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-indigo-600" /> Responsable de Obra <span className="text-red-500">*</span>
                                </Label>
                                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-xl">
                                    <Select value={encargadoUid} onValueChange={setEncargadoUid}>
                                        <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 h-12">
                                            <SelectValue placeholder="Seleccionar responsable..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {employees.map(emp => (
                                                <SelectItem key={emp.id} value={emp.auth_user_id}>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="w-6 h-6">
                                                            <AvatarImage src={emp.foto_url} />
                                                            <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700">{emp.nombre?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <span>{emp.nombre} {emp.apellidos}</span>
                                                        <Badge variant="outline" className="ml-auto text-[10px] h-5 capitalize opacity-70">{emp.rol}</Badge>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {encargadoUid && getEmpByUid(encargadoUid) && (
                                        <div className="mt-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                                            <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                                                <AvatarImage src={getEmpByUid(encargadoUid)?.foto_url} />
                                                <AvatarFallback className="bg-indigo-600 text-white">{getEmpByUid(encargadoUid)?.nombre?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                    {getEmpByUid(encargadoUid)?.nombre} {getEmpByUid(encargadoUid)?.apellidos}
                                                </p>
                                                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Líder del Proceso</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section 2: Técnicos */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <Label className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-blue-600" /> Técnicos Asignados
                                    </Label>
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                                        {tecnicosUids.length} Asignados
                                    </Badge>
                                </div>
                                
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                                    {/* Selector to Add */}
                                    <div className="flex gap-2">
                                        <Select onValueChange={handleAddTechnician}>
                                            <SelectTrigger className="w-full bg-white dark:bg-slate-900">
                                                <SelectValue placeholder="Añadir técnico..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableTechnicians.map(emp => (
                                                    <SelectItem key={emp.id} value={emp.auth_user_id}>
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="w-5 h-5">
                                                                <AvatarImage src={emp.foto_url} />
                                                                <AvatarFallback className="text-[10px]">{emp.nombre?.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <span>{emp.nombre} {emp.apellidos}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                                {availableTechnicians.length === 0 && (
                                                    <div className="p-2 text-xs text-center text-muted-foreground">No hay más técnicos disponibles</div>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <Button variant="outline" size="icon" className="shrink-0" disabled>
                                            <UserPlus className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    {/* Selected List */}
                                    <ScrollArea className="h-[180px] w-full pr-4">
                                        {tecnicosUids.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-32 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                                                <Users className="w-8 h-8 mb-2 opacity-20" />
                                                <p className="text-sm">Sin técnicos asignados</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {tecnicosUids.map(techUid => {
                                                    const tech = getEmpByUid(techUid);
                                                    if (!tech) return null;
                                                    return (
                                                        <div key={techUid} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm animate-in slide-in-from-left-2">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="w-8 h-8">
                                                                    <AvatarImage src={tech.foto_url} />
                                                                    <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">{tech.nombre?.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <div className="leading-none">
                                                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{tech.nombre} {tech.apellidos}</p>
                                                                    <p className="text-[10px] text-muted-foreground capitalize">{tech.rol}</p>
                                                                </div>
                                                            </div>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                                                                onClick={() => handleRemoveTechnician(techUid)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 gap-2">
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={saving || !encargadoUid} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Guardar Equipo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PersonnelAssignmentModal;