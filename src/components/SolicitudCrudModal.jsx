import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const SolicitudCrudModal = ({ isOpen, onClose, onSuccess, initialData }) => {
    const { sessionRole } = useAuth();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [tools, setTools] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [projects, setProjects] = useState([]);

    const [formData, setFormData] = useState({
        herramienta_id: '',
        solicitada_por: '',
        proyecto_id: 'none',
        mensaje: '',
        estado: 'pendiente'
    });

    useEffect(() => {
        if (isOpen) {
            fetchDictionaries();
            if (initialData) {
                setFormData({
                    herramienta_id: initialData.herramientas?.id || initialData.herramienta_id || '',
                    solicitada_por: initialData.empleados?.id || initialData.solicitada_por || '',
                    proyecto_id: initialData.proyecto_id || 'none',
                    mensaje: initialData.mensaje || '',
                    estado: initialData.estado || 'pendiente'
                });
            } else {
                setFormData({
                    herramienta_id: '',
                    solicitada_por: '', // Could default to current user if they are a tech, but admin creates for others usually
                    proyecto_id: 'none',
                    mensaje: '',
                    estado: 'pendiente'
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
                .select('id, nombre, ref_almacen, marca, modelo')
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
            toast({ variant: "destructive", title: "Error", description: "Error al cargar listas de selección." });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.herramienta_id || !formData.solicitada_por) {
            toast({ variant: "destructive", title: "Faltan datos", description: "Herramienta y Técnico son obligatorios." });
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                herramienta_id: formData.herramienta_id,
                solicitada_por: formData.solicitada_por,
                proyecto_id: formData.proyecto_id === 'none' ? null : formData.proyecto_id,
                mensaje: formData.mensaje,
                estado: formData.estado,
                updated_at: new Date().toISOString()
            };

            if (initialData?.id) {
                // Update
                const { error } = await supabase
                    .from('herramienta_solicitudes')
                    .update(payload)
                    .eq('id', initialData.id);
                if (error) throw error;
                toast({ title: "Solicitud actualizada" });
            } else {
                // Create
                payload.created_at = new Date().toISOString();
                const { error } = await supabase
                    .from('herramienta_solicitudes')
                    .insert([payload]);
                if (error) throw error;
                toast({ title: "Solicitud creada" });
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error saving request:", error);
            toast({ variant: "destructive", title: "Error al guardar", description: error.message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Editar Solicitud' : 'Nueva Solicitud de Herramienta'}</DialogTitle>
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
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                        {tools.map(t => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.nombre} - {t.marca} ({t.ref_almacen})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Técnico Solicitante *</Label>
                                <Select 
                                    value={formData.solicitada_por} 
                                    onValueChange={(val) => setFormData(prev => ({...prev, solicitada_por: val}))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                        {technicians.map(t => (
                                            <SelectItem key={t.id} value={t.id}>
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
                                            <SelectItem key={p.id} value={p.id}>
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
                                        <SelectItem value="pendiente">Pendiente</SelectItem>
                                        <SelectItem value="aprobada">Aprobada</SelectItem>
                                        <SelectItem value="rechazada">Rechazada</SelectItem>
                                        <SelectItem value="atendida">Atendida (Cerrada)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Mensaje / Motivo</Label>
                            <Textarea 
                                value={formData.mensaje} 
                                onChange={(e) => setFormData(prev => ({...prev, mensaje: e.target.value}))}
                                placeholder="Describe el motivo de la solicitud..."
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

export default SolicitudCrudModal;