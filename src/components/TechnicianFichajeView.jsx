import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import SeleccionTareaModal from '@/components/SeleccionTareaModal';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  MapPin,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Briefcase,
  History,
  Clock,
  AlertCircle,
  Warehouse,
  Info
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { fmtMadrid, cn, formatSecondsToHoursMinutes, getMadridLocalTime } from '@/lib/utils';
import { DateRangePicker } from '@/components/DateRangePicker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import TimeClockMap from '@/components/TimeClockMap';
import { useGeolocation } from '@/hooks/useGeolocation';
import FontaneriaModal from '@/components/FontaneriaModal';

/* 
   NO frontend duration/pauses/hour calculations; 
   Supabase view v_fichajes_admin_neto_v5 is single source of truth.
*/

// Email del fontanero que ve el modal de fontanería tras el cierre
const FRAN_EMAIL = 'fran@orkaled.com';

const TechnicianFichajeView = ({ navigate }) => {
  const { sessionRole, user } = useAuth();
  const [activeTab, setActiveTab] = useState('registro');
  
  // --- STATE FOR REGISTRATION ---
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState({
    fichajeId: null,
    enPausa: false,
    nombreUbicacion: null,
    pauseStartTime: null,
    loading: true
  });

  const { getLocation, loading: geoLoading } = useGeolocation();

  // --- STATE FOR FONTANERIA MODAL ---
  const [fontaneriaModalOpen, setFontaneriaModalOpen] = useState(false);
  const [fechaSalida, setFechaSalida] = useState(null);

  // --- STATE FOR TASK SELECTION MODAL ---
  const [tareaModalOpen, setTareaModalOpen] = useState(false);
  const [proyectoFichado, setProyectoFichado] = useState(null);

  // Detectar si el usuario actual es Fran
  const esFran = user?.email?.toLowerCase() === FRAN_EMAIL;

  // --- STATE FOR HISTORY ---
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
  
  // --- STATE FOR DETAIL MODAL ---
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedFichaje, setSelectedFichaje] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // --- INITIAL DATA LOADING ---
  useEffect(() => {
    fetchProjects();
    fetchCurrentStatus();
  }, []);

  useEffect(() => {
    if (activeTab === 'historial') {
      fetchHistory();
    }
  }, [activeTab, dateRange]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('vw_selector_fichaje_obras_v1')
        .select('value, label');
      
      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      console.error("Error loading projects:", err);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los proyectos." });
    }
  };

  const fetchCurrentStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('get_estado_fichaje_sesion');
      
      if (error) throw error;

      if (data && data.length > 0) {
        let pauseStartTime = null;
        
        if (data[0].en_pausa) {
             const { data: pauseData } = await supabase
                .from('pausas')
                .select('hora_inicio_pausa')
                .eq('fichaje_id', data[0].fichaje_id)
                .is('hora_fin_pausa', null)
                .limit(1)
                .maybeSingle();
             
             if (pauseData) {
                 pauseStartTime = pauseData.hora_inicio_pausa;
             }
        }

        setCurrentStatus({
          fichajeId: data[0].fichaje_id,
          enPausa: data[0].en_pausa,
          nombreUbicacion: data[0].nombre_ubicacion,
          pauseStartTime,
          loading: false
        });
      } else {
        setCurrentStatus({
          fichajeId: null,
          enPausa: false,
          nombreUbicacion: null,
          pauseStartTime: null,
          loading: false
        });
      }
    } catch (err) {
      console.error("Error status:", err);
      setCurrentStatus(prev => ({ ...prev, loading: false }));
    }
  };

  // --- ACTIONS ---

  const performAction = async (actionType) => {
    setActionLoading(true);
    
    try {
      // 1. Get Geolocation using the hook
      const { lat, lng, error } = await getLocation();
      
      if (error) {
        console.warn("GPS error:", error);
        toast({ 
          variant: "warning", 
          title: "Ubicación no precisa", 
          description: error.message || "No se pudo obtener GPS exacto. Se registrará sin coordenadas." 
        });
      }

      let rpcName = '';
      let params = { 
          p_latitud: lat, 
          p_longitud: lng,
          p_custom_time: null 
      };

      if (actionType === 'entrada') {
        if (!selectedProject) { 
             throw new Error("Selecciona una obra o destino.");
        }
        
        rpcName = 'fichar_entrada'; 
        
        if (selectedProject === 'nave') {
             params = {
                ...params,
                p_proyecto_id: null,
                p_centro_coste_interno_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
                p_tipo: 'nave_taller'
             };
        } else {
             params = {
                ...params,
                p_proyecto_id: selectedProject,
                p_centro_coste_interno_id: null, 
                p_tipo: 'entrada_obra'
             };
        }
      } else if (actionType === 'salida') {
        rpcName = 'fichar_salida';
      } else if (actionType === 'pausa') {
        rpcName = 'fichar_pausa';
      } else if (actionType === 'reanudar') {
        rpcName = 'fichar_reanudar';
      }

      const { data, error: rpcError } = await supabase.rpc(rpcName, params);
      
      if (rpcError) throw rpcError;

      if (typeof data === 'string' && data.startsWith('ERROR')) {
        throw new Error(data.replace('ERROR: ', ''));
      }

      toast({
        title: "Acción registrada",
        description: typeof data === 'string' ? data : "Registro guardado correctamente.",
        className: "bg-green-600 text-white"
      });

      await fetchCurrentStatus();

      // ✅ Si es fichaje de ENTRADA en OBRA (no nave), abrir modal de tareas
      if (actionType === 'entrada' && selectedProject && selectedProject !== 'nave') {
        setProyectoFichado(selectedProject);
        setTareaModalOpen(true);
      }

      if (actionType === 'salida') {
        setSelectedProject(null);
        // ✅ Si es Fran, abrir el modal de fontanería
        if (esFran) {
          setFechaSalida(format(new Date(), 'yyyy-MM-dd'));
          setFontaneriaModalOpen(true);
        }
      }

    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al fichar",
        description: err.message
      });
    } finally {
      setActionLoading(false);
    }
  };

  // --- HISTORY ---

  const fetchHistory = async () => {
    if (!sessionRole?.empleadoId) return;
    setHistoryLoading(true);
    try {
      let query = supabase
        .from('v_fichajes_admin_neto_v5')
        .select(`
          fichaje_id,
          empleado_id,
          proyecto_id,
          fecha,
          hora_entrada,
          hora_salida,
          horas_normales_dia,
          horas_extra_dia,
          horas_festivo_dia,
          saldo_dia,
          es_fin_semana,
          es_festivo,
          proyecto:proyectos(nombre_proyecto),
          centro:centros_coste_internos(nombre_centro)
        `)
        .eq('empleado_id', sessionRole.empleadoId)
        .order('hora_entrada', { ascending: false });

      if (dateRange?.from) {
        query = query.gte('hora_entrada', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('hora_entrada', toDate.toISOString());
      }

      const { data: historyData, error: historyError } = await query;
      if (historyError) throw historyError;

      if (!historyData || historyData.length === 0) {
        setHistoryData([]);
        return;
      }

      const processedData = historyData.map(item => {
        let ubicacion = 'Nave / Taller';
        let tipoIcon = 'nave'; 
        
        if (item.proyecto?.nombre_proyecto) {
            ubicacion = item.proyecto.nombre_proyecto;
            tipoIcon = 'obra';
        } else if (item.centro?.nombre_centro) {
            ubicacion = item.centro.nombre_centro;
        } else if (!item.proyecto_id) {
             ubicacion = 'Nave / Taller';
        }

        const totalHoras = (item.horas_normales_dia || 0) + (item.horas_extra_dia || 0) + (item.horas_festivo_dia || 0);
        const totalSeconds = totalHoras * 3600;

        return {
            id: item.fichaje_id, 
            hora_entrada: item.hora_entrada,
            hora_salida: item.hora_salida,
            horas_normales: item.horas_normales_dia || 0,
            horas_extra: item.horas_extra_dia || 0,
            horas_festivo: item.horas_festivo_dia || 0,
            duracion_neta_segundos: totalSeconds, 
            tipo_icon: tipoIcon,
            nombre_ubicacion: ubicacion
        };
      });

      setHistoryData(processedData);

    } catch (err) {
      console.error("Error fetching history:", err);
      toast({ variant: "destructive", title: "Error historial", description: err.message });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRowClick = async (item) => {
    setSelectedFichaje(null);
    setDetailOpen(true);
    setDetailLoading(true);

    try {
        const { data: pausas, error } = await supabase
            .from('pausas')
            .select('*')
            .eq('fichaje_id', item.id) 
            .order('hora_inicio_pausa', { ascending: true });
        
        if (error) throw error;

        const pauseSeconds = (pausas || []).reduce((acc, p) => {
            if (p.hora_inicio_pausa && p.hora_fin_pausa) {
                const start = new Date(p.hora_inicio_pausa);
                const end = new Date(p.hora_fin_pausa);
                return acc + (end - start) / 1000;
            }
            return acc;
        }, 0);

        setSelectedFichaje({
            ...item,
            pausas: pausas || [],
            pausa_segundos_display: pauseSeconds
        });
    } catch (err) {
        console.error("Error details:", err);
        setDetailOpen(false);
        toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los detalles." });
    } finally {
        setDetailLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Clock className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Control Horario</h1>
          <p className="text-muted-foreground text-sm">Gestiona tu jornada laboral y revisa tu historial.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="registro" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Registrar Fichaje
          </TabsTrigger>
          <TabsTrigger value="historial" className="flex items-center gap-2">
            <History className="w-4 h-4" /> Mi Historial
          </TabsTrigger>
        </TabsList>

        {/* --- REGISTRO TAB --- */}
        <TabsContent value="registro" className="space-y-4 mt-4">
          <Card className="border-t-4 border-t-primary shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex justify-between items-center">
                <span>Estado Actual</span>
                {currentStatus.loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : currentStatus.fichajeId ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 uppercase",
                      currentStatus.enPausa 
                        ? "bg-orange-100 text-orange-700 border border-orange-200" 
                        : "bg-green-100 text-green-700 border border-green-200"
                    )}>
                      {currentStatus.enPausa ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                      {currentStatus.enPausa ? "En Pausa" : "Trabajando"}
                    </span>
                    {currentStatus.enPausa && currentStatus.pauseStartTime && (
                        <span className="text-[11px] font-medium text-orange-800 bg-orange-50/50 px-2 py-0.5 rounded border border-orange-100">
                            Desde las {fmtMadrid(currentStatus.pauseStartTime, 'time')}
                        </span>
                    )}
                  </div>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-2 uppercase">
                    <StopCircle className="w-4 h-4" /> Fuera de Turno
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {currentStatus.nombreUbicacion ? (
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <MapPin className="w-4 h-4 text-primary" /> {currentStatus.nombreUbicacion}
                  </span>
                ) : "Selecciona una obra para iniciar jornada."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {!currentStatus.fichajeId && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ubicación / Obra</label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Selecciona dónde vas a trabajar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nave" className="font-semibold text-orange-600 bg-orange-50 focus:bg-orange-100 border-b border-orange-100">
                        <div className="flex items-center gap-2">
                          <Warehouse className="w-4 h-4" /> NAVE / TALLER
                        </div>
                      </SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-muted-foreground" /> {p.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!currentStatus.fichajeId ? (
                  <Button 
                    size="lg" 
                    className="w-full h-16 text-lg bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20"
                    onClick={() => performAction('entrada')}
                    disabled={actionLoading || !selectedProject}
                  >
                    {actionLoading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <PlayCircle className="mr-2 h-6 w-6" />}
                    Entrar
                  </Button>
                ) : (
                  <>
                    {currentStatus.enPausa ? (
                      <Button 
                        size="lg" 
                        variant="outline"
                        className="w-full h-16 text-lg border-green-600 text-green-700 hover:bg-green-50"
                        onClick={() => performAction('reanudar')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <PlayCircle className="mr-2 h-6 w-6" />}
                        Reanudar
                      </Button>
                    ) : (
                      <Button 
                        size="lg" 
                        variant="outline"
                        className="w-full h-16 text-lg border-orange-500 text-orange-700 hover:bg-orange-50"
                        onClick={() => performAction('pausa')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <PauseCircle className="mr-2 h-6 w-6" />}
                        Pausa
                      </Button>
                    )}

                    <Button 
                      size="lg" 
                      variant="destructive"
                      className="w-full h-16 text-lg shadow-lg shadow-red-900/20"
                      onClick={() => performAction('salida')}
                      disabled={actionLoading || currentStatus.enPausa} 
                    >
                      {actionLoading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <StopCircle className="mr-2 h-6 w-6" />}
                      Salida
                    </Button>
                  </>
                )}
              </div>

              {geoLoading && (
                <div className="flex items-center justify-center text-xs text-muted-foreground animate-pulse">
                  <MapPin className="w-3 h-3 mr-1" /> Obteniendo ubicación GPS...
                </div>
              )}

            </CardContent>
          </Card>
        </TabsContent>

        {/* --- HISTORIAL TAB --- */}
        <TabsContent value="historial" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle className="text-lg">Mi Historial de Fichajes</CardTitle>
                <div className="w-full md:w-auto">
                  <DateRangePicker 
                    date={dateRange}
                    setDate={setDateRange}
                    className="w-full md:w-[300px]"
                    onClear={() => setDateRange({ from: undefined, to: undefined })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Horario</TableHead>
                      <TableHead className="hidden md:table-cell">Proyecto / Ubicación</TableHead>
                      <TableHead className="text-center">Total Horas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" /> Cargando historial...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : historyData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                          No se encontraron registros en este periodo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      historyData.map((item) => (
                        <TableRow 
                          key={item.id} 
                          className="hover:bg-muted/50 cursor-pointer group"
                          onClick={() => handleRowClick(item)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="capitalize">{format(new Date(item.hora_entrada), 'EEEE', { locale: es })}</span>
                              <span className="text-xs text-muted-foreground">{format(new Date(item.hora_entrada), 'dd MMM yyyy')}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-sm">
                              <span className="text-green-700 font-mono">IN: {fmtMadrid(item.hora_entrada, 'time')}</span>
                              {item.hora_salida ? (
                                <span className="text-red-700 font-mono">OUT: {fmtMadrid(item.hora_salida, 'time')}</span>
                              ) : (
                                <span className="text-amber-600 text-xs italic font-medium">En curso...</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-2 text-sm">
                              {item.tipo_icon === 'nave' ? <Warehouse className="w-4 h-4 text-orange-500" /> : <Briefcase className="w-4 h-4 text-blue-500" />}
                              <span className="truncate max-w-[200px]" title={item.nombre_ubicacion}>
                                {item.nombre_ubicacion}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-gray-700 dark:text-gray-300">
                            {formatSecondsToHoursMinutes(item.duracion_neta_segundos)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
                <p>
                  El tiempo mostrado es el calculado por el sistema (horas normales + extras + festivos).
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- DETALLE MODAL --- */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl w-full h-[90vh] md:h-auto overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Detalle del Fichaje
            </DialogTitle>
            {selectedFichaje && (
              <DialogDescription className="font-medium text-foreground">
                {format(new Date(selectedFichaje.hora_entrada), "EEEE d 'de' MMMM, yyyy", { locale: es })}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {detailLoading ? (
              <div className="flex justify-center items-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
          ) : selectedFichaje ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Left Column: Stats & Time Info */}
              <div className="space-y-4">
                  
                  {/* Project Info Banner */}
                  <div className="p-4 bg-muted/50 rounded-lg border flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Ubicación</span>
                    <div className="flex items-center gap-2">
                        {selectedFichaje.tipo_icon === 'nave' 
                          ? <Warehouse className="w-4 h-4 text-orange-500 shrink-0" /> 
                          : <Briefcase className="w-4 h-4 text-blue-500 shrink-0" />
                        }
                        <span className="text-sm font-semibold truncate max-w-[200px]" title={selectedFichaje.nombre_ubicacion}>
                          {selectedFichaje.nombre_ubicacion}
                        </span>
                    </div>
                  </div>

                  {/* Times List */}
                  <div className="flex flex-col gap-3">
                    
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500 rounded-full text-white shadow-sm">
                                <PlayCircle size={16} />
                            </div>
                            <span className="font-medium text-green-900 dark:text-green-300">H. Entrada</span>
                        </div>
                        <span className="font-mono text-lg font-bold text-green-700 dark:text-green-400">
                            {fmtMadrid(selectedFichaje.hora_entrada, 'time')}
                        </span>
                    </div>

                    {selectedFichaje.pausas && selectedFichaje.pausas.map((p, idx) => (
                        <div key={p.id} className="space-y-3 relative">
                            <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-lg ml-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-500 rounded-full text-white shadow-sm">
                                        <PauseCircle size={16} />
                                    </div>
                                    <span className="font-medium text-orange-900 dark:text-orange-300">
                                        {selectedFichaje.pausas.length > 1 ? `H. Parada (${idx + 1})` : 'H. Parada'}
                                    </span>
                                </div>
                                <span className="font-mono text-lg font-bold text-orange-700 dark:text-orange-400">
                                    {fmtMadrid(p.hora_inicio_pausa, 'time')}
                                </span>
                            </div>

                            {p.hora_fin_pausa ? (
                                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg ml-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500 rounded-full text-white shadow-sm">
                                            <PlayCircle size={16} />
                                        </div>
                                        <span className="font-medium text-blue-900 dark:text-blue-300">
                                            {selectedFichaje.pausas.length > 1 ? `H. Reanudación (${idx + 1})` : 'H. Reanudación'}
                                        </span>
                                    </div>
                                    <span className="font-mono text-lg font-bold text-blue-700 dark:text-blue-400">
                                        {fmtMadrid(p.hora_fin_pausa, 'time')}
                                    </span>
                                </div>
                            ) : (
                                <div className="ml-8 p-2 text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded text-center">
                                    Pausa en curso...
                                </div>
                            )}
                        </div>
                    ))}

                    {selectedFichaje.hora_salida ? (
                        <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-500 rounded-full text-white shadow-sm">
                                    <StopCircle size={16} />
                                </div>
                                <span className="font-medium text-red-900 dark:text-red-300">H. Salida</span>
                            </div>
                            <span className="font-mono text-lg font-bold text-red-700 dark:text-red-400">
                                {fmtMadrid(selectedFichaje.hora_salida, 'time')}
                            </span>
                        </div>
                    ) : (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm text-slate-500 italic">
                            Jornada en curso...
                        </div>
                    )}
                  </div>

                  {/* Totals Summary */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-3 bg-card rounded border text-center">
                        <span className="text-xs text-muted-foreground block uppercase tracking-wider">Duración Neta</span>
                        <span className="font-mono text-xl font-bold text-foreground">
                            {formatSecondsToHoursMinutes(selectedFichaje.duracion_neta_segundos)}
                        </span>
                        <span className="text-[10px] text-green-600 font-medium block mt-1">
                            Normales: {selectedFichaje.horas_normales?.toFixed(2) || '0.00'}h
                        </span>
                    </div>
                    
                    <div className="p-3 bg-card rounded border text-center border-orange-100 bg-orange-50/20">
                        <span className="text-xs text-muted-foreground block uppercase tracking-wider">Tiempo de Pausa</span>
                        <span className="font-mono text-xl font-bold text-orange-700">
                            {formatSecondsToHoursMinutes(selectedFichaje.pausa_segundos_display)}
                        </span>
                        {selectedFichaje.horas_extra > 0 && (
                            <span className="text-[10px] text-orange-600 font-medium block mt-1">
                                Extras: {selectedFichaje.horas_extra.toFixed(2)}h
                            </span>
                        )}
                    </div>
                  </div>

              </div>

              {/* Right Column: Map */}
              <div className="h-[400px] lg:h-auto bg-muted rounded-xl overflow-hidden border relative min-h-[400px] shadow-sm">
                  <TimeClockMap fichajeId={selectedFichaje.id} height="h-full" />
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
                No se encontraron datos.
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ MODAL FONTANERÍA — Solo se muestra si el usuario es fran@orkaled.com */}
      <FontaneriaModal
        isOpen={fontaneriaModalOpen}
        onClose={() => setFontaneriaModalOpen(false)}
        fecha={fechaSalida}
      />

      {/* ✅ MODAL SELECCIÓN DE TAREA — Se muestra al fichar entrada en obra */}
      <SeleccionTareaModal
        isOpen={tareaModalOpen}
        onClose={() => setTareaModalOpen(false)}
        proyectoId={proyectoFichado}
        empleadoId={sessionRole?.empleadoId}
        onTareaSeleccionada={(tarea) => {
          console.log('Tarea seleccionada:', tarea);
        }}
      />

    </div>
  );
};

export default TechnicianFichajeView;
