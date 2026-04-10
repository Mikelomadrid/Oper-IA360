import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Wrench, Briefcase, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useDebounce } from '@/hooks/useDebounce';

const EmployeeToolAssignmentModal = ({ isOpen, onClose, employeeId, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [projects, setProjects] = useState([]);
    const [tools, setTools] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [searchingTools, setSearchingTools] = useState(false);
    
    const [formData, setFormData] = useState({
        toolId: '',
        projectId: 'none',
        observations: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            setFormData({
                toolId: '',
                projectId: 'none',
                observations: ''
            });
            setSearchTerm('');
            setTools([]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            searchTools(debouncedSearch);
        }
    }, [debouncedSearch, isOpen]);

    const fetchInitialData = async () => {
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

    const searchTools = async (query) => {
        setSearchingTools(true);
        try {
            let builder = supabase
                .from('herramientas')
                .select('id, nombre, marca, modelo, ref_almacen, unidades_disponibles, unidades_totales, categoria_id')
                .gt('unidades_disponibles', 0) // Only available tools
                .eq('activa', true)
                .order('nombre');

            if (query) {
                builder = builder.or(`nombre.ilike.%${query}%,marca.ilike.%${query}%,modelo.ilike.%${query}%,ref_almacen.ilike.%${query}%`);
            } else {
                builder = builder.limit(20); // Initial limit
            }

            const { data, error } = await builder;
            if (error) throw error;
            setTools(data || []);
        } catch (error) {
            console.error("Error searching tools:", error);
        } finally {
            setSearchingTools(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.toolId) {
            toast({ variant: "destructive", title: "Falta herramienta", description: "Debes seleccionar una herramienta." });
            return;
        }

        setSubmitting(true);
        try {
            // Verify stock one last time
            const { data: currentTool, error: toolError } = await supabase
                .from('herramientas')
                .select('id, unidades_disponibles, nombre')
                .eq('id', formData.toolId)
                .single();

            if (toolError) throw toolError;

            if (!currentTool || currentTool.unidades_disponibles <= 0) {
                throw new Error(`No hay stock disponible para ${currentTool?.nombre || 'esta herramienta'}.`);
            }

            const { error } = await supabase.rpc('rpc_asignar_herramienta_directa', {
                p_herramienta_id: formData.toolId,
                p_tecnico_id: employeeId,
                p_proyecto_id: formData.projectId === 'none' ? null : formData.projectId,
                p_observaciones: formData.observations
            });

            if (error) throw error;

            toast({ 
                title: "Herramienta Asignada", 
                description: "La herramienta se ha asignado correctamente al empleado.",
                className: "bg-green-50 border-green-200"
            });
            
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Assignment error:", error);
            toast({ variant: "destructive", title: "Error al asignar", description: error.message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Asignar Herramienta</DialogTitle>
                    <DialogDescription>
                        Busca y selecciona una herramienta disponible para asignar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Wrench className="w-4 h-4" /> Herramienta
                        </Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, marca, ref..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {searchingTools ? (
                            <div className="text-xs text-center py-2 text-muted-foreground">Buscando...</div>
                        ) : (
                            <Select 
                                value={formData.toolId} 
                                onValueChange={(val) => setFormData(prev => ({ ...prev, toolId: val }))}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecciona una herramienta disponible" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                    {tools.length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground text-center">No hay herramientas disponibles que coincidan.</div>
                                    ) : (
                                        tools.map(tool => (
                                            <SelectItem key={tool.id} value={tool.id}>
                                                <span className="font-medium">{tool.nombre}</span>
                                                <span className="text-muted-foreground ml-2 text-xs">
                                                    ({tool.marca} - {tool.ref_almacen}) - Stock: {tool.unidades_disponibles}
                                                </span>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4" /> Proyecto (Opcional)
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
                            placeholder="Notas adicionales..."
                            value={formData.observations}
                            onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={submitting || !formData.toolId}
                    >
                        {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Asignar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EmployeeToolAssignmentModal;