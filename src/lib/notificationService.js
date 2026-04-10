import { supabase } from '@/lib/customSupabaseClient';

/**
 * Servicio para gestionar notificaciones avanzadas de administrador
 */
export const notificationService = {
  
  /**
   * Fetch notifications with filtering
   * @param {string} userId - Employee ID (Actual user)
   * @param {object} filters - { type, changeType, limit, isAdmin }
   */
  async getNotifications(userId, filters = {}) {
    let query = supabase
      .from('notificaciones')
      .select('*');

    if (!filters.isAdmin) {
        query = query.eq('empleado_id', userId);
    } 
    // Admin View: No filter by empleado_id to show global activity if filters.isAdmin is true.

    query = query.neq('estado', 'eliminada')
      .order('fecha_creacion', { ascending: false });

    if (filters.type && filters.type !== 'all') {
      query = query.eq('tipo_entidad', filters.type);
    }
    
    if (filters.changeType && filters.changeType !== 'all') {
      query = query.eq('tipo_cambio', filters.changeType);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * Compute diff between old and new data objects
   */
  computeDiff(oldData, newData) {
    if (!oldData || !newData) return [];
    
    const changes = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    
    // Ignored fields
    const ignored = ['updated_at', 'created_at', 'fecha_actualizacion', 'search_vector', 'created_by', 'uploaded_by', 'owner_user_id', 'id', 'fecha_creacion'];

    allKeys.forEach(key => {
      if (ignored.includes(key)) return;

      const valOld = oldData[key];
      const valNew = newData[key];

      // Simple equality check (works for primitives)
      if (JSON.stringify(valOld) !== JSON.stringify(valNew)) {
        changes.push({
          field: key,
          old: valOld,
          new: valNew
        });
      }
    });

    return changes;
  },

  async markAsRead(id) {
    return await supabase.rpc('marcar_notificacion_leida', { p_id: id });
  },

  async markAsUnread(id) {
    // Reutilizamos la función masiva para un solo ID si no existe RPC individual o si preferimos consistencia
    return await supabase.rpc('marcar_notificaciones_no_leidas', { p_ids: [id] });
  },

  async markNotificationsRead(ids) {
    return await supabase.rpc('marcar_notificaciones_leidas', { p_ids: ids });
  },

  async markNotificationsUnread(ids) {
    return await supabase.rpc('marcar_notificaciones_no_leidas', { p_ids: ids });
  },

  async deleteNotification(id) {
    return await supabase.rpc('eliminar_notificacion', { p_id: id });
  },

  async deleteNotifications(ids) {
    return await supabase.rpc('eliminar_notificaciones', { p_ids: ids });
  },
  
  // Alias for backward compatibility if needed
  async markAllRead(ids) {
      return await supabase.rpc('marcar_notificaciones_leidas', { p_ids: ids });
  }
};