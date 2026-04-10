import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ForgotPasswordModal = ({ isOpen, onOpenChange, onSendLink }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        await onSendLink(email);
        setLoading(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-card border-border">
                <DialogHeader>
                    <DialogTitle>Recuperar contraseña</DialogTitle>
                    <DialogDescription>
                        Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="email-forgot" className="text-right">
                                Email
                            </Label>
                            <Input
                                id="email-forgot"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="col-span-3"
                                placeholder="tu@email.com"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enviar enlace
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const GoogleIcon = () => (
  <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="currentColor">
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
  </svg>
);

const Login = ({ navigate }) => {
    const { user, sessionRole, loadingAuth, signInWithGoogle } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isForgotPasswordModalOpen, setForgotPasswordModalOpen] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    // Redirect logic: Trigger only when auth loading is finished and user is present
    useEffect(() => {
        if (!loadingAuth && user && isMounted.current) {
            console.log("Login: User authenticated, redirecting. Role:", sessionRole?.rol);
            if (sessionRole?.rol === 'finca_admin') {
                navigate('/gestion/partes');
            } else if (sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado') {
                navigate('/inicio');
            } else {
                navigate('/dashboard');
            }
        }
    }, [user, sessionRole, loadingAuth, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMsg(null);
        if (!email || !password) {
            toast({
                variant: "destructive",
                title: "Campos requeridos",
                description: "Por favor, introduce tu email y contraseña.",
            });
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            toast({
                title: "¡Inicio de sesión exitoso!",
                description: "Bienvenido de nuevo.",
            });
            // We do NOT set loading(false) here because we want to show loading state 
            // until the useEffect redirects us.
        } catch (error) {
            if (isMounted.current) {
                console.error("Login error:", error);
                let friendlyMessage = error.message;
                let isTimeout = false;

                // Handle Hook Timeout (422) specifically
                if (error.status === 422 || error.message?.includes('hook_timeout') || error.message?.includes('timeout')) {
                    friendlyMessage = "El servidor tardó demasiado en responder. Esto puede deberse a una conexión lenta o una verificación pendiente. Por favor, inténtalo de nuevo.";
                    isTimeout = true;
                } else if (error.message === 'Invalid login credentials') {
                    friendlyMessage = "Credenciales incorrectas. Por favor, verifica tu email y contraseña.";
                }

                setErrorMsg(friendlyMessage);
                
                toast({
                    variant: "destructive",
                    title: isTimeout ? "Tiempo de espera agotado" : "Error al iniciar sesión",
                    description: friendlyMessage,
                });
                setLoading(false); // Stop loading on error
            }
        }
    };
    
    const handleGoogleLogin = async () => {
        // Avoid double click
        if (loading) return;
        
        setLoading(true);
        setErrorMsg(null);
        try {
            await signInWithGoogle();
            // No set loading false here because redirect will happen
        } catch (error) {
            console.error("Google login error:", error);
            setErrorMsg("Error al iniciar sesión con Google. Inténtalo de nuevo.");
            setLoading(false);
        }
    };
    
    const handleForgotPassword = async (forgotEmail) => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                redirectTo: `${window.location.origin}/auth/reset`,
            });

            if (error) throw error;

            toast({
                title: "Revisa tu correo",
                description: `Te hemos enviado un enlace para restablecer tu contraseña a ${forgotEmail}.`,
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message,
            });
        } finally {
            if (isMounted.current) setForgotPasswordModalOpen(false);
        }
    };

    const onForgotPasswordClick = () => {
        if(email) {
            handleForgotPassword(email);
        } else {
            setForgotPasswordModalOpen(true);
        }
    }


    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900">
             <ForgotPasswordModal 
                isOpen={isForgotPasswordModalOpen} 
                onOpenChange={setForgotPasswordModalOpen}
                onSendLink={handleForgotPassword}
            />
            <motion.div
                initial={{ opacity: 0, y: -50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md p-8 space-y-8 glass-effect rounded-2xl shadow-2xl shadow-purple-500/10 border border-white/10"
            >
                <div className="text-center">
                    <h1 className="text-4xl font-bold gradient-text">
                        Bienvenido
                    </h1>
                    <p className="mt-2 text-gray-400">Accede a tu panel de control.</p>
                </div>
                
                {errorMsg && (
                    <Alert variant="destructive" className="bg-red-900/20 border-red-900/50 text-red-200">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                            {errorMsg}
                        </AlertDescription>
                    </Alert>
                )}

                <form className="space-y-6" onSubmit={handleLogin}>
                    <div>
                        <Label htmlFor="email" className="flex items-center text-sm font-medium text-white mb-2">
                            <Mail className="w-4 h-4 mr-2" /> Email
                        </Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                            placeholder="tu@email.com"
                            disabled={loading}
                        />
                    </div>
                    <div className="relative">
                        <Label htmlFor="password" className="flex items-center text-sm font-medium text-white mb-2">
                            <Lock className="w-4 h-4 mr-2" /> Contraseña
                        </Label>
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                            placeholder="••••••••"
                            disabled={loading}
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)} 
                            className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5 text-gray-400 hover:text-white"
                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>

                    <Button type="submit" className="w-full h-12 text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transform active:scale-95 transition-transform" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                        {loading ? 'Iniciando...' : 'Entrar'}
                    </Button>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-white/10"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">O</span>
                        <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleGoogleLogin} 
                        className="w-full h-12 bg-white text-slate-900 hover:bg-gray-100 border-none font-semibold rounded-xl transition-colors"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <GoogleIcon />}
                        Iniciar sesión con Google
                    </Button>

                     <div className="text-left pt-2">
                        <Button variant="link" type="button" onClick={onForgotPasswordClick} className="text-purple-400 hover:text-purple-300 px-0">
                            He olvidado mi contraseña
                        </Button>
                    </div>
                </form>

            </motion.div>
        </div>
    );
};

export default Login;