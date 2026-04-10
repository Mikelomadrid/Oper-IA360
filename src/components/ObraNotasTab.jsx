import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, Trash2, Edit2, X, Check, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

export default function ObraNotasTab({ obraId }) {
  const { sessionRole, empleadoId } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  
  const isAdmin = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado';

  // Fetch Notes
  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('obra_notas')
        .select(`
          *,
          autor:empleados!obra_notas_created_by_fkey (
            id,
            nombre,
            apellidos,
            foto_url
          )
        `)
        .eq('obra_id', obraId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las notas.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (obraId) {
      fetchNotes();
      
      // Realtime subscription
      const channel = supabase
        .channel(`obra_notas_${obraId}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'obra_notas', filter: `obra_id=eq.${obraId}` }, 
          () => fetchNotes()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [obraId]);

  // Submit New Note
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    if (!empleadoId) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar tu usuario empleado.' });
        return;
    }

    setSubmitting(true);
    
    // Optimistic Update
    const tempId = 'temp-' + Date.now();
    const tempNote = {
        id: tempId,
        contenido: newNote,
        created_at: new Date().toISOString(),
        created_by: empleadoId,
        autor: {
            id: empleadoId,
            nombre: sessionRole?.nombre || 'Yo',
            apellidos: sessionRole?.apellidos || '',
            foto_url: sessionRole?.foto_url
        },
        isTemp: true
    };
    
    setNotes(prev => [tempNote, ...prev]);
    setNewNote('');

    try {
      const { error } = await supabase
        .from('obra_notas')
        .insert({
          obra_id: obraId,
          contenido: tempNote.contenido,
          created_by: empleadoId
        });

      if (error) throw error;
      
      // Verification via toast
      toast({ title: 'Nota añadida' });
    } catch (error) {
      console.error('Error adding note:', error);
      setNotes(prev => prev.filter(n => n.id !== tempId)); // Revert
      setNewNote(tempNote.contenido); // Restore text
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la nota.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Note
  const handleDelete = async (noteId) => {
    if (!confirm('¿Estás seguro de eliminar esta nota?')) return;

    // Optimistic delete
    const prevNotes = [...notes];
    setNotes(prev => prev.filter(n => n.id !== noteId));

    try {
        const { error } = await supabase.from('obra_notas').delete().eq('id', noteId);
        if (error) throw error;
        toast({ title: 'Nota eliminada' });
    } catch (error) {
        setNotes(prevNotes);
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  // Update Note
  const handleUpdate = async (noteId) => {
      if (!editContent.trim()) return;
      
      try {
          const { error } = await supabase
            .from('obra_notas')
            .update({ contenido: editContent, updated_at: new Date().toISOString() })
            .eq('id', noteId);
            
          if (error) throw error;
          
          setEditingId(null);
          toast({ title: 'Nota actualizada' });
          fetchNotes();
      } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
  };

  const startEditing = (note) => {
      setEditingId(note.id);
      setEditContent(note.contenido);
  };

  if (loading) {
      return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Input Area */}
      <Card className="shadow-sm border-l-4 border-l-primary/50">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex gap-4">
                <Avatar className="h-10 w-10 hidden sm:block">
                    <AvatarImage src={sessionRole?.foto_url} />
                    <AvatarFallback>{sessionRole?.nombre?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                    <Textarea 
                        placeholder="Escribe una nota, observación o recordatorio..." 
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="min-h-[100px] resize-none focus-visible:ring-primary/20"
                    />
                    <div className="flex justify-end">
                        <Button type="submit" disabled={!newNote.trim() || submitting} size="sm">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                            Añadir Nota
                        </Button>
                    </div>
                </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Notes List */}
      <div className="space-y-4">
        {notes.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed">
                <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No hay notas registradas en esta obra.</p>
            </div>
        ) : (
            notes.map((note) => {
                const isAuthor = note.created_by === empleadoId;
                const canEdit = isAuthor || isAdmin;
                const isEditing = editingId === note.id;

                return (
                    <Card key={note.id} className={cn("transition-all hover:shadow-md", note.isTemp && "opacity-70")}>
                        <CardContent className="p-5">
                            <div className="flex gap-4 items-start">
                                <Avatar className="h-9 w-9 mt-1 border">
                                    <AvatarImage src={note.autor?.foto_url} />
                                    <AvatarFallback>{note.autor?.nombre?.charAt(0) || '?'}</AvatarFallback>
                                </Avatar>
                                
                                <div className="flex-1 space-y-1">
                                    {/* Header */}
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm text-slate-900">
                                                {note.autor ? `${note.autor.nombre} ${note.autor.apellidos || ''}` : 'Usuario Desconocido'}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                • {format(new Date(note.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                                            </span>
                                            {note.created_at !== note.updated_at && !note.isTemp && (
                                                <span className="text-[10px] text-muted-foreground italic">(editado)</span>
                                            )}
                                        </div>
                                        
                                        {canEdit && !isEditing && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(note)}>
                                                    <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-50 hover:text-red-600" onClick={() => handleDelete(note.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    {isEditing ? (
                                        <div className="space-y-3 mt-2">
                                            <Textarea 
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                className="min-h-[80px]"
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-8">
                                                    <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                                                </Button>
                                                <Button size="sm" onClick={() => handleUpdate(note.id)} className="h-8">
                                                    <Check className="h-3.5 w-3.5 mr-1" /> Guardar
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                            {note.contenido}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })
        )}
      </div>
    </div>
  );
}