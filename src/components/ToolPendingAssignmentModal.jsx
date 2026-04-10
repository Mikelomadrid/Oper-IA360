import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Briefcase, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ToolPendingAssignmentModal = ({ isOpen, onClose, tool, onSuccess }) => {
    const { sessionRole } = useAuth();
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
            // 1. Stock Check (we don't deduct yet, but we shouldn't allow requesting if 0)
            const { data: currentTool, error: toolError } = await supabase
                .from('herramientas')
                .select('id, unidades_disponibles, nombre, ref_almacen')
                .eq('id', tool.id)
                .single();

            if (toolError) throw toolError;

            if (!currentTool || currentTool.unidades_disponibles <= 0) {
                throw new Error(`No hay stock disponible para ${currentTool?.nombre || 'esta herramienta'}.`);
            }

            // 2. Perform Pending Assignment
            // We insert directly into 'herramienta_asignaciones' with estado 'pendiente_aceptacion'
            const { error: insertError } = await supabase
                .from('herramienta_asignaciones')
                .insert({
                    herramienta_id: tool.id,
                    entregada_a: formData.technicianId,
                    entregada_por: sessionRole?.empleadoId,
                    estado: 'pendiente_aceptacion',
                    proyecto_id: null,
                    observaciones: formData.observations,
                    // Note: No fecha_recepcion or fecha_entrega yet, handled upon acceptance if needed
                });

            if (insertError) {
                console.error("Insert error details:", insertError);
                throw new Error("No se pudo crear la solicitud de asignación.");
            }

            toast({
                title: "Asignación Enviada",
                description: "Se ha enviado la asignación. El técnico debe aceptarla para ser efectiva.",
                className: "bg-blue-50 border-blue-200"
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
                    <DialogTitle>Asignar Herramienta al Técnico</DialogTitle>
                    <DialogDescription>
                        Esta acción creará una asignación PENDIENTE. El stock no se descontará hasta que el usuario acepte la herramienta desde sus notificaciones.
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
                                <span className="font-medium">{tool?.nombre} {tool?.modelo ? `(${tool.modelo})` : ''}</span>
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
                                <User className="w-4 h-4" /> Asignar a... *
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
                            <Label>Observaciones de Asignación</Label>
                            <Textarea
                                placeholder="Notas opcionales..."
                                value={formData.observations}
                                onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
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
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Enviar Solicitud
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ToolPendingAssignmentModal;
