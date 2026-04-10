import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Copy, AlertTriangle, Bug } from 'lucide-react';

const DebugCard = ({ title, data, loading, error, colorClass }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast({
      title: 'Copiado al portapapeles',
      description: `${title} data has been copied.`,
    });
  };

  return (
    <Card className={`overflow-hidden border-l-4 ${colorClass}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Cargando...</span>
          </div>
        ) : error ? (
          <div className="text-destructive-foreground bg-destructive p-2 rounded-md">{error}</div>
        ) : (
          <pre className="text-xs bg-muted/50 p-3 rounded-md font-mono">
            <code>{JSON.stringify(data, null, 2)}</code>
          </pre>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" onClick={handleCopy} disabled={loading || !data}>
          <Copy className="w-4 h-4 mr-2" />
          Copiar JSON
        </Button>
      </CardFooter>
    </Card>
  );
};

const DebugAccess = () => {
  const { sessionRole, user, profile, loadingAuth } = useAuth();
  const [directUser, setDirectUser] = useState(null);
  const [directUserLoading, setDirectUserLoading] = useState(true);
  const [directUserError, setDirectUserError] = useState(null);

  useEffect(() => {
    const fetchDirectUser = async () => {
      setDirectUserLoading(true);
      setDirectUserError(null);
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        setDirectUser(data);
      } catch (err) {
        setDirectUserError(err.message);
      } finally {
        setDirectUserLoading(false);
      }
    };
    fetchDirectUser();
  }, []);

  if (sessionRole.rol !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Acceso Denegado</h1>
        <p className="mt-2 text-muted-foreground">Esta sección es exclusivamente para administradores.</p>
      </div>
    );
  }

  const debugData = [
    { title: 'Context: sessionRole', data: sessionRole, loading: loadingAuth, error: null, color: 'border-blue-500' },
    { title: 'Context: user', data: user, loading: loadingAuth, error: null, color: 'border-green-500' },
    { title: 'Context: profile (from empleados)', data: profile, loading: loadingAuth, error: null, color: 'border-purple-500' },
    { title: 'Direct Call: supabase.auth.getUser()', data: directUser, loading: directUserLoading, error: directUserError, color: 'border-yellow-500' },
    { title: 'Interpreted Role', data: { rol: sessionRole.rol }, loading: loadingAuth, error: null, color: 'border-red-500' },
    { title: 'Is Loaded Flag', data: { loaded: sessionRole.loaded }, loading: loadingAuth, error: null, color: 'border-teal-500' },
    { title: 'User Metadata', data: user?.user_metadata || {}, loading: loadingAuth, error: null, color: 'border-indigo-500' },
    { title: 'App Metadata', data: user?.app_metadata || {}, loading: loadingAuth, error: null, color: 'border-pink-500' },
  ];

  return (
    <div className="p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-8"
      >
        <div className="flex items-center gap-3">
            <Bug className="w-8 h-8 text-primary"/>
            <h1 className="text-3xl font-bold">Debug de Sesión y Acceso</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {debugData.map(item => (
            <motion.div key={item.title} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * debugData.indexOf(item) }}>
                <DebugCard 
                    title={item.title} 
                    data={item.data} 
                    loading={item.loading} 
                    error={item.error}
                    colorClass={item.color}
                />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default DebugAccess;