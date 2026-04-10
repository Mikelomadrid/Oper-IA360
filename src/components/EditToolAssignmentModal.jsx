import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Briefcase } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const EditToolAssignmentModal = ({ isOpen, onClose, assignment, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState([]);
    const [formData, setFormData] = useState({
        projectId: 'none',
        observations: ''
    });

    useEffect(() => {
        if (isOpen && assignment) {
            fetchProjects();
            setFormData({
                projectId: assignment.proyecto_id || 'none',
                observations: assignment.observaciones || ''
            });
        }
    }, [isOpen, assignment]);

    const fetchProjects = async () => {
        try {
            const { data: projs } = await supabase
                .from('proyectos')
                .select('id, nombre_proyecto')
                .eq('estado', 'activo')
                .order('nombre_proyecto');
            setProjects(projs || []);
        } catch (error) {
            console.error("Error fetching projects:", error);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('herramienta_asignaciones')
                .update({
                    proyecto_id: formData.projectId === 'none' ? null : formData.projectId,
                    observaciones: formData.observations
                })
                .eq('id', assignment.id);

            if (error) throw error;

            toast({ title: "Actualizado", description: "La asignación ha sido actualizada." });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Error updating assignment:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la asignación." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar Asignación</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="p-3 bg-muted rounded-md text-sm mb-4">
                        <p><strong>Herramienta:</strong> {assignment?.herramienta?.nombre}</p>
                        <p className="text-xs text-muted-foreground">Ref: {assignment?.herramienta?.ref_almacen}</p>
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4" /> Proyecto
                        </Label>
                        <Select 
                            value={formData.projectId} 
                            onValueChange={(val) => setFormData(prev => ({ ...prev, projectId: val }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar proyecto..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                <SelectItem value="none">-- Ninguno / General --</SelectItem>
                                {projects.map(proj => (
                                    <SelectItem key={proj.id} value={proj.id}>
                                        {proj.nombre_proyecto}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Observaciones</Label>
                        <Textarea 
                            value={formData.observations}
                            onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                            rows={4}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Guardar Cambios
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EditToolAssignmentModal;