import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, UserCheck, AlertCircle, Calendar, User } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLeadAssignment } from '@/hooks/useLeadAssignment';

export default function LeadAssignmentManager({ leadId, currentUserId, isAdmin }) {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [selectedEmployeeAuthId, setSelectedEmployeeAuthId] = useState('');
    
    // Centralized assignment logic hook
    const { assignLead, assigning } = useLeadAssignment();

    useEffect(() => {
        if (leadId) fetchAssignments();
        if (isAdmin) fetchTechnicians();
    }, [leadId, isAdmin]);

    const fetchAssignments = async () => {
        setLoading(true);
        try {
            const { data: asmData, error: asmError } = await supabase
                .from('leads_asignaciones')
                .select(`
                    id,
                    usuario_id,
                    created_at,
                    asignado_por
                `)
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false });

            if (asmError) throw asmError;

            if (asmData && asmData.length > 0) {
                const userIds = [...new Set([
                    ...asmData.map(a => a.usuario_id),
                    ...asmData.map(a => a.asignado_por)
                ])].filter(id => id && id !== 'null');

                if (userIds.length > 0) {
                    const { data: empData } = await supabase
                        .from('empleados')
                        .select('id, auth_user_id, nombre, apellidos, email, rol')
                        .in('auth_user_id', userIds);
                    
                    const merged = asmData.map(a => {
                        const emp = empData?.find(e => e.auth_user_id === a.usuario_id);
                        const assigner = empData?.find(e => e.auth_user_id === a.asignado_por);
                        
                        return { 
                            ...a, 
                            employee: emp || { nombre: 'Usuario', apellidos: 'Desconocido', email: 'Desconocido', auth_user_id: a.usuario_id },
                            assigner_name: assigner ? `${assigner.nombre} ${assigner.apellidos || ''}` : 'Sistema'
                        };
                    });
                    setAssignments(merged);
                } else {
                     const merged = asmData.map(a => ({
                        ...a,
                        employee: { nombre: 'Usuario', apellidos: 'Desconocido', email: 'Desconocido', auth_user_id: a.usuario_id },
                        assigner_name: 'Sistema'
                     }));
                     setAssignments(merged);
                }
            } else {
                setAssignments([]);
            }
        } catch (error) {
            console.error("Error fetching assignments:", error);
            setAssignments([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchTechnicians = async () => {
        setLoadingEmployees(true);
        try {
            const { data, error } = await supabase
                .from('empleados')
                .select('id, auth_user_id, nombre, apellidos, email, rol')
                .eq('activo', true)
                .in('rol', ['tecnico', 'encargado', 'admin']) 
                .not('auth_user_id', 'is', null) 
                .order('nombre');
            
            if (error) throw error;
            setEmployees(data ? data.filter(e => e.auth_user_id) : []); 
        } catch (error) {
            console.error("Error fetching technicians:", error);
        } finally {
            setLoadingEmployees(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedEmployeeAuthId || selectedEmployeeAuthId === 'null') return;
        
        // Call the centralized hook
        const result = await assignLead(leadId, selectedEmployeeAuthId, currentUserId);

        if (result.success) {
            toast({ title: "Asignación exitosa", description: "El técnico ha sido añadido y notificado." });
            setSelectedEmployeeAuthId('');
            fetchAssignments();
        } else if (result.error === 'assigned_already') {
            toast({ variant: "warning", title: "Ya asignado", description: "Este técnico ya está asignado al lead." });
        } else {
            toast({ variant: "destructive", title: "Error", description: "No se pudo realizar la asignación." });
        }
    };

    const handleUnassign = async (assignmentId) => {
        try {
            const { error } = await supabase
                .from('leads_asignaciones')
                .delete()
                .eq('id', assignmentId);
            
            if (error) throw error;
            toast({ title: "Asignación eliminada" });
            fetchAssignments();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la asignación." });
        }
    };

    const assignedUserIds = new Set(assignments.map(a => a.usuario_id));
    const availableEmployees = employees.filter(e => !assignedUserIds.has(e.auth_user_id));

    const isAssignedToMe = assignments.some(a => a.usuario_id === currentUserId);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-primary" /> 
                    Personal Asignado
                </h3>
                {isAssignedToMe && !isAdmin && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 animate-in fade-in zoom-in">
                        Acceso concedido
                    </Badge>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground w-6 h-6" /></div>
            ) : (
                <div className="space-y-3">
                    {assignments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-muted/10 border-dashed text-muted-foreground text-center">
                            <User className="w-8 h-8 opacity-20 mb-2" />
                            <p>No hay técnicos asignados todavía.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3 animate-in slide-in-from-bottom-2 duration-300">
                            {assignments.map((assign) => (
                                <div key={assign.id} className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border">
                                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                                {assign.employee.nombre?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-medium text-foreground">
                                                {assign.employee.nombre} {assign.employee.apellidos}
                                            </p>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> 
                                                    {new Date(assign.created_at).toLocaleDateString()}
                                                </span>
                                                <span className="hidden sm:flex items-center gap-1" title="Asignado por">
                                                    <UserCheck className="w-3 h-3" /> 
                                                    Por: {assign.assigner_name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {isAdmin && (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-70 group-hover:opacity-100"
                                            onClick={() => handleUnassign(assign.id)}
                                            title="Retirar asignación"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isAdmin && (
                <div className="pt-6 border-t mt-6">
                    <label className="text-sm font-medium mb-3 block text-foreground">Añadir Nuevo Técnico</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 min-w-0">
                            <Select value={selectedEmployeeAuthId} onValueChange={setSelectedEmployeeAuthId} disabled={loadingEmployees}>
                                <SelectTrigger className="w-full bg-background">
                                    <SelectValue placeholder={loadingEmployees ? "Cargando técnicos..." : "Seleccionar técnico..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    <ScrollArea className="h-[200px]">
                                        {availableEmployees.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground text-center">
                                                {loadingEmployees ? "Cargando..." : "No hay técnicos disponibles"}
                                            </div>
                                        ) : (
                                            availableEmployees.map(emp => (
                                                <SelectItem key={emp.id} value={emp.auth_user_id} className="cursor-pointer">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{emp.nombre} {emp.apellidos}</span>
                                                        <span className="text-xs text-muted-foreground capitalize">{emp.rol}</span>
                                                    </div>
                                                </SelectItem>
                                            ))
                                        )}
                                    </ScrollArea>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button 
                            onClick={handleAssign} 
                            disabled={!selectedEmployeeAuthId || assigning} 
                            className="bg-primary hover:bg-primary/90 min-w-[120px]"
                        >
                            {assigning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Asignar
                        </Button>
                    </div>
                    {availableEmployees.length === 0 && !loadingEmployees && employees.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5 bg-muted/50 p-2 rounded">
                            <AlertCircle className="w-3 h-3 text-amber-500" /> 
                            Todos los técnicos disponibles ya están asignados.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}