import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const ReassignToolModal = ({ isOpen, onClose, toolId, toolName, currentEmployeeId }) => {
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
            setSelectedEmployee('');
        }
    }, [isOpen]);

    const fetchEmployees = async () => {
        setFetching(true);
        try {
            // Use RPC 'sel_empleados' to bypass RLS policies that might prevent 
            // technicians from listing other employees directly from the table.
            // This function returns { id, label, value } where label is "Nombre Apellidos"
            const { data, error } = await supabase.rpc('sel_empleados');

            if (error) throw error;
            
            // Filter out the current user so they don't reassign to themselves
            const filtered = (data || []).filter(emp => emp.id !== currentEmployeeId);
            
            setEmployees(filtered);
        } catch (error) {
            console.error("Error fetching employees:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los empleados." });
        } finally {
            setFetching(false);
        }
    };

    const handleReassign = async () => {
        if (!selectedEmployee) return;
        setLoading(true);
        try {
            const { error } = await supabase.rpc('api_iniciar_traspaso', {
                p_herramienta_id: toolId,
                p_hacia_empleado_id: selectedEmployee
            });

            if (error) throw error;

            toast({
                title: "Solicitud enviada",
                description: "El compañero deberá aceptar el traspaso para completar el proceso."
            });
            onClose();
        } catch (error) {
            console.error("Error initiating transfer:", error);
            toast({
                variant: "destructive",
                title: "Error al reasignar",
                description: error.message || "No se pudo iniciar el traspaso."
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5 text-primary" />
                        Reasignar Herramienta
                    </DialogTitle>
                    <DialogDescription>
                        Vas a transferir <strong>{toolName}</strong> a otro compañero. La herramienta seguirá bajo tu responsabilidad hasta que sea aceptada.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Seleccionar Compañero</Label>
                        <Select value={selectedEmployee} onValueChange={setSelectedEmployee} disabled={loading || fetching}>
                            <SelectTrigger>
                                <SelectValue placeholder={fetching ? "Cargando..." : "Selecciona un empleado"} />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.length === 0 ? (
                                    <SelectItem value="no-employees" disabled>
                                        {fetching ? "Cargando..." : "No hay empleados disponibles"}
                                    </SelectItem>
                                ) : (
                                    employees.map((emp) => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.label}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleReassign} disabled={loading || !selectedEmployee || selectedEmployee === 'no-employees'}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enviar Solicitud
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ReassignToolModal;