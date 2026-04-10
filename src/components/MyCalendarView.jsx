import React, { useState, useEffect, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { format, isSameDay, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Calendar as CalendarIcon, Info, Briefcase, User, MapPin, CheckCircle2, AlertTriangle, Palmtree, AlertCircle, Banknote, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import DashboardCalendar from '@/components/DashboardCalendar';
import { filterEventsByRole } from '@/utils/calendarPermissions';

// --- HELPER CONSTANTS & FUNCTIONS ---

const EVENT_TYPES = {
  FESTIVO: { color: 'bg-red-500', text: 'Festivo', icon: Palmtree },
  VACACIONES: { color: 'bg-green-500', text: 'Vacaciones', icon: Palmtree },
  AUSENCIA: { color: 'bg-purple-500', text: 'Ausencia', icon: AlertCircle },
  TAREA: { color: 'bg-blue-500', text: 'Tarea', icon: CheckCircle2 },
  PARTE: { color: 'bg-orange-500', text: 'Parte Trabajo', icon: Briefcase },
  VISITA: { color: 'bg-indigo-500', text: 'Visita Comercial', icon: Users },
  EVENTO: { color: 'bg-sky-500', text: 'Evento Agenda', icon: CalendarIcon }, // New Type for generic calendar events
  MODIFICACION: { color: 'bg-yellow-500', text: 'Modificación', icon: AlertTriangle },
  FIN_DE_SEMANA: { color: 'bg-blue-100/50 dark:bg-blue-900/30', text: 'Fin de Semana', icon: CalendarIcon },
};

const getEventColor = (type) => EVENT_TYPES[type]?.color || 'bg-gray-500';
const getEventIcon = (type) => EVENT_TYPES[type]?.icon || Info;

// --- COMPONENT ---

const MyCalendarView = ({ navigate }) => {
  const { sessionRole, user, loadingAuth } = useAuth();
  const [date, setDate] = useState(new Date()); 
  const [month, setMonth] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Determine user roles for tab visibility
  const isAdminOrEncargado = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado';
  const isTecnico = sessionRole?.rol === 'tecnico';

  // Dynamic tabs configuration based on user role
  const availableTabs = useMemo(() => {
    const tabs = [
      {
        value: "agenda",
        label: "Calendario",
        icon: <CalendarIcon className="w-4 h-4" />,
        content: () => <MainCalendarContent />,
        alwaysVisible: true,
      },
    ];

    if (isAdminOrEncargado) {
      tabs.push({
        value: "cargos-bancarios",
        label: "Cargos Bancarios",
        icon: <Banknote className="w-4 h-4" />,
        content: () => <DashboardCalendar allowedEmails={[]} />, 
      });
    }
    return tabs;
  }, [isAdminOrEncargado]);

  const defaultTabValue = availableTabs.length > 0 ? availableTabs[0].value : "agenda";
  const [activeTab, setActiveTab] = useState(defaultTabValue);

  useEffect(() => {
    if (!availableTabs.some(tab => tab.value === activeTab)) {
      setActiveTab(defaultTabValue);
    }
  }, [availableTabs, activeTab, defaultTabValue]);

  // Data Fetching
  useEffect(() => {
    if (loadingAuth) return;
    if (!user) return;

    // Require session role to be loaded
    if (!sessionRole?.rol) {
        setLoading(false);
        return;
    }

    const fetchCalendarData = async () => {
      setLoading(true);
      try {
        const start = format(startOfMonth(month), 'yyyy-MM-dd');
        const end = format(endOfMonth(month), 'yyyy-MM-dd');
        
        let allEvents = [];

        // 1. Festivos (System-wide, visible to all)
        const { data: festivos } = await supabase
          .from('calendario_festivos')
          .select('*')
          .gte('fecha', start)
          .lte('fecha', end);

        if (festivos) {
          allEvents = allEvents.concat(festivos.map(f => ({
            id: f.id,
            date: parseISO(f.fecha),
            type: 'FESTIVO',
            title: f.descripcion,
            description: f.tipo,
            details: null,
            owner: null // Global
          })));
        }

        // --- Fetching Logic ---
        // We fetch broader data and filter it using JS utility to ensure 
        // consistent logic. Crucially, we now fetch `auth_user_id` to enforce Mikelo's privacy.

        // 2. Vacaciones
        // Fetch including employee auth_user_id for filtering
        let vacQuery = supabase
          .from('vacaciones_solicitudes')
          .select('*, empleados:vacaciones_solicitudes_empleado_id_fkey(id, nombre, apellidos, rol, auth_user_id)')
          .or(`fecha_inicio.gte.${start},fecha_fin.lte.${end}`);
        
        if (sessionRole.rol === 'tecnico') {
           vacQuery = vacQuery.eq('empleado_id', sessionRole.id);
        }

        const { data: vacaciones } = await vacQuery;
        
        if (vacaciones) {
          vacaciones.forEach(v => {
            if (v.estado === 'rechazada') return; 
            
            let curr = parseISO(v.fecha_inicio);
            const endV = parseISO(v.fecha_fin);
            
            while (curr <= endV) {
              if (curr >= startOfMonth(month) && curr <= endOfMonth(month)) {
                allEvents.push({
                  id: v.id + '_' + curr.toISOString(),
                  date: new Date(curr),
                  type: 'VACACIONES',
                  title: (v.empleados?.nombre || 'Empleado'),
                  description: v.estado,
                  details: v,
                  owner: v.empleados // { id, rol, auth_user_id }
                });
              }
              curr.setDate(curr.getDate() + 1);
            }
          });
        }

        // 3. Ausencias
        let ausQuery = supabase
          .from('ausencias_empleados')
          .select('*, empleados:ausencias_empleados_empleado_id_fkey(id, nombre, apellidos, rol, auth_user_id)')
          .or(`fecha_inicio.gte.${start},fecha_fin.lte.${end}`);
          
        if (sessionRole.rol === 'tecnico') {
           ausQuery = ausQuery.eq('empleado_id', sessionRole.id);
        }
        
        const { data: ausencias } = await ausQuery;

        if (ausencias) {
          ausencias.forEach(a => {
            let curr = parseISO(a.fecha_inicio);
            const endA = parseISO(a.fecha_fin);
            while (curr <= endA) {
              if (curr >= startOfMonth(month) && curr <= endOfMonth(month)) {
                allEvents.push({
                  id: a.id + '_' + curr.toISOString(),
                  date: new Date(curr),
                  type: 'AUSENCIA',
                  title: (a.empleados?.nombre || 'Empleado'),
                  description: a.tipo,
                  details: a,
                  owner: a.empleados
                });
              }
              curr.setDate(curr.getDate() + 1);
            }
          });
        }

        // 4. Tareas
        let taskQuery = supabase
          .from('tareas')
          .select('*, empleados:empleado_asignado_id(id, nombre, apellidos, rol, auth_user_id), proyectos(nombre_proyecto)')
          .not('fecha_limite', 'is', null)
          .gte('fecha_limite', start).lte('fecha_limite', end);
          
        if (sessionRole.rol === 'tecnico') {
           taskQuery = taskQuery.eq('empleado_asignado_id', sessionRole.id);
        }
        
        const { data: tareas } = await taskQuery;
        if (tareas) {
          allEvents = allEvents.concat(tareas.map(t => ({
            id: t.id,
            date: parseISO(t.fecha_limite),
            type: 'TAREA',
            title: t.titulo,
            description: t.proyectos?.nombre_proyecto || 'Sin proyecto',
            details: t,
            assignee: t.empleados?.nombre,
            owner: t.empleados
          })));
        }

        // 5. Partes de Trabajo
        let partesQuery = supabase
          .from('partes')
          .select('*, tecnico:tecnico_asignado_id(id, nombre, apellidos, rol, auth_user_id)')
          .not('fecha_visita', 'is', null)
          .gte('fecha_visita', start + 'T00:00:00').lte('fecha_visita', end + 'T23:59:59');
          
        if (sessionRole.rol === 'tecnico') {
           partesQuery = partesQuery.eq('tecnico_asignado_id', sessionRole.id);
        }

        const { data: partes } = await partesQuery;
        if (partes) {
          allEvents = allEvents.concat(partes.map(p => ({
            id: p.id,
            date: parseISO(p.fecha_visita),
            type: 'PARTE',
            title: p.cliente_nombre || 'Cliente Desconocido',
            description: p.direccion_servicio || 'Sin dirección',
            details: p,
            assignee: p.tecnico?.nombre,
            owner: p.tecnico
          })));
        }

        // 6. Visitas de Leads
        let leadsQuery = supabase
          .from('leads')
          .select('id, nombre_contacto, nombre_empresa, fecha_visita, direccion, empleado_asignado_id, empleados:empleado_asignado_id(id, nombre, apellidos, rol, auth_user_id)')
          .not('fecha_visita', 'is', null)
          .gte('fecha_visita', start + 'T00:00:00').lte('fecha_visita', end + 'T23:59:59');

        if (sessionRole.rol === 'tecnico') {
           leadsQuery = leadsQuery.eq('empleado_asignado_id', sessionRole.id);
        }

        const { data: leadsData } = await leadsQuery;
        if (leadsData) {
          allEvents = allEvents.concat(leadsData.map(l => ({
            id: l.id,
            date: parseISO(l.fecha_visita),
            type: 'VISITA',
            title: l.nombre_contacto || l.nombre_empresa || 'Prospecto',
            description: l.direccion || (l.nombre_empresa ? `Empresa: ${l.nombre_empresa}` : 'Visita Comercial'),
            details: l,
            assignee: l.empleados?.nombre,
            owner: l.empleados
          })));
        }

        // 7. Eventos de Agenda (Desde vista v_calendar_events_mis_visitas)
        // Se cargan eventos generales/Google Calendar a través de la vista
        // en lugar de usar la tabla calendar_events directamente.
        const { data: agendaEvents } = await supabase
          .from('v_calendar_events_mis_visitas')
          .select('*')
          .gte('start_time', start + 'T00:00:00')
          .lte('start_time', end + 'T23:59:59');

        if (agendaEvents) {
          allEvents = allEvents.concat(agendaEvents.map(e => ({
            id: e.id,
            date: parseISO(e.start_time),
            type: 'EVENTO',
            title: e.title || 'Evento',
            description: e.description || '',
            details: e,
            owner: { auth_user_id: e.user_id }, // Map auth_user_id for permission filter
            assignee: 'Yo'
          })));
        }

        // --- APPLY SECURITY FILTERING ---
        // Security Rules:
        // 1. MIKELO Exception: Events owned by Mikelo are ONLY visible to Mikelo.
        // 2. Admin: All (except Mikelo private).
        // 3. Encargado: Self + Admins + Technicians (Not other Encargados).
        // 4. Technician: Self Only.
        
        const filteredEvents = filterEventsByRole(allEvents, sessionRole);
        setEvents(filteredEvents);

      } catch (error) {
        console.error("Error fetching calendar events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarData();
  }, [month, user, sessionRole, isAdminOrEncargado, isTecnico, loadingAuth]);

  // --- RENDERING HELPERS ---

  const selectedDayEvents = useMemo(() => {
    if (!date) return [];
    return events.filter(e => isSameDay(e.date, date));
  }, [date, events]);

  const calendarModifiers = useMemo(() => ({
    holiday: (date) => events.some(e => isSameDay(e.date, date) && e.type === 'FESTIVO'),
    hasEvent: (date) => events.some(e => isSameDay(e.date, date) && ['TAREA', 'PARTE', 'VACACIONES', 'AUSENCIA', 'VISITA', 'EVENTO'].includes(e.type)),
    weekend: (day) => day.getDay() === 0 || day.getDay() === 6,
  }), [events]);

  const dayContent = (day) => {
    const dayEvents = events.filter(e => isSameDay(e.date, day));
    const dots = dayEvents.slice(0, 4); 
    
    return (
      <div className="w-full h-full flex flex-col items-center justify-start pt-1 relative z-10">
        <span>{format(day, 'd')}</span>
        <div className="flex gap-0.5 mt-1">
          {dots.map((ev, i) => (
            <div 
              key={i} 
              className={cn("w-1.5 h-1.5 rounded-full", getEventColor(ev.type))} 
            />
          ))}
          {dayEvents.length > 4 && <span className="text-[8px] leading-none text-muted-foreground">+</span>}
        </div>
      </div>
    );
  };

  const handleEventClick = (event) => {
    if (event.type === 'VISITA' && event.details?.id && navigate) {
      navigate(`/crm/leads/${event.details.id}`);
    } else if (event.type === 'PARTE' && event.details?.id && navigate) {
      navigate(`/gestion/partes/detail/${event.details.id}`);
    } else if (event.type === 'TAREA' && navigate) {
      navigate('/gestion/tareas');
    }
  };

  const MainCalendarContent = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-0">
        {/* Left Column: Calendar */}
        <Card className="lg:col-span-8 xl:col-span-9 h-full shadow-md flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle>Vista Mensual</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex justify-center p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              month={month}
              onMonthChange={setMonth}
              locale={es}
              className="rounded-md border shadow-sm p-4 w-full max-w-3xl"
              classNames={{
                month: "space-y-4 w-full",
                table: "w-full border-collapse space-y-1",
                head_row: "flex w-full",
                head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.8rem] h-9",
                row: "flex w-full mt-2",
                cell: "h-14 sm:h-20 w-full text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-full w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-accent/50 text-accent-foreground font-bold border border-primary/20",
              }}
              modifiers={calendarModifiers}
              modifiersClassNames={{
                holiday: "bg-red-100/50 text-red-900 font-medium hover:bg-red-200/60 dark:bg-red-900/20 dark:text-red-100 dark:hover:bg-red-900/50",
                hasEvent: "cursor-pointer hover:bg-secondary hover:text-secondary-foreground hover:shadow-sm hover:font-bold hover:scale-[1.02] transition-all duration-200",
                weekend: "rdp-day_weekend" 
              }}
              components={{
                DayContent: ({ date: d }) => dayContent(d)
              }}
            />
          </CardContent>
        </Card>

        {/* Right Column: Daily Details */}
        <Card className="lg:col-span-4 xl:col-span-3 h-full shadow-md flex flex-col max-h-[800px]">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="flex items-center justify-between">
              <span>{date ? format(date, "d 'de' MMMM", { locale: es }) : 'Selecciona un día'}</span>
              {date && isSameDay(date, new Date()) && <Badge variant="outline" className="ml-2">Hoy</Badge>}
            </CardTitle>
            <CardDescription>
              {selectedDayEvents.length} eventos para este día
            </CardDescription>
          </CardHeader>
          
          <ScrollArea className="flex-1">
            <CardContent className="p-4 space-y-3">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : selectedDayEvents.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p>No hay eventos programados.</p>
                </div>
              ) : (
                selectedDayEvents.map((event, idx) => {
                  const Icon = getEventIcon(event.type);
                  return (
                    <div 
                      key={idx} 
                      onClick={() => handleEventClick(event)}
                      className={cn(
                        "group flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
                        ['VISITA', 'PARTE', 'TAREA'].includes(event.type) && "cursor-pointer"
                      )}
                    >
                      <div className={cn("mt-1 w-1.5 self-stretch rounded-full shrink-0", getEventColor(event.type))} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-background">
                            {event.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-auto font-mono">
                            {format(event.date, 'HH:mm') !== '00:00' ? format(event.date, 'HH:mm') : 'Todo el día'}
                          </span>
                        </div>
                        
                        <h4 className="font-medium text-sm truncate pr-2" title={event.title}>
                          {event.title}
                        </h4>
                        
                        <div className="text-xs text-muted-foreground mt-1 truncate" title={event.description}>
                          {event.description}
                        </div>

                        {/* Assignee info - only shown if allowed */}
                        {(isAdminOrEncargado || (event.type === 'TAREA' && sessionRole.rol === 'tecnico')) && event.assignee && (
                          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs font-medium text-foreground/80">{event.assignee}</span>
                          </div>
                        )}
                        
                        {event.type === 'PARTE' && event.details?.direccion_servicio && (
                           <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                             <MapPin className="w-3 h-3" />
                             <span className="truncate">{event.details.direccion_servicio}</span>
                           </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto w-full h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" />
            {isAdminOrEncargado ? 'Calendario Global' : 'Mi Calendario'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdminOrEncargado 
              ? 'Gestión de agenda, vacaciones, visitas y tareas de todo el equipo.' 
              : 'Vista personal de tus tareas, vacaciones y servicios asignados.'}
          </p>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(EVENT_TYPES).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1.5 bg-card border px-2 py-1 rounded-md">
              <div className={cn("w-2.5 h-2.5 rounded-full", config.color)} />
              <span>{config.text}</span>
            </div>
          ))}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
           <TabsList>
              {availableTabs.map((tab) => (
                <TabsTrigger 
                  key={tab.value} 
                  value={tab.value} 
                  className="flex items-center gap-2"
                >
                  {tab.icon} {tab.label}
                </TabsTrigger>
              ))}
           </TabsList>
        </div>

        {availableTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="flex-1 mt-0">
            {tab.content()}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default MyCalendarView;