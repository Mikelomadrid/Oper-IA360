import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ShieldCheck, LogIn, Loader2 } from 'lucide-react'; // Añadido Loader2
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const RecoverySafe = ({ navigate }) => {
  const { session, loadingAuth } = useAuth();

  useEffect(() => {
    // Cuando la autenticación no esté cargando y tengamos una sesión, navegamos.
    if (!loadingAuth && session?.user?.id) {
      navigate('/ObrasSafe');
    }
  }, [session, loadingAuth, navigate]);

  // Mientras carga la autenticación, mostramos un loader para evitar parpadeos
  if (loadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <Loader2 className="h-12 w-12 text-green-400 animate-spin" />
      </div>
    );
  }

  // Si no hay sesión, mostramos la pantalla de recuperación
  return (
    <>
      <Helmet>
        <title>Modo Recuperación</title>
        <meta name="description" content="Aplicación arrancada en modo de recuperación seguro." />
      </Helmet>
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center p-10 rounded-2xl bg-black/30 backdrop-blur-lg border border-white/10 shadow-2xl max-w-lg"
        >
          <ShieldCheck className="mx-auto h-20 w-20 text-green-400 mb-6" />
          <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-blue-400">
            Recovery Safe
          </h1>
          <p className="text-lg text-gray-300 mb-8">
            La aplicación ha arrancado en modo mínimo y seguro.
          </p>
          <Button
            size="lg"
            className="text-lg bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105"
            onClick={() => navigate('/LoginSafe')}
          >
            <LogIn className="mr-2 h-5 w-5" />
            Ir a Login
          </Button>
        </motion.div>
      </div>
    </>
  );
};

export default RecoverySafe;