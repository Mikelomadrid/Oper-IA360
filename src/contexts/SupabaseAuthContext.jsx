import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useNetworkStatus } from '@/contexts/NetworkStatusContext';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { isSupabaseConnected, isOnline, reportNetworkError } = useNetworkStatus(); 
  const isMounted = useRef(true);

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionRole, setSessionRole] = useState(null);
  
  // Use refs to track auth state for non-reactive callbacks (like fetch interceptor)
  const isLoggedInRef = useRef(false);
  
  // Inbox State
  const [inboxItems, setInboxItems] = useState([]);
  const [readItems, setReadItems] = useState(new Set());

  // Flags for logic control
  const isManualLogout = useRef(false);
  const isHandlingExpiration = useRef(false);

  // Circuit breaker for fetchUserRole to prevent infinite loops
  const fetchRoleAttempts = useRef(0);
  const lastFetchTime = useRef(0);

  // Track last saved Google token to prevent duplicate RPC calls
  const lastSavedToken = useRef(null);

  useEffect(() => {
    isLoggedInRef.current = !!user;
  }, [user]);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // --- GLOBAL SESSION MANAGEMENT ---
  
  const handleSessionExpired = useCallback(async (isSilent = false) => {
    // Prevent double handling if multiple requests fail at once
    if (isHandlingExpiration.current) return;
    
    // If we are already at login, no need to redirect or notify
    if (location.pathname === '/login') {
        setLoading(false);
        return;
    }

    isHandlingExpiration.current = true;

    // Only show friendly message if NOT silent (user was logged in and active)
    if (!isSilent && isLoggedInRef.current) {
        toast({
          title: "Sesión Finalizada",
          description: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
          duration: 5000,
        });
    }

    // 1. Clean local state immediately
    if (isMounted.current) {
        setSession(null);
        setUser(null);
        setSessionRole(null);
        setInboxItems([]);
        isLoggedInRef.current = false;
    }
    
    // Clear storage to remove stale tokens
    localStorage.removeItem('supabase.auth.token'); // Assuming default key, or clear all safe keys
    // We avoid localStorage.clear() to preserve preferences like theme
    
    // 2. Attempt Supabase SignOut silently
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Ignore errors during forced signout
    }

    // 3. Redirect
    navigate('/login');
    
    // Reset flag after delay
    setTimeout(() => { 
        isHandlingExpiration.current = false; 
        if (isMounted.current) setLoading(false);
    }, 1000);
  }, [navigate, toast, location.pathname]);

  // --- FETCH INTERCEPTOR FOR AUTH & NETWORK ERRORS ---
  // Intercept all fetch calls to detect 401/400 errors related to Auth tokens AND network failures
  useEffect(() => {
    const originalFetch = window.fetch;

    const isAuthError = async (response, resource) => {
      // 1. Check HTTP Status
      if (response.status !== 400 && response.status !== 401) return false;

      // 2. Only intercept Supabase calls
      const url = resource instanceof Request ? resource.url : resource;
      if (!url.includes(supabase.supabaseUrl)) return false;

      // 3. Inspect body
      try {
        const clone = response.clone();
        const data = await clone.json();
        
        const errorMsg = (data.error_description || data.msg || data.message || data.error || '').toLowerCase();
        
        // Specific checks for Refresh Token issues
        if (
          errorMsg.includes('invalid refresh token') || 
          errorMsg.includes('refresh token not found') ||
          errorMsg.includes('jwt expired') ||
          (response.status === 401 && errorMsg.includes('invalid_grant'))
        ) {
          return true;
        }
      } catch (e) {
        // Ignore non-JSON responses
      }
      return false;
    };

    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);

        if (await isAuthError(response, args[0])) {
          // If user was logged in, show friendly message. If not (startup), be silent.
          const wasLoggedIn = isLoggedInRef.current;
          const silent = !wasLoggedIn; 
          
          console.debug("Auth interceptor caught error. Silent:", silent);
          handleSessionExpired(silent);
        }

        return response;
      } catch (error) {
        // --- NETWORK ERROR HANDLING ---
        // Catch "Failed to fetch" which indicates network failure (DNS, Offline, etc.)
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            console.error("Global fetch interceptor caught network error:", error);
            
            // Report to NetworkStatusContext to trigger global banner
            reportNetworkError();

            // Optional: Show toast for immediate feedback if user was interacting
            // We debounce this slightly or rely on the global banner to avoid toast spam
            // But for critical actions, a toast is helpful.
            if (isLoggedInRef.current) {
               // We don't toast here to avoid spamming if many requests fail at once.
               // The GlobalErrorBanner will show up.
            }
        }
        throw error; // Re-throw so the calling component can handle loading states
      }
    };

    return () => {
      window.fetch = originalFetch; // Cleanup
    };
  }, [handleSessionExpired, reportNetworkError]);


  // Load/Save read inbox items
  useEffect(() => {
    try {
      const stored = localStorage.getItem('read_inbox_items');
      if (stored && isMounted.current) setReadItems(new Set(JSON.parse(stored)));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('read_inbox_items', JSON.stringify(Array.from(readItems)));
    } catch (e) { console.error(e); }
  }, [readItems]);

  // --- ROLE FETCHING ---
  const fetchUserRole = useCallback(async (userId, currentUser) => {
    if (!isMounted.current) return;

    // Network Guard
    if (!isSupabaseConnected && !isOnline) {
        setLoading(false);
        return;
    }

    // Circuit Breaker
    const now = Date.now();
    if (now - lastFetchTime.current < 2000) {
        fetchRoleAttempts.current += 1;
        if (fetchRoleAttempts.current > 3) {
            setLoading(false); 
            return; 
        }
    } else {
        fetchRoleAttempts.current = 0;
    }
    lastFetchTime.current = now;

    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (!isMounted.current) return;

      if (!error && data) {
        setSessionRole({ ...data, loaded: true, empleadoId: data.id });
      } else {
        // Fallback or Bootstrap
        if (isSupabaseConnected) {
            const { data: newEmpData, error: newEmpError } = await supabase.rpc('bootstrap_new_user');

            if (newEmpError) {
              // Minimal guest role if DB fails
              setSessionRole({ role: 'guest', loaded: true, id: null, empleadoId: null });
            } else {
              const metaName = currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name;
              setSessionRole({
                id: newEmpData.empleado_id,
                nombre: metaName || newEmpData.email_out.split('@')[0],
                apellidos: '',
                rol: newEmpData.rol_out,
                email: newEmpData.email_out,
                auth_user_id: userId,
                loaded: true,
                empleadoId: newEmpData.empleado_id
              });
            }
        } else {
             setSessionRole({ role: 'guest', loaded: true, id: null, empleadoId: null, offline: true });
        }
      }
    } catch (error) {
      if (isMounted.current) {
        setSessionRole({ role: 'guest', loaded: true, id: null, empleadoId: null });
      }
    } finally {
        if (isMounted.current) setLoading(false);
    }
  }, [isSupabaseConnected, isOnline]);

  const refreshInbox = useCallback(async () => {
    if (!user || !sessionRole?.empleadoId || !isSupabaseConnected) return;
    
    try {
      let adminItems = [];
      if (['admin', 'encargado'].includes(sessionRole.rol)) {
          const { data } = await supabase.rpc('get_admin_pending_actions');
          if (data) adminItems = data;
      }

      const { data: notifData } = await supabase
          .from('notificaciones')
          .select('*')
          .eq('empleado_id', sessionRole.empleadoId)
          .order('fecha_creacion', { ascending: false });

      const { data: assignData } = await supabase
          .from('herramienta_asignaciones')
          .select(`id, created_at, herramienta_id, herramientas(nombre), entregada_por, entregada_por_user:empleados!entregada_por(nombre, apellidos)`)
          .eq('entregada_a', sessionRole.empleadoId)
          .eq('estado', 'pendiente_aceptacion');

      let personalItems = notifData ? notifData.map(n => ({
          id: n.id, 
          type: n.tipo_objeto, 
          title: getNotificationTitle(n.tipo_objeto),
          description: n.mensaje,
          created_at: n.fecha_creacion,
          status: n.estado,
          priority: 'medium', 
          reference_id: n.referencia_id, 
          action_path: null,
          is_notification: true
      })) : [];

      let assignmentItems = assignData ? assignData.map(a => ({
          id: a.id,
          type: 'tool_assignment',
          title: 'Herramienta Asignada',
          description: `Se te ha asignado: ${a.herramientas?.nombre}. Por: ${a.entregada_por_user?.nombre || 'Almacén'}.`,
          created_at: a.created_at,
          status: 'pending',
          priority: 'high',
          reference_id: a.id,
          action_path: null,
          is_assignment: true
      })) : [];

      if (isMounted.current) {
        setInboxItems([...adminItems, ...personalItems, ...assignmentItems]);
      }
    } catch (err) {
      // Silent error for inbox refresh
    }
  }, [user, sessionRole, isSupabaseConnected]);

  const getNotificationTitle = (type) => {
      switch (type) {
          case 'lead_visita': return 'Nueva Visita Comercial';
          case 'parte_visita': return 'Nuevo Servicio Asignado';
          case 'tarea': return 'Nueva Tarea Asignada';
          default: return 'Notificación';
      }
  };

  // --- SESSION HANDLER ---
  const handleSession = useCallback(async (currentSession) => {
    if (!isMounted.current) return;

    if (!currentSession) {
      setSession(null);
      setUser(null);
      setSessionRole(null);
      setInboxItems([]);
      setLoading(false);
      lastSavedToken.current = null;
      return;
    }

    if (session?.access_token === currentSession.access_token && sessionRole?.loaded) {
        return;
    }

    setSession(currentSession);
    setUser(currentSession.user);

    // Google Token Automation
    if (currentSession.user?.app_metadata?.provider === 'google' && currentSession.provider_token) {
        const tokenSignature = currentSession.provider_token; 
        if (lastSavedToken.current !== tokenSignature) {
            lastSavedToken.current = tokenSignature; 
            const p_token_expiry = currentSession.expires_at ? new Date(currentSession.expires_at * 1000) : new Date(Date.now() + 3600 * 1000);
            
            supabase.rpc('save_google_calendar_tokens', {
                p_user_id: currentSession.user.id,
                p_google_email: currentSession.user.email,
                p_access_token: currentSession.provider_token,
                p_refresh_token: currentSession.provider_refresh_token || currentSession.provider_token,
                p_token_expiry
            }).catch(() => {});
        }
    }

    await fetchUserRole(currentSession.user.id, currentSession.user);
  }, [fetchUserRole, session, sessionRole]);

  const handleSessionRef = useRef(handleSession);
  useEffect(() => { handleSessionRef.current = handleSession; }, [handleSession]);

  // --- INITIALIZATION ---
  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
        try {
            // 1. Get Session FIRST (Silent check)
            const { data, error } = await supabase.auth.getSession();
            
            // Handle error or missing session silently on startup
            if (error || !data.session) {
                if (isMounted.current) {
                    setSession(null);
                    setUser(null);
                    setSessionRole(null);
                    setLoading(false);
                }
                return;
            }
            
            // Session exists, process it
            if (handleSessionRef.current) {
                await handleSessionRef.current(data.session);
            }

        } catch (e) {
            // Graceful failure
            console.debug("Auth initialization silent exception", e);
            if (isMounted.current) setLoading(false);
        }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
            if (isMounted.current) {
                setSession(null);
                setUser(null);
                setSessionRole(null);
                setLoading(false);
                lastSavedToken.current = null;
            }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (handleSessionRef.current) {
                await handleSessionRef.current(session);
            }
        }
    });
    subscription = authListener.subscription;

    return () => {
        if (subscription) subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (sessionRole?.loaded) refreshInbox();
  }, [sessionRole, refreshInbox]);

  // --- AUTH ACTIONS ---
  
  const signUp = useCallback(async (email, password, options) => {
    try {
        const { error } = await supabase.auth.signUp({ email, password, options });
        if (error) throw error;
        return { error: null };
    } catch (error) {
        toast({ variant: "destructive", title: "Sign up Failed", description: error.message });
        return { error };
    }
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return { error: null };
    } catch (error) {
        // Propagate error to Login.jsx for handling
        return { error };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                queryParams: { access_type: 'offline', prompt: 'consent' },
                scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
                redirectTo: window.location.origin
            },
        });
        if (error) throw error;
        return { error: null };
    } catch (error) {
        toast({ variant: "destructive", title: "Google Login Failed", description: error.message });
        return { error };
    }
  }, [toast]);

  const signOut = useCallback(async () => {
    isManualLogout.current = true;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("SignOut warning (benign):", err.message);
    } finally {
      if (isMounted.current) {
        setUser(null);
        setSession(null);
        setSessionRole(null);
        setInboxItems([]);
        lastSavedToken.current = null;
        localStorage.clear(); 
        sessionStorage.clear();
      }
      isManualLogout.current = false;
    }
    return { error: null };
  }, []);

  // Inbox helpers
  const markAsRead = useCallback((id) => setReadItems(prev => new Set(prev).add(id)), []);
  const markAsUnread = useCallback((id) => setReadItems(prev => { const n = new Set(prev); n.delete(id); return n; }), []);
  const toggleReadStatus = useCallback((id) => setReadItems(prev => { const n = new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const isItemRead = useCallback((id) => readItems.has(id), [readItems]);
  const unreadCount = useMemo(() => inboxItems.filter(item => !readItems.has(item.id)).length, [inboxItems, readItems]);

  const displayName = useMemo(() => {
    // 1. Force ATC Fincas for this specific ID
    if (user?.id === '9e3e6fcf-7966-4949-8543-b5d7a82e13dd') {
        return 'ATC Fincas';
    }

    const dbName = sessionRole?.nombre;
    const metaName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.display_name;
    const isGeneric = (name) => {
        if (!name) return true;
        const lower = name.trim().toLowerCase();
        const terms = ['admin', 'administrator', 'encargado', 'tecnico', 'usuario', 'user', 'guest', 'colaborador'];
        if (terms.includes(lower)) return true;
        if (user?.email && lower === user.email.split('@')[0].toLowerCase()) return true;
        return false;
    };

    if (dbName && dbName.trim() !== '') {
        if (isGeneric(dbName) && metaName && metaName.trim() !== '') return metaName;
        return dbName;
    }
    if (metaName && metaName.trim() !== '') return metaName;
    if (user?.email) {
        const emailPart = user.email.split('@')[0];
        if (!isGeneric(emailPart)) return emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
    }
    return 'Usuario';
  }, [sessionRole, user]);

  const userPhoto = useMemo(() => {
    return sessionRole?.foto_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  }, [sessionRole, user]);

  const value = useMemo(() => ({
    user,
    session,
    loadingAuth: loading,
    loading,
    sessionRole,
    empleadoId: sessionRole?.id || null, 
    displayName, 
    userPhoto,   
    signUp,
    signIn,
    signInWithGoogle, 
    signOut,
    inboxItems,
    refreshInbox,
    markAsRead,
    markAsUnread,
    toggleReadStatus,
    isItemRead,
    unreadCount
  }), [
    user, session, loading, sessionRole, displayName, userPhoto, signUp, signIn, signInWithGoogle, signOut,
    inboxItems, refreshInbox, markAsRead, markAsUnread, toggleReadStatus, isItemRead, unreadCount
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};