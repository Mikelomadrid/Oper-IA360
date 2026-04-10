import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useAppShell } from '@/contexts/AppShellContext';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  Package,
  Wrench,
  RotateCcw,
  CheckSquare,
  Calendar,
  Truck,
  Users,
  DollarSign,
  AlertCircle,
  FileText,
  Activity,
  UserCheck,
  TrendingUp,
  Clock,
  ClipboardList,
  Timer,
  ShoppingCart,
  Smile,
  ShieldCheck,
  Briefcase,
  Search,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardCard from '@/components/DashboardCard';
import AlertCard from '@/components/AlertCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getGreetingByHour } from '@/lib/utils';
import { AnimatePresence } from 'framer-motion';
import ResumenFinancieroMeses from '@/components/ResumenFinancieroMeses';

// --- SUBCOMPONENTS ---

const KpiCard = ({ title, value, icon: Icon, color, bg }) => (
  <Card className="hover:shadow-md transition-all duration-200 border-slate-100 bg-white group">
    <CardContent className="p-6 flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground group-hover:text-slate-600 transition-colors">{title}</p>
        <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
      </div>
      <div className={`p-4 rounded-full ${bg} ${color} group-hover:scale-110 transition-transform duration-200`}>
        <Icon className="w-6 h-6" />
      </div>
    </CardContent>
  </Card>
);

