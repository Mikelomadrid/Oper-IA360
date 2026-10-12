import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
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
  Info,
  ClipboardCheck,
  ListChecks,
  CircleDashed,
  ArrowRightLeft,
  CheckCircle2,
  Camera,
  ImagePlus
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { fmtMadrid, cn, formatSecondsToHoursMinutes, getMadridLocalTime } from '@/lib/utils';
import { DateRangePicker } from '@/components/DateRangePicker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import TimeClockMap from '@/components/TimeClockMap';
import { useGeolocation } from '@/hooks/useGeolocation';
import FontaneriaModal from '@/components/FontaneriaModal';
import PhotoUploadModal from '@/components/PhotoUploadModal';

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
    proyectoId: null,
    enPausa: false,
    nombreUbicacion: null,
    pauseStartTime: null,
    loading: true
  });

  const { getLocation, loading: geoLoading } = useGeolocation();

  // --- STATE FOR FONTANERIA MODAL ---
  const [fontaneriaModalOpen, setFontaneriaModalOpen] = useState(false);
  const [fechaSalida, setFechaSalida] = useState(null);

  // --- ÓRDENES DIARIAS LIBERADAS POR EL ENCARGADO ---
  const [workOrders, setWorkOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [exitReviewOpen, setExitReviewOpen] = useState(false);
  const [exitResults, setExitResults] = useState({});
  const [exitNotes, setExitNotes] = useState({});
  const [pendingTransfer, setPendingTransfer] = useState(null);
  const [evidenceCapture, setEvidenceCapture] = useState({ open: false, mode: null, order: null });
  const [exitEvidenceFiles, setExitEvidenceFiles] = useState({});
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [assignmentWait, setAssignmentWait] = useState(null);

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
    fetchCurrentStatus();
  }, []);

  useEffect(() => {
    if (sessionRole?.rol) fetchProjects();
  }, [sessionRole?.rol, sessionRole?.empleadoId]);

  useEffect(() => {
    if (activeTab === 'historial') {
      fetchHistory();
    }
  }, [activeTab, dateRange]);

  const fetchProjects = async () => {
    try {
      const isManager = ['admin', 'encargado'].includes(sessionRole?.rol);
      const { data, error } = isManager
        ? await supabase
          .from('proyectos')
          .select('id,nombre_proyecto')
          .in('estado', ['activo', 'en_espera'])
          .order('nombre_proyecto')
        : await supabase.rpc('rpc_selector_proyectos_fichaje_tecnico');
      
      if (error) throw error;
      setProjects(isManager
        ? (data || []).map((project) => ({ value: project.id, label: project.nombre_proyecto }))
        : (data || []));
    } catch (err) {
      console.error("Error loading projects:", err);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar las obras disponibles para fichar." });
    }
  };

  const fetchCurrentStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('get_estado_fichaje_sesion');
      
      if (error) throw error;

      if (data && data.length > 0) {
        let pauseStartTime = null;
        let proyectoId = null;

        const { data: activeClock } = await supabase
          .rpc('obtener_contexto_fichaje_actual');
        proyectoId = activeClock?.[0]?.proyecto_id || null;
        
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
          proyectoId,
          enPausa: data[0].en_pausa,
          nombreUbicacion: data[0].nombre_ubicacion,
          pauseStartTime,
          loading: false
        });
      } else {
        setCurrentStatus({
          fichajeId: null,
          proyectoId: null,
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

  const fetchWorkOrders = async (projectId = currentStatus.proyectoId) => {
    if (!sessionRole?.empleadoId || !projectId) {
      setWorkOrders([]);
      setPendingTransfer(null);
      return;
    }
    setOrdersLoading(true);
    try {
      // La planificación de obra vive en tarea_empleados. Al fichar, materializamos
      // esas asignaciones en la cola operativa del técnico para que no sea necesario
      // que el encargado vuelva a asignar manualmente cada tarea ya planificada.
      // Durante el despliegue toleramos que la RPC aún no exista para no ocultar las
      // órdenes que ya estuvieran creadas.
      const syncResult = await supabase.rpc('asegurar_tarea_activa_fichaje');
      if (syncResult.error
        && !['42883', 'PGRST202'].includes(syncResult.error.code)
        && !syncResult.error.message?.includes('asegurar_tarea_activa_fichaje')) {
        console.warn('No se pudo asegurar la tarea activa:', syncResult.error);
      }
      if (syncResult.data?.codigo === 'ESPERANDO_ASIGNACION') {
        setAssignmentWait({
          projectId,
          message: syncResult.data.mensaje || 'El encargado debe asignarte una tarea antes de fichar.',
        });
        setCurrentStatus({
          fichajeId: null,
          proyectoId: null,
          enPausa: false,
          nombreUbicacion: null,
          pauseStartTime: null,
          loading: false,
        });
        setWorkOrders([]);
        setPendingTransfer(null);
        return;
      }

      const [ordersResult, transferResult] = await Promise.all([
        supabase
          .from('ordenes_trabajo_diarias')
          .select(`
            id, proyecto_id, tarea_id, empleado_id, fichaje_id, fecha_asignacion,
            orden, estado, horas_previstas, notas_encargado, asignada_at,
            iniciada_at, cerrada_at,
            tarea:tareas(id,titulo,descripcion,orden)
          `)
          .eq('empleado_id', sessionRole.empleadoId)
          .eq('proyecto_id', projectId)
          .in('estado', ['asignada', 'activa', 'pendiente_continuar', 'completada'])
          .order('orden', { ascending: true })
          .order('asignada_at', { ascending: true }),
        supabase
          .from('traslados_personal')
          .select(`
            id,motivo,notas,estado,proyecto_destino_id,centro_destino_id,
            proyecto_destino:proyectos!traslados_personal_proyecto_destino_id_fkey(nombre_proyecto),
            centro_destino:centros_coste_internos!traslados_personal_centro_destino_id_fkey(nombre_centro)
          `)
          .eq('empleado_id', sessionRole.empleadoId)
          .in('estado', ['pendiente_salida', 'en_desplazamiento'])
          .order('ordenado_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      // La orden de trabajo es la información principal de esta vista. Un fallo
      // en la consulta auxiliar de traslados (por ejemplo, por permisos sobre
      // centros internos) no debe ocultar una tarea que ya está asignada.
      if (transferResult.error) {
        console.warn('No se pudo cargar el traslado pendiente:', transferResult.error);
      }
      setWorkOrders(ordersResult.data || []);
      setPendingTransfer(transferResult.error ? null : (transferResult.data || null));
    } catch (err) {
      const missingInfrastructure = err?.code === '42P01'
        || err?.code === 'PGRST205'
        || err?.message?.includes('ordenes_trabajo_diarias');
      if (!missingInfrastructure) console.error('Error loading daily work orders:', err);
      setWorkOrders([]);
      setPendingTransfer(null);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (!currentStatus.fichajeId || !currentStatus.proyectoId) {
      setWorkOrders([]);
      setPendingTransfer(null);
      return undefined;
    }
    fetchWorkOrders(currentStatus.proyectoId);
    const interval = window.setInterval(() => fetchWorkOrders(currentStatus.proyectoId), 8_000);
    return () => window.clearInterval(interval);
  }, [currentStatus.fichajeId, currentStatus.proyectoId, sessionRole?.empleadoId]);

  const uploadWorkOrderEvidence = async (order, files, moment) => {
    if (!order?.id || !order?.tarea_id || !order?.proyecto_id || !files?.length) {
      throw new Error('Selecciona al menos una foto de evidencia.');
    }

    const uploadedPaths = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const originalExtension = file.name?.split('.').pop()?.toLowerCase();
      const extension = originalExtension && /^[a-z0-9]+$/.test(originalExtension) ? originalExtension : 'jpg';
      const uniquePart = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${index}`;
      const storagePath = `${order.proyecto_id}/tareas/${order.tarea_id}/ordenes/${order.id}/${moment}/${uniquePart}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('proyecto_fotos')
        .upload(storagePath, file, { contentType: file.type || 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      uploadedPaths.push(`proyecto_fotos/${storagePath}`);
    }
    return uploadedPaths;
  };

  const completeWorkOrderAndContinue = async (order, files) => {
    if (!files?.length) {
      toast({
        variant: 'destructive',
        title: 'Falta una fotografía',
        description: 'Debes adjuntar al menos una imagen para finalizar la tarea.',
      });
      return;
    }

    setEvidenceUploading(true);
    try {
      const uploadedPaths = await uploadWorkOrderEvidence(order, files, 'finalizacion');
      const { error: closeError } = await supabase.rpc('cerrar_orden_trabajo_con_evidencias', {
        p_orden_id: order.id,
        p_resultado: 'completada',
        p_notas: null,
        p_archivos: uploadedPaths,
      });
      if (closeError) throw closeError;

      const { data: advanceResult, error: advanceError } = await supabase.rpc('asegurar_tarea_activa_fichaje');
      if (advanceError) throw advanceError;
      const nextOrderStarted = ['ACTIVA', 'INICIADA'].includes(advanceResult?.codigo);
      const waitingForAssignment = advanceResult?.codigo === 'ESPERANDO_ASIGNACION';

      setEvidenceCapture({ open: false, mode: null, order: null });
      toast({
        title: nextOrderStarted
          ? 'Tarea terminada. Siguiente tarea iniciada'
          : waitingForAssignment
            ? 'Tarea terminada. Esperando asignación'
            : 'Tarea terminada',
        description: nextOrderStarted
          ? `Ahora continúa con: ${advanceResult?.tarea_titulo || 'la siguiente tarea asignada'}.`
          : waitingForAssignment
            ? 'Se ha detenido el fichaje. El encargado debe asignarte el siguiente trabajo antes de volver a entrar.'
            : 'No quedan más tareas pendientes en esta obra.',
        className: 'bg-green-600 text-white',
      });
      if (waitingForAssignment) {
        setAssignmentWait({ projectId: order.proyecto_id, message: advanceResult?.mensaje });
        await fetchCurrentStatus();
      } else {
        await fetchWorkOrders(order.proyecto_id);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo finalizar la tarea',
        description: err.message,
      });
    } finally {
      setEvidenceUploading(false);
    }
  };

  const handleEvidenceSelected = async (files) => {
    const { mode, order } = evidenceCapture;
    if (!files?.length || !order) return;

    if (mode === 'salida') {
      setExitEvidenceFiles((current) => ({
        ...current,
        [order.id]: [...(current[order.id] || []), ...files],
      }));
      setEvidenceCapture({ open: false, mode: null, order: null });
      setExitReviewOpen(true);
      return;
    }

    if (mode === 'finalizar_tarea') {
      await completeWorkOrderAndContinue(order, files);
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
        
        if (selectedProject === 'nave') {
             rpcName = 'fichar_entrada';
             params = {
                ...params,
                p_proyecto_id: null,
                // El RPC resuelve el centro marcado como taller en esta instalación.
                // No se usa un UUID fijo porque cambia entre entornos.
                p_centro_coste_interno_id: null,
                p_tipo: 'nave_taller'
             };
        } else {
             rpcName = 'fichar_entrada_obra_con_tarea';
             params = {
                p_proyecto_id: selectedProject,
                p_latitud: lat,
                p_longitud: lng,
                p_custom_time: null,
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

      if (actionType === 'entrada' && selectedProject !== 'nave' && data?.ok === false) {
        setAssignmentWait({
          projectId: selectedProject,
          message: data.mensaje || 'El encargado debe asignarte una tarea antes de fichar.',
        });
        toast({
          variant: 'warning',
          title: 'Esperando asignación del encargado',
          description: data.mensaje || 'No se ha iniciado el fichaje ni el cómputo de horas.',
        });
        await fetchCurrentStatus();
        return;
      }

      if (actionType === 'entrada') setAssignmentWait(null);

      toast({
        title: "Acción registrada",
        description: typeof data === 'string'
          ? data
          : data?.tarea_titulo
            ? `Trabajo iniciado: ${data.tarea_titulo}`
            : "Registro guardado correctamente.",
        className: "bg-green-600 text-white"
      });

      await fetchCurrentStatus();

      if (actionType === 'entrada' && selectedProject && selectedProject !== 'nave') {
        await fetchWorkOrders(selectedProject);
      }

      if (actionType === 'salida') {
        setSelectedProject(null);
        setWorkOrders([]);
        setPendingTransfer(null);
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

  const requestExit = () => {
    const reviewOrders = workOrders.filter((order) => order.estado === 'activa');
    if (!currentStatus.proyectoId || reviewOrders.length === 0) {
      performAction('salida');
      return;
    }
    const defaultResults = {};
    const defaultNotes = {};
    reviewOrders.forEach((order) => {
      defaultResults[order.id] = 'pendiente_continuar';
      defaultNotes[order.id] = '';
    });
    setExitEvidenceFiles({});
    setExitResults(defaultResults);
    setExitNotes(defaultNotes);
    setEvidenceCapture({ open: true, mode: 'salida', order: reviewOrders[0] });
  };

  const updateExitResult = (order, value) => {
    setExitResults((current) => ({ ...current, [order.id]: value }));
  };

  const confirmExit = async () => {
    const reviewOrders = workOrders.filter((order) => order.estado === 'activa');
    const missingFinalEvidence = reviewOrders.find((order) => !(exitEvidenceFiles[order.id]?.length > 0));
    if (missingFinalEvidence) {
      toast({
        variant: 'destructive',
        title: 'Falta la evidencia de salida',
        description: 'Para cerrar la jornada debes adjuntar al menos una fotografía del estado en que queda el trabajo.',
      });
      setExitReviewOpen(false);
      setEvidenceCapture({ open: true, mode: 'salida', order: missingFinalEvidence });
      return;
    }

    setActionLoading(true);
    try {
      for (const order of reviewOrders) {
        const result = exitResults[order.id] || 'pendiente_continuar';
        const uploadedPaths = await uploadWorkOrderEvidence(order, exitEvidenceFiles[order.id], 'finalizacion');
        const { error } = await supabase.rpc('cerrar_orden_trabajo_con_evidencias', {
          p_orden_id: order.id,
          p_resultado: result,
          p_notas: exitNotes[order.id]?.trim() || null,
          p_archivos: uploadedPaths,
        });
        if (error) throw error;
      }
      setExitReviewOpen(false);
      setExitEvidenceFiles({});
      setActionLoading(false);
      await performAction('salida');
    } catch (err) {
      setActionLoading(false);
      toast({ variant: 'destructive', title: 'No se pudo cerrar la jornada', description: err.message });
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

  const completedWorkOrders = workOrders
    .filter((order) => order.estado === 'completada')
    .sort((a, b) => new Date(b.cerrada_at || 0) - new Date(a.cerrada_at || 0));
  const activeWorkOrders = workOrders
    .filter((order) => order.estado === 'activa')
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
  const pendingWorkOrders = workOrders
    .filter((order) => ['asignada', 'pendiente_continuar'].includes(order.estado))
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0)
      || new Date(a.asignada_at || 0) - new Date(b.asignada_at || 0));

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
                  <Select value={selectedProject} onValueChange={(value) => {
                    setSelectedProject(value);
                    setAssignmentWait(null);
                  }}>
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
                  {assignmentWait?.projectId === selectedProject && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-4">
                      <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                      <div>
                        <p className="font-semibold text-amber-950">Esperando asignación del encargado</p>
                        <p className="mt-1 text-sm text-amber-800">{assignmentWait.message || 'No se ha iniciado el fichaje ni el cómputo de horas.'}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentStatus.fichajeId && currentStatus.proyectoId && (
                <div className="space-y-3">
                  {pendingTransfer?.estado === 'pendiente_salida' && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <ArrowRightLeft className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
                        <div>
                          <p className="text-sm font-semibold text-violet-950">El encargado ha preparado un traslado</p>
                          <p className="mt-0.5 text-sm text-violet-800">{pendingTransfer.motivo} · Destino: {pendingTransfer.proyecto_destino?.nombre_proyecto || pendingTransfer.centro_destino?.nombre_centro || 'por confirmar'}</p>
                          {pendingTransfer.notas && <p className="mt-1 text-xs text-violet-700">{pendingTransfer.notas}</p>}
                          <p className="mt-2 text-xs font-medium text-violet-900">Ficha la salida de esta obra antes de desplazarte.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">Mis tareas en esta obra</p>
                      </div>
                      {workOrders.length > 0 && <span className="font-mono text-xs text-muted-foreground">{workOrders.length} {workOrders.length === 1 ? 'tarea' : 'tareas'}</span>}
                    </div>

                    {ordersLoading && workOrders.length === 0 ? (
                      <div className="flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Comprobando la asignación…</div>
                    ) : workOrders.length === 0 ? (
                      <div className="flex items-start gap-3 bg-amber-50/60 px-4 py-5">
                        <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                        <div>
                          <p className="font-semibold text-amber-950">Esperando asignación del encargado</p>
                          <p className="mt-1 text-sm text-amber-800">No elijas ninguna tarea. El encargado te asignará el siguiente trabajo desde su móvil.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {completedWorkOrders.length > 0 && (
                          <section className="bg-emerald-50/35 px-4 py-4">
                            <div className="mb-3 flex items-center gap-2 text-emerald-800">
                              <CheckCircle2 className="h-4 w-4" />
                              <h3 className="text-xs font-bold uppercase tracking-wide">1 · Realizadas</h3>
                            </div>
                            <div className="space-y-2">
                              {completedWorkOrders.map((order) => (
                                <div key={order.id} className="flex items-start gap-3 rounded-lg border border-emerald-200/80 bg-white/80 px-3 py-3">
                                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold leading-snug text-slate-800">{order.tarea?.titulo || 'Tarea realizada'}</p>
                                    <p className="mt-1 text-xs font-medium text-emerald-700">
                                      Realizada{order.cerrada_at ? ` · ${fmtMadrid(order.cerrada_at, 'time')}` : ''}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}

                        <section className="px-4 py-4">
                          <div className="mb-3 flex items-center gap-2 text-violet-800">
                            <PlayCircle className="h-4 w-4" />
                            <h3 className="text-xs font-bold uppercase tracking-wide">2 · En curso</h3>
                          </div>
                          {activeWorkOrders.length > 0 ? (
                            <div className="space-y-3">
                              {activeWorkOrders.map((order) => (
                                <div key={order.id} className="rounded-xl border border-violet-200 bg-violet-50/55 p-4">
                                  <div className="flex items-start gap-3">
                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">{Number(order.orden || 0)}</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-bold leading-snug text-violet-950">{order.tarea?.titulo || 'Tarea en curso'}</p>
                                      {order.notas_encargado && <p className="mt-1 text-xs text-violet-800">{order.notas_encargado}</p>}
                                      {order.horas_previstas != null && <p className="mt-2 font-mono text-xs font-semibold tabular-nums text-violet-700">{Number(order.horas_previstas).toLocaleString('es-ES', { maximumFractionDigits: 2 })} h previstas</p>}
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    className="mt-4 h-12 w-full bg-emerald-600 text-base font-semibold hover:bg-emerald-700"
                                    onClick={() => setEvidenceCapture({ open: true, mode: 'finalizar_tarea', order })}
                                    disabled={evidenceUploading || actionLoading}
                                  >
                                    {evidenceUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}
                                    Finalizar tarea y añadir fotos
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="rounded-lg border border-dashed border-violet-200 bg-violet-50/30 px-3 py-3 text-sm text-violet-800">No hay ninguna tarea en curso.</p>
                          )}
                        </section>

                        <section className="bg-slate-50/45 px-4 py-4">
                          <div className="mb-3 flex items-center gap-2 text-slate-700">
                            <CircleDashed className="h-4 w-4" />
                            <h3 className="text-xs font-bold uppercase tracking-wide">3 · Pendientes</h3>
                          </div>
                          {pendingWorkOrders.length > 0 ? (
                            <div className="space-y-2">
                              {pendingWorkOrders.map((order, index) => (
                                <div key={order.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 font-mono text-xs font-bold text-slate-700">{Number(order.orden || index + 1)}</span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold leading-snug">{order.tarea?.titulo || 'Tarea pendiente'}</p>
                                      {index === 0 && <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800">Siguiente</span>}
                                    </div>
                                    {order.notas_encargado && <p className="mt-1 text-xs text-muted-foreground">{order.notas_encargado}</p>}
                                    {order.horas_previstas != null && <p className="mt-2 font-mono text-xs font-semibold tabular-nums text-violet-700">{Number(order.horas_previstas).toLocaleString('es-ES', { maximumFractionDigits: 2 })} h previstas</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No quedan tareas pendientes en esta obra.</p>
                          )}
                        </section>
                      </div>
                    )}
                  </div>
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
                      onClick={requestExit}
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

      <Dialog open={exitReviewOpen} onOpenChange={(open) => !actionLoading && !evidenceUploading && setExitReviewOpen(open)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />Resumen antes de salir</DialogTitle>
            <DialogDescription>Indica cómo queda cada trabajo. Al confirmar se detendrán las horas y los costes de esta obra.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {workOrders.filter((order) => order.estado !== 'asignada').map((order) => (
              <div key={order.id} className="rounded-xl border border-border/60 bg-muted/10 p-4">
                <p className="text-sm font-semibold leading-snug">{order.tarea?.titulo || 'Orden de trabajo'}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[210px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Resultado</label>
                    <Select value={exitResults[order.id] || 'pendiente_continuar'} onValueChange={(value) => updateExitResult(order, value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completada">Terminada</SelectItem>
                        <SelectItem value="pendiente_continuar">Pendiente de continuar</SelectItem>
                        <SelectItem value="no_realizada">No realizada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Observación opcional</label>
                    <Textarea value={exitNotes[order.id] || ''} onChange={(event) => setExitNotes((current) => ({ ...current, [order.id]: event.target.value }))} placeholder="Motivo, avance o incidencia…" rows={2} />
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2">
                      <ImagePlus className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-950">Evidencia al cerrar la jornada</p>
                        <p className="text-xs text-emerald-800">
                          {exitEvidenceFiles[order.id]?.length
                            ? `${exitEvidenceFiles[order.id].length} foto(s) preparada(s)`
                            : 'Obligatoria tanto si continúa otro día como si queda terminada.'}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
                      onClick={() => {
                        setExitReviewOpen(false);
                        setEvidenceCapture({ open: true, mode: 'salida', order });
                      }}
                      disabled={actionLoading}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {exitEvidenceFiles[order.id]?.length ? 'Añadir más fotos' : 'Elegir o hacer fotos'}
                    </Button>
                  </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitReviewOpen(false)} disabled={actionLoading || evidenceUploading}>Volver</Button>
            <Button variant="destructive" onClick={confirmExit} disabled={actionLoading || evidenceUploading}>
              {(actionLoading || evidenceUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar y fichar salida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PhotoUploadModal
        isOpen={evidenceCapture.open}
        onClose={() => {
          if (!evidenceUploading) setEvidenceCapture({ open: false, mode: null, order: null });
        }}
        onPhotosSelected={handleEvidenceSelected}
        title={evidenceCapture.mode === 'finalizar_tarea' ? 'Fotos para finalizar la tarea' : 'Fotos al cerrar la jornada'}
        allowMultiple
      />

      {/* ✅ MODAL FONTANERÍA — Solo se muestra si el usuario es fran@orkaled.com */}
      <FontaneriaModal
        isOpen={fontaneriaModalOpen}
        onClose={() => setFontaneriaModalOpen(false)}
        fecha={fechaSalida}
      />

    </div>
  );
};

export default TechnicianFichajeView;
