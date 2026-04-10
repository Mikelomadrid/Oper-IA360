import { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

export const useLeadAssignment = () => {
    const { user } = useAuth();
    const [assigning, setAssigning] = useState(false);

    /**
     * Asigna un lead a un empleado y gestiona la notificación centralizada.
     * @param {string} leadId - ID del lead
     * @param {string} employeeAuthId - ID de autenticación del empleado (usuario_id)
     * @param {string} assignerId - ID del usuario que asigna (por defecto el usuario actual)
     */
    const assignLead = async (leadId, employeeAuthId, assignerId = user?.id) => {
        if (!user) return { success: false, error: 'No authenticated user' };
        
        setAssigning(true);
        try {
            // 1. Obtener datos del Lead para construir el mensaje correctamente
            const { data: lead, error: leadError } = await supabase
                .from('leads')
                .select('*')
                .eq('id', leadId)
                .single();
            
            if (leadError) throw leadError;

            // 2. Obtener datos del Empleado destinatario (necesitamos su ID interno de la tabla empleados)
            const { data: empData, error: empError } = await supabase
                .from('empleados')
                .select('id, nombre, apellidos')
                .eq('auth_user_id', employeeAuthId)
                .single();

            if (empError) {
                console.error("Error fetching employee for assignment:", empError);
                // Continuamos, pero sin notificación personalizada si falla esto
            }

            // 3. Lógica de construcción del mensaje (Nombre a mostrar)
            const isEmpresa = (
                lead.tipo_cliente === 'empresa' || 
                lead.tipo_cliente === 'CDAD PROPIETARIOS' || 
                lead.tipo_cliente === 'cdad_propietarios' ||
                (lead.nombre_empresa && lead.nombre_empresa.trim() !== '')
            );

            const displayName = isEmpresa 
                ? (lead.nombre_empresa || lead.nombre_contacto || 'Empresa Desconocida')
                : (lead.nombre_contacto || 'Cliente Desconocido');

            // Nombre del asignador
            const assignorName = user.user_metadata?.nombre || user.email || 'Sistema';
            
            // Mensaje final
            const mensaje = `${assignorName} te ha asignado el lead ${displayName}`;

            // 4. Log de diagnóstico (Single log as requested)
            console.log('[LEAD NOTIFICATION] Single notification created:', {
                destinatario: employeeAuthId,
                mensaje: mensaje,
                lead_id: leadId,
                timestamp: new Date().toISOString()
            });

            // 5. Insertar la asignación (Acción principal)
            const { error: assignError } = await supabase
                .from('leads_asignaciones')
                .insert({
                    lead_id: leadId,
                    usuario_id: employeeAuthId,
                    asignado_por: assignerId
                });

            if (assignError) {
                if (assignError.code === '23505') { 
                    return { success: false, error: 'assigned_already' };
                }
                throw assignError;
            }

            // 6. Crear notificación MANUALMENTE (Single source of truth for notification text)
            // Insertamos explícitamente para asegurar el texto personalizado.
            if (empData) {
                const { error: notifError } = await supabase.from('notificaciones').insert({
                    empleado_id: empData.id,
                    user_id: employeeAuthId,
                    referencia_id: leadId,
                    tipo_objeto: 'lead_asignado',
                    mensaje: mensaje,
                    estado: 'no_leida',
                    fecha_creacion: new Date().toISOString()
                });
                
                if (notifError) console.error('Error creating manual notification:', notifError);
            }

            return { success: true };

        } catch (error) {
            console.error('Error in assignLead:', error);
            return { success: false, error };
        } finally {
            setAssigning(false);
        }
    };

    return { assignLead, assigning };
};