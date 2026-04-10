import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const NetworkStatusContext = createContext(undefined);

export const NetworkStatusProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);
  const [lastError, setLastError] = useState(null);
  
  // Ref to track previous status to avoid duplicate logs/toasts
  const prevStatus = useRef({ online: true, connected: true });
  // Circuit breaker for ping
  const pingFailures = useRef(0);

  // Monitor browser online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Reset circuit breaker on browser online event
      pingFailures.current = 0;
      checkSupabaseConnection();
      if (!prevStatus.current.online) {
        console.log('[Network] Browser is back online.');
        toast({ title: "Conexión restaurada", description: "Has vuelto a estar en línea." });
      }
      prevStatus.current.online = true;
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setIsSupabaseConnected(false); // If browser is offline, Supabase is definitely unreachable
      if (prevStatus.current.online) {
        console.warn('[Network] Browser went offline.');
        toast({ variant: "destructive", title: "Sin conexión", description: "Comprueba tu conexión a internet." });
      }
      prevStatus.current.online = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Active ping to Supabase to verify API reachability
  const checkSupabaseConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setIsSupabaseConnected(false);
      return false;
    }

    // Circuit breaker: If we failed 5 times in a row, stop pinging aggressively
    // until manual retry or browser online event
    if (pingFailures.current > 5) {
        return false; 
    }

    try {
      // Lightweight query to a public or system table to check health
      // Using abort controller to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const { error } = await supabase
        .from('app_ok')
        .select('status')
        .limit(1)
        .maybeSingle()
        .abortSignal(controller.signal);
      
      clearTimeout(timeoutId);
      
      if (error) {
        // Don't mark as disconnected immediately on 401/403 (auth issues), only on network errors
        if (error.message && (
            error.message.toLowerCase().includes('fetch') || 
            error.message.toLowerCase().includes('network') || 
            error.message.toLowerCase().includes('connection') ||
            error.status === 503 || 
            error.status === 504
        )) {
           pingFailures.current += 1;
           if (prevStatus.current.connected) {
             console.error("[Network] Supabase unreachable:", error.message);
           }
           setIsSupabaseConnected(false);
           prevStatus.current.connected = false;
           return false;
        }
      }
      
      // Success
      pingFailures.current = 0;
      if (!prevStatus.current.connected) {
        console.log("[Network] Supabase connection restored.");
        toast({ title: "Servidor conectado", description: "Conexión con la base de datos restablecida." });
      }
      
      setIsSupabaseConnected(true);
      setLastError(null);
      prevStatus.current.connected = true;
      return true;
    } catch (err) {
      pingFailures.current += 1;
      if (prevStatus.current.connected) {
        console.error("[Network] Critical connection error:", err);
      }
      setIsSupabaseConnected(false);
      setLastError(err.message);
      prevStatus.current.connected = false;
      return false;
    }
  }, []);

  // Allow other components (like fetch interceptors) to report errors
  const reportNetworkError = useCallback(() => {
    if (prevStatus.current.connected) {
        console.warn('[Network] Network error reported by application interceptor.');
        setIsSupabaseConnected(false);
        prevStatus.current.connected = false;
        // We don't immediately ping to avoid storming, but we mark state as disconnected
    }
  }, []);

  // Initial check and periodic heartbeat
  useEffect(() => {
    checkSupabaseConnection();
    
    // Periodic heartbeat every 30 seconds
    const interval = setInterval(() => {
        // Only ping if we haven't tripped the circuit breaker
        if (pingFailures.current <= 5) {
            checkSupabaseConnection();
        }
    }, 30000);
    return () => clearInterval(interval);
  }, [checkSupabaseConnection]);

  // Manual retry function to reset circuit breaker
  const manualRetry = useCallback(() => {
      pingFailures.current = 0;
      return checkSupabaseConnection();
  }, [checkSupabaseConnection]);

  const value = {
    isOnline,
    isSupabaseConnected,
    checkConnection: manualRetry,
    reportNetworkError,
    lastError
  };

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

export const useNetworkStatus = () => {
  const context = useContext(NetworkStatusContext);
  if (context === undefined) {
    throw new Error('useNetworkStatus must be used within a NetworkStatusProvider');
  }
  return context;
};