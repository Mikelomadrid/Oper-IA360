import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useAppShell } from '@/contexts/AppShellContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2,
  Coffee,
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
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardCard from '@/components/DashboardCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getGreetingByHour } from '@/lib/utils';

// Simple Holiday Calendar Component for HomeView
const MiniHolidayCalendar = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

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
        console.error("Error fetching holidays:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHolidays();
  }, []);

  // Filter for upcoming holidays
  const upcomingHolidays = holidays.filter(h => new Date(h.fecha) >= new Date(new Date().setHours(0, 0, 0, 0)));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-pink-500" />
          Próximos Festivos
        </CardTitle>
        <CardDescription>Calendario laboral del año en curso</CardDescription>
      </CardHeader>
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
            {upcomingHolidays.length > 5 && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                + {upcomingHolidays.length - 5} festivos más...
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Team Status Component
const TeamStatusWidget = () => {
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveTeam = async () => {
      try {
        // Fetch users who have an open clock-in record (hora_salida is null)
        const { data, error } = await supabase
          .from('v_fichajes_admin_ui')
          .select('empleado_nombre, proyecto_nombre, hora_entrada, tipo')
          .eq('abierto', true)
          .order('hora_entrada', { ascending: false });

        if (error) throw error;
        setActiveUsers(data || []);
      } catch (error) {
        console.error("Error fetching team status:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchActiveTeam();
  }, []);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserCheck className="h-5 w-5 text-emerald-500" />
          Equipo Activo
        </CardTitle>
        <CardDescription>Personal trabajando actualmente ({activeUsers.length})</CardDescription>
      </CardHeader>
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
    </Card>
  );
};

const HomeView = () => {
  const { sessionRole, loadingAuth, user } = useAuth();
  const { appShellData, isLoading: loadingShell } = useAppShell();
  const [extraStats, setExtraStats] = useState({ incidencias: 0, partes: 0 }); // Manual queries still here for things not in shell
  const [latestTimes, setLatestTimes] = useState({ incidencias: 0, partes: 0 });
  const [alertViews, setAlertViews] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();
  const { toast } = useToast();

  // Use appShellData for profile info
  const displayName = appShellData?.empleado?.nombre || 'Usuario';
  const userPhoto = appShellData?.empleado?.foto_url;

  // Clock effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchExtraData = async () => {
      if (loadingAuth) return;

      // Role validation: Only Admin and Encargado
      if (sessionRole?.rol !== 'admin' && sessionRole?.rol !== 'encargado') {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Pending actions come from AppShellContext now (appShellData.pendientes)

        // 1. Fetch Alert Views for current user FIRST so we can filter DB queries
        let viewsMap = {};
        if (user?.id) {
          const { data: viewsData, error: viewsError } = await supabase
            .from('usuario_alertas_vistas')
            .select('alerta_tipo, ultimo_visto')
            .eq('usuario_id', user.id);

          if (viewsError) console.error("Error fetching alert views", viewsError);

          if (viewsData) {
            viewsData.forEach(v => { viewsMap[v.alerta_tipo] = new Date(v.ultimo_visto).getTime(); });
            setAlertViews(viewsMap);
          }
        }

        const incLimitTime = new Date(viewsMap['incidencias'] || 0).toISOString();
        const partesLimitTime = new Date(viewsMap['partes'] || 0).toISOString();

        // 2. Fetch Incidencias (Manual query: estado 'abierta') UNSEEN ONLY
        const { data: incData, count: incCount, error: incError } = await supabase
          .from('incidencias')
          .select('created_at', { count: 'exact' })
          .eq('estado', 'abierta')
          .gt('created_at', incLimitTime);
        if (incError) console.error("Error fetching incidencias count", incError);

        // 3. Fetch Partes de Trabajo (Manual query: estado 'pendiente') UNSEEN ONLY
        const { data: partesData, count: partesCount, error: partesError } = await supabase
          .from('partes')
          .select('created_at', { count: 'exact' })
          .eq('estado', 'pendiente')
          .gt('created_at', partesLimitTime);
        if (partesError) console.error("Error fetching partes count", partesError);

        setExtraStats({
          incidencias: incCount || 0,
          partes: partesCount || 0
        });

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchExtraData();
  }, [sessionRole, loadingAuth, user]);

  // Aggregate pending items from AppShell Context
  const { stats, appShellLatest } = useMemo(() => {
    const counts = {
      materiales: 0, herramientas: 0, devoluciones: 0, tareas: 0,
      vacaciones: 0, vehiculos: 0, leads: 0, gastos: 0
    };
    const latest = {
      materiales: 0, herramientas: 0, devoluciones: 0, tareas: 0,
      vacaciones: 0, vehiculos: 0, leads: 0, gastos: 0
    };

    const items = appShellData?.pendientes || [];

    items.forEach(item => {
      // Find any plausible timestamp
      const dateStr = item.created_at || item.fecha || item.fecha_creacion || item.fecha_solicitud || item.hora_entrada;
      const time = dateStr ? new Date(dateStr).getTime() : 0;

      const isUnseen = (key) => time > (alertViews[key] || 0);

      switch (item.type) {
        case 'material_request': if (isUnseen('materiales')) counts.materiales++; latest.materiales = Math.max(latest.materiales, time); break;
        case 'tool_request': if (isUnseen('herramientas')) counts.herramientas++; latest.herramientas = Math.max(latest.herramientas, time); break;
        case 'tool_return': if (isUnseen('devoluciones')) counts.devoluciones++; latest.devoluciones = Math.max(latest.devoluciones, time); break;
        case 'task_review': if (isUnseen('tareas')) counts.tareas++; latest.tareas = Math.max(latest.tareas, time); break;
        case 'vacation_request': if (isUnseen('vacaciones')) counts.vacaciones++; latest.vacaciones = Math.max(latest.vacaciones, time); break;
        case 'vehicle_alert': if (isUnseen('vehiculos')) counts.vehiculos++; latest.vehiculos = Math.max(latest.vehiculos, time); break;
        case 'unassigned_lead': if (isUnseen('leads')) counts.leads++; latest.leads = Math.max(latest.leads, time); break;
        case 'expense_approval': if (isUnseen('anticipos')) counts.gastos++; latest.gastos = Math.max(latest.gastos, time); break;
        default: break;
      }
    });

    return { stats: counts, appShellLatest: latest };
  }, [appShellData, alertViews]);

  // Access control check
  if (!loadingAuth && sessionRole?.rol !== 'admin' && sessionRole?.rol !== 'encargado') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Acceso Restringido</h2>
        <p className="text-muted-foreground mt-2">Esta vista es exclusiva para Administradores y Encargados.</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/dashboard')}>
          Volver al Dashboard
        </Button>
      </div>
    );
  }

  if (loading || loadingAuth || loadingShell) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Cargando resumen operativo...</p>
        </div>
      </div>
    );
  }

  const handleCardClick = async (card) => {
    // Optimistic UI update
    setAlertViews(prev => ({ ...prev, [card.key]: Date.now() }));

    // DB Update
    if (user?.id) {
      try {
        const nowIso = new Date().toISOString();
        // Check if record exists
        const { data: existingData, error: selectError } = await supabase
          .from('usuario_alertas_vistas')
          .select('id')
          .eq('usuario_id', user.id)
          .eq('alerta_tipo', card.key)
          .maybeSingle();

        if (selectError) throw selectError;

        if (existingData) {
          // Update
          const { error: updateError } = await supabase
            .from('usuario_alertas_vistas')
            .update({ ultimo_visto: nowIso })
            .eq('id', existingData.id);

          if (updateError) throw updateError;
        } else {
          // Insert
          const { error: insertError } = await supabase
            .from('usuario_alertas_vistas')
            .insert({
              usuario_id: user.id,
              alerta_tipo: card.key,
              ultimo_visto: nowIso
            });

          if (insertError) throw insertError;
        }
      } catch (e) {
        console.error("Error saving view status:", e);
        toast({
          variant: "destructive",
          title: "Error de Guardado",
          description: "La notificación no se marcará como vista: " + (e.message || JSON.stringify(e))
        });
      }
    }

    // Navigate
    navigate(card.path);
  };

  // Cards Configuration - strictly operational
  const allCards = [
    {
      key: 'materiales',
      title: 'Materiales',
      count: stats.materiales,
      icon: Package,
      description: 'Solicitudes de compra o asignación de material para obras.',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      path: '/gestion/solicitudes'
    },
    {
      key: 'herramientas',
      title: 'Herramientas',
      count: stats.herramientas,
      icon: Wrench,
      description: 'Peticiones de herramientas por parte de técnicos.',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      path: '/inventario/solicitudes?tab=solicitudes'
    },
    {
      key: 'devoluciones',
      title: 'Devoluciones',
      count: stats.devoluciones,
      icon: RotateCcw,
      description: 'Herramientas devueltas pendientes de revisión y stock.',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      path: '/inventario/solicitudes-devoluciones'
    },
    {
      key: 'tareas',
      title: 'Tareas',
      count: stats.tareas,
      icon: CheckSquare,
      description: 'Tareas completadas que requieren validación de calidad.',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      path: '/gestion/tareas'
    },
    {
      key: 'vacaciones',
      title: 'Vacaciones',
      count: stats.vacaciones,
      icon: Calendar,
      description: 'Solicitudes de ausencia o vacaciones del personal.',
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
      path: '/personal/gestion-calendario'
    },
    {
      key: 'vehiculos',
      title: 'Vehículos',
      count: stats.vehiculos,
      icon: Truck,
      description: 'Mantenimientos, ITV o Seguros próximos a vencer.',
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      path: '/inventario/vehiculos'
    },
    {
      key: 'leads',
      title: 'Leads',
      count: stats.leads,
      icon: Users,
      description: 'Oportunidades comerciales nuevas sin asignar.',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      path: '/crm/leads'
    },
    {
      key: 'anticipos',
      title: 'Anticipos',
      count: stats.gastos, // Mapped from expense_approval
      icon: DollarSign,
      description: 'Solicitudes de anticipo de nómina pendientes de aprobación.',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      path: '/personal/anticipos'
    },
    {
      key: 'incidencias',
      title: 'Incidencias',
      count: extraStats.incidencias,
      icon: AlertCircle,
      description: 'Incidencias de personal o seguridad abiertas.',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      path: '/personal/incidencias'
    },
    {
      key: 'partes',
      title: 'Partes de Trabajo',
      count: extraStats.partes,
      icon: FileText,
      description: 'Partes de trabajo pendientes de asignación o gestión.',
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100',
      path: '/gestion/partes'
    }
  ];

  // ALWAYS show all cards so that "0" is visible instead of disappearing
  const activeCards = allCards;
  const totalPending = Object.values(stats).reduce((a, b) => a + b, 0) + extraStats.incidencias + extraStats.partes;

  // Determine greeting based on time of day in Madrid
  const greeting = getGreetingByHour();

  // Robustly determine initials from displayName (fallback to 'US' for Usuario)
  const userInitials = displayName ? displayName.substring(0, 2).toUpperCase() : 'US';

  // Format date and time
  const formattedDate = currentTime.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  // Capitalize first letter of date
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
                {greeting}, <br className="md:hidden" />
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
                    {totalPending > 0 ? `${totalPending} Tareas Pendientes` : 'Todo al día'}
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

      {/* 2. Pending Actions Cards */}
      <section>
        {activeCards.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/10">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-green-100 p-4 mb-4 animate-bounce-slow ring-8 ring-green-50">
                <Coffee className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">¡Todo al día!</h2>
              <p className="text-muted-foreground max-w-sm">
                ¡Buen trabajo, todas tus peticiones están atendidas! Puedes relajarte o revisar otras áreas.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {activeCards.map((card) => {
              return (
                <DashboardCard
                  key={card.key}
                  title={card.title}
                  count={card.count}
                  icon={card.icon}
                  description={card.description}
                  color={card.color}
                  bgColor={card.bgColor}
                  onClick={() => handleCardClick(card)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Calendar & Insights Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Calendar Column */}
        <div className="md:col-span-1 h-full">
          <MiniHolidayCalendar />
        </div>

        {/* Team Status Column */}
        <div className="md:col-span-1 h-full">
          <TeamStatusWidget />
        </div>

        {/* Quick Metrics / Activity Column */}
        <div className="md:col-span-1 h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Resumen Mensual
              </CardTitle>
              <CardDescription>Métricas clave del mes en curso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-xs text-blue-600 font-medium uppercase">Gastos Obra</span>
                  <div className="text-2xl font-bold text-blue-900 mt-1">-- €</div>
                  <span className="text-[10px] text-blue-400">Actualizado hoy</span>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <span className="text-xs text-purple-600 font-medium uppercase">Ingresos</span>
                  <div className="text-2xl font-bold text-purple-900 mt-1">-- €</div>
                  <span className="text-[10px] text-purple-400">Facturación</span>
                </div>
              </div>

              <div className="pt-2">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Accesos Recientes
                </h4>
                <div className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start text-xs h-8 px-2" onClick={() => navigate('/gestion/obras')}>
                    <span className="w-2 h-2 rounded-full bg-orange-400 mr-2"></span>
                    Gestión de Obras
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-xs h-8 px-2" onClick={() => navigate('/personal/empleados')}>
                    <span className="w-2 h-2 rounded-full bg-indigo-400 mr-2"></span>
                    Directorio Empleados
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-xs h-8 px-2" onClick={() => navigate('/inventario/catalogo')}>
                    <span className="w-2 h-2 rounded-full bg-teal-400 mr-2"></span>
                    Catálogo Herramientas
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </section>
    </div>
  );
};

export default HomeView;