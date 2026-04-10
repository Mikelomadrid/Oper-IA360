import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { AsyncSearchableSelector } from '@/components/AsyncSearchableSelector';
import { toast } from '@/components/ui/use-toast';


const SolicitudHerramientaModal = ({ isOpen, onClose, herramienta, onSuccess }) => {
    const [proyecto, setProyecto] = useState(null);
    const [motivo, setMotivo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setProyecto(null);
            setMotivo('');
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!herramienta) return;

        setIsSubmitting(true);
        try {
            // Call the robust 'solicitar_herramienta' function which handles auth.uid internally
            const { error } = await supabase.rpc('solicitar_herramienta', {
                p_herramienta_id: herramienta.herramienta_id,
                p_proyecto_id: proyecto?.value || null,
                p_mensaje: motivo || 'Solicitud desde detalle' // Correct param: p_mensaje
            });

            if (error) {
                throw error;
            }
            
            toast({
                title: '¡Solicitud enviada!',
                description: `Tu petición para "${herramienta.nombre}" ha sido registrada.`,
                className: "bg-green-100 dark:bg-green-900 border-green-400"
            });
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error al enviar solicitud:', error);
            toast({
                variant: "destructive",
                title: 'Error al solicitar',
                description: error.message || 'No se pudo completar la solicitud.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const fetchProyectos = async (searchTerm) => {
        const { data, error } = await supabase.rpc('sel_proyectos', { p_q: searchTerm });
        if (error) {
            console.error('Error fetching proyectos:', error);
            return [];
        }
        return data.map(p => ({ value: p.value, label: p.label }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Solicitar Herramienta</DialogTitle>
                    <DialogDescription>
                        Completa los detalles para solicitar la herramienta. Un encargado revisará tu petición.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="herramienta" className="text-right">
                            Herramienta
                        </Label>
                        <Input
                            id="herramienta"
                            value={herramienta?.nombre || ''}
                            disabled
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="proyecto" className="text-right">
                            Proyecto
                        </Label>
                        <div className="col-span-3">
                            <AsyncSearchableSelector
                                fetcher={fetchProyectos}
                                selected={proyecto}
                                onSelect={setProyecto}
                                placeholder="Busca un proyecto (opcional)"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="motivo" className="text-right">
                            Motivo
                        </Label>
                        <Textarea
                            id="motivo"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Ej: Necesaria para instalación de pladur..."
                            className="col-span-3"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Enviar Solicitud
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default SolicitudHerramientaModal;