const MiniHolidayCalendar = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const today = new Date();
        const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString();
        const endOfYear = new Date(today.getFullYear(), 11, 31).toISOString();

        const { data, error } = await supabase
          .from('calendario_festivos')
          .select('*')
          .gte('fecha', startOfYear)
          .lte('fecha', endOfYear)
          .order('fecha', { ascending: true });

        if (error) throw error;
        setHolidays(data || []);
      } catch (error) {
        // Silent error
      } finally {
        setLoading(false);
      }
    };
    fetchHolidays();
  }, []);

  const upcomingHolidays = holidays.filter(h => new Date(h.fecha) >= new Date(new Date().setHours(0, 0, 0, 0)));

  return (
    <Card className="h-full">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-pink-500" />
            Próximos Festivos
          </CardTitle>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
        <CardDescription>Calendario laboral del año en curso</CardDescription>
      </CardHeader>
      {open && (
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : upcomingHolidays.length === 0 ? (
            <div className="text-center p-4 text-muted-foreground text-sm">No hay festivos próximos registrados.</div>
          ) : (
            <div className="space-y-4">
              {upcomingHolidays.slice(0, 5).map((h) => (
                <div key={h.id} className="flex items-start justify-between border-b pb-2 last:border-0 last:pb-0">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{h.descripcion}</span>
                    <span className="text-xs text-muted-foreground capitalize">{h.tipo}</span>
                  </div>
                  <Badge variant="outline" className="ml-2 whitespace-nowrap shrink-0">
                    {new Date(h.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

const TeamStatusWidget = () => {
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchActiveTeam = async () => {
      try {
        const { data, error } = await supabase
          .from('v_fichajes_admin_ui')
          .select('empleado_nombre, proyecto_nombre, hora_entrada, tipo')
          .eq('abierto', true)
          .order('hora_entrada', { ascending: false });

        if (error) throw error;
        setActiveUsers(data || []);
      } catch (error) {
        // Silent error
      } finally {
        setLoading(false);
      }
    };
    fetchActiveTeam();
  }, []);

  return (
    <Card className="h-full">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="h-5 w-5 text-emerald-500" />
            Equipo Activo
          </CardTitle>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
        <CardDescription>Personal trabajando actualmente ({activeUsers.length})</CardDescription>
      </CardHeader>
      {open && (
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : activeUsers.length === 0 ? (
            <div className="text-center p-8 bg-muted/20 rounded-lg">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">Nadie ha fichado entrada aún.</p>
            </div>
          ) : (
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-3">
                {activeUsers.map((user, idx) => (
                  <div key={idx} className="flex items-start justify-between text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">{user.empleado_nombre}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {user.proyecto_nombre || (user.tipo === 'nave_taller' ? 'Nave / Taller' : 'Sin ubicación')}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                      {new Date(user.hora_entrada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      )}
    </Card>
  );
};

const AccesosRapidosWidget = ({ navigate }) => {
  const [open, setOpen] = useState(false);
  return (
    <Card className="h-full">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Accesos Rápidos
          </CardTitle>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
        <CardDescription>Gestión diaria</CardDescription>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start h-10 px-4" onClick={() => navigate('/gestion/obras')}>
              <span className="w-2 h-2 rounded-full bg-orange-400 mr-3"></span>
              Gestión de Obras
            </Button>
            <Button variant="outline" className="w-full justify-start h-10 px-4" onClick={() => navigate('/personal/empleados')}>
              <span className="w-2 h-2 rounded-full bg-indigo-400 mr-3"></span>
              Directorio Empleados
            </Button>
            <Button variant="outline" className="w-full justify-start h-10 px-4" onClick={() => navigate('/inventario/catalogo')}>
              <span className="w-2 h-2 rounded-full bg-teal-400 mr-3"></span>
              Catálogo Herramientas
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

// --- MAIN VIEW ---

const HomeView = () => {
  const { sessionRole, loadingAuth, user, empleadoId } = useAuth();
  const { appShellData, isLoading: loadingShell } = useAppShell();
  const navigate = useNavigate();
  const isMounted = useRef(true);

  // States
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [alertCounts, setAlertCounts] = useState({
    leads: 0,
    partes: 0,
    tareas: 0,
    herramientas: 0,
    materiales: 0,
    pedidos: 0,
    incidencias: 0
  });

  // Track which types of alerts the user is eligible to see (so we don't show empty cards to irrelevant roles)
  const [visibleAlertTypes, setVisibleAlertTypes] = useState({
    leads: false,
    partes: false,
    tareas: false,
    herramientas: false,
    materiales: false,
    pedidos: false,
    incidencias: false
  });

  // Profile Data
  const displayName = sessionRole?.nombre || user?.email || 'Usuario';
  const userPhoto = sessionRole?.foto_url;
  const userInitials = displayName ? displayName.substring(0, 2).toUpperCase() : 'US';
  const greetingText = getGreetingByHour();

  // Clock
  useEffect(() => {
    const timer = setInterval(() => { if (isMounted.current) setCurrentTime(new Date()); }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // --- DATA FETCHING ---
  const fetchAlertData = async () => {
    if (loadingAuth || !empleadoId) return;

    if (loading) setLoading(true);

    try {
      const isAdminOrEncargado = ['admin', 'encargado'].includes(sessionRole?.rol);

      // 0. Fetch Alert Views for current user
      let viewsMap = {};
      if (user?.id) {
        const { data: viewsData } = await supabase
          .from('usuario_alertas_vistas')
          .select('alerta_tipo, ultimo_visto')
          .eq('usuario_id', user.id);
        if (viewsData) {
          viewsData.forEach(v => { viewsMap[v.alerta_tipo] = v.ultimo_visto; });
        }
      }

      // 1. LEADS
      let leadsBaseQuery = supabase.from('leads').select('created_at', { count: 'exact' }).in('estado', ['nuevo', 'contactado', 'visitado', 'presupuestado']);
      let leadsQuery = supabase.from('leads').select('created_at', { count: 'exact' }).in('estado', ['nuevo', 'contactado', 'visitado', 'presupuestado']);
      if (!isAdminOrEncargado) {
        leadsBaseQuery = leadsBaseQuery.eq('empleado_asignado_id', empleadoId);
        leadsQuery = leadsQuery.eq('empleado_asignado_id', empleadoId);
      }
      const leadsBaseTask = leadsBaseQuery.then(res => ({ raw: res.count || 0 }));
      if (viewsMap['leads']) leadsQuery = leadsQuery.gt('created_at', viewsMap['leads']);

      // 2. PARTES
      let partesBaseQuery = supabase.from('partes').select('created_at', { count: 'exact' }).in('estado', ['pendiente', 'asignado', 'en_curso', 'nuevo']);
      let partesQuery = supabase.from('partes').select('created_at', { count: 'exact' }).in('estado', ['pendiente', 'asignado', 'en_curso', 'nuevo']);
      if (!isAdminOrEncargado) {
        partesBaseQuery = partesBaseQuery.eq('tecnico_asignado_id', empleadoId);
        partesQuery = partesQuery.eq('tecnico_asignado_id', empleadoId);
      }
      const partesBaseTask = partesBaseQuery.then(res => ({ raw: res.count || 0 }));
      if (viewsMap['partes']) partesQuery = partesQuery.gt('created_at', viewsMap['partes']);

      // 2.5 TAREAS
      let tareasBaseQuery;
      let tareasQuery;
      if (isAdminOrEncargado) {
        tareasBaseQuery = supabase.from('tareas').select('created_at', { count: 'exact' }).in('estado', ['pendiente', 'en_progreso', 'pendiente_revision']);
        tareasQuery = supabase.from('tareas').select('created_at', { count: 'exact' }).in('estado', ['pendiente', 'en_progreso', 'pendiente_revision']);
      } else {
        const { data: misAsignaciones } = await supabase.from('tarea_empleados').select('tarea_id').eq('empleado_id', empleadoId);
        const misTareasIdsTemp = misAsignaciones?.map(a => a.tarea_id) || [];
        tareasBaseQuery = supabase.from('tareas').select('created_at', { count: 'exact' }).in('estado', ['pendiente', 'en_progreso', 'pendiente_revision']);
        tareasQuery = supabase.from('tareas').select('created_at', { count: 'exact' }).in('estado', ['pendiente', 'en_progreso', 'pendiente_revision']);
        if (misTareasIdsTemp.length > 0) {
          tareasBaseQuery = tareasBaseQuery.or(`empleado_asignado_id.eq.${empleadoId},id.in.(${misTareasIdsTemp.join(',')})`);
          tareasQuery = tareasQuery.or(`empleado_asignado_id.eq.${empleadoId},id.in.(${misTareasIdsTemp.join(',')})`);
        } else {
          tareasBaseQuery = tareasBaseQuery.eq('empleado_asignado_id', empleadoId);
          tareasQuery = tareasQuery.eq('empleado_asignado_id', empleadoId);
        }
      }
      const tareasBaseTask = tareasBaseQuery.then(res => ({ raw: res.count || 0 }));
      if (viewsMap['tareas']) tareasQuery = tareasQuery.gt('created_at', viewsMap['tareas']);

      // 3. HERRAMIENTAS
      let toolsBaseQuery = supabase.from('herramienta_asignaciones').select('created_at', { count: 'exact' }).eq('entregada_a', empleadoId).eq('estado', 'pendiente_aceptacion');
      let toolsQuery = supabase.from('herramienta_asignaciones').select('created_at', { count: 'exact' }).eq('entregada_a', empleadoId).eq('estado', 'pendiente_aceptacion');
      const toolsBaseTask = toolsBaseQuery.then(res => ({ raw: res.count || 0 }));
      if (viewsMap['herramientas']) toolsQuery = toolsQuery.gt('created_at', viewsMap['herramientas']);

      // 4. MATERIALES
      let materialsBaseQuery = supabase.from('solicitudes_material').select('created_at', { count: 'exact' }).eq('empleado_solicitante_id', empleadoId).in('estado_solicitud', ['gestionada', 'en_reparto', 'entregada']);
      let materialsQuery = supabase.from('solicitudes_material').select('created_at', { count: 'exact' }).eq('empleado_solicitante_id', empleadoId).in('estado_solicitud', ['gestionada', 'en_reparto', 'entregada']);
      const materialsBaseTask = materialsBaseQuery.then(res => ({ raw: res.count || 0 }));
      if (viewsMap['materiales']) materialsQuery = materialsQuery.gt('created_at', viewsMap['materiales']);

      // 5. PEDIDOS
      let pedidosQuery;
      let pedidosBaseTask;
      if (isAdminOrEncargado) {
        let pedidosBaseQuery = supabase.from('solicitudes_material').select('created_at', { count: 'exact' }).eq('estado_solicitud', 'pendiente');
        pedidosQuery = supabase.from('solicitudes_material').select('created_at', { count: 'exact' }).eq('estado_solicitud', 'pendiente');
        pedidosBaseTask = pedidosBaseQuery.then(res => ({ raw: res.count || 0 }));
        if (viewsMap['pedidos']) pedidosQuery = pedidosQuery.gt('created_at', viewsMap['pedidos']);
      } else {
        pedidosQuery = Promise.resolve({ count: 0 });
        pedidosBaseTask = Promise.resolve({ raw: 0 });
      }

      // 6. INCIDENCIAS
      let incidenciasQuery;
      let incidenciasBaseTask;
      if (isAdminOrEncargado) {
        let incidenciasBaseQuery = supabase.from('incidencias').select('created_at', { count: 'exact' }).eq('estado', 'abierta');
        incidenciasQuery = supabase.from('incidencias').select('created_at', { count: 'exact' }).eq('estado', 'abierta');
        incidenciasBaseTask = incidenciasBaseQuery.then(res => ({ raw: res.count || 0 }));
        if (viewsMap['incidencias']) incidenciasQuery = incidenciasQuery.gt('created_at', viewsMap['incidencias']);
      } else {
        incidenciasQuery = Promise.resolve({ count: 0 });
        incidenciasBaseTask = Promise.resolve({ raw: 0 });
      }

      const [
        { count: leadsCount }, { count: partesCount }, { count: tareasCount }, { count: toolsCount }, { count: matCount }, { count: pedCount }, { count: incCount },
        leadsRaw, partesRaw, tareasRaw, toolsRaw, matRaw, pedRaw, incRaw
      ] = await Promise.all([
        leadsQuery, partesQuery, tareasQuery, toolsQuery, materialsQuery, pedidosQuery, incidenciasQuery,
        leadsBaseTask, partesBaseTask, tareasBaseTask, toolsBaseTask, materialsBaseTask, pedidosBaseTask, incidenciasBaseTask
      ]);

      if (isMounted.current) {
        setAlertCounts({
          leads: leadsCount || 0,
          partes: partesCount || 0,
          tareas: tareasCount || 0,
          herramientas: toolsCount || 0,
          materiales: matCount || 0,
          pedidos: pedCount || 0,
          incidencias: incCount || 0
        });

        setVisibleAlertTypes({
          leads: isAdminOrEncargado || (leadsRaw.raw > 0),
          partes: isAdminOrEncargado || (partesRaw.raw > 0),
          tareas: isAdminOrEncargado || (tareasRaw.raw > 0),
          herramientas: toolsRaw.raw > 0,
          materiales: matRaw.raw > 0,
          pedidos: isAdminOrEncargado || (pedRaw.raw > 0),
          incidencias: isAdminOrEncargado || (incRaw.raw > 0)
        });
      }

    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  // --- REALTIME SUBSCRIPTIONS ---
  useEffect(() => {
    if (!empleadoId) return;

    fetchAlertData(); // Initial fetch

    const channel = supabase.channel('home-alerts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchAlertData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partes' }, () => fetchAlertData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => fetchAlertData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarea_empleados' }, () => fetchAlertData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'herramienta_asignaciones' }, () => fetchAlertData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_material' }, () => fetchAlertData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidencias' }, () => fetchAlertData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empleadoId, sessionRole]);


  // --- RENDERING ---

  const handleAlertClick = async (key, route) => {
    // 1. Optimistic status reset
    setAlertCounts(prev => ({ ...prev, [key]: 0 }));

    // 2. Safe save to real Supabase timestamp tracking
    if (user?.id) {
      try {
        const nowIso = new Date().toISOString();
        const { data: existingData } = await supabase
          .from('usuario_alertas_vistas')
          .select('id')
          .eq('usuario_id', user.id)
          .eq('alerta_tipo', key)
          .maybeSingle();

        if (existingData) {
          await supabase.from('usuario_alertas_vistas').update({ ultimo_visto: nowIso }).eq('id', existingData.id);
        } else {
          await supabase.from('usuario_alertas_vistas').insert({ usuario_id: user.id, alerta_tipo: key, ultimo_visto: nowIso });
        }
      } catch (e) {
        console.error("Error saving strict alert view status:", e);
      }
    }

    // Navigate
    navigate(route);
  };

  // Check if everything is zero
  const allAlertsZero = Object.values(alertCounts).every(val => val === 0);

  // Other Cards Logic (kept for Admin/Encargado mostly, or general shortcuts)
  // We can filter this for Techs too if needed, but the requirement specifically targeted the Alert Cards.
  // We'll keep the logic but maybe hide if not relevant.

  // Aggregate stats from AppShell (global context)
  const stats = useMemo(() => {
    const counts = { devoluciones: 0, tareas: 0, vacaciones: 0, vehiculos: 0, gastos: 0 };

    // FIX: Ensure rawItems is always an array to prevent forEach crash
    const rawItems = Array.isArray(appShellData?.pendientes) ? appShellData.pendientes : [];

    rawItems.forEach(item => {
      if (item.type === 'tool_return') counts.devoluciones++;
      if (item.type === 'task_review') counts.tareas++;
      if (item.type === 'vacation_request') counts.vacaciones++;
      if (item.type === 'vehicle_alert') counts.vehiculos++;
      if (item.type === 'expense_approval') counts.gastos++;
    });
    return counts;
  }, [appShellData]);

  // Determine other cards to show (Admin/Encargado context mostly)
  const isAdminOrEncargado = ['admin', 'encargado'].includes(sessionRole?.rol);
  const otherCards = isAdminOrEncargado ? [
    { key: 'devoluciones', title: 'Devoluciones', count: stats.devoluciones, icon: RotateCcw, color: 'text-purple-600', bgColor: 'bg-purple-100', path: '/inventario/solicitudes-devoluciones' },
    { key: 'tareas', title: 'Revisiones', count: stats.tareas, icon: CheckSquare, color: 'text-green-600', bgColor: 'bg-green-100', path: '/gestion/tareas' },
    { key: 'vacaciones', title: 'Vacaciones', count: stats.vacaciones, icon: Calendar, color: 'text-pink-600', bgColor: 'bg-pink-100', path: '/personal/gestion-calendario' },
    { key: 'vehiculos', title: 'Vehículos', count: stats.vehiculos, icon: Truck, color: 'text-red-600', bgColor: 'bg-red-100', path: '/inventario/vehiculos' },
    { key: 'anticipos', title: 'Anticipos', count: stats.gastos, icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-100', path: '/personal/anticipos' },
  ] : [];

  const activeOtherCards = otherCards.filter(card => card.count > 0);
  const totalPending = Object.values(alertCounts).reduce((a, b) => a + b, 0) + Object.values(stats).reduce((a, b) => a + b, 0);

  if (loading || loadingAuth || loadingShell) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Cargando panel personal...</p>
        </div>
      </div>
    );
  }

  // Common Header Logic
  const formattedDate = currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  const formattedTime = currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="p-4 md:p-8 space-y-8 bg-background min-h-screen animate-in fade-in duration-500">

      {/* 1. Welcome Section */}
      <section className="bg-card rounded-xl border p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
          <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background shadow-xl ring-4 ring-primary/10">
            <AvatarImage src={userPhoto} alt={displayName} className="object-cover" />
            <AvatarFallback className="text-4xl bg-primary text-primary-foreground font-bold">{userInitials}</AvatarFallback>
          </Avatar>

          <div className="flex-1 text-center md:text-left space-y-4 pt-2">
            <div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
                {greetingText}, <br className="md:hidden" />
                <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                  {displayName}
                </span>
              </h1>
              <div className="mt-3 flex flex-wrap items-center justify-center md:justify-start gap-3">
                <Badge variant="secondary" className="px-3 py-1 text-sm font-medium uppercase tracking-wide bg-secondary/50 text-secondary-foreground border-secondary-foreground/20">
                  {sessionRole?.rol || 'Usuario'}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 mt-6 pt-6 border-t border-border/50">
              <div className="text-center sm:text-left">
                <p className="text-lg font-semibold text-foreground capitalize">{capitalizedDate}</p>
                <p className="text-sm font-mono text-muted-foreground tracking-widest">{formattedTime}</p>
              </div>
              <div className="hidden sm:block h-10 w-px bg-border/50"></div>
              <div className="flex items-center gap-3 bg-muted/30 px-4 py-2 rounded-lg border border-border/50">
                <div className={`p-2 rounded-full ${totalPending > 0 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                  <Activity className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">
                    {totalPending > 0 ? `${totalPending} Acciones Pendientes` : 'Todo al día'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {totalPending > 0 ? 'Requieren tu atención' : '¡Buen trabajo!'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex flex-col gap-3 self-center">
            <Button onClick={() => navigate('/bandeja-entrada')} size="lg" className="shadow-md hover:shadow-lg transition-all w-full min-w-[200px]">
              Ver Bandeja Completa
            </Button>
            <Button variant="outline" onClick={() => navigate('/sistema/configuracion')} size="lg" className="w-full">
              Configuración
            </Button>
          </div>
        </div>
      </section>

      {/* 2. Priority Alerts Grid (Filtered by Current User) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary" />
            Mis Tareas Pendientes
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <AnimatePresence>
            {visibleAlertTypes.leads && (
              <AlertCard
                key="leads"
                title={isAdminOrEncargado ? "Leads Activos" : "Leads Asignados"}
                count={alertCounts.leads}
                icon={Users}
                status={alertCounts.leads > 0 ? "alert" : "ok"}
                onClick={() => handleAlertClick('leads', isAdminOrEncargado ? '/crm/leads' : '/crm/leads?filter=assigned')}
              />
            )}
            {visibleAlertTypes.partes && (
              <AlertCard
                key="partes"
                title={isAdminOrEncargado ? "Partes Activos" : "Partes Asignados"}
                count={alertCounts.partes}
                icon={FileText}
                status={alertCounts.partes > 0 ? "alert" : "ok"}
                onClick={() => handleAlertClick('partes', isAdminOrEncargado ? '/gestion/partes' : '/gestion/partes?filter=assigned')}
              />
            )}
            {visibleAlertTypes.tareas && (
              <AlertCard
                key="tasks"
                title={isAdminOrEncargado ? "Tareas Pendientes" : "Mis Tareas"}
                count={alertCounts.tareas}
                icon={ClipboardList}
                status={alertCounts.tareas > 0 ? "alert" : "ok"}
                onClick={() => handleAlertClick('tareas', isAdminOrEncargado ? '/gestion/tareas' : '/gestion/tareas?filter=assigned')}
              />
            )}
            {visibleAlertTypes.herramientas && (
              <AlertCard
                key="tools"
                title="Aceptar Herramientas"
                count={alertCounts.herramientas}
                icon={Wrench}
                status={alertCounts.herramientas > 0 ? "alert" : "ok"}
                onClick={() => handleAlertClick('herramientas', '/inventario/mis-herramientas?filter=pending')}
              />
            )}
            {visibleAlertTypes.materiales && (
              <AlertCard
                key="materials"
                title="Recibir Materiales"
                count={alertCounts.materiales}
                icon={Package}
                status={alertCounts.materiales > 0 ? "alert" : "ok"}
                onClick={() => handleAlertClick('materiales', '/inventario/pedidos')}
              />
            )}
            {visibleAlertTypes.pedidos && (
              <AlertCard
                key="orders"
                title="Aprobar Pedidos"
                count={alertCounts.pedidos}
                icon={ShoppingCart}
                status={alertCounts.pedidos > 0 ? "alert" : "ok"}
                onClick={() => handleAlertClick('pedidos', '/inventario/solicitudes')}
              />
            )}
            {visibleAlertTypes.incidencias && (
              <AlertCard
                key="incidences"
                title="Incidencias Abiertas"
                count={alertCounts.incidencias}
                icon={ShieldCheck}
                status={alertCounts.incidencias > 0 ? "alert" : "ok"}
                onClick={() => handleAlertClick('incidencias', '/personal/incidencias')}
              />
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* 3. Other Admin Actions (Only for Admin/Encargado) */}
      {isAdminOrEncargado && activeOtherCards.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-muted-foreground">
              <Briefcase className="w-5 h-5" />
              Gestión General
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {activeOtherCards.map((card) => (
              <DashboardCard
                key={card.key}
                title={card.title}
                count={card.count}
                icon={card.icon}
                description={card.description}
                color={card.color}
                bgColor={card.bgColor}
                onClick={() => navigate(card.path)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 4. Widgets Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 h-full">
          <MiniHolidayCalendar />
        </div>
        <div className="md:col-span-1 h-full">
          <TeamStatusWidget />
        </div>
        {/* Only show Financial Summary to Admin/Encargado */}
        {isAdminOrEncargado && (
          <div className="md:col-span-1 h-full">
            <AccesosRapidosWidget navigate={navigate} />
          </div>
        )}
      </section>

      {/* 5. Resumen financiero mensual — solo admin y encargados */}
      {isAdminOrEncargado && (
        <section>
          <ResumenFinancieroMeses />
        </section>
      )}

    </div>
  );
};

export default HomeView;