import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO, startOfMonth, endOfMonth, isSameDay, startOfDay, endOfDay, isWithinInterval, isValid, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn, safeFormat } from '@/lib/utils';
import { 
  Calendar as CalendarIcon, 
  Wallet, 
  Briefcase, 
  HardHat,
  Loader2,
  Users,
  MapPin,
  Clock,
  ArrowRight,
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { filterEventsByRole } from '@/utils/calendarPermissions';
import { useNavigate } from 'react-router-dom';

const CalendarioPrivadoView = () => {
  const { user, sessionRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("calendario");
  
  // Controls for Month View
  const [month, setMonth] = useState(new Date());
  // Selected specific day for details
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  // Data State
  const [eventsHR, setEventsHR] = useState([]);
  const [eventsFinance, setEventsFinance] = useState([]);

  // --- WHITELIST CONFIGURATION ---
  const FINANCE_VIEWERS = ['admin@orkaled.com', 'dana@orkaled.com', 'fran@orkaled.com'];
  
  const canViewFinance = useMemo(() => {
    return user?.email && FINANCE_VIEWERS.includes(user.email.toLowerCase());
  }, [user]);

  const availableTabs = useMemo(() => {
    const tabs = [
      { value: "calendario", label: "Calendario", icon: Briefcase }
    ];
    if (canViewFinance) {
      tabs.push({ value: "cargos", label: "Cargos bancarios", icon: Wallet });
    }
    return tabs;
  }, [canViewFinance]);

  // Ensure default tab
  useEffect(() => {
    if (!availableTabs.some(t => t.value === activeTab)) {
      setActiveTab(availableTabs[0].value);
    }
  }, [availableTabs, activeTab]);

  const fetchRange = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return { 
      start: format(start, 'yyyy-MM-dd'), 
      end: format(end, 'yyyy-MM-dd') 
    };
  }, [month]);

  // Helper to go to today
  const handleJumpToToday = () => {
    const today = new Date();
    setMonth(today);
    setSelectedDate(today);
  };

  // --- FETCH DATA (Unified) ---
  const fetchCalendarData = useCallback(async () => {
    if (!user || !sessionRole?.rol) return;
    setLoading(true);
    
    try {
      if (activeTab === "calendario") {
        // --- 1. Fetch Employees Mapping ---
        const { data: allEmployees } = await supabase.from('empleados').select('id, rol, auth_user_id');
        const roleMap = {};
        const authMap = {};
        allEmployees?.forEach(e => {
            roleMap[e.id] = e.rol;
            authMap[e.id] = e.auth_user_id;
        });
        const enrichOwner = (item, empIdKey = 'empleado_id') => {
            const eid = item[empIdKey];
            return { id: eid, rol: roleMap[eid], auth_user_id: authMap[eid] };
        };

        // --- 2. Standard HR Events ---
        const { data: vacaciones } = await supabase.from('v_vacaciones_solicitudes').select('*') 
          .or(`fecha_inicio.gte.${fetchRange.start},fecha_fin.lte.${fetchRange.end}`);
        const { data: ausencias } = await supabase.from('ausencias_empleados').select('*')
          .or(`fecha_inicio.gte.${fetchRange.start},fecha_fin.lte.${fetchRange.end}`);
        const { data: festivos } = await supabase.from('calendario_festivos').select('*')
          .gte('fecha', fetchRange.start).lte('fecha', fetchRange.end);
        const { data: cierres } = await supabase.from('company_closures').select('*')
          .or(`start_date.gte.${fetchRange.start},end_date.lte.${fetchRange.end}`);
        const { data: proyectos } = await supabase.from('proyectos').select('id, nombre_proyecto, fecha_inicio, fecha_fin_estimada, fecha_fin_real, estado')
          .or(`fecha_inicio.gte.${fetchRange.start},fecha_fin_estimada.lte.${fetchRange.end}`);
        const { data: leadsVisits } = await supabase.from('leads').select('id, nombre_contacto, nombre_empresa, fecha_visita, direccion, empleado_asignado_id')
          .not('fecha_visita', 'is', null)
          .gte('fecha_visita', fetchRange.start + 'T00:00:00').lte('fecha_visita', fetchRange.end + 'T23:59:59');

        // --- 3. Calendar Events (including Partes) ---
        // Explicitly fetch including the join to parte_visita_calendar_link
        const { data: calendarEvents } = await supabase
          .from('calendar_events')
          .select(`
            *,
            parte_links:parte_visita_calendar_link(parte_id)
          `)
          .eq('user_id', user.id)
          .gte('start_time', fetchRange.start + 'T00:00:00')
          .lte('start_time', fetchRange.end + 'T23:59:59');

        // Merge Everything
        const merged = [
          // HR Base
          ...(vacaciones || []).map(i => ({ ...i, type: 'vacacion', date: i.fecha_inicio, dateEnd: i.fecha_fin, owner: enrichOwner(i) })),
          ...(ausencias || []).map(i => ({ ...i, type: 'ausencia', date: i.fecha_inicio, dateEnd: i.fecha_fin, owner: enrichOwner(i) })),
          ...(festivos || []).map(i => ({ ...i, type: 'festivo', date: i.fecha, title: i.descripcion || 'Festivo', owner: null })),
          ...(cierres || []).map(i => ({ ...i, type: 'cierre', date: i.start_date, dateEnd: i.end_date, title: i.name || 'Cierre Empresa', owner: null })),
          ...(proyectos || []).map(i => ({ ...i, type: 'proyecto', date: i.fecha_inicio, dateEnd: i.fecha_fin_estimada || i.fecha_fin_real, owner: null })), 
          ...(leadsVisits || []).map(i => ({ ...i, type: 'visita_lead', date: i.fecha_visita, title: i.nombre_contacto || i.nombre_empresa, desc: i.direccion, owner: enrichOwner(i, 'empleado_asignado_id') })),
          
          // Calendar Events (Partes & Generic)
          ...(calendarEvents || []).map(e => {
             // Extract parte_id if available
             const pid = e.parte_links?.[0]?.parte_id;
             const isParte = e.source === 'parte_visita' || !!pid;
             
             return {
               id: e.id,
               type: isParte ? 'visita_parte' : 'evento_generico',
               date: e.start_time,
               dateEnd: e.end_time,
               title: e.title,
               desc: e.description,
               all_day: e.all_day,
               parte_id: pid,
               owner: { auth_user_id: user.id } // Own events
             };
          })
        ];

        // Filter permissions
        setEventsHR(filterEventsByRole(merged, sessionRole));

      } else if (activeTab === "cargos" && canViewFinance) {
        // Finance Data
        const { data: facturas } = await supabase.from('facturas_emitidas').select('*').gte('fecha_vencimiento', fetchRange.start).lte('fecha_vencimiento', fetchRange.end);
        const { data: gastos } = await supabase.from('gastos').select('*, proveedor:proveedores(nombre)').gte('fecha_vencimiento', fetchRange.start).lte('fecha_vencimiento', fetchRange.end);
        const { data: gastosGen } = await supabase.from('v_gastos_generales').select('*').gte('fecha_vencimiento', fetchRange.start).lte('fecha_vencimiento', fetchRange.end);

        setEventsFinance([
          ...(facturas || []).map(i => ({ ...i, type: 'factura_emitida', date: i.fecha_vencimiento, amount: i.monto_total })),
          ...(gastos || []).map(i => ({ ...i, type: 'gasto', date: i.fecha_vencimiento, amount: i.total_con_iva })),
          ...(gastosGen || []).map(i => ({ ...i, type: 'gasto_general', date: i.fecha_vencimiento, amount: i.total_con_iva }))
        ]);
      }
    } catch (err) {
      console.error("Error fetching calendar:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchRange, user, sessionRole, canViewFinance]);

  // Initial Fetch & Refetch on Tab/Month change
  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  // --- RENDER HELPERS ---
  const getEventsForDay = (date, eventList) => {
    if (!date || !isValid(date)) return [];
    return eventList.filter(e => {
        if (!e.date) return false;
        const start = parseISO(e.date); 
        if (!isValid(start)) return false;
        
        // Single Point Events
        if (!e.dateEnd) return isSameDay(start, date);
        
        // Ranges
        const end = parseISO(e.dateEnd);
        if (!isValid(end)) return isSameDay(start, date);
        return isWithinInterval(date, { start: startOfDay(start), end: endOfDay(end) });
    });
  };

  const renderDayContent = (day, events) => {
    if (!isValid(day)) return null;
    const dailyEvents = getEventsForDay(day, events);
    const hasHighPriority = dailyEvents.some(e => ['festivo', 'cierre', 'factura_emitida'].includes(e.type));
    const count = dailyEvents.length;

    if (count === 0) return <span>{format(day, 'd')}</span>;

    return (
      <div className="w-full h-full flex flex-col items-center justify-start pt-1 relative z-10">
        <span className={cn("font-medium text-xs", hasHighPriority ? "text-red-600 font-bold" : "")}>
          {format(day, 'd')}
        </span>
        <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-[2rem] content-center">
          {dailyEvents.slice(0, 5).map((ev, i) => (
            <div 
              key={i} 
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                ev.type === 'vacacion' ? "bg-purple-400" :
                ev.type === 'ausencia' ? "bg-orange-400" :
                ev.type === 'festivo' ? "bg-red-500" :
                ev.type === 'cierre' ? "bg-red-800" :
                ev.type === 'proyecto' ? "bg-slate-500" :
                ev.type === 'factura_emitida' ? "bg-green-600" :
                ev.type === 'gasto' ? "bg-red-400" :
                ev.type === 'visita_lead' ? "bg-indigo-500" :
                ev.type === 'visita_parte' ? "bg-cyan-500" :
                "bg-blue-400" // Generico
              )}
            />
          ))}
          {count > 5 && <span className="text-[6px] text-muted-foreground leading-none">+</span>}
        </div>
      </div>
    );
  };

  const selectedDayEvents = useMemo(() => {
    const list = activeTab === "calendario" ? eventsHR : eventsFinance;
    const evs = getEventsForDay(selectedDate, list);
    // Sort by time if available
    return evs.sort((a,b) => {
       if (a.date && b.date) return new Date(a.date) - new Date(b.date);
       return 0;
    });
  }, [selectedDate, activeTab, eventsHR, eventsFinance]);

  return (
    <div className="p-2 md:p-6 space-y-4 h-full flex flex-col bg-slate-50/50 dark:bg-background/50">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarIcon className="w-6 h-6 text-primary" />
          Mi Calendario
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleJumpToToday}>
            Hoy
          </Button>
          <div className="flex items-center rounded-md border bg-background shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-none" onClick={() => setMonth(prev => subMonths(prev, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="w-32 text-center text-sm font-medium border-x px-2 py-1.5 h-8 flex items-center justify-center">
              {safeFormat(month, 'MMMM yyyy')}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none" onClick={() => setMonth(prev => addMonths(prev, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-4">
          {availableTabs.map(tab => (
            <TabsTrigger 
              key={tab.value}
              value={tab.value} 
              className="data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-sm rounded-t-md px-6 py-2 gap-2 border border-transparent border-b-0"
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
          {/* Calendar Widget */}
          <Card className="lg:col-span-8 shadow-sm border-t-4 border-t-primary h-fit">
            <CardContent className="p-4 flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                month={month}
                onMonthChange={setMonth}
                locale={es}
                className="rounded-md w-full max-w-full"
                classNames={{
                  month: "space-y-4 w-full",
                  caption: "hidden", // We use custom header
                  table: "w-full border-collapse space-y-1",
                  head_row: "grid grid-cols-7 w-full mb-2",
                  head_cell: "text-muted-foreground rounded-md w-full font-medium text-xs uppercase tracking-wider text-center",
                  row: "grid grid-cols-7 w-full mt-1 gap-1",
                  cell: "h-20 w-full p-0 relative [&:has([aria-selected])]:bg-transparent focus-within:relative focus-within:z-20",
                  day: "h-full w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent/50 focus:bg-accent rounded-md border border-transparent hover:border-border transition-all",
                  day_selected: "bg-primary/5 border-primary text-primary font-bold shadow-sm",
                  day_today: "bg-accent/30 text-accent-foreground border-accent",
                  day_outside: "text-muted-foreground opacity-30 bg-muted/10",
                }}
                components={{
                  DayContent: ({ date }) => renderDayContent(date, activeTab === "calendario" ? eventsHR : eventsFinance)
                }}
              />
            </CardContent>
          </Card>

          {/* Agenda / Details List */}
          <Card className="lg:col-span-4 shadow-sm flex flex-col h-full max-h-[800px] border-t-4 border-t-indigo-500">
            <CardHeader className="bg-muted/10 pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                {safeFormat(selectedDate, "EEEE, d 'de' MMMM")}
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 bg-slate-50/30">
              <CardContent className="p-4 space-y-3">
                {loading && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                  </div>
                )}
                
                {!loading && selectedDayEvents.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground bg-background rounded-lg border border-dashed">
                    <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p>Sin eventos</p>
                  </div>
                )}

                {selectedDayEvents.map((ev, idx) => (
                  <div key={idx} className="group relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                    <div className={cn(
                      "absolute left-0 top-0 bottom-0 w-1.5",
                      ev.type === 'vacacion' ? "bg-purple-400" :
                      ev.type === 'ausencia' ? "bg-orange-400" :
                      ev.type === 'festivo' ? "bg-red-500" :
                      ev.type === 'cierre' ? "bg-red-800" :
                      ev.type === 'proyecto' ? "bg-slate-500" :
                      ev.type === 'factura_emitida' ? "bg-green-600" :
                      ev.type === 'gasto' ? "bg-red-400" :
                      ev.type === 'visita_lead' ? "bg-indigo-500" :
                      ev.type === 'visita_parte' ? "bg-cyan-500" :
                      "bg-blue-400"
                    )} />
                    
                    <div className="p-3 pl-4">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                          {ev.type.replace('_', ' ').replace('visita_lead', 'Comercial').replace('visita_parte', 'Técnica')}
                        </span>
                        {ev.date && (
                          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground/70">
                            {format(parseISO(ev.date), 'HH:mm')}
                          </span>
                        )}
                      </div>
                      
                      <h4 className="font-semibold text-sm leading-tight mb-1">
                        {ev.title || ev.nombre_proyecto || 'Evento'}
                      </h4>
                      
                      {(ev.desc || ev.descripcion) && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {ev.desc || ev.descripcion}
                        </p>
                      )}

                      {/* Specific Actions */}
                      {ev.type === 'visita_parte' && ev.parte_id && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full mt-2 h-7 text-xs bg-cyan-50 hover:bg-cyan-100 text-cyan-700 justify-between group-hover:pr-2"
                          onClick={() => navigate(`/gestion/partes/detail/${ev.parte_id}`)}
                        >
                          Ver Parte <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Button>
                      )}
                      
                      {ev.type === 'visita_lead' && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 p-1.5 rounded">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{ev.desc || 'Sin dirección'}</span>
                        </div>
                      )}

                      {ev.amount !== undefined && (
                        <div className="mt-2 pt-2 border-t flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Importe</span>
                          <span className={cn("font-bold text-sm", ev.type === 'factura_emitida' ? 'text-green-600' : 'text-red-600')}>
                            {formatCurrency(ev.amount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </ScrollArea>
          </Card>
        </div>
      </Tabs>
    </div>
  );
};

export default CalendarioPrivadoView;