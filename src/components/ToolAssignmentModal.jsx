import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Briefcase, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const ToolAssignmentModal = ({ isOpen, onClose, tool, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [formData, setFormData] = useState({
        technicianId: '',
        observations: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchData();
            setFormData({
                technicianId: '',
                observations: ''
            });
        }
    }, [isOpen]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch technicians
            const { data: emps, error: empError } = await supabase
                .from('empleados')
                .select('id, nombre, apellidos, email')
                .eq('activo', true)
                .order('nombre');

            if (empError) throw empError;

            setEmployees(emps || []);

        } catch (error) {
            console.error("Error fetching data for assignment:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar empleados o proyectos." });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.technicianId) {
            toast({ variant: "destructive", title: "Falta técnico", description: "Debes seleccionar un empleado." });
            return;
        }

        setSubmitting(true);
        try {
            // 1. Stock Check: Verify real-time availability from 'herramientas' table
            // We check 'unidades_disponibles' directly.
            const { data: currentTool, error: toolError } = await supabase
                .from('herramientas')
                .select('id, unidades_disponibles, unidades_totales, nombre')
                .eq('id', tool.id)
                .single();

            if (toolError) throw toolError;

            if (!currentTool || currentTool.unidades_disponibles <= 0) {
                throw new Error(`No hay stock disponible para ${currentTool?.nombre || 'esta herramienta'}.`);
            }

            // The RPC 'rpc_asignar_herramienta_directa' handles:
            // - Creating the new record in 'herramienta_asignaciones'
            // - Decrementing 'unidades_disponibles' by 1
            const { error } = await supabase.rpc('rpc_asignar_herramienta_directa', {
                p_herramienta_id: tool.id,
                p_tecnico_id: formData.technicianId,
                p_observaciones: formData.observations
            });

            if (error) throw error;

            toast({
                title: "Asignación Completada",
                description: "La herramienta ha sido asignada y el stock actualizado.",
                className: "bg-green-50 border-green-200"
            });

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Assignment error:", error);

            let msg = error.message;
            if (error.message?.includes("violates unique constraint")) {
                // This shouldn't happen for multi-stock items if logic is correct, but keeping for safety
                msg = "Error de restricción única. Verifica si este técnico ya tiene esta herramienta específica.";
            } else if (error.message?.includes("No hay stock")) {
                msg = error.message;
            }

            toast({ variant: "destructive", title: "Error al asignar", description: msg });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Asignar Herramienta (Directa)</DialogTitle>
                    <DialogDescription>
                        Esta acción asignará una unidad del stock disponible al técnico seleccionado.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="p-3 bg-muted/50 rounded-md border text-sm space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Herramienta:</span>
                                <span className="font-medium">{tool?.marca} {tool?.modelo}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Ref:</span>
                                <span className="font-mono text-xs">{tool?.ref_almacen}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 mt-1 border-t border-border/50">
                                <span className="text-muted-foreground">Stock Actual:</span>
                                <span className={`font-bold ${tool?.unidades_disponibles > 0 ? 'text-green-600' : 'text-destructive'}`}>
                                    {tool?.unidades_disponibles} / {tool?.unidades_totales}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <User className="w-4 h-4" /> Técnico / Empleado *
                            </Label>
                            <Select
                                value={formData.technicianId}
                                onValueChange={(val) => setFormData(prev => ({ ...prev, technicianId: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar empleado..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.nombre} {emp.apellidos}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Observaciones / Notas (Opcional)</Label>
                            <Textarea
                                value={formData.observations}
                                onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                                placeholder="Añade cualquier nota sobre el estado o la entrega..."
                                rows={3}
                            />
                        </div>

                        {tool?.unidades_disponibles < 1 && (
                            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                                <AlertCircle className="w-4 h-4" />
                                <span>No hay stock disponible para asignar.</span>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || loading || !formData.technicianId || tool?.unidades_disponibles < 1}
                        className="gap-2"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Asignar Ahora
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ToolAssignmentModal;