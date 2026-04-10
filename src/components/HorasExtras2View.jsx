import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Calendar as CalendarIcon, FilterX, Filter, X, MessageCircle, Clock, AlertCircle, Plus, Pencil, Trash2, MoreHorizontal, Briefcase, CalendarOff, Wallet, Euro, User, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, getMonth, getYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { LocationBadge } from '@/components/ui/LocationBadge';
import { cn, toMadridTime } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import OvertimeCrudModal from '@/components/OvertimeCrudModal';
import FontaneriaSeccion from '@/components/FontaneriaSeccion';

// Helper to format decimal hours to "H:mm" (e.g., 1.217 -> 1:13)
const formatDecimalToTime = val => {
  if (val === null || val === undefined || isNaN(val)) return '0h';
  const num = Number(val);
  if (num === 0) return '0h';
  const h = Math.floor(Math.abs(num));
  const m = Math.round((Math.abs(num) - h) * 60);

  // Handle case where rounding minutes bumps hour (e.g. 59.9 min -> 60 min)
  if (m === 60) return `${h + 1}:00`;
  return `${h}:${m.toString().padStart(2, '0')}`;
};
const formatCurrency = val => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(val || 0);
};

// Helper to parse '08:00 - 17:00' string or raw dates into Madrid Time for display
const parseHorarioMadrid = row => {
  // If raw UTC timestamps are available (preferred)
  if (row.hora_entrada_madrid || row.hora_entrada) {
    const inTime = toMadridTime(row.hora_entrada || row.hora_entrada_madrid);
    const outTime = toMadridTime(row.hora_salida || row.hora_salida_madrid);
    return {
      in: inTime,
      out: outTime
    };
  }

  // Fallback to parsing the pre-formatted string from view if timestamps missing
  const horarioStr = row.horario || '';
  if (!horarioStr) return {
    in: '-',
    out: '-'
  };
  const parts = horarioStr.toString().split(' - ');
  if (parts.length >= 2) {
    return {
      in: parts[0],
      out: parts[1]
    };
  }
  const match = horarioStr.toString().match(/IN:\s*(\d{1,2}:\d{2})/i);
  const matchOut = horarioStr.toString().match(/OUT:\s*(\d{1,2}:\d{2})/i);
  if (match || matchOut) {
    return {
      in: match ? match[1] : '-',
      out: matchOut ? matchOut[1] : '-'
    };
  }
  return {
    in: horarioStr,
    out: ''
  };
};
const SummaryCard = ({
  title,
  value,
  icon: Icon,
  colorClass,
  subtitle
}) => <Card className="border-0 shadow-md ring-1 ring-border/50 bg-card overflow-hidden relative">
    <div className={cn("absolute top-0 right-0 p-3 opacity-10", colorClass)}>
      <Icon className="w-16 h-16" />
    </div>
    <CardContent className="p-5 flex flex-col gap-1 relative z-10">
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <span className={cn("text-3xl font-bold tracking-tight", colorClass)}>
          {value}
        </span>
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </CardContent>
  </Card>;
