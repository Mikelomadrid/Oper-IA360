import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

/**
 * Hook de avisos pendientes para Mikelo (admin).
 *
 * Devuelve dos Sets (pendingPartes / pendingLeads) con los IDs de partes y
 * leads que tienen comentarios, cambios de estado, check-in/check-out o
 * archivos subidos por técnicos/encargados SIN revisar todavía por Mikelo.
 *
 * Se mantiene sincronizado en tiempo real: si Mikelo abre el detalle en
 * otra pestaña (o desde ParteDetail/LeadDetail, que llaman a la RPC
 * api_marcar_avisos_leidos), este hook lo detecta vía Supabase Realtime
 * sobre la tabla `notificaciones` y actualiza los Sets automáticamente,
 * sin necesidad de recargar la página ni compartir estado global.
 *
 * Uso típico en un listado o Kanban:
 *
 *   const { pendingPartes, markAsRead } = useAvisosMikelo();
 *   const hasAviso = pendingPartes.has(parte.id);
 *   <tr className={cn(hasAviso && AVISO_ROW_CLASS)}>
 *     <td><AvisoBolita show={hasAviso} /> ...</td>
 *   </tr>
 */
export function useAvisosMikelo() {
  const { sessionRole } = useAuth();
  const isAdmin = sessionRole?.rol === 'admin';

  const [pendingPartes, setPendingPartes] = useState(new Set());
  const [pendingLeads, setPendingLeads] = useState(new Set());
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchPending = useCallback(async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase
      .from('v_avisos_mikelo_pendientes')
      .select('tipo_entidad, entidad_id');

    if (error) {
      console.error('Error cargando avisos pendientes:', error);
      return;
    }
    if (!isMounted.current) return;

    const partes = new Set();
    const leads = new Set();
    (data || []).forEach(row => {
      if (row.tipo_entidad === 'parte') partes.add(row.entidad_id);
      else if (row.tipo_entidad === 'lead') leads.add(row.entidad_id);
    });
    setPendingPartes(partes);
    setPendingLeads(leads);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchPending();

    const channel = supabase
      .channel('avisos-mikelo-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, () => {
        fetchPending();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, fetchPending]);

  // Marca como leídos los avisos de una entidad concreta. Actualiza la UI
  // de forma optimista y además llama a la RPC en BD (que es la fuente de
  // verdad y la que hace que el resto de vistas se sincronicen via realtime).
  const markAsRead = useCallback(async (tipoEntidad, entidadId) => {
    if (!isAdmin) return;

    if (tipoEntidad === 'parte') {
      setPendingPartes(prev => {
        const next = new Set(prev);
        next.delete(entidadId);
        return next;
      });
    } else if (tipoEntidad === 'lead') {
      setPendingLeads(prev => {
        const next = new Set(prev);
        next.delete(entidadId);
        return next;
      });
    }

    const { error } = await supabase.rpc('api_marcar_avisos_leidos', {
      p_tipo_entidad: tipoEntidad,
      p_entidad_id: entidadId
    });
    if (error) console.error('Error marcando avisos como leídos:', error);
  }, [isAdmin]);

  return { pendingPartes, pendingLeads, markAsRead, refetch: fetchPending };
}

export default useAvisosMikelo;
