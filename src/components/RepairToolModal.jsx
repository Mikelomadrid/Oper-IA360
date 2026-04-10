import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wrench } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const RepairToolModal = ({ isOpen, onClose, tool, onSuccess }) => {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!reason.trim()) {
            toast({ variant: "destructive", title: "Requerido", description: "Debes indicar el motivo de la reparación." });
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.rpc('rpc_send_unit_to_repair', {
                p_herramienta_id: tool.id,
                p_motivo: reason
            });

            if (error) throw error;

            toast({ 
                title: "Enviado a reparación", 
                description: `La herramienta ${tool.nombre} ha sido marcada para reparación.` 
            });
            
            if (onSuccess) onSuccess();
            onClose();
            setReason('');
        } catch (error) {
            console.error("Error sending to repair:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo enviar a reparación." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-yellow-600" />
                        Enviar a Reparación
                    </DialogTitle>
                    <DialogDescription>
                        Indica el motivo por el cual envías la herramienta <strong>{tool?.nombre}</strong> al taller.
                        Esto descontará 1 unidad del stock disponible.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="reason">Motivo de la avería / Mantenimiento</Label>
                        <Textarea
                            id="reason"
                            placeholder="Ej: El motor hace ruido extraño, cable dañado..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={4}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="bg-yellow-600 hover:bg-yellow-700 text-white">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Envío
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RepairToolModal;