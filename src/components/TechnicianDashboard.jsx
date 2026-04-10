import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { 
  Clock, 
  MapPin, 
  Play, 
  Square, 
  Utensils, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2,
  Briefcase,
  ClipboardList,
  Warehouse,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { cn, getMadridLocalTime } from '@/lib/utils';
import Tareas from '@/components/Tareas';
import TechnicianAvisosView from '@/components/TechnicianAvisosView';
import TimeClockMap from '@/components/TimeClockMap';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import AdminIncidencias from '@/components/AdminIncidencias'; 

// --- Helper Hook for Geolocation ---
const useGeolocation = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      if (isMounted.current) setError('Geolocalización no soportada');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (isMounted.current) {
            setLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setError(null);
        }
      },
      (err) => {
        console.error(err);
        if (isMounted.current) setError('No se pudo obtener la ubicación');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  return { location, error, getLocation };
};

const TechnicianDashboard = ({ navigate, view = 'fichaje', isIncidentModalOpenFromSidebar = false }) => {
  // Use 'empleadoId' exported directly from context
  const { user, empleadoId } = useAuth();
  
  const [activeTab, setActiveTab] = useState(view === 'fichaje' ? 'clock' : view === 'tareas' ? 'tasks' : 'notices');
  
  // Clock State
  const [fichajeState, setFichajeState] = useState({
    loading: true,
    active: false,
    data: null,
    pausa: false,
    pausaData: null
  });
  
  const [proyectos, setProyectos] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  const { location, getLocation } = useGeolocation();
  const [showIncidentModal, setShowIncidentModal] = useState(isIncidentModalOpenFromSidebar);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch Proyectos Activos
      const { data: proys } = await supabase
        .from('proyectos')
        .select('id, nombre_proyecto')
        .eq('estado', 'activo')
        .order('nombre_proyecto');
        
      if (isMounted.current) setProyectos(proys || []);

      // 2. Fetch Active Fichaje State
      await refreshFichajeState();
    };

    fetchData();
  }, [empleadoId]); // Depend on empleadoId

  // Update tab when prop changes
  useEffect(() => {
    if (view === 'fichaje') setActiveTab('clock');
    else if (view === 'tareas') setActiveTab('tasks');
    else if (view === 'incidencias') setActiveTab('incidents'); // Nueva pestaña
  }, [view]);

  // Handle Incident Modal from Sidebar prop
  useEffect(() => {
    setShowIncidentModal(isIncidentModalOpenFromSidebar);
  }, [isIncidentModalOpenFromSidebar]);

  const refreshFichajeState = async () => {
    if (!empleadoId) {
        if (isMounted.current) setFichajeState(prev => ({ ...prev, loading: false }));
        return;
    }

    if (isMounted.current) setFichajeState(prev => ({ ...prev, loading: true }));
    try {
        // Call RPC to get detailed state
        const { data: state, error } = await supabase.rpc('get_estado_fichaje_empleado', { 
            p_empleado_id: empleadoId 
        });

        if (error) throw error;

        // If state is empty (no rows), means no active fichaje
        if (!state || state.length === 0) {
             if (isMounted.current) {
                 setFichajeState({
                    loading: false,
                    active: false,
                    data: null,
                    pausa: false,
                    pausaData: null
                });
             }
            return;
        }

        // We have an active fichaje
        const current = state[0]; 
        
        // Fetch full details
        const { data: fullFichaje } = await supabase
            .from('control_horario')
            .select('*, proyectos(nombre_proyecto), centros_coste_internos(nombre_centro)')
            .eq('id', current.fichaje_id)
            .single();

        if (isMounted.current) {
            setFichajeState({
                loading: false,
                active: true,
                data: fullFichaje,
                pausa: current.en_pausa,
                pausaData: null 
            });

            // Pre-select the project if active 
            if (fullFichaje?.proyecto_id) {
                setSelectedProject(fullFichaje.proyecto_id);
            } else if (fullFichaje?.centro_coste_interno_id) {
                setSelectedProject('nave_taller');
            }
        }

    } catch (err) {
        console.error("Error refreshing fichaje:", err);
        if (isMounted.current) setFichajeState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleClockAction = async (action) => {
    getLocation(); // Refresh location
    setActionLoading(true);
    
    // Capturamos el timestamp local (Madrid) en este momento exacto para pasar al backend
    // Esto asegura consistencia y evita discrepancias de UTC.
    const customTime = getMadridLocalTime();

    try {
        let successMessage = '';

        if (action === 'entrada') {
            if (!selectedProject) {
                toast({ variant: "destructive", title: "Selecciona un destino", description: "Debes indicar una obra o Nave/Taller." });
                if (isMounted.current) setActionLoading(false);
                return;
            }

            let rpcParams = {
                p_latitud: location?.lat || null,
                p_longitud: location?.lng || null,
                // p_custom_time removed as it is not supported by fichar_entrada
            };

            if (selectedProject === 'nave_taller') {
                rpcParams.p_tipo = 'nave_taller';
                rpcParams.p_proyecto_id = null; 
                rpcParams.p_centro_coste_interno_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Using known ID or null for trigger to handle
            } else {
                rpcParams.p_tipo = 'entrada_obra';
                rpcParams.p_proyecto_id = selectedProject;
                rpcParams.p_centro_coste_interno_id = null;
            }

            const { data: result, error: rpcError } = await supabase.rpc('fichar_entrada', rpcParams);
            
            if (rpcError) throw rpcError;
            if (result && result.startsWith('ERROR')) throw new Error(result);
            
            successMessage = '¡Jornada iniciada!';
        } 
        else if (action === 'salida') {
            const { data: result, error: rpcError } = await supabase.rpc('fichar_salida', {
                p_latitud: location?.lat,
                p_longitud: location?.lng,
                // p_custom_time removed
            });
            if (rpcError) throw rpcError;
            if (result && result.startsWith('ERROR')) throw new Error(result);
            successMessage = 'Jornada finalizada. ¡Buen descanso!';
        }
        else if (action === 'pausa') {
            const { data: result, error: rpcError } = await supabase.rpc('fichar_pausa_inicio', {
                p_latitud: location?.lat,
                p_longitud: location?.lng,
                // p_custom_time removed
            });
            if (rpcError) throw rpcError;
            if (result && result.startsWith('ERROR')) throw new Error(result);
            successMessage = 'Pausa iniciada.';
        }
        else if (action === 'reanudar') {
            const { data: result, error: rpcError } = await supabase.rpc('fichar_pausa_fin', {
                p_latitud: location?.lat,
                p_longitud: location?.lng,
                // p_custom_time removed
            });
            if (rpcError) throw rpcError;
            if (result && result.startsWith('ERROR')) throw new Error(result);
            successMessage = 'Jornada reanudada.';
        }

        toast({ title: successMessage, className: "bg-green-600 text-white border-none" });
        await refreshFichajeState();

    } catch (err) {
        toast({ 
            variant: "destructive", 
            title: "Error al fichar", 
            description: err.message || "Ha ocurrido un error desconocido." 
        });
    } finally {
        if (isMounted.current) setActionLoading(false);
    }
  };

  // --- Render Helpers ---

  const renderClockTab = () => {
    if (fichajeState.loading) {
        return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    }

    const isActive = fichajeState.active;
    const isPaused = fichajeState.pausa;
    const currentData = fichajeState.data;

    return (
      <div className="space-y-6 max-w-md mx-auto mt-4">
        {/* Status Card */}
        <Card className={cn("border-l-4 shadow-md overflow-hidden relative", 
            isActive ? (isPaused ? "border-l-amber-500" : "border-l-green-500") : "border-l-slate-300"
        )}>
            <div className={cn("absolute top-0 right-0 p-4 opacity-10 pointer-events-none", 
                isActive ? (isPaused ? "text-amber-500" : "text-green-500") : "text-slate-400"
            )}>
                <Clock className="w-32 h-32" />
            </div>

            <CardHeader className="pb-2 relative z-10">
                <CardTitle className="flex items-center gap-2 text-xl">
                    {isActive ? (
                        isPaused ? <><Utensils className="w-6 h-6 text-amber-500"/> En Pausa</> 
                                 : <><CheckCircle2 className="w-6 h-6 text-green-500"/> Jornada Activa</>
                    ) : (
                        <><Clock className="w-6 h-6 text-slate-400"/> Sin Actividad</>
                    )}
                </CardTitle>
                <CardDescription>
                    {isActive ? (
                        <span className="font-medium text-foreground block mt-1 text-lg">
                            {currentData?.proyectos?.nombre_proyecto || 
                             (currentData?.tipo === 'nave_taller' ? 'Nave / Taller' : 
                             (currentData?.centros_coste_internos?.nombre_centro || 'Ubicación desconocida'))}
                        </span>
                    ) : "Selecciona un destino para iniciar"}
                </CardDescription>
            </CardHeader>

            <CardContent className="pb-6 relative z-10">
                {!isActive && (
                    <div className="mt-4 space-y-4">
                        <Select value={selectedProject} onValueChange={setSelectedProject}>
                            <SelectTrigger className="h-12 text-lg bg-background/50 backdrop-blur-sm border-primary/20 focus:ring-primary">
                                <SelectValue placeholder="¿Dónde vas a trabajar?" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="nave_taller" className="font-medium text-orange-600 bg-orange-50/50 focus:bg-orange-100 focus:text-orange-700">
                                    <div className="flex items-center gap-2 py-1">
                                        <Warehouse className="w-5 h-5" />
                                        <span>Nave / Taller</span>
                                    </div>
                                </SelectItem>
                                {proyectos.length > 0 && <div className="h-px bg-border my-1" />}
                                {proyectos.map(p => (
                                    <SelectItem key={p.id} value={p.id} className="py-2">
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="w-4 h-4 text-muted-foreground" />
                                            <span>{p.nombre_proyecto}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </CardContent>

            <CardFooter className="pt-0 pb-6 px-6 relative z-10 flex flex-col gap-3">
                {!isActive ? (
                    <Button 
                        className="w-full h-14 text-lg font-bold shadow-lg shadow-green-900/20 bg-green-600 hover:bg-green-700" 
                        onClick={() => handleClockAction('entrada')}
                        disabled={actionLoading || !selectedProject}
                    >
                        {actionLoading ? 'Procesando...' : <><Play className="w-5 h-5 mr-2 fill-current" /> INICIAR JORNADA</>}
                    </Button>
                ) : (
                    <div className="grid grid-cols-2 gap-3 w-full">
                        {isPaused ? (
                            <Button 
                                variant="outline" 
                                className="h-12 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                                onClick={() => handleClockAction('reanudar')}
                                disabled={actionLoading}
                            >
                                <RotateCcw className="w-4 h-4 mr-2" /> Reanudar
                            </Button>
                        ) : (
                            <Button 
                                variant="outline" 
                                className="h-12 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                                onClick={() => handleClockAction('pausa')}
                                disabled={actionLoading}
                            >
                                <Utensils className="w-4 h-4 mr-2" /> Pausa
                            </Button>
                        )}
                        
                        <Button 
                            variant="destructive" 
                            className="h-12 shadow-md shadow-red-900/10"
                            onClick={() => handleClockAction('salida')}
                            disabled={actionLoading}
                        >
                            <Square className="w-4 h-4 mr-2 fill-current" /> Finalizar
                        </Button>
                    </div>
                )}
            </CardFooter>
        </Card>

        {/* Map Preview (Optional) */}
        {isActive && currentData && currentData.id && (
            <div className="rounded-lg overflow-hidden border shadow-sm h-48 bg-muted/20 relative">
                <TimeClockMap fichajeId={currentData.id} height="h-full" />
                <div className="absolute bottom-2 right-2 bg-white/80 backdrop-blur px-2 py-1 rounded text-xs text-muted-foreground border shadow-sm">
                    Ubicación de entrada
                </div>
            </div>
        )}
      </div>
    );
  };

  return (
    <div className="pb-20 md:pb-0">
        <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="container max-w-2xl mx-auto p-4"
        >
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Hola, {user?.user_metadata?.nombre || 'Compañero'}</h1>
                    <p className="text-muted-foreground text-sm">Panel de Técnico</p>
                </div>
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => navigate('/login')}>
                    <LogOut className="w-5 h-5" />
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="clock" className="flex items-center gap-2">
                        <Clock className="w-4 h-4" /> <span className="hidden sm:inline">Fichaje</span>
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" /> <span className="hidden sm:inline">Mis Tareas</span>
                    </TabsTrigger>
                    <TabsTrigger value="incidents" className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> <span className="hidden sm:inline">Incidencias</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="clock" className="mt-0 focus-visible:ring-0">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key="clock"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {renderClockTab()}
                        </motion.div>
                    </AnimatePresence>
                </TabsContent>

                <TabsContent value="tasks" className="mt-0 focus-visible:ring-0">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                       <Tareas navigate={navigate} />
                    </motion.div>
                </TabsContent>

                <TabsContent value="notices" className="mt-0 focus-visible:ring-0">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                       <TechnicianAvisosView />
                    </motion.div>
                </TabsContent>

                <TabsContent value="incidents" className="mt-0 focus-visible:ring-0">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                       <AdminIncidencias />
                    </motion.div>
                </TabsContent>
            </Tabs>
        </motion.div>

        {/* Global Incident Modal Triggered from Sidebar */}
        <Dialog open={showIncidentModal} onOpenChange={(open) => {
            setShowIncidentModal(open);
            if (!open) setActiveTab('clock'); 
        }}>
            <DialogContent className="sm:max-w-3xl h-[80vh] p-0 overflow-hidden">
                <div className="h-full overflow-y-auto p-4">
                    <AdminIncidencias />
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
};

export default TechnicianDashboard;