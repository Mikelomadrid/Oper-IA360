import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import EmployeeDetail from '@/components/EmployeeDetail';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MyProfile = ({ navigate }) => {
    const { user } = useAuth();
    const [employeeId, setEmployeeId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchMyEmployeeId = async () => {
            if (!user) {
                setLoading(false);
                return;
            }
            try {
                // Fetch the employee ID associated with the current authenticated user
                const { data, error } = await supabase
                    .from('empleados')
                    .select('id')
                    .eq('auth_user_id', user.id)
                    .single();
                
                if (error) {
                    // Check if it's just 'row not found'
                    if (error.code === 'PGRST116') {
                        setError("No se ha encontrado una ficha de empleado vinculada a tu usuario.");
                    } else {
                        throw error;
                    }
                } else if (data) {
                    setEmployeeId(data.id);
                }
            } catch (error) {
                console.error("Error fetching my profile:", error);
                setError("Ocurrió un error al cargar tu perfil.");
            } finally {
                setLoading(false);
            }
        };
        fetchMyEmployeeId();
    }, [user]);

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (error || !employeeId) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4 text-center p-8">
                <div className="bg-red-100 p-4 rounded-full dark:bg-red-900/20">
                    <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-bold">Perfil no disponible</h3>
                <p className="text-muted-foreground max-w-md">
                    {error || "No se ha encontrado tu ficha de empleado. Por favor, contacta con administración."}
                </p>
                <Button onClick={() => navigate('/inicio')}>Volver al Inicio</Button>
            </div>
        );
    }

    // Reuse the full EmployeeDetail view which includes the Horas Extras tab
    return <EmployeeDetail employeeId={employeeId} navigate={navigate} />;
};

export default MyProfile;