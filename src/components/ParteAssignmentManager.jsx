import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserCheck, User, Calendar, Save } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function ParteAssignmentManager({ parteId, currentTechnicianId, onAssign, isAdmin }) {
    const [employees, setEmployees] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [selectedTechnician, setSelectedTechnician] = useState(currentTechnicianId ? currentTechnicianId.toString() : 'unassigned');
    const [assigning, setAssigning] = useState(false);
    const [currentTechDetails, setCurrentTechDetails] = useState(null);

    useEffect(() => {
        fetchEmployees();
    }, []);

    useEffect(() => {
        setSelectedTechnician(currentTechnicianId ? currentTechnicianId.toString() : 'unassigned');
        if (currentTechnicianId && employees.length > 0) {
            const tech = employees.find(e => e.id === currentTechnicianId);
            setCurrentTechDetails(tech);
        } else {
            setCurrentTechDetails(null);
        }
    }, [currentTechnicianId, employees]);

    const fetchEmployees = async () => {
        setLoadingEmployees(true);
        try {
            const { data, error } = await supabase
                .from('empleados')
                .select('id, nombre, apellidos, rol, email')
                .eq('activo', true)
                .order('nombre');
            
            if (error) throw error;
            setEmployees(data || []);
        } catch (error) {
            console.error("Error fetching employees:", error);
        } finally {
            setLoadingEmployees(false);
        }
    };

    const handleSaveAssignment = async () => {
        setAssigning(true);
        try {
            const newTechId = selectedTechnician === 'unassigned' ? null : selectedTechnician;
            
            const { error } = await supabase
                .from('partes')
                .update({ tecnico_asignado_id: newTechId })
                .eq('id', parteId);

            if (error) throw error;

            // Log activity
            const { data: userEmp } = await supabase.from('empleados').select('id').eq('auth_user_id', (await supabase.auth.getUser()).data.user.id).single();
            const actorId = userEmp?.id;

            if (actorId) {
                const techName = employees.find(e => e.id === newTechId)?.nombre || 'Nadie';
                await supabase.from('partes_actividad').insert({
                    parte_id: parteId,
                    usuario_id: actorId,
                    contenido: `Técnico reasignado a: ${techName}`,
                    tipo: 'cambio_estado',
                    fecha_creacion: new Date().toISOString()
                });
            }

            toast({ title: "Asignación actualizada", description: "El técnico responsable ha sido actualizado." });
            if (onAssign) onAssign();
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la asignación." });
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-primary" /> 
                    Responsable del Servicio
                </h3>
            </div>

            {/* Current Assignment Card */}
            <Card className="border-l-4 border-l-primary">
                <CardContent className="p-4 flex items-center gap-4">
                    <Avatar className="h-12 w-12 border">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                            {currentTechDetails ? currentTechDetails.nombre.charAt(0).toUpperCase() : '?'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <p className="font-semibold text-base">
                            {currentTechDetails ? `${currentTechDetails.nombre} ${currentTechDetails.apellidos || ''}` : 'Sin Asignar'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {currentTechDetails ? (currentTechDetails.rol || 'Técnico') : 'Pendiente de asignación'}
                        </p>
                    </div>
                    {currentTechDetails && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                            Activo
                        </Badge>
                    )}
                </CardContent>
            </Card>

            {isAdmin && (
                <div className="pt-6 border-t mt-6 bg-muted/10 p-4 rounded-lg">
                    <label className="text-sm font-medium mb-3 block text-foreground">Cambiar Asignación</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <Select value={selectedTechnician} onValueChange={setSelectedTechnician} disabled={loadingEmployees}>
                                <SelectTrigger className="w-full bg-background">
                                    <SelectValue placeholder="Seleccionar técnico..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">-- Sin Asignar --</SelectItem>
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.nombre} {emp.apellidos} ({emp.rol})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button 
                            onClick={handleSaveAssignment} 
                            disabled={assigning || loadingEmployees} 
                            className="bg-primary hover:bg-primary/90"
                        >
                            {assigning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Guardar Cambios
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}