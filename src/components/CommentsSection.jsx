import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Trash2, Send, MessageSquare, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { AnimatePresence, motion } from 'framer-motion';

const CommentsSection = ({ obraId, isVisible }) => {
  const { user, sessionRole, displayName } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [obraIdRecibido, setObraIdRecibido] = useState(null);

  const isAdmin = sessionRole?.rol === 'admin';

  // Sincronizar prop obraId con state obraIdRecibido
  useEffect(() => {
    if (obraId) {
      setObraIdRecibido(obraId);
      console.log('obraIdRecibido:', obraId);
      toast({
        title: "ID de Obra recibido",
        description: `Obra ID: ${obraId}`,
      });
    }
  }, [obraId]);

  // Log cuando se abre la sección/modal
  useEffect(() => {
    if (isVisible) {
      console.log('Modal abierto con obraIdRecibido:', obraIdRecibido);
    }
  }, [isVisible, obraIdRecibido]);

  const fetchComments = useCallback(async () => {
    // Usamos el prop directamente para asegurar consistencia inicial,
    // o el state si ya está listo.
    const targetId = obraId || obraIdRecibido;
    if (!targetId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('obra_observaciones')
        .select('*')
        .eq('obra_id', targetId)
        .eq('tipo', 'observacion') 
        .order('creado_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los comentarios.',
      });
    } finally {
      setLoading(false);
    }
  }, [obraId, obraIdRecibido]);

  useEffect(() => {
    if (isVisible && (obraId || obraIdRecibido)) {
      fetchComments();
    }
  }, [isVisible, obraId, obraIdRecibido, fetchComments]);

  const handleSaveComment = async () => {
    if (!newComment.trim()) return;
    
    // Validación estricta del ID recibido
    if (!obraIdRecibido) {
        console.error('Intento de guardar sin obraIdRecibido');
        toast({
            variant: 'destructive',
            title: 'Error de obra',
            description: 'No se ha detectado la obra activa.'
        });
        return;
    }

    if (!user?.id) {
        toast({
            variant: 'destructive',
            title: 'Error de sesión',
            description: 'No se ha detectado un usuario autenticado.'
        });
        return;
    }

    setSubmitting(true);
    try {
      // 1. Resolve employee ID if available
      const { data: empData } = await supabase
        .from('empleados')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      const authorName = displayName || (sessionRole?.nombre ? `${sessionRole.nombre} ${sessionRole.apellidos || ''}`.trim() : 'Usuario');
      
      // Audit: Log the ID being used
      console.log('Insertando con obra_id:', obraIdRecibido);

      // 2. Prepare Payload with HARD-CODED tipo 'observacion'
      const payload = {
        obra_id: obraIdRecibido, // Explicitly using the state ID
        tipo: 'observacion', 
        texto: newComment.trim(),
        nombre: authorName,
        creado_por_auth_user_id: user.id,
        creado_por_empleado_id: empData?.id || null,
        creado_at: new Date().toISOString()
      };

      // 3. Insert
      const { error } = await supabase
        .from('obra_observaciones')
        .insert(payload)
        .select();

      if (error) throw error;

      toast({
        title: 'Nota guardada',
        description: 'Se ha guardado la nota correctamente.',
      });

      setNewComment('');
      fetchComments(); // Refresh list to show new note immediately
    } catch (error) {
      console.error('Error saving comment:', error);
      
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: error.message || 'No se pudo guardar el comentario.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!isAdmin) return;
    
    setDeletingId(commentId);
    try {
      const { error } = await supabase
        .from('obra_observaciones')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      setComments(prev => prev.filter(c => c.id !== commentId));
      toast({
        title: 'Comentario eliminado',
        description: 'El comentario ha sido borrado correctamente.',
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo eliminar el comentario.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="mt-4 border-t pt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Notas y Observaciones
        </h4>
        {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      </div>

      {/* Input Area - NO dropdowns, only Textarea */}
      <div className="flex gap-3 items-start bg-muted/30 p-3 rounded-lg border border-border/50">
        <Avatar className="w-8 h-8 hidden sm:flex">
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {displayName?.slice(0, 2)?.toUpperCase() || 'YO'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <Textarea 
            placeholder="Añadir nota..." 
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] text-sm resize-y bg-background focus-visible:ring-primary/20"
          />
          <div className="flex justify-end">
            <Button 
              size="sm" 
              onClick={handleSaveComment} 
              disabled={submitting || !newComment.trim() || !obraIdRecibido}
              className="gap-2 h-8"
            >
              {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Guardar
            </Button>
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
        {loading && comments.length === 0 ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-xs italic border border-dashed rounded-lg">
            No hay notas registradas.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {comments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                className="group relative flex gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-all"
              >
                <Avatar className="w-8 h-8 shrink-0 mt-1">
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px]">
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {comment.nombre || 'Usuario desconocido'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {comment.creado_at ? format(new Date(comment.creado_at), "d MMM yyyy, HH:mm", { locale: es }) : '-'}
                      </span>
                    </div>
                    
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1"
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                      >
                        {deletingId === comment.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </Button>
                    )}
                  </div>
                  
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed break-words">
                    {comment.texto}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default CommentsSection;