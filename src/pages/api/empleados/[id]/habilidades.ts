import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/customSupabaseClient';
import { getSession } from '@/lib/auth'; // Assuming a helper to get session and role

/**
 * API endpoint: /api/empleados/[id]/habilidades
 *
 * Gestiona las habilidades de un empleado.
 * Sólo los usuarios con rol "admin" o "encargado" pueden crear, actualizar o eliminar.
 * Todos los roles autenticados pueden leer (GET).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { method } = req;
    const { id: employeeId } = req.query; // employee id from URL

    // Validar que employeeId exista y sea string
    if (!employeeId || typeof employeeId !== 'string') {
        return res.status(400).json({ error: 'Employee ID is required' });
    }

    // Obtener sesión y rol del usuario
    const session = await getSession(req);
    if (!session) {
        return res.status(401).json({ error: 'Unauthenticated' });
    }
    const userRole = session.role; // assuming session.role contains 'admin' | 'encargado' | 'tecnico' etc.
    const isAdminOrEncargado = userRole === 'admin' || userRole === 'encargado';

    try {
        switch (method) {
            case 'GET': {
                // Obtener todas las habilidades del empleado
                const { data, error } = await supabase
                    .from('empleado_habilidades')
                    .select('*')
                    .eq('empleado_id', employeeId)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return res.status(200).json(data);
            }
            case 'POST': {
                if (!isAdminOrEncargado) return res.status(403).json({ error: 'Forbidden' });
                const { nombre, descripcion, nivel, puede_ayudar } = req.body;
                const payload = {
                    empleado_id: employeeId,
                    nombre,
                    descripcion: descripcion ?? null,
                    nivel,
                    puede_ayudar: !!puede_ayudar,
                };
                const { data, error } = await supabase.from('empleado_habilidades').insert(payload).single();
                if (error) throw error;
                return res.status(201).json(data);
            }
            case 'PUT': {
                if (!isAdminOrEncargado) return res.status(403).json({ error: 'Forbidden' });
                const { id, nombre, descripcion, nivel, puede_ayudar } = req.body;
                if (!id) return res.status(400).json({ error: 'Skill ID is required' });
                const payload = {
                    nombre,
                    descripcion: descripcion ?? null,
                    nivel,
                    puede_ayudar: !!puede_ayudar,
                };
                const { data, error } = await supabase
                    .from('empleado_habilidades')
                    .update(payload)
                    .eq('id', id)
                    .single();
                if (error) throw error;
                return res.status(200).json(data);
            }
            case 'DELETE': {
                if (!isAdminOrEncargado) return res.status(403).json({ error: 'Forbidden' });
                const { id } = req.body;
                if (!id) return res.status(400).json({ error: 'Skill ID is required' });
                const { error } = await supabase.from('empleado_habilidades').delete().eq('id', id);
                if (error) throw error;
                return res.status(204).end();
            }
            default:
                res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
                return res.status(405).end(`Method ${method} Not Allowed`);
        }
    } catch (err: any) {
        console.error('API error:', err);
        return res.status(500).json({ error: err.message ?? 'Internal server error' });
    }
}
