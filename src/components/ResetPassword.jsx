import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Loader2, Eye, EyeOff } from 'lucide-react';

const ResetPassword = ({ navigate }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isTokenValid, setIsTokenValid] = useState(false);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsTokenValid(true);
                setError('');
            }
        });

        // Also check for hash on initial load
        if (window.location.hash.includes('type=recovery')) {
            setIsTokenValid(true);
        }

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        if (password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres.');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            setError(`Error al actualizar la contraseña: ${error.message}`);
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } else {
            setMessage('Tu contraseña ha sido actualizada con éxito. Ya puedes iniciar sesión.');
            toast({ title: '¡Éxito!', description: 'Contraseña actualizada correctamente.' });
        }
        setLoading(false);
    };
    
    const handleGoToLogin = () => {
        if (navigate) {
            navigate('/');
        } else {
            window.location.href = '/';
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white">
            <Toaster />
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md p-8 space-y-6 glass-effect rounded-2xl shadow-lg border border-white/10"
            >
                <div className="text-center">
                    <h1 className="text-3xl font-bold gradient-text">Restablecer Contraseña</h1>
                </div>

                {message ? (
                    <div className="text-center space-y-4">
                        <p className="text-green-400">{message}</p>
                        <Button onClick={handleGoToLogin} className="w-full">
                            Ir a Iniciar Sesión
                        </Button>
                    </div>
                ) : (
                    isTokenValid ? (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div className="relative">
                                <Label htmlFor="password">Nueva Contraseña</Label>
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="bg-white/5 border-white/10 text-white"
                                />
                                 <button 
                                    type="button" 
                                    onClick={() => setShowPassword(!showPassword)} 
                                    className="absolute inset-y-0 right-0 top-5 pr-3 flex items-center text-sm leading-5 text-gray-400 hover:text-white"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                            <div>
                                <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                            
                            {error && <p className="text-sm text-red-400">{error}</p>}

                            <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                            </Button>
                        </form>
                    ) : (
                         <div className="text-center space-y-4">
                            <p className="text-yellow-400">{error || 'Esperando el token de recuperación desde tu email...'}</p>
                             <p className="text-sm text-gray-400">Por favor, haz clic en el enlace que has recibido por correo electrónico. Si no ves la página de reseteo, asegúrate de que estás en la misma pestaña donde hiciste clic.</p>
                            <Button onClick={handleGoToLogin} className="w-full">
                                Volver a la página principal
                            </Button>
                        </div>
                    )
                )}
            </motion.div>
        </div>
    );
};

export default ResetPassword;