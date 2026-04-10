import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { Helmet } from 'react-helmet';

const LoginSafe = ({ navigate }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { toast } = useToast();

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            toast({ variant: "destructive", title: "Campos requeridos" });
            return;
        }
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            setLoading(false);
            toast({ variant: 'destructive', title: 'Credenciales inválidas', description: error.message });
        } else {
            toast({ title: '¡Bienvenido!', description: 'Iniciando sesión...' });
        }
    };

    return (
      <>
        <Helmet>
            <title>Login | Horizons ERP</title>
            <meta name="description" content="Acceso al panel de control." />
        </Helmet>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800">
            <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full max-w-md p-8 space-y-8 bg-card rounded-2xl shadow-2xl shadow-primary/10 border"
            >
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-[#2563eb]">
                        Bienvenido
                    </h1>
                    <p className="mt-2 text-muted-foreground">Introduce tus credenciales para acceder.</p>
                </div>
                
                <form className="space-y-6" onSubmit={handleLogin}>
                    <div>
                        <Label htmlFor="email" className="flex items-center text-sm font-medium mb-2">
                            <Mail className="w-4 h-4 mr-2 text-muted-foreground" /> Email
                        </Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            disabled={loading}
                        />
                    </div>
                    <div className="relative">
                        <Label htmlFor="password" className="flex items-center text-sm font-medium mb-2">
                            <Lock className="w-4 h-4 mr-2 text-muted-foreground" /> Contraseña
                        </Label>
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={loading}
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)} 
                            className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5 text-muted-foreground hover:text-foreground"
                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>

                    <Button type="submit" className="w-full h-11 text-base font-bold" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                        {loading ? 'Verificando...' : 'Entrar'}
                    </Button>
                </form>
            </motion.div>
        </div>
      </>
    );
};

export default LoginSafe;
