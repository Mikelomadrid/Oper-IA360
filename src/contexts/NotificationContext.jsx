import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { sessionRole } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef(null);
  const { toast } = useToast();

  const fetchUnreadCount = useCallback(async () => {
    if (!sessionRole?.empleadoId) return;
    try {
      // Fetch unread notifications excluyendo las generadas por el propio admin
      const { data: unreadData, error } = await supabase
        .from('notificaciones')
        .select('mensaje')
        .eq('empleado_id', sessionRole.empleadoId)
        .eq('estado', 'no_leida');

      if (error) throw error;
      // Filtrar las generadas por MIKELO (admin)
      const filtered = (unreadData || []).filter(n => {
        if (!n.mensaje) return true;
        const author = n.mensaje.split(': ')[0]?.trim().toUpperCase();
        return author !== 'MIKELO';
      });
      setUnreadCount(filtered.length);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [sessionRole?.empleadoId]);

  useEffect(() => {
    if (!sessionRole?.empleadoId) {
        setUnreadCount(0);
        return;
    }

    // Initial fetch
    fetchUnreadCount();

    // Setup Realtime Subscription
    // We listen to ALL events on public:notificaciones for this employee
    if (!channelRef.current) {
        channelRef.current = supabase
            .channel('public:notificaciones')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'notificaciones',
                    filter: `empleado_id=eq.${sessionRole.empleadoId}`, // Filter for current user rows
                },
                (payload) => {
                    // Update the count immediately
                    fetchUnreadCount();

                    // If new notification, show toast (excepto las generadas por el propio admin)
                    if (payload.eventType === 'INSERT' && payload.new.estado === 'no_leida') {
                        const msgAuthor = payload.new.mensaje?.split(': ')[0]?.trim().toUpperCase();
                        if (msgAuthor === 'MIKELO') return; // No mostrar mis propias acciones
                        const { tipo_entidad, mensaje } = payload.new;
                        toast({
                            title: `Nuevo aviso${tipo_entidad ? ': ' + tipo_entidad.toUpperCase() : ''}`,
                            description: mensaje,
                            duration: 5000,
                            action: <ToastAction altText="Ver" onClick={() => window.location.href = '/bandeja-entrada'}>Ver</ToastAction>
                        });
                    }
                }
            )
            .subscribe();
    }

    return () => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
    };
  }, [sessionRole?.empleadoId, fetchUnreadCount, toast]);

  const adjustCount = useCallback((amount) => {
    setUnreadCount(prev => Math.max(0, prev + amount));
  }, []);

  const value = {
    unreadCount,
    refreshCount: fetchUnreadCount,
    adjustCount
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};