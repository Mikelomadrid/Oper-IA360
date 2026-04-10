import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Trash2, Save, StickyNote } from 'lucide-react';
import { format } from 'date-fns';

export default function HorasExtrasNotesModal({ 
    isOpen, 
    onClose, 
    empleadoId, 
    dia, 
    proyectoId, 
    empleadoNombre,
    currentNote, 
    onNoteSaved 
}) {
    const [noteText, setNoteText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setNoteText(currentNote?.nota || '');
        }
    }, [isOpen, currentNote]);

    const handleSave = async () => {
        if (!noteText.trim()) {
            if (currentNote?.id) {
                // If text is cleared but note existed, confirm deletion logic or ask user to use delete button
                toast({
                    title: "Nota vacía",
                    description: "Para eliminar la nota, usa el botón de eliminar.",
                    variant: "secondary"
                });
                return;
            } else {
                onClose(); // Just close if nothing to save
                return;
            }
        }

        setIsSaving(true);
        try {
            const user = (await supabase.auth.getUser()).data.user;
            
            // Get current employee ID for 'created_by'
            const { data: empData } = await supabase
                .from('empleados')
                .select('id')
                .eq('auth_user_id', user.id)
                .single();

            const payload = {
                empleado_id: empleadoId,
                dia: dia,
                proyecto_id: proyectoId || null,
                nota: noteText.trim(),
                updated_at: new Date().toISOString(),
                created_by: empData?.id
            };

            const { data, error } = await supabase
                .from('horas_extras_notas')
                .upsert(payload, { onConflict: 'empleado_id, dia' })
                .select()
                .single();

            if (error) throw error;

            toast({
                title: "Nota guardada",
                description: "La nota se ha actualizado correctamente.",
            });

            onNoteSaved(data); // Pass back the full note object
            onClose();
        } catch (error) {
            console.error('Error saving note:', error);
            toast({
                title: "Error",
                description: "No se pudo guardar la nota.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!currentNote?.id) return;

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('horas_extras_notas')
                .delete()
                .eq('id', currentNote.id);

            if (error) throw error;

            toast({
                title: "Nota eliminada",
                description: "La nota ha sido borrada.",
            });

            onNoteSaved(null); // Pass null to indicate deletion
            onClose();
        } catch (error) {
            console.error('Error deleting note:', error);
            toast({
                title: "Error",
                description: "No se pudo eliminar la nota.",
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <StickyNote className="w-5 h-5 text-amber-500 fill-current" />
                        Notas - Horas Extras
                    </DialogTitle>
                    <DialogDescription>
                        {empleadoNombre} • {dia ? format(new Date(dia), 'dd/MM/yyyy') : ''}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <Textarea 
                        placeholder="Escribe aquí los detalles, incidencias o justificaciones..." 
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="min-h-[150px] resize-none bg-amber-50/50 focus:bg-white transition-colors"
                    />
                    
                    {currentNote && (
                        <div className="text-xs text-muted-foreground text-right">
                            Actualizado: {format(new Date(currentNote.updated_at), 'dd/MM/yyyy HH:mm')}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex sm:justify-between gap-2 items-center">
                    {currentNote?.id ? (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleDelete}
                            disabled={isDeleting || isSaving}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Eliminar
                        </Button>
                    ) : (
                        <div className="flex-1"></div> // Spacer
                    )}
                    
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving || isDeleting}>
                            Cancelar
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={isSaving || isDeleting}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Guardar Nota
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}