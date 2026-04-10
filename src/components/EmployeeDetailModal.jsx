import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, User, Briefcase, Mail, Phone, Euro, Building2 } from 'lucide-react';

const EmployeeDetailModal = ({ employeeId, isOpen, onClose }) => {
    const [detalleEmpleado, setDetalleEmpleado] = useState(null);
    const [detalleError, setDetalleError] = useState(null);
    const [loading, setLoading] = useState(false);

    const dsEmpleadoDetalle = useCallback(async () => {
        if (!employeeId) return;

        setLoading(true);
        setDetalleError(null);
        setDetalleEmpleado(null);

        try {
            const { data, error } = await supabase
                .from('v_empleado_detalle')
                .select('*')
                .eq('id', employeeId)
                .limit(1);

            if (error) throw error;

            if (Array.isArray(data) && data.length > 0) {
                setDetalleEmpleado(data[0]);
                setDetalleError(null);
            } else {
                setDetalleEmpleado(null);
                setDetalleError("Empleado no encontrado.");
            }
        } catch (error) {
            setDetalleEmpleado(null);
            setDetalleError(error.message);
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    useEffect(() => {
        if (isOpen && employeeId) {
            dsEmpleadoDetalle();
        }
    }, [isOpen, employeeId, dsEmpleadoDetalle]);

    const getStatusText = (emp) => {
        if (emp.baja) return "De baja 🚫";
        if (emp.vacaciones) return "De vacaciones 🌴";
        if (emp.activo) return "Activo ✅";
        return "Inactivo";
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="mt-4 text-muted-foreground">Cargando ficha...</p>
                </div>
            );
        }

        if (detalleError) {
            return (
                <Alert variant="destructive" className="m-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{detalleError}</AlertDescription>
                </Alert>
            );
        }

        if (detalleEmpleado) {
            return (
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-muted rounded-full">
                            <User className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{detalleEmpleado.nombre} {detalleEmpleado.apellidos ?? ''}</h2>
                            <p className="text-muted-foreground">{getStatusText(detalleEmpleado)}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                        <div className="flex items-center gap-3"><Briefcase className="w-5 h-5 text-muted-foreground" /><span className="font-medium">Rol:</span> <span className="capitalize">{detalleEmpleado.rol}</span></div>
                        <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-muted-foreground" /><span className="font-medium">Email:</span> <a href={`mailto:${detalleEmpleado.email}`} className="text-primary hover:underline truncate">{detalleEmpleado.email}</a></div>
                        <div className="flex items-center gap-3"><Phone className="w-5 h-5 text-muted-foreground" /><span className="font-medium">Teléfono:</span> <a href={`tel:${detalleEmpleado.telefono}`} className="text-primary hover:underline">{detalleEmpleado.telefono || '—'}</a></div>
                        <div className="flex items-center gap-3"><Building2 className="w-5 h-5 text-muted-foreground" /><span className="font-medium">Tel. Empresa:</span> <a href={`tel:${detalleEmpleado.telefono_empresa}`} className="text-primary hover:underline">{detalleEmpleado.telefono_empresa || '—'}</a></div>
                        <div className="flex items-center gap-3"><Euro className="w-5 h-5 text-muted-foreground" /><span className="font-medium">Coste/Hora:</span> <span>{detalleEmpleado.costo_por_hora != null ? `${detalleEmpleado.costo_por_hora} €` : '—'}</span></div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[525px] bg-card p-0">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle>Ficha de Empleado</DialogTitle>
                </DialogHeader>
                {renderContent()}
                <DialogFooter className="p-6 pt-0">
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EmployeeDetailModal;