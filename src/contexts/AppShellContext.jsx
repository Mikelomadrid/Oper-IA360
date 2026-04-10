import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const AppShellContext = createContext(undefined);

export const AppShellProvider = ({ children }) => {
  const { user } = useAuth();
  const [appShellData, setAppShellData] = useState({
    empleado: null,
    menu: [],
    pendientes: [],
    notificaciones: { total_no_leidas: 0 }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Track previous user to avoid refetching unnecessarily, but allow refetch on user change
  const prevUserRef = useRef(null);
  const isFetchingRef = useRef(false);

  const fetchAppShellData = useCallback(async (force = false) => {
    if (!user) {
        setAppShellData({
            empleado: null,
            menu: [],
            pendientes: [],
            notificaciones: { total_no_leidas: 0 }
        });
        return;
    }

    // Prevent duplicate calls
    if (isFetchingRef.current && !force) return;
    
    // If we already have data for this user and not forced, skip
    if (!force && prevUserRef.current === user.id && appShellData.empleado) return;

    try {
      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_app_shell_data_v1');

      if (rpcError) throw rpcError;

      if (data) {
        setAppShellData({
            empleado: data.empleado || null,
            menu: data.menu || [],
            pendientes: data.pendientes || [],
            notificaciones: data.notificaciones || { total_no_leidas: 0 }
        });
        prevUserRef.current = user.id;
      }
    } catch (err) {
      console.error('Error fetching app shell data:', err);
      setError(err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [user, appShellData.empleado]);

  // Initial fetch on mount / user change
  useEffect(() => {
    if (user) {
        fetchAppShellData();
    }
  }, [user, fetchAppShellData]);

  // Specific updater for notifications to avoid full refetch
  const updateNotificationCount = (newCount) => {
      setAppShellData(prev => ({
          ...prev,
          notificaciones: { ...prev.notificaciones, total_no_leidas: newCount }
      }));
  };

  const refreshShell = () => fetchAppShellData(true);

  const value = {
    appShellData,
    isLoading,
    error,
    fetchAppShellData,
    refreshShell,
    updateNotificationCount
  };

  return (
    <AppShellContext.Provider value={value}>
      {children}
    </AppShellContext.Provider>
  );
};

export const useAppShell = () => {
  const context = useContext(AppShellContext);
  if (context === undefined) {
    throw new Error('useAppShell must be used within an AppShellProvider');
  }
  return context;
};