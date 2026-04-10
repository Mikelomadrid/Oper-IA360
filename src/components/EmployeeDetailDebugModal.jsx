import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

const EmployeeDetailDebugModal = ({ employeeId, isOpen, onClose }) => {
    const [currentId, setCurrentId] = useState(employeeId);
    const [detalleJson, setDetalleJson] = useState("");
    const [detalleError, setDetalleError] = useState(null);
    const [loading, setLoading] = useState(false);

    const runDsEmpleadoDetalleDebug = useCallback(async (idToFetch) => {
        if (!idToFetch) {
            setDetalleError("Sin ID para buscar.");
            return;
        }
        setLoading(true);
        setDetalleError(null);
        setDetalleJson("");

        try {
            const { data, error } = await supabase
                .from('v_empleado_detalle')
                .select('*')
                .eq('id', idToFetch)
                .limit(1);

            if (error) {
                throw error;
            }

            if (Array.isArray(data) && data.length > 0) {
                setDetalleJson(JSON.stringify(data[0], null, 2));
                setDetalleError(null);
            } else {
                setDetalleJson("");
                setDetalleError("Sin filas para ese ID.");
            }
        } catch (error) {
            setDetalleJson("");
            setDetalleError(error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen && currentId) {
            runDsEmpleadoDetalleDebug(currentId);
        }
    }, [isOpen, currentId, runDsEmpleadoDetalleDebug]);
    
    useEffect(() => {
        setCurrentId(employeeId);
    }, [employeeId]);

    const handleForceIsrael = () => {
        const israelId = "06b2c336-db5b-4a3c-91d9-8a2c9dc90bf5";
        setCurrentId(israelId);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>DEBUG Detalle empleado</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <p className="text-sm font-medium">selectedEmpleadoId = <span className="font-mono text-primary">{currentId || '—'}</span></p>
                    </div>
                    <div>
                        <p className="text-sm font-medium">Error = <span className="font-mono text-destructive">{detalleError || '—'}</span></p>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Respuesta JSON</label>
                        <div className="relative mt-1">
                            <Textarea
                                readOnly
                                value={detalleJson || '—'}
                                className="h-64 font-mono text-xs bg-muted"
                                placeholder="Esperando respuesta..."
                            />
                            {loading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter className="justify-between">
                    <Button variant="secondary" onClick={handleForceIsrael}>Forzar con Israel</Button>
                    <Button onClick={onClose}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EmployeeDetailDebugModal;