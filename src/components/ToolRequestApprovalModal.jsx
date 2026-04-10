import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const ToolRequestApprovalModal = ({ isOpen, onClose, request, onApproved }) => {
    const { sessionRole } = useAuth();
    const [availableTools, setAvailableTools] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedToolId, setSelectedToolId] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !request) return;

        const fetchOptions = async () => {
            setLoading(true);
            // Fetch available tools (stock_disponible > 0)
            const { data: toolsData, error: toolsError } = await supabase
                .from('v_tools_available')
                .select('id, nombre, stock_disponible, categoria_nombre')
                .gt('stock_disponible', 0)
                .order('nombre');

            if (toolsError) {
                toast({ variant: 'destructive', title: 'Error', description: 'Error al cargar herramientas disponibles.' });
                console.error('Error fetching available tools:', toolsError);
            } else {
                setAvailableTools(toolsData);
                // Pre-select tool if request has a tool_id and it's available
                if (request.tool_id && toolsData.some(t => t.id === request.tool_id)) {
                    setSelectedToolId(request.tool_id);
                } else if (request.categoria_id) {
                    // If no specific tool, try to find one from the requested category
                    const toolInCat = toolsData.find(t => t.categoria_id === request.categoria_id);
                    if (toolInCat) setSelectedToolId(toolInCat.id);
                }
            }

            // Fetch projects
            const { data: projectsData, error: projectsError } = await supabase
                .from('proyectos')
                .select('id, nombre_proyecto')
                .order('nombre_proyecto');

            if (projectsError) {
                toast({ variant: 'destructive', title: 'Error', description: 'Error al cargar proyectos.' });
                console.error('Error fetching projects:', projectsError);
            } else {
                setProjects(projectsData);
                // Pre-select project if request has a project_id
                if (request.proyecto_id && projectsData.some(p => p.id === request.proyecto_id)) {
                    setSelectedProjectId(request.proyecto_id);
                }
            }
            setLoading(false);
        };

        fetchOptions();
    }, [isOpen, request]);

    const handleSubmit = async () => {
        if (!selectedToolId || !selectedProjectId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debe seleccionar una herramienta y un proyecto.' });
            return;
        }

        setLoading(true);
        try {
            // 1. Call RPC to create tool assignment
            const { error: rpcError } = await supabase.rpc('api_tool_assignment_create_v2', {
                p_tool_id: selectedToolId,
                p_tecnico_id: request.tecnico_id,
                p_proyecto_id: selectedProjectId
            });

            if (rpcError) throw rpcError;

            // 2. Update tool_requests status
            const { error: updateError } = await supabase
                .from('tool_requests')
                .update({
                    estado: 'aprobada',
                    gestionada_por: sessionRole.empleadoId, // Assuming sessionRole.empleadoId is auth.uid()
                    gestionada_at: new Date().toISOString()
                })
                .eq('id', request.id);

            if (updateError) throw updateError;

            toast({ title: 'Solicitud aprobada', description: 'Herramienta asignada y solicitud actualizada.' });
            onApproved();
            onClose();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al aprobar', description: error.message });
            console.error('Error approving tool request:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Aprobar Solicitud de Herramienta</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="tool-select">Herramienta a asignar</Label>
                        <Select value={selectedToolId} onValueChange={setSelectedToolId} disabled={loading}>
                            <SelectTrigger id="tool-select">
                                <SelectValue placeholder="Seleccionar herramienta..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableTools.map(tool => (
                                    <SelectItem key={tool.id} value={tool.id}>
                                        {tool.nombre} ({tool.stock_disponible} disponibles) - {tool.categoria_nombre}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="project-select">Proyecto</Label>
                        <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={loading}>
                            <SelectTrigger id="project-select">
                                <SelectValue placeholder="Seleccionar proyecto..." />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map(project => (
                                    <SelectItem key={project.id} value={project.id}>
                                        {project.nombre_proyecto}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading || !selectedToolId || !selectedProjectId}>
                        {loading ? <Loader2 className="animate-spin mr-2" /> : 'Aprobar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ToolRequestApprovalModal;