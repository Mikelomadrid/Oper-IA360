import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar as CalendarIcon, User, Save, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';

const EjecucionCrudModal = ({ isOpen, onClose, onSave, obraId, initialData }) => {
    const { user, sessionRole } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [fetchingProcedures, setFetchingProcedures] = useState(false);
    
    // Dropdown Data
    const [procedures, setProcedures] = useState([]);
    const [employees, setEmployees] = useState([]);

    // Form Data
    const [formData, setFormData] = useState({
        procedimiento_codigo: '',
        asignado_a: '', // UUID
        fecha_inicio: '',
        fecha_fin: '',
        estado: 'en_progreso'
    });

    const isEdit = !!initialData;

    useEffect(() => {
        if (isOpen) {
            loadDependencies();
            if (initialData) {
                setFormData({
                    procedimiento_codigo: initialData.procedimiento_codigo || '',
                    asignado_a: initialData.asignado_a || 'unassigned',
                    fecha_inicio: initialData.fecha_inicio ? new Date(initialData.fecha_inicio).toISOString().slice(0, 16) : '',
                    fecha_fin: initialData.fecha_fin ? new Date(initialData.fecha_fin).toISOString().slice(0, 16) : '',
                    estado: initialData.estado || 'en_progreso'
                });
            } else {
                // Reset for create
                setFormData({
                    procedimiento_codigo: '',
                    asignado_a: 'unassigned',
                    fecha_inicio: new Date().toISOString().slice(0, 16),
                    fecha_fin: '',
                    estado: 'en_progreso'
                });
            }
        }
    }, [isOpen, initialData]);

    const loadDependencies = async () => {
        setFetchingProcedures(true);
        try {
            // 1. Fetch Active Procedures
            const { data: procs } = await supabase
                .from('procedimientos_v2')
                .select('codigo, titulo')
                .eq('activo', true)
                .order('titulo');
            setProcedures(procs || []);

            // 2. Fetch Employees for assignment
            const { data: emps } = await supabase
                .from('empleados')
                .select('id, nombre, apellidos, auth_user_id')
                .eq('activo', true)
                .order('nombre');
            
            // Map to format suitable for Select
            const empOptions = (emps || []).map(e => ({
                id: e.auth_user_id || e.id, // Prefer auth_user_id for assignment if available, but legacy uses uuid sometimes
                label: `${e.nombre} ${e.apellidos || ''}`.trim()
            })).filter(e => e.id); // Ensure valid ID
            
            setEmployees(empOptions);

        } catch (err) {
            console.error("Error loading dependencies", err);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos necesarios." });
        } finally {
            setFetchingProcedures(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!isEdit && !formData.procedimiento_codigo) {
                throw new Error("Selecciona un procedimiento.");
            }

            // Prepare assignment UUID (handle 'unassigned')
            const assignedUuid = formData.asignado_a === 'unassigned' ? null : formData.asignado_a;

            if (isEdit) {
                // UPDATE
                const { error } = await supabase
                    .from('ejecuciones_v2')
                    .update({
                        fecha_inicio: formData.fecha_inicio ? new Date(formData.fecha_inicio).toISOString() : null,
                        fecha_fin: formData.fecha_fin ? new Date(formData.fecha_fin).toISOString() : null,
                        asignado_a: assignedUuid,
                        estado: formData.estado
                        // Procedure cannot be changed usually as it implies different steps
                    })
                    .eq('id', initialData.ejecucion_id);

                if (error) throw error;
                toast({ title: "Actualizado", description: "La ejecución se ha modificado correctamente." });

            } else {
                // CREATE via RPC
                // rpc_crear_ejecucion_v2(p_procedimiento_codigo, p_entidad_tipo, p_entidad_id, p_asignado_a)
                const { error } = await supabase.rpc('rpc_crear_ejecucion_v2', {
                    p_procedimiento_codigo: formData.procedimiento_codigo,
                    p_entidad_tipo: 'obra',
                    p_entidad_id: obraId,
                    p_asignado_a: assignedUuid
                });

                if (error) throw error;
                toast({ title: "Creado", description: "Nueva ejecución creada exitosamente." });
            }

            onSave(); // Refresh parent
            onClose();

        } catch (error) {
            console.error("Error saving execution:", error);
            toast({ 
                variant: "destructive", 
                title: "Error al guardar", 
                description: error.message || "Ocurrió un error inesperado." 
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-0 shadow-2xl rounded-xl">
                {/* Hero Background Header */}
                <div className="relative h-32 w-full">
                    <div 
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ 
                            backgroundImage: `url('https://images.unsplash.com/photo-1531497258014-b5736f376b1b?auto=format&fit=crop&w=800&q=80')` 
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    <div className="absolute bottom-4 left-6 z-10">
                        <DialogTitle className="text-2xl font-bold text-foreground">
                            {isEdit ? 'Editar Ejecución' : 'Nueva Ejecución'}
                        </DialogTitle>
                        <DialogDescription className="text-foreground/70">
                            {isEdit ? 'Modifica los detalles del proceso' : 'Inicia un nuevo proceso para esta obra'}
                        </DialogDescription>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 text-white/80 hover:text-white hover:bg-black/20 rounded-full"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-background/50 backdrop-blur-sm">
                    
                    <div className="grid gap-4">
                        {/* Procedure Selector (Create Only) or Readonly Display (Edit) */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase text-muted-foreground">Procedimiento</Label>
                            {isEdit ? (
                                <div className="p-3 bg-muted/50 rounded-lg border text-sm font-medium">
                                    {initialData.procedimiento_titulo} ({initialData.procedimiento_codigo})
                                </div>
                            ) : (
                                <Select 
                                    value={formData.procedimiento_codigo} 
                                    onValueChange={(val) => setFormData(prev => ({...prev, procedimiento_codigo: val}))}
                                    disabled={fetchingProcedures}
                                >
                                    <SelectTrigger className="h-10 bg-background/50 border-input/60 focus:ring-primary/20">
                                        <SelectValue placeholder={fetchingProcedures ? "Cargando..." : "Seleccionar procedimiento..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {procedures.map(proc => (
                                            <SelectItem key={proc.codigo} value={proc.codigo}>
                                                {proc.titulo}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Fecha Inicio</Label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        type="datetime-local" 
                                        className="pl-9 h-10 bg-background/50"
                                        value={formData.fecha_inicio}
                                        onChange={(e) => setFormData(prev => ({...prev, fecha_inicio: e.target.value}))}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Fecha Fin / Límite</Label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        type="datetime-local" 
                                        className="pl-9 h-10 bg-background/50"
                                        value={formData.fecha_fin}
                                        onChange={(e) => setFormData(prev => ({...prev, fecha_fin: e.target.value}))}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Assignment */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase text-muted-foreground">Responsable Principal</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                                <Select 
                                    value={formData.asignado_a} 
                                    onValueChange={(val) => setFormData(prev => ({...prev, asignado_a: val}))}
                                >
                                    <SelectTrigger className="pl-9 h-10 bg-background/50 border-input/60">
                                        <SelectValue placeholder="Sin asignar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">-- Sin Asignar --</SelectItem>
                                        {employees.map(emp => (
                                            <SelectItem key={emp.id} value={emp.id}>
                                                {emp.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Status (Edit Only) */}
                        {isEdit && (
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Estado</Label>
                                <Select 
                                    value={formData.estado} 
                                    onValueChange={(val) => setFormData(prev => ({...prev, estado: val}))}
                                >
                                    <SelectTrigger className="h-10 bg-background/50 border-input/60">
                                        <SelectValue placeholder="Estado..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pendiente">Pendiente</SelectItem>
                                        <SelectItem value="en_progreso">En Progreso</SelectItem>
                                        <SelectItem value="completado">Completado</SelectItem>
                                        <SelectItem value="cancelado">Cancelado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={onClose} className="h-10">Cancelar</Button>
                        <Button type="submit" disabled={loading} className="h-10 bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {isEdit ? 'Guardar Cambios' : 'Crear Ejecución'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default EjecucionCrudModal;