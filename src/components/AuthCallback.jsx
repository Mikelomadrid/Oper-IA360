import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const AuthCallback = ({ navigate }) => {
    const [status, setStatus] = useState('Verificando sesión...');

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error("AuthCallback session error:", sessionError);
                    setStatus('Error al verificar la sesión.');
                    toast({ variant: 'destructive', title: 'Error de Sesión', description: sessionError.message });
                    setTimeout(() => navigate('/'), 3000);
                    return;
                }

                if (session) {
                    setStatus('Configurando perfil de usuario...');
                    const { error: bootstrapError } = await supabase.rpc('attach_or_bootstrap_user');

                    if (bootstrapError) {
                        console.warn("Bootstrap error:", bootstrapError);
                        // Non-blocking error, just warn
                        toast({ variant: 'destructive', title: 'Aviso de Configuración', description: 'Tu perfil se está configurando en segundo plano.' });
                    }

                    setStatus('Perfil listo. Obteniendo rol...');
                    const { data: roleData, error: roleError } = await supabase.rpc('get_my_role');

                    if (roleError) {
                        console.error("Role fetch error:", roleError);
                        setStatus('No se pudo obtener el rol. Redirigiendo al dashboard general.');
                        toast({ variant: 'destructive', title: 'Error de Rol', description: roleError.message });
                        setTimeout(() => navigate('/dashboard'), 2000);
                        return;
                    }
                    
                    const userRole = roleData?.rol;
                    let destination = '/dashboard';
                    if (userRole === 'colaborador') {
                        destination = '/leads';
                    } else if (userRole === 'tecnico') {
                        destination = '/dashboard/tecnico';
                    } else if (userRole === 'admin' || userRole === 'encargado') {
                        destination = '/inicio';
                    }
                    
                    setStatus(`¡Bienvenido/a! Redirigiendo a ${destination}...`);
                    toast({ title: '¡Sesión iniciada!', description: 'Has accedido correctamente.' });
                    setTimeout(() => navigate(destination), 1000);

                } else {
                    setStatus('No se pudo establecer la sesión. Redirigiendo al login...');
                    toast({ variant: 'destructive', title: 'Fallo de Autenticación', description: 'El enlace puede haber expirado o ser inválido.' });
                    setTimeout(() => navigate('/'), 2000);
                }
            } catch (err) {
                console.error("AuthCallback unexpected error:", err);
                setStatus('Error inesperado. Redirigiendo...');
                setTimeout(() => navigate('/'), 3000);
            }
        };

        handleAuthCallback();
    }, [navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="text-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 border-4 border-t-primary border-border rounded-full mx-auto mb-6"
                ></motion.div>
                <h1 className="text-2xl font-bold text-foreground">Finalizando inicio de sesión...</h1>
                <p className="text-muted-foreground mt-2">{status}</p>
            </div>
        </div>
    );
};

export default AuthCallback;