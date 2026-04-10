import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { RadioGroup as ShadRadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const RevisionTareaModal = ({ isOpen, onClose, onSubmitted, task }) => {
    const [aprobado, setAprobado] = useState(true);
    const [comentario, setComentario] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && task) {
            setAprobado(true);
            setComentario('');
        }
    }, [isOpen, task]);

    const handleSave = async () => {
        if (!aprobado && !comentario.trim()) {
            toast({ variant: 'destructive', title: 'Comentario requerido', description: 'Debes añadir un comentario si rechazas la tarea.' });
            return;
        }
        setIsSaving(true);
        try {
            const { error } = await supabase.rpc('admin_guardar_revision_tarea', {
                p_tarea_id: task.id,
                p_resultado: aprobado ? 'aprobada' : 'rechazada',
                p_comentario: comentario.trim() || null
            });
            if (error) throw error;
            
            toast({ title: `Tarea ${aprobado ? 'aprobada' : 'rechazada'}`, description: `La tarea ha sido marcada como ${aprobado ? 'completada' : 'en proceso'}.` });
            onSubmitted();
            onClose();

        } catch (error) {
            console.error("Error validando tarea:", error);
            toast({ variant: 'destructive', title: 'Error al validar', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Revisión de Tarea: {task?.titulo}</DialogTitle>
                    <DialogDescription>Revisa la tarea y aprueba o rechaza el trabajo realizado.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    
                    <div className="border-t pt-4 mt-2">
                        <ShadRadioGroup value={aprobado ? 'aprobar' : 'rechazar'} onValueChange={(value) => setAprobado(value === 'aprobar')} className="flex gap-4 mb-4">
                            <Label htmlFor="r-aprobar" className={`flex-1 p-4 border rounded-md cursor-pointer transition-all ${aprobado ? 'bg-primary/10 border-primary ring-2 ring-primary' : 'hover:bg-muted'}`}>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="aprobar" id="r-aprobar" />
                                    <span className="font-medium">Aprobar y Finalizar</span>
                                </div>
                            </Label>
                            <Label htmlFor="r-rechazar" className={`flex-1 p-4 border rounded-md cursor-pointer transition-all ${!aprobado ? 'bg-destructive/10 border-destructive ring-2 ring-destructive' : 'hover:bg-muted'}`}>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="rechazar" id="r-rechazar" />
                                    <span className="font-medium">Rechazar y Reabrir</span>
                                </div>
                            </Label>
                        </ShadRadioGroup>
                        
                        <div className="space-y-2">
                            <Label htmlFor="comentario-revision">Comentario {aprobado ? '(opcional)' : '(obligatorio si rechazas)'}</Label>
                            <Textarea
                                id="comentario-revision"
                                placeholder="Añade un comentario para el técnico..."
                                value={comentario}
                                onChange={(e) => setComentario(e.target.value)}
                                className="min-h-[100px]"
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving || (!aprobado && !comentario.trim())}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Guardar Revisión
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RevisionTareaModal;