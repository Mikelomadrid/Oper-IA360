import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Info, CheckCircle, User, Clock, AlertCircle, FileText, MessageSquare, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

export default function AvisoTimeline({ avisoId }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [currentEmployeeId, setCurrentEmployeeId] = useState(null);
  const scrollRef = useRef(null);

  // 1. Obtener el ID de empleado del usuario actual
  useEffect(() => {
    const fetchEmployeeId = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('empleados')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();

        if (data) setCurrentEmployeeId(data.id);
        if (error) console.error('Error fetching employee ID:', error);
      } catch (err) {
        console.error(err);
      }
    };
    fetchEmployeeId();
  }, [user]);

  // 2. Cargar historial inicial
  useEffect(() => {
    if (!avisoId) return;

    const fetchTimeline = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('avisos_comentarios')
        .select(`
          *,
          empleados:usuario_id (
            id,
            nombre,
            apellidos,
            email
          )
        `)
        .eq('aviso_id', avisoId)
        .order('fecha_creacion', { ascending: true });

      if (error) {
        console.error('Error loading timeline:', error);
        toast({
          title: "Error",
          description: "No se pudo cargar el historial del aviso.",
          variant: "destructive"
        });
      } else {
        setItems(data || []);
      }
      setLoading(false);
    };

    fetchTimeline();

    // 3. Suscripción en tiempo real
    const channel = supabase
      .channel(`timeline-aviso-${avisoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'avisos_comentarios',
          filter: `aviso_id=eq.${avisoId}`,
        },
        async (payload) => {
          // Fetch completo del nuevo item para obtener la relación con empleados
          const { data, error } = await supabase
            .from('avisos_comentarios')
            .select(`
              *,
              empleados:usuario_id (
                id,
                nombre,
                apellidos,
                email
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (!error && data) {
            setItems((prev) => [...prev, data]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [avisoId]);

  // Auto-scroll al fondo al llegar nuevos mensajes
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [items]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentEmployeeId) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('avisos_comentarios')
        .insert({
          aviso_id: avisoId,
          usuario_id: currentEmployeeId,
          contenido: newMessage.trim(),
          tipo: 'comentario',
          fecha_creacion: new Date().toISOString(),
          tipo_usuario: 'tecnico'
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar el comentario.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  // Helper para renderizar el contenido según el tipo de evento
  const renderTimelineItem = (item) => {
    const isMe = item.usuario_id === currentEmployeeId;
    const isSystem = item.tipo && item.tipo !== 'comentario';
    
    // Formatear nombre
    const authorName = item.empleados 
      ? `${item.empleados.nombre} ${item.empleados.apellidos || ''}`.trim()
      : 'Sistema';
    
    const initial = authorName.charAt(0).toUpperCase();

    if (isSystem) {
      let Icon = Info;
      let colorClass = "text-blue-500 bg-blue-100";
      
      if (item.tipo === 'cambio_estado') {
        Icon = CheckCircle;
        colorClass = "text-green-600 bg-green-100";
      } else if (item.tipo === 'asignacion') {
        Icon = User;
        colorClass = "text-amber-600 bg-amber-100";
      } else if (item.tipo === 'urgencia') {
        Icon = AlertCircle;
        colorClass = "text-red-600 bg-red-100";
      }

      return (
        <div key={item.id} className="flex items-center justify-center my-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border", colorClass, "border-opacity-20")}>
            <Icon className="w-3.5 h-3.5" />
            <span>{item.contenido}</span>
            <span className="text-[10px] opacity-70 ml-1 border-l pl-2 border-current">
              {formatDistanceToNow(new Date(item.fecha_creacion), { addSuffix: true, locale: es })}
            </span>
          </div>
        </div>
      );
    }

    // Mensaje de usuario (Chat bubbles)
    return (
      <div
        key={item.id}
        className={cn(
          "flex gap-3 mb-4 max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
          isMe ? "ml-auto flex-row-reverse" : ""
        )}
      >
        <Avatar className="w-8 h-8 mt-1 border border-border">
          <AvatarImage src={null} />
          <AvatarFallback className={cn("text-xs", isMe ? "bg-primary text-primary-foreground" : "bg-muted")}>
            {initial}
          </AvatarFallback>
        </Avatar>

        <div className={cn(
          "flex flex-col",
          isMe ? "items-end" : "items-start"
        )}>
          <div className="flex items-baseline gap-2 mb-1 px-1">
            <span className="text-xs font-medium text-foreground/80">{authorName}</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatDistanceToNow(new Date(item.fecha_creacion), { addSuffix: true, locale: es })}
            </span>
          </div>
          
          <div className={cn(
            "px-4 py-2.5 rounded-2xl text-sm shadow-sm leading-relaxed whitespace-pre-wrap break-words",
            isMe 
              ? "bg-primary text-primary-foreground rounded-tr-none" 
              : "bg-card border border-border rounded-tl-none"
          )}>
            {item.contenido}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background/50 rounded-lg overflow-hidden border border-border/60 shadow-sm">
      {/* Header del Timeline */}
      <div className="p-3 border-b bg-muted/30 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Actividad del Aviso</h3>
      </div>

      {/* Área de mensajes scrollable */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4 min-h-[300px] max-h-[500px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Cargando historial...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground opacity-60">
            <FileText className="w-10 h-10 mb-2 stroke-1" />
            <p className="text-sm">No hay actividad registrada aún.</p>
          </div>
        ) : (
          <div className="flex flex-col pb-2">
            {items.map(renderTimelineItem)}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3 bg-card border-t border-border mt-auto">
        <form onSubmit={handleSendMessage} className="relative">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder="Escribe un comentario o actualización..."
            className="min-h-[50px] max-h-[150px] pr-12 resize-none py-3 text-sm rounded-xl bg-muted/20 focus:bg-background transition-all"
            disabled={loading || !currentEmployeeId}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!newMessage.trim() || sending || !currentEmployeeId}
            className={cn(
              "absolute right-2 bottom-2 h-8 w-8 rounded-lg transition-all",
              newMessage.trim() ? "opacity-100 scale-100" : "opacity-50 scale-90"
            )}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
        {!currentEmployeeId && !loading && (
          <p className="text-[10px] text-destructive mt-2 text-center">
            ⚠️ No se ha encontrado tu perfil de empleado. No puedes comentar.
          </p>
        )}
      </div>
    </div>
  );
}