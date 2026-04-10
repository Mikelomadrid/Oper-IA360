import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const STATUS_OPTIONS = [
    'nuevo', 'contactado', 'visitado', 'presupuestado', 'rechazado', 'cancelado'
];

export default function EditLeadTechnicianModal({ isOpen, onClose, leadId, onLeadUpdated }) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        nombre_contacto: '',
        nombre_empresa: '',
        email: '',
        telefono: '',
        direccion: '',
        municipio: '',
        estado: '',
        comentario: '',
        partida: ''
    });

    useEffect(() => {
        if (isOpen && leadId) {
            fetchLead();
        }
    }, [isOpen, leadId]);

    const fetchLead = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('id', leadId)
                .single();

            if (error) throw error;
            
            if (data) {
                setFormData({
                    nombre_contacto: data.nombre_contacto || '',
                    nombre_empresa: data.nombre_empresa || '',
                    email: data.email || '',
                    telefono: data.telefono || '',
                    direccion: data.direccion || '',
                    municipio: data.municipio || '',
                    estado: data.estado || 'nuevo',
                    comentario: data.comentario || '',
                    partida: data.partida || ''
                });
            }
        } catch (error) {
            console.error('Error fetching lead:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el lead.' });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const { error } = await supabase
                .from('leads')
                .update(formData)
                .eq('id', leadId);

            if (error) throw error;

            toast({ title: 'Éxito', description: 'Lead actualizado correctamente.' });
            if (onLeadUpdated) onLeadUpdated();
            onClose();
        } catch (error) {
            console.error('Error updating lead:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el lead. Verifica tus permisos.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Editar Lead (Vista Técnico)</DialogTitle>
                    <DialogDescription>
                        Actualiza la información básica y el estado del lead.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nombre_contacto">Nombre Contacto</Label>
                                <Input id="nombre_contacto" name="nombre_contacto" value={formData.nombre_contacto} onChange={handleChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="nombre_empresa">Empresa</Label>
                                <Input id="nombre_empresa" name="nombre_empresa" value={formData.nombre_empresa} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="telefono">Teléfono</Label>
                                <Input id="telefono" name="telefono" value={formData.telefono} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="direccion">Dirección</Label>
                                <Input id="direccion" name="direccion" value={formData.direccion} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="municipio">Municipio</Label>
                                <Input id="municipio" name="municipio" value={formData.municipio} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="estado">Estado</Label>
                                <Select value={formData.estado} onValueChange={(val) => handleSelectChange('estado', val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map(s => (
                                            <SelectItem key={s} value={s || "unknown"} className="capitalize">{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="partida">Partida</Label>
                                <Input id="partida" name="partida" value={formData.partida} onChange={handleChange} placeholder="Ej. Electricidad" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="comentario">Comentarios / Notas</Label>
                            <Textarea 
                                id="comentario" 
                                name="comentario" 
                                value={formData.comentario} 
                                onChange={handleChange} 
                                rows={3}
                                placeholder="Añade notas importantes aquí..."
                            />
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}