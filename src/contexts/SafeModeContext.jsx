import React, { createContext, useState, useContext, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const SafeModeContext = createContext();

export const useSafeMode = () => useContext(SafeModeContext);

export const SafeModeProvider = ({ children }) => {
  const [isSafeMode, setIsSafeMode] = useState(true);
  const [lastError, setLastError] = useState({ message: null, origin: null });

  const handleDataError = useCallback(async (error, origin = 'unknown') => {
    const errorMessage = error?.message || (typeof error === 'string' ? error : 'Error desconocido');
    console.error(`[SAFE_MODE] Error en ${origin}:`, errorMessage);

    setLastError({ message: errorMessage, origin });

    // Log to backend
    try {
      await supabase.rpc('app_event_v1', {
        p_origin: origin,
        p_level: 'error',
        p_payload: { message: errorMessage }
      });
    } catch (rpcError) {
      console.error('Failed to log event to backend:', rpcError);
    }

    toast({
      title: `Error en ${origin} (modo seguro activo)`,
      variant: 'destructive',
      duration: 5000,
    });
    
  }, []);

  const value = {
    isSafeMode,
    setIsSafeMode,
    lastError,
    handleDataError,
  };

  return (
    <SafeModeContext.Provider value={value}>
      {children}
    </SafeModeContext.Provider>
  );
};