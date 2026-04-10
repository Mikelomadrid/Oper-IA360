import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, KeyRound, Lock, Eye, EyeOff } from 'lucide-react';

const PasswordUpdateForm = () => {
    const { user } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Visibility toggles
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const validatePassword = (password) => {
        // min 8 chars, one uppercase, one lowercase, one number, one special char
        const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return re.test(password);
    }

    const handleUpdatePassword = async () => {
        if (!currentPassword) {
            toast({
                variant: 'destructive',
                title: 'Requerido',
                description: 'Por favor ingresa tu contraseña actual.',
            });
            return;
        }

        if (password !== confirmPassword) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Las nuevas contraseñas no coinciden.',
            });
            return;
        }

        if (!validatePassword(password)) {
             toast({
                variant: 'destructive',
                title: 'Contraseña débil',
                description: 'Debe tener al menos 8 caracteres, mayúscula, minúscula, número y símbolo (@$!%*?&).',
            });
            return;
        }

        setLoading(true);

        try {
            // 1. Verify current password by attempting a sign in
            // This is the standard way to verify current password before change in Supabase if using email/password
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            });

            if (signInError) {
                console.error("Error verifying password:", signInError);
                toast({
                    variant: 'destructive',
                    title: 'Contraseña incorrecta',
                    description: 'La contraseña actual ingresada no es válida.',
                });
                setLoading(false);
                return;
            }

            // 2. If verified, update the password
            const { error: updateError } = await supabase.auth.updateUser({ password });

            if (updateError) {
                throw updateError;
            }

            toast({
                title: '¡Éxito!',
                description: 'Tu contraseña ha sido actualizada correctamente.',
            });
            
            // Clear fields
            setCurrentPassword('');
            setPassword('');
            setConfirmPassword('');
            
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error al actualizar',
                description: error.message || 'Ocurrió un error inesperado.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
        >
            <div className="space-y-4 pt-4 border-t mt-4">
                <div className="space-y-2">
                    <Label htmlFor="current-password">Contraseña actual</Label>
                    <div className="relative">
                        <Input
                            id="current-password"
                            type={showCurrent ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Ingresa tu contraseña actual"
                            disabled={loading}
                            className="pr-10"
                        />
                        <button 
                            type="button"
                            onClick={() => setShowCurrent(!showCurrent)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="new-password">Nueva contraseña</Label>
                    <div className="relative">
                        <Input
                            id="new-password"
                            type={showNew ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Nueva contraseña segura"
                            disabled={loading}
                            className="pr-10"
                        />
                        <button 
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirm-password">Repetir nueva contraseña</Label>
                    <div className="relative">
                        <Input
                            id="confirm-password"
                            type={showConfirm ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirma la nueva contraseña"
                            disabled={loading}
                            className="pr-10"
                        />
                        <button 
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Mínimo 8 caracteres, con mayúscula, minúscula, número y un símbolo.
                    </p>
                </div>

                <div className="flex justify-end pt-2">
                    <Button onClick={handleUpdatePassword} disabled={loading} className="w-full sm:w-auto">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                        {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}

const Profile = () => {
    const { user } = useAuth();
    const [showPasswordForm, setShowPasswordForm] = useState(false);

    // Default avatars based on role or name initials could be improved, but current usage is fine.
    const initials = user?.email ? user.email.substring(0, 2).toUpperCase() : 'US';

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-3xl font-bold tracking-tight">Mi Perfil</h1>
                <p className="text-muted-foreground">Gestiona tu información personal y configuración de seguridad.</p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* User Info Card */}
                <motion.div className="lg:col-span-1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                    <Card>
                        <CardHeader className="flex flex-row items-center gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                                {initials}
                            </div>
                            <div>
                                <CardTitle>Tu Cuenta</CardTitle>
                                <CardDescription>Sesión activa</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
                                <div className="font-medium truncate" title={user?.email}>{user?.email}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">ID de Usuario</Label>
                                <div className="text-sm font-mono bg-muted p-2 rounded truncate" title={user?.id}>
                                    {user?.id}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Último acceso</Label>
                                <div className="text-sm text-muted-foreground">
                                    {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }) : 'N/A'}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Security Card */}
                <motion.div className="lg:col-span-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <KeyRound className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <CardTitle>Seguridad y Contraseña</CardTitle>
                                    <CardDescription>Actualiza tu contraseña para mantener tu cuenta segura.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {!showPasswordForm ? (
                                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-muted/50 rounded-lg border">
                                        <div className="space-y-1">
                                            <h4 className="font-medium">Cambiar contraseña</h4>
                                            <p className="text-sm text-muted-foreground">Se recomienda usar una contraseña única y segura.</p>
                                        </div>
                                        <Button onClick={() => setShowPasswordForm(true)} variant="outline">
                                            Cambiar Contraseña
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="bg-muted/30 p-6 rounded-lg border">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-medium">Nueva Contraseña</h4>
                                            <Button variant="ghost" size="sm" onClick={() => setShowPasswordForm(false)}>Cancelar</Button>
                                        </div>
                                        <PasswordUpdateForm />
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
};

export default Profile;