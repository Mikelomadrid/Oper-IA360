import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

export default function KilometrajeModal({ isOpen, onClose, vehicle, onSave }) {
    const [formData, setFormData] = useState({
        fecha: new Date().toISOString().split('T')[0],
        km: '',
        observacion: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                fecha: new Date().toISOString().split('T')[0],
                km: '',
                observacion: ''
            });
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.km) {
            toast({ title: "Error", description: "Debes ingresar los kilómetros.", variant: "destructive" });
            return;
        }

        const newKm = parseInt(formData.km);
        const currentKm = vehicle?.km_actuales || 0;

        if (vehicle && newKm < currentKm) {
             toast({ title: "Error", description: `El kilometraje (${newKm}) no puede ser menor al actual (${currentKm}).`, variant: "destructive" });
             return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.rpc('rpc_registrar_km_vehiculo', {
                p_vehiculo_id: vehicle.id,
                p_km: newKm,
                p_observacion: formData.observacion,
                p_fecha: formData.fecha,
                p_foto_contador: null 
            });

            if (error) throw error;

            toast({ title: "Kilometraje registrado correctamente" });
            if (onSave) onSave();
            onClose();
        } catch (error) {
            console.error(error);
            toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Registrar Kilometraje</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Vehículo</Label>
                        <Input value={`${vehicle?.marca || ''} ${vehicle?.modelo || ''} - ${vehicle?.matricula || ''}`} disabled className="bg-muted" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Fecha</Label>
                            <Input 
                                type="date" 
                                value={formData.fecha} 
                                onChange={(e) => setFormData({...formData, fecha: e.target.value})} 
                                required 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Kilómetros</Label>
                            <Input 
                                type="number" 
                                value={formData.km} 
                                onChange={(e) => setFormData({...formData, km: e.target.value})} 
                                placeholder={`Actual: ${vehicle?.km_actuales || 0}`}
                                required 
                                min={vehicle?.km_actuales || 0}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Observación (Opcional)</Label>
                        <Textarea 
                            value={formData.observacion} 
                            onChange={(e) => setFormData({...formData, observacion: e.target.value})} 
                            placeholder="Ej: Repostaje, viaje a obra, etc."
                            className="resize-none"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar registro
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}