export default function HorasExtras2View({
  employeeId = null,
  isEmbedded = false,
  className
}) {
  const navigate = useNavigate();
  const {
    user,
    sessionRole
  } = useAuth();
  const isAdmin = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado';

  // --- State ---
  const [rawData, setRawData] = useState([]);

  // EmployeesMap now stores object: { name: string, rol: string, email: string }
  const [employeesMap, setEmployeesMap] = useState({});
  // RatesMap: { [rol]: { [tipo_hora]: number } }
  const [ratesMap, setRatesMap] = useState({});
  const [filterEmployees, setFilterEmployees] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);

  // Notes Map: Key = `${empleadoId}_${dia}`, Value = boolean (has notes)
  const [notesMap, setNotesMap] = useState({});

  // CRUD State
  const [isCrudModalOpen, setCrudModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  // --- Date Selectors State ---
  // Initialize with current month/year
  const [selectedMonth, setSelectedMonth] = useState(String(getMonth(new Date()) + 1));
  const [selectedYear, setSelectedYear] = useState(String(getYear(new Date())));

  // --- Global Filters ---
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  // Sync Date Range when Month/Year selectors change
  useEffect(() => {
    if (selectedMonth && selectedYear) {
      const newDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
      setDateRange({
        from: startOfMonth(newDate),
        to: endOfMonth(newDate)
      });
    }
  }, [selectedMonth, selectedYear]);

  // Initial employee: if prop passed -> prop; else if admin -> ALL, else -> self
  const [selectedEmpleado, setSelectedEmpleado] = useState(employeeId || "ALL");
  const isMounted = useRef(true);
  useEffect(() => {
    if (employeeId) {
      setSelectedEmpleado(employeeId);
      return;
    }

    // If no prop passed, and user is not admin, select self
    if (!isAdmin && user) {
      const fetchSelf = async () => {
        const {
          data
        } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single();
        if (data && isMounted.current) setSelectedEmpleado(data.id);
      };
      fetchSelf();
    }
  }, [isAdmin, user, employeeId]);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  const [selectedUbicacion, setSelectedUbicacion] = useState("all");
  const [colFilters, setColFilters] = useState({});

  // Constants for Selectors
  const months = [{
    value: '1',
    label: 'Enero'
  }, {
    value: '2',
    label: 'Febrero'
  }, {
    value: '3',
    label: 'Marzo'
  }, {
    value: '4',
    label: 'Abril'
  }, {
    value: '5',
    label: 'Mayo'
  }, {
    value: '6',
    label: 'Junio'
  }, {
    value: '7',
    label: 'Julio'
  }, {
    value: '8',
    label: 'Agosto'
  }, {
    value: '9',
    label: 'Septiembre'
  }, {
    value: '10',
    label: 'Octubre'
  }, {
    value: '11',
    label: 'Noviembre'
  }, {
    value: '12',
    label: 'Diciembre'
  }];
  const currentYear = new Date().getFullYear();
  const years = Array.from({
    length: 5
  }, (_, i) => String(currentYear - 2 + i));

  // --- Initial Load of Metadata (Employees, Projects, Rates) ---
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        // 1. Employees - Fetch relevant roles
        // Filter by role to ensure clean list (only Admin, Encargado, Tecnico)
        const {
          data: empData
        } = await supabase.from('empleados').select('id, nombre, apellidos, rol, email').eq('activo', true).in('rol', ['admin', 'encargado', 'tecnico']);
        const eMap = {};
        let fEmployees = [];
        if (empData) {
          empData.forEach(e => {
            const fullName = `${e.nombre} ${e.apellidos || ''}`.trim();
            eMap[e.id] = {
              name: fullName,
              rol: e.rol,
              email: e.email
            };
          });

          // SORTING LOGIC: Manager (Encargado/Admin) First, then Alphabetical
          const sortedEmployees = [...empData].sort((a, b) => {
            const roleA = (a.rol || '').toLowerCase();
            const roleB = (b.rol || '').toLowerCase();
            const isManagerA = roleA === 'admin' || roleA === 'encargado';
            const isManagerB = roleB === 'admin' || roleB === 'encargado';

            // Priority to managers
            if (isManagerA && !isManagerB) return -1;
            if (!isManagerA && isManagerB) return 1;

            // Alphabetical Name for tie-breakers (both managers or both technicians)
            const nameA = (a.nombre || '').toLowerCase();
            const nameB = (b.nombre || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
          fEmployees = sortedEmployees.map(e => ({
            value: e.id,
            label: `${e.nombre} ${e.apellidos || ''}`.trim(),
            isManager: ['admin', 'encargado'].includes((e.rol || '').toLowerCase())
          }));
        }
        if (isMounted.current) {
          setEmployeesMap(eMap);
          setFilterEmployees(fEmployees);
        }

        // 2. Projects
        const {
          data: projData
        } = await supabase.from('proyectos').select('id, nombre_proyecto').eq('estado', 'activo').order('nombre_proyecto');
        if (isMounted.current && projData) setProjectsList(projData);

        // 3. Rates (Tarifas)
        const {
          data: ratesData
        } = await supabase.from('tarifas_horas_roles').select('*');
        const rMap = {};
        if (ratesData) {
          ratesData.forEach(r => {
            const rolKey = (r.rol || '').toLowerCase();
            if (!rMap[rolKey]) rMap[rolKey] = {};
            rMap[rolKey][r.tipo] = Number(r.precio || 0);
          });
        }
        if (isMounted.current) setRatesMap(rMap);
      } catch (err) {
        console.error("Error loading metadata:", err);
      }
    };
    loadMetadata();
  }, []);

  // --- Main Data Fetch ---
  const fetchData = async (silent = false) => {
    if (!dateRange?.from || !dateRange?.to) return;
    if (!silent) setLoading(true);
    setIsRefetching(true);
    try {
      const fromDateStr = format(dateRange.from, 'yyyy-MM-dd');
      const toDateStr = format(dateRange.to, 'yyyy-MM-dd');

      // 1. Fetch Main Data (Rows)
      let query = supabase.from('v_control_horas_extra_ui_nombre_20260125_v7_hhmm_nulls').select('*');
      query = query.gte('dia', fromDateStr);
      query = query.lte('dia', toDateStr);

      // FILTRO CRÍTICO - Only records with overtime
      query = query.or('horas_extras.gt.0,horas_festivo.gt.0');
      if (selectedEmpleado && selectedEmpleado !== "ALL") {
        query = query.eq('empleado_id', selectedEmpleado);
      }
      query = query.order('dia', {
        ascending: false
      });
      const {
        data: viewData,
        error: viewError
      } = await query;
      if (viewError) throw viewError;

      // 2. Fetch Notes Indicators
      let notesQuery = supabase.from('horas_extras_notas').select('empleado_id, dia, nota').gte('dia', fromDateStr).lte('dia', toDateStr).neq('nota', '');
      if (selectedEmpleado && selectedEmpleado !== "ALL") {
        notesQuery = notesQuery.eq('empleado_id', selectedEmpleado);
      }
      const {
        data: notesData,
        error: notesError
      } = await notesQuery;
      if (isMounted.current) {
        const nMap = {};
        if (notesData) {
          notesData.forEach(note => {
            if (note.empleado_id && note.dia && note.nota && note.nota.trim().length > 0) {
              nMap[`${note.empleado_id}_${note.dia}`] = true;
            }
          });
        }
        setNotesMap(nMap);
        setRawData(viewData || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching horas extras:', err);
      if (!silent) {
        toast({
          title: "Error",
          description: "No se pudieron cargar los datos de horas extras. Inténtalo de nuevo.",
          variant: "destructive"
        });
      }
      if (isMounted.current) setRawData([]);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsRefetching(false);
      }
    }
  };

  // Initial Fetch & Polling & Re-fetch on filter change
  useEffect(() => {
    // Only fetch if we have a valid context (admin or specific employee)
    if ((selectedEmpleado || isAdmin) && isMounted.current) {
      fetchData();
      const interval = setInterval(() => {
        if (isMounted.current) fetchData(true);
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [dateRange, selectedEmpleado, isAdmin]);
  const getSmartLocationLabel = row => {
    if (!row.proyecto_id) {
      return "Taller / Nave Central";
    }
    const label = row.ubicacion_nombre || '';
    if (!label || label.trim() === '') {
      return "Proyecto sin nombre";
    }
    return label;
  };
  const uniqueLocations = useMemo(() => {
    const locs = new Set();
    rawData.forEach(r => {
      const smartLabel = getSmartLocationLabel(r);
      if (smartLabel) locs.add(smartLabel);
    });
    return Array.from(locs).sort();
  }, [rawData]);
  const resolveDisplayName = row => {
    if (row.empleado_id && employeesMap[row.empleado_id]) return employeesMap[row.empleado_id].name;
    return row.empleado_nombre || row.empleado_id_txt || 'Desconocido';
  };
  const filteredRecords = useMemo(() => {
    let data = rawData;

    // 0. MANDATORY OVERTIME FILTER (Already in query, but good for safety if rawData changes source)
    data = data.filter(r => {
      const extras = Number(r.horas_extras || 0);
      const festivos = Number(r.horas_festivo || 0);
      return extras > 0 || festivos > 0;
    });
    if (selectedUbicacion && selectedUbicacion !== "all") {
      data = data.filter(r => getSmartLocationLabel(r) === selectedUbicacion);
    }
    Object.entries(colFilters).forEach(([key, filter]) => {
      if (!filter || filter.value === undefined || filter.value === null || filter.value === '' || filter.value === 'all' || typeof filter.value === 'object' && !filter.value.min && !filter.value.max) {
        return;
      }
      if (key === 'dia') {
        const dateStr = filter.value.toLowerCase();
        data = data.filter(r => {
          const formatted = r.dia ? format(parseISO(r.dia), 'dd/MM/yyyy') : '';
          return formatted.includes(dateStr);
        });
      } else if (key === 'empleado') {
        // Column filter logic here, but currently unused as we removed the UI trigger for it
        const searchStr = filter.value.toLowerCase();
        data = data.filter(r => {
          const name = resolveDisplayName(r).toLowerCase();
          return name.includes(searchStr);
        });
      } else if (key === 'ubicacion_nombre') {
        if (filter.value !== 'all') {
          data = data.filter(r => getSmartLocationLabel(r) === filter.value);
        }
      } else if (['horas_normales', 'horas_extras', 'horas_festivo', 'horas_total'].includes(key)) {
        const min = filter.value.min ? parseFloat(filter.value.min) : -Infinity;
        const max = filter.value.max ? parseFloat(filter.value.max) : Infinity;
        data = data.filter(r => {
          const val = Number(r[key] || 0);
          return val >= min && val <= max;
        });
      }
    });
    return data;
  }, [rawData, selectedUbicacion, colFilters, employeesMap]);

  // --- Dynamic Totals & Cost Calculation ---
  const {
    totals,
    summaryStats
  } = useMemo(() => {
    let tNormal = 0;
    let tExtra = 0;
    let tFestivo = 0;
    let tTotal = 0;
    let sumLaborales = 0;
    let sumFestivos = 0;
    let totalCost = 0;
    let costLaborales = 0;
    let costFestivos = 0;
    filteredRecords.forEach(row => {
      // Basic totals
      tNormal += Number(row.horas_normales) || 0;
      const hExtra = Number(row.horas_extras) || 0;
      const hFestivo = Number(row.horas_festivo) || 0;
      tExtra += hExtra;
      tFestivo += hFestivo;
      tTotal += Number(row.horas_total) || 0;

      // Summary Cards Calculation
      // Logic: Laboral = row.tipo_dia is 'LABORAL'
      // Logic: Festivo/Finde = row.tipo_dia is 'FESTIVO' or 'FIN_SEMANA'

      const empData = employeesMap[row.empleado_id] || {};
      const empRol = (empData.rol || 'tecnico').toLowerCase();
      const empEmail = (empData.email || '').toLowerCase();
      const rRates = ratesMap[empRol] || {};

      let rateExtra = rRates['extra_laborable'] || 0;
      let rateFestivo = rRates['extra_festivo'] || 0;

      // SPECIFIC RATES FOR FRAN
      if (empEmail === 'fran@orkaled.com') {
        rateExtra = 17.40;
        rateFestivo = 30.45;
      }

      // Cost Calculation
      if (row.tipo_dia === 'FESTIVO' || row.tipo_dia === 'FIN_SEMANA') {
        const dailyTotalSpecial = hExtra + hFestivo;
        sumFestivos += dailyTotalSpecial;
        const cost = dailyTotalSpecial * rateFestivo;
        totalCost += cost;
        costFestivos += cost;
      } else {
        sumLaborales += hExtra;
        const costExtra = hExtra * rateExtra;
        totalCost += costExtra;
        costLaborales += costExtra;
        if (hFestivo > 0) {
          sumFestivos += hFestivo;
          const costFest = hFestivo * rateFestivo;
          totalCost += costFest;
          costFestivos += costFest;
        }
      }
    });
    const stats = {
      laborables: sumLaborales,
      festivos: sumFestivos,
      cost: totalCost,
      costLaborales,
      costFestivos
    };

    return {
      totals: {
        normal: tNormal,
        extra: tExtra,
        festivo: tFestivo,
        total: tTotal
      },
      summaryStats: stats
    };
  }, [filteredRecords, employeesMap, ratesMap]);
  const updateColFilter = (key, value) => {
    setColFilters(prev => {
      const newFilters = {
        ...prev
      };
      if (value === null || value === undefined || value === '' || value === 'all' || typeof value === 'object' && !value.min && !value.max) {
        delete newFilters[key];
      } else {
        newFilters[key] = {
          value
        };
      }
      return newFilters;
    });
  };
  const clearAllFilters = () => {
    if (isAdmin && !employeeId) setSelectedEmpleado("ALL");
    setSelectedUbicacion("all");
    setColFilters({});
    // Reset to current month
    setSelectedMonth(String(getMonth(new Date()) + 1));
    setSelectedYear(String(getYear(new Date())));
    fetchData();
  };
  const getFilterCount = () => Object.keys(colFilters).length;
  const handleRowClick = row => {
    const params = new URLSearchParams();
    if (row.empleado_id) params.append('empleado_id', row.empleado_id);
    if (row.dia) params.append('fecha', row.dia);
    navigate(`/personal/fichajes-admin?${params.toString()}`);
  };

  // --- CRUD Handlers ---
  const handleAddNew = () => {
    setEditingRecord(null);
    setCrudModalOpen(true);
  };
  const handleEdit = record => {
    setEditingRecord(record);
    setCrudModalOpen(true);
  };
  const handleDeleteRequest = record => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };
  const confirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      const {
        error
      } = await supabase.from('control_horario_extras').delete().eq('empleado_id', recordToDelete.empleado_id).eq('dia', recordToDelete.dia);
      if (error) throw error;
      toast({
        title: "Eliminado",
        description: "El registro ha sido eliminado correctamente."
      });
      fetchData();
    } catch (err) {
      console.error("Delete error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el registro."
      });
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };
  const ColumnHeader = ({
    title,
    columnId,
    type,
    options = []
  }) => {
    const isActive = !!colFilters[columnId];
    const currentValue = colFilters[columnId]?.value;
    return <div className="flex items-center gap-2">
      <span className="truncate">{title}</span>
      <Popover>
        <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className={cn("h-6 w-6", isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}>
            <Filter className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3" align="start" onClick={e => e.stopPropagation()}>
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Filtrar por {title}</h4>

            {type === 'text' && <Input placeholder={`Buscar ${title}...`} value={currentValue || ''} onChange={e => updateColFilter(columnId, e.target.value)} className="h-8" />}

            {type === 'select' && <Select value={currentValue || 'all'} onValueChange={val => updateColFilter(columnId, val)}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {options.map((opt, i) => <SelectItem key={i} value={opt || 'sin_valor'}>{opt || 'Sin Valor'}</SelectItem>)}
              </SelectContent>
            </Select>}

            {type === 'number' && <div className="flex gap-2">
              <Input placeholder="Min" type="number" className="h-8" value={currentValue?.min || ''} onChange={e => updateColFilter(columnId, {
                ...currentValue,
                min: e.target.value
              })} />
              <Input placeholder="Max" type="number" className="h-8" value={currentValue?.max || ''} onChange={e => updateColFilter(columnId, {
                ...currentValue,
                max: e.target.value
              })} />
            </div>}

            {isActive && <Button variant="ghost" size="sm" onClick={() => updateColFilter(columnId, null)} className="w-full h-8 mt-2 text-red-500 hover:text-red-700 hover:bg-red-50">
              <X className="h-3 w-3 mr-2" /> Limpiar filtro
            </Button>}
          </div>
        </PopoverContent>
      </Popover>
    </div>;
  };

  // Check if we should display Fran's special rates in labels
  // This depends on whether the current user context or selected filter is strictly Fran
  const currentUserEmail = user?.email?.toLowerCase();
  const selectedEmpEmail = employeesMap[selectedEmpleado]?.email?.toLowerCase();
  const showFranRates = currentUserEmail === 'fran@orkaled.com' || selectedEmpEmail === 'fran@orkaled.com';

  const labelRateNormal = showFranRates ? '17,40€/hora' : '14,19€/hora';
  const labelRateFestivo = showFranRates ? '30,45€/hora' : '24,83€/hora';

  return <div className={cn("w-full animate-in fade-in duration-500", !isEmbedded ? "p-6" : "", className)}>
    <div className={cn("w-full mx-auto flex flex-col gap-6", !isEmbedded ? "w-full" : "")}>

      {/* Header & Controls */}
      <div className="flex flex-col gap-4">
        {/* Upper Section Header */}
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium">Resumen Mensual de Horas Extras</h3>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
            <div className="flex gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px] bg-background border-input shadow-sm">
                  <CalendarIcon className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px] bg-background border-input shadow-sm">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* UPPER SUMMARY CARDS (DESGLOSE & VALORACION) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-300">
          {/* Box 1: Desglose */}
          <Card className="shadow-sm border border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Desglose de Horas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50/80 dark:bg-slate-950/30 rounded-lg">
                <span className="text-sm font-medium">Laborables = {labelRateNormal}</span>
                <span className="font-mono font-bold text-lg text-slate-700 dark:text-slate-300">
                  {formatDecimalToTime(summaryStats.laborables)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-amber-50/80 dark:bg-amber-950/30 rounded-lg border border-amber-100 dark:border-amber-900/50">
                <span className="text-sm font-medium text-amber-900 dark:text-amber-400">Festivos / Fin de Sem. = {labelRateFestivo}</span>
                <span className="font-mono font-bold text-lg text-amber-700 dark:text-amber-400">
                  {formatDecimalToTime(summaryStats.festivos)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Box 2: Valoracion */}
          <Card className="shadow-sm border border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Valoración Económica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Importe Laborables:</span>
                <span>{formatCurrency(summaryStats.costLaborales)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Importe Festivos:</span>
                <span>{formatCurrency(summaryStats.costFestivos)}</span>
              </div>

              <div className="pt-4 border-t mt-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">Total Acumulado Mes</span>
                  <div className="flex items-center gap-2 text-primary font-bold text-2xl">
                    <Euro className="w-6 h-6" />
                    {formatCurrency(summaryStats.cost).replace('€', '').trim()} <span className="text-sm">€</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LOWER SUMMARY CARDS */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-2">
          <SummaryCard title="Extras (Laborables)" value={formatDecimalToTime(summaryStats.laborables)} icon={Briefcase} colorClass="text-amber-600 dark:text-amber-400" subtitle="Lunes a Viernes (No festivos)" />
          <SummaryCard title="Extras (Sábados y Festivos)" value={formatDecimalToTime(summaryStats.festivos)} icon={CalendarOff} colorClass="text-purple-600 dark:text-purple-400" subtitle="Fines de semana y días festivos" />
          <SummaryCard title="Coste Total Estimado" value={formatCurrency(summaryStats.cost)} icon={Wallet} colorClass="text-emerald-600 dark:text-emerald-400" subtitle="Calculado según tarifas por rol" />
        </div>
      </div>

      {/* Table Header & Controls (Lower Section) */}
      <div className={cn("flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mt-4 bg-muted/10 border rounded-xl p-4")}>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Detalle de Registros</h3>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          {isAdmin && <Button onClick={handleAddNew} className="bg-primary hover:bg-primary/90 text-white shadow-sm h-8 text-xs" size="sm">
            <Plus className="w-3 h-3 mr-2" />
            Nuevo Registro
          </Button>}

          {getFilterCount() > 0 && <Badge variant="secondary" className="mr-2">
            {getFilterCount()} filtros
          </Badge>}
          <Button variant="outline" size="sm" onClick={clearAllFilters} title="Limpiar filtros" className="h-8 text-xs">
            <FilterX className="h-3 w-3 mr-2" />
            Limpiar
          </Button>
          <Button onClick={() => fetchData()} variant="default" size="sm" className="h-8 min-w-[90px] text-xs" disabled={isRefetching}>
            {isRefetching ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <RefreshCw className="h-3 w-3 mr-2" />}
            Actualizar
          </Button>
        </div>
      </div>

      {/* Show Global Filters Bar ONLY if NOT embedded (admin dashboard view) */}
      {!isEmbedded && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
        {/* Re-using the same date range state, but visualizing it differently if needed */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">Rango Exacto</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal bg-background hover:bg-accent/50 border-input", !dateRange && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                {dateRange?.from ? dateRange.to ? <>
                  {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                </> : format(dateRange.from, "dd/MM/yyyy") : <span>Seleccionar fechas</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={es} />
            </PopoverContent>
          </Popover>
        </div>

        {/* Location Filter */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">Ubicación / Proyecto</Label>
          <Select value={selectedUbicacion} onValueChange={setSelectedUbicacion}>
            <SelectTrigger className="bg-background border-input">
              <SelectValue placeholder="Todas las ubicaciones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ubicaciones</SelectItem>
              {uniqueLocations.map((loc, idx) => <SelectItem key={idx} value={loc}>{loc}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Employee Filter - Moved here */}
        {isAdmin && !employeeId && <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">Empleado</Label>
          <Select value={selectedEmpleado} onValueChange={val => setSelectedEmpleado(val)} disabled={loading && filterEmployees.length === 0}>
            <SelectTrigger className="w-full bg-background border-input">
              <div className="flex items-center gap-2 truncate">
                {selectedEmpleado === "ALL" ? <Users className="w-4 h-4 text-muted-foreground" /> : <User className="w-4 h-4 text-primary" />}
                <SelectValue placeholder="Filtrar por empleado..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="font-semibold text-primary">
                Todos los empleados
              </SelectItem>
              <div className="h-px bg-border my-1 mx-1" />
              {filterEmployees.length === 0 ? <div className="p-2 text-sm text-muted-foreground text-center">
                {loading ? <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
                </span> : "No employees found."}
              </div> : filterEmployees.map(emp => <SelectItem key={emp.value} value={emp.value}>
                <span className={cn(emp.isManager ? "font-bold text-foreground" : "text-muted-foreground")}>
                  {emp.label}
                </span>
              </SelectItem>)}
            </SelectContent>
          </Select>
        </div>}
      </div>}

      {/* Table Card */}
      <Card className="shadow-lg border-0 ring-1 ring-border/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/60">
                  <TableHead className="min-w-[140px]">
                    <ColumnHeader title="Fecha" columnId="dia" type="text" />
                  </TableHead>
                  <TableHead className="min-w-[200px]">
                    Empleado
                  </TableHead>
                  <TableHead className="min-w-[200px]">
                    <ColumnHeader title="Obra / Ubicación" columnId="ubicacion_nombre" type="select" options={uniqueLocations} />
                  </TableHead>

                  <TableHead className="min-w-[140px]">
                    <div className="flex items-center gap-2">Horario (Madrid)</div>
                  </TableHead>

                  <TableHead className="text-right bg-blue-50/30 dark:bg-blue-900/10 min-w-[140px]">
                    <div className="flex justify-end">
                      <ColumnHeader title="Normales" columnId="horas_normales" type="number" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right bg-amber-50/30 dark:bg-amber-900/10 min-w-[140px]">
                    <div className="flex justify-end">
                      <ColumnHeader title="Extras" columnId="horas_extras" type="number" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right bg-purple-50/30 dark:bg-purple-900/10 min-w-[140px]">
                    <div className="flex justify-end">
                      <ColumnHeader title="Festivo" columnId="horas_festivo" type="number" />
                    </div>
                  </TableHead>

                  <TableHead className="text-right min-w-[140px] bg-muted/20">
                    <div className="flex justify-end">
                      <ColumnHeader title="Total" columnId="horas_total" type="number" />
                    </div>
                  </TableHead>

                  <TableHead className="min-w-[120px] text-xs uppercase text-muted-foreground font-bold text-center border-l border-border/50">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow>
                  <TableCell colSpan={9} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-3">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <span className="text-sm font-medium">Cargando registros...</span>
                    </div>
                  </TableCell>
                </TableRow> : filteredRecords.length === 0 ? <TableRow>
                  <TableCell colSpan={9} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-lg font-medium text-foreground/80">No hay registros de horas extras</p>
                      <p className="text-sm mt-1">
                        No se encontraron horas extras o festivas para los filtros seleccionados.<br />
                        Intenta ampliar el rango de fechas.
                      </p>
                    </div>
                  </TableCell>
                </TableRow> : <>
                  {filteredRecords.map((row, idx) => {
                    const hasNote = notesMap[`${row.empleado_id}_${row.dia}`];
                    const horario = parseHorarioMadrid(row);
                    return <TableRow key={idx} className="group border-b border-border/40 cursor-pointer hover:bg-muted/50 transition-colors duration-200" onClick={() => handleRowClick(row)}>
                      <TableCell className="font-medium whitespace-nowrap text-foreground/90">
                        {row.dia ? format(parseISO(row.dia), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-foreground/90 block truncate max-w-[250px]" title={resolveDisplayName(row)}>
                          {resolveDisplayName(row)}
                        </span>
                        <div className="md:hidden mt-1">
                          <Badge variant="outline" className={cn("text-xs font-normal", row.tipo_dia === 'FESTIVO' ? "border-purple-200 bg-purple-50 text-purple-700" : row.tipo_dia === 'FIN_SEMANA' ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-700")}>
                            {row.tipo_dia || 'LABORAL'}
                          </Badge>
                        </div>
                      </TableCell>

                      {/* Location Badge & Notes Icon */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <LocationBadge label={getSmartLocationLabel(row)} onClick={row.proyecto_id ? e => {
                            e.stopPropagation();
                            navigate(`/gestion/obras/${row.proyecto_id}`);
                          } : undefined} />
                          {hasNote && <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-transparent rounded-full" onClick={e => {
                            e.stopPropagation();
                            handleRowClick(row);
                          }} title="Ver notas/observaciones">
                            <MessageCircle className="w-5 h-5 text-[#FF9800] fill-[#FF9800]" />
                          </Button>}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-green-600 font-bold whitespace-nowrap">
                            IN: {horario.in}
                          </span>
                          <span className="text-red-500 font-medium whitespace-nowrap">
                            OUT: {horario.out}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-mono text-sm bg-blue-50/10 group-hover:bg-blue-50/20 text-blue-700 dark:text-blue-300">
                        {formatDecimalToTime(row.horas_normales)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm bg-amber-50/10 group-hover:bg-amber-50/20 text-amber-700 dark:text-amber-300 font-bold">
                        {formatDecimalToTime(row.horas_extras)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm bg-purple-50/10 group-hover:bg-purple-50/20 text-purple-700 dark:text-purple-300 font-bold">
                        {formatDecimalToTime(row.horas_festivo)}
                      </TableCell>

                      <TableCell className="text-right font-mono text-sm font-bold bg-muted/10 group-hover:bg-muted/20">
                        {formatDecimalToTime(row.horas_total)}
                      </TableCell>

                      <TableCell className="text-center border-l border-border/50 bg-muted/5">
                        {isAdmin && <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                            <DropdownMenuItem onClick={e => {
                              e.stopPropagation();
                              handleEdit(row);
                            }}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar registro
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={e => {
                              e.stopPropagation();
                              handleDeleteRequest(row);
                            }} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar registro
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>}
                      </TableCell>
                    </TableRow>;
                  })}

                  <TableRow className="bg-secondary/50 hover:bg-secondary/60 border-t-2 border-border font-bold">
                    <TableCell colSpan={4} className="text-right pr-6 py-4 text-base uppercase tracking-wider text-muted-foreground">
                      Totales Generales:
                    </TableCell>
                    <TableCell className="text-right font-mono text-base text-blue-700 dark:text-blue-400 py-4">
                      {formatDecimalToTime(totals.normal)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-base text-amber-700 dark:text-amber-400 py-4">
                      {formatDecimalToTime(totals.extra)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-base text-purple-700 dark:text-purple-400 py-4">
                      {formatDecimalToTime(totals.festivo)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-base text-foreground bg-muted/30 py-4 border-l border-border/50">
                      {formatDecimalToTime(totals.total)}
                    </TableCell>
                    <TableCell className="bg-muted/5 border-l border-border/50"></TableCell>
                  </TableRow>
                </>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center text-xs text-muted-foreground px-2">
        <span>Mostrando {filteredRecords.length} registros</span>
        <span>Actualizado: {format(new Date(), 'HH:mm:ss')}</span>
      </div>

      {/* ✅ SECCIÓN FONTANERÍA — Solo visible para fran@orkaled.com y admins */}
      <FontaneriaSeccion />

    </div>

    {/* Modals */}
    <OvertimeCrudModal isOpen={isCrudModalOpen} onClose={() => setCrudModalOpen(false)} onSave={fetchData} initialData={editingRecord} employeesMap={employeesMap} projects={projectsList} />

    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción eliminará permanentemente el registro de horas para {recordToDelete ? employeesMap[recordToDelete.empleado_id]?.name || 'Empleado' : ''} del día {recordToDelete ? format(parseISO(recordToDelete.dia), 'dd/MM/yyyy') : ''}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
