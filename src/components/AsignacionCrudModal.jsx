import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const AsignacionCrudModal = ({ isOpen, onClose, onSuccess, initialData }) => {
    const { sessionRole } = useAuth();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [tools, setTools] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [projects, setProjects] = useState([]);

    const [formData, setFormData] = useState({
        herramienta_id: '',
        entregada_a: '',
        proyecto_id: 'none',
        estado: 'pendiente_aceptacion', // Default valid state
        observaciones: ''
    });

    // Function to clean initial status if it comes as invalid string from DB
    const cleanInitialStatus = (status) => {
        const validStates = ['pendiente_aceptacion', 'en_uso', 'pendiente_revision', 'devuelta'];
        if (validStates.includes(status)) return status;
        return 'pendiente_aceptacion'; // Fallback if invalid
    };

    useEffect(() => {
        if (isOpen) {
            fetchDictionaries();
            if (initialData) {
                setFormData({
                    herramienta_id: initialData.herramientas?.id || initialData.herramienta_id || '',
                    entregada_a: initialData.empleados?.id || initialData.entregada_a || '',
                    proyecto_id: initialData.proyecto_id || 'none',
                    estado: cleanInitialStatus(initialData.estado),
                    observaciones: initialData.observaciones || ''
                });
            } else {
                setFormData({
                    herramienta_id: '',
                    entregada_a: '',
                    proyecto_id: 'none',
                    estado: 'pendiente_aceptacion',
                    observaciones: ''
                });
            }
        }
    }, [isOpen, initialData]);

    const fetchDictionaries = async () => {
        setLoading(true);
        try {
            // Fetch Tools
            const { data: toolsData } = await supabase
                .from('herramientas')
                .select('id, nombre, ref_almacen, marca')
                .eq('activa', true)
                .order('nombre');
            setTools(toolsData || []);

            // Fetch Technicians
            const { data: techsData } = await supabase
                .from('empleados')
                .select('id, nombre, apellidos')
                .eq('activo', true)
                .order('nombre');
            setTechnicians(techsData || []);

            // Fetch Projects
            const { data: projectsData } = await supabase
                .from('proyectos')
                .select('id, nombre_proyecto')
                .eq('estado', 'activo')
                .order('nombre_proyecto');
            setProjects(projectsData || []);

        } catch (error) {
            console.error("Error loading dictionaries:", error);
            toast({ variant: "destructive", title: "Error", description: "Error al cargar listas." });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.herramienta_id || !formData.entregada_a) {
            toast({ variant: "destructive", title: "Faltan datos", description: "Herramienta y Técnico son obligatorios." });
            return;
        }

        setSubmitting(true);
        try {
            // Constraints check on create
            if (!initialData?.id) {
                const { data: activeAssignments } = await supabase
                    .from('herramienta_asignaciones')
                    .select('id')
                    .eq('herramienta_id', formData.herramienta_id)
                    .in('estado', ['pendiente_aceptacion', 'en_uso', 'pendiente_revision']);
                
                if (activeAssignments?.length > 0) {
                    throw new Error("Esta herramienta ya tiene una asignación activa.");
                }
            }

            const payload = {
                herramienta_id: formData.herramienta_id,
                entregada_a: formData.entregada_a,
                proyecto_id: formData.proyecto_id === 'none' ? null : formData.proyecto_id,
                estado: formData.estado, // Now guaranteed to be a valid enum value from select
                observaciones: formData.observaciones,
                updated_at: new Date().toISOString()
            };

            // Ensure 'entregada_por' is set on create
            if (!initialData?.id) {
                // If user role has ID, use it, else fallback to auth user (might fail if no employee record)
                payload.entregada_por = sessionRole.empleadoId || (await supabase.auth.getUser()).data.user.id; 
                payload.created_at = new Date().toISOString();
            }

            if (initialData?.id) {
                // Update
                const { error } = await supabase
                    .from('herramienta_asignaciones')
                    .update(payload)
                    .eq('id', initialData.id);
                if (error) throw error;
                toast({ title: "Asignación actualizada" });
            } else {
                // Create
                const { error } = await supabase
                    .from('herramienta_asignaciones')
                    .insert([payload]);
                if (error) throw error;
                
                // Trigger stock update via RPC just in case, or manual logic in View
                toast({ title: "Asignación creada" });
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error saving assignment:", error);
            toast({ variant: "destructive", title: "Error al guardar", description: error.message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Editar Asignación' : 'Nueva Asignación Directa'}</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : (
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Herramienta *</Label>
                                <Select 
                                    value={formData.herramienta_id} 
                                    onValueChange={(val) => setFormData(prev => ({...prev, herramienta_id: val}))}
                                    disabled={!!initialData} 
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                        {tools.map(t => (
                                            // Guardrail: Ensure value is not empty
                                            <SelectItem key={t.id} value={t.id || "unknown"}>
                                                {t.nombre} ({t.ref_almacen})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Asignada a (Técnico) *</Label>
                                <Select 
                                    value={formData.entregada_a} 
                                    onValueChange={(val) => setFormData(prev => ({...prev, entregada_a: val}))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                        {technicians.map(t => (
                                            // Guardrail: Ensure value is not empty
                                            <SelectItem key={t.id} value={t.id || "unknown"}>
                                                {t.nombre} {t.apellidos}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Proyecto</Label>
                                <Select 
                                    value={formData.proyecto_id} 
                                    onValueChange={(val) => setFormData(prev => ({...prev, proyecto_id: val}))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                        <SelectItem value="none">-- General / Ninguno --</SelectItem>
                                        {projects.map(p => (
                                            // Guardrail: Ensure value is not empty
                                            <SelectItem key={p.id} value={p.id || "unknown"}>
                                                {p.nombre_proyecto}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Estado</Label>
                                <Select 
                                    value={formData.estado} 
                                    onValueChange={(val) => setFormData(prev => ({...prev, estado: val}))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Estado..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pendiente_aceptacion">Pendiente Aceptación</SelectItem>
                                        <SelectItem value="en_uso">En Uso (Entregada)</SelectItem>
                                        <SelectItem value="pendiente_revision">Pendiente Revisión (Devolución)</SelectItem>
                                        <SelectItem value="devuelta">Devuelta / Cerrada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Observaciones</Label>
                            <Textarea 
                                value={formData.observaciones} 
                                onChange={(e) => setFormData(prev => ({...prev, observaciones: e.target.value}))}
                                placeholder="Notas sobre la entrega..."
                                rows={3}
                            />
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={submitting || loading}>
                        {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        <Save className="w-4 h-4 mr-2" /> Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AsignacionCrudModal;