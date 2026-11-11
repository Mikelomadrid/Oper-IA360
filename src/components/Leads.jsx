/**
 * Leads.jsx
 * 
 * FILTER PERSISTENCE PATTERN:
 * This component uses URL Query Parameters (via useSearchParams) as the single source of truth 
 * for all list filters (status, category, search, tab, partida, view, empleado, etc.).
 * 
 * - State is derived directly from searchParams on render.
 * - User interactions (filtering) update the URL using setSearchParams.
 * - This ensures that refreshing the page or sharing the URL preserves the exact view state.
 * - Navigation to Detail View propagates these query parameters so the "Back" button
 *   can restore the exact same list state.
 * 
 * VISTA KANBAN (por defecto):
 * - Toggle Lista / Kanban (persistido en URL param 'view'). Por defecto: kanban.
 * - Columnas: NUEVO, VISITA AGENDADA, VISITADO, PRESUPUESTADO, ACEPTADO + columna HISTORIAL.
 * - Drag & drop nativo HTML5: arrastrar una tarjeta a otra columna actualiza
 *   el campo 'estado' en Supabase (los triggers de notificación/auditoría se disparan solos).
 * - Actualización optimista local + realtime ya existente como respaldo.
 *
 * NUEVO - COLUMNA HISTORIAL (Kanban):
 * - Última columna del tablero: leads con archivado = true, agrupados por mes
 *   (usando archivado_at). Mismo patrón que el Historial de Cobradas de Obras:
 *   lista de meses con contador -> clic -> tarjetas de ese mes -> botón volver.
 * - Vista Lista mantiene la pestaña "Archivo" tal cual estaba (LeadsArchiveView).
 *
 * NUEVO - FILTRO POR PERSONAL ASIGNADO:
 * - Param URL 'empleado' (guarda el auth_user_id del empleado seleccionado).
 * - Desplegable con el personal de campo activo (roles 'tecnico' y 'encargado').
 * - Cada lead lleva 'assigned_user_ids' (auth_user_id de leads_asignaciones).
 *   Al filtrar se muestran TODOS los leads donde el empleado esté asignado,
 *   tanto si está solo como acompañado por otros empleados en el mismo lead.
 * - Fallback: si el lead no tiene filas en leads_asignaciones pero sí
 *   empleado_asignado_id (empleados.id), se mapea a su auth_user_id.
 * - Aplica tanto en vista Lista como en vista Kanban.
 *
 * NUEVO - FILTRO DE ESTADO MULTI-SELECCIÓN:
 * - Param URL 'status' ahora admite VARIOS estados separados por comas (ej: "nuevo,visitado").
 * - Desplegable con checkbox por cada estado + botón "Marcar todos"/"Desmarcar todos".
 * - Solo aplica en vista Lista (en Kanban las columnas ya son los estados).
 *
 * AVISOS DE LEAD:
 * - El sombreado naranja es individual por usuario: aparece si el lead tiene
 *   actividad posterior a su última lectura.
 * - El usuario que genera la actividad queda marcado como leído automáticamente.
 *
 * FIX (móvil) - BOTONES EDITAR/ELIMINAR EN TARJETAS KANBAN:
 * - Antes, los botones de Editar/Eliminar de cada tarjeta solo se mostraban con
 *   "group-hover" (pasar el ratón por encima). En móvil no existe hover, así que
 *   estos botones eran invisibles/imposibles de pulsar de forma fiable en pantallas
 *   táctiles. Esto afectaba a CUALQUIER empleado (técnico, encargado, etc.) que
 *   tuviera un lead asignado y necesitara editarlo o cambiar su estado desde el móvil.
 * - Ahora los botones son siempre visibles en pantallas pequeñas (por debajo del
 *   breakpoint 'md' de Tailwind) y se mantienen ocultos-hasta-hover únicamente en
 *   escritorio (md y superior), donde el ratón sí permite ese patrón.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, ArrowUpDown, Edit, Trash2, MapPin,
  BarChart3, ChevronDown, ChevronUp, X, Users, Archive, Tag, Wrench,
  List, LayoutGrid, GripVertical, Calendar, Filter, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { formatDate, cn } from '@/lib/utils';
import { FORM_STATUS_OPTIONS, getStatusLabel, estadoMap } from '@/utils/leadStatus';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams, useLocation } from 'react-router-dom';
import { format as formatDateFns, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// Import modals & views
import AddLeadModalV2 from '@/components/AddLeadModalV2.jsx';
import EditLeadModal from '@/components/EditLeadModal.jsx';
import LeadsStatistics from '@/components/LeadsStatistics.jsx';
import LeadsArchiveView from '@/components/LeadsArchiveView.jsx';

// Hook for responsive check
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth < 768;
    return false;
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

// Columnas del tablero Kanban (en orden de pipeline, solo estados activos)
const KANBAN_COLUMNS = ['nuevo', 'visita_agendada', 'visitado', 'presupuestado'];

const Leads = ({ navigate }) => {
  const { sessionRole, user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const mobileKanbanOnly = isMobile && ['tecnico', 'encargado'].includes(sessionRole?.rol);

  // URL Param State Management
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Derived state from URL params
  // Filtro de estado MULTI-SELECCIÓN: se guarda en la URL como lista separada por comas
  // (ej: ?status=nuevo,visitado). Array vacío = sin filtro (se muestran todos).
  const statusFilterRaw = searchParams.get('status');
  const statusFilter = statusFilterRaw ? statusFilterRaw.split(',').filter(Boolean) : [];

  const selectedCategoryKey = searchParams.get('category') || null;
  const conversionFilter = searchParams.get('conversion') || null;
  const partidaFilter = searchParams.get('partida') || 'all'; // Filtro por partida
  const empleadoFilter = searchParams.get('empleado') || 'all'; // NUEVO: filtro por personal asignado (auth_user_id)
  const activeTab = searchParams.get('tab') || 'activos';
  const effectiveActiveTab = mobileKanbanOnly ? 'activos' : activeTab;
  const openColumnParam = searchParams.get('open') || null;
  const urlSearchTerm = searchParams.get('q') || '';
  const filterParam = searchParams.get('filter') || null;
  const viewMode = searchParams.get('view') || 'kanban'; // ACTUALIZADO: por defecto Kanban. 'lista' | 'kanban'
  const effectiveViewMode = mobileKanbanOnly ? 'kanban' : viewMode;

  // Local state for search input to prevent lag/excessive URL updates
  const [localSearchTerm, setLocalSearchTerm] = useState(urlSearchTerm);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partidas, setPartidas] = useState([]); // Lista de partidas para el filtro
  const [empleadosList, setEmpleadosList] = useState([]); // NUEVO: personal de campo para el filtro de asignados

  // NUEVO: Leads archivados (para la columna HISTORIAL del Kanban)
  const [archivedLeads, setArchivedLeads] = useState([]);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  // NUEVO: Estados para el drag & drop del Kanban
  const [draggedLeadId, setDraggedLeadId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const justDraggedRef = useRef(false); // Evita que el "drop" dispare el click de la tarjeta

  // En móvil el Kanban funciona como un acordeón para evitar una pantalla interminable.
  const [openMobileKanbanColumn, setOpenMobileKanbanColumn] = useState(openColumnParam);

  useEffect(() => {
    setOpenMobileKanbanColumn(openColumnParam);
  }, [openColumnParam]);

  const setOpenKanbanColumn = (column) => {
    setOpenMobileKanbanColumn(column);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (column) next.set('open', column);
      else next.delete('open');
      return next;
    }, { replace: true });
  };

  // NUEVO: Qué mes está abierto dentro de la columna HISTORIAL del Kanban
  const [kanbanHistorialMonth, setKanbanHistorialMonth] = useState(() => {
    try { return localStorage.getItem('leads_kanban_historial_mes_abierto') || null; } catch { return null; }
  });

  // Debounce search updates to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchTerm !== urlSearchTerm) {
        updateFilter('q', localSearchTerm || null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearchTerm, urlSearchTerm]);

  // Sync local state if URL changes externally (e.g. back button)
  useEffect(() => {
    if (urlSearchTerm !== localSearchTerm) {
      setLocalSearchTerm(urlSearchTerm);
    }
  }, [urlSearchTerm]);

  // Helper to update specific param while keeping others
  const updateFilter = (key, value) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (value === null || value === 'all') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
      return newParams;
    });
  };

  // NUEVO: Establece la lista completa de estados seleccionados (usado por
  // los checkboxes y por "Marcar todos" / "Desmarcar todos" / "Limpiar").
  const setStatusFilterMulti = (arr) => {
    updateFilter('status', arr.length > 0 ? arr.join(',') : null);
  };

  const handleTabChange = (value) => {
    updateFilter('tab', value);
  };

  // ACTUALIZADO: Cambiar entre vista Lista y Kanban (persistido en URL).
  // Kanban es ahora el valor por defecto, así que se omite de la URL cuando
  // se selecciona (URLs limpias); 'lista' sí se escribe explícitamente.
  const handleViewChange = (mode) => {
    updateFilter('view', mode === 'kanban' ? null : mode);
  };

  // --- ROLE BASED PERMISSIONS ---
  const userRole = sessionRole?.rol;
  const canViewStats = useMemo(() => {
    return ['admin', 'encargado'].includes(userRole);
  }, [userRole]);

  // Statistics Toggle State (Local Preference)
  const [showStats, setShowStats] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('leads_show_stats') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (canViewStats) {
      localStorage.setItem('leads_show_stats', showStats);
    }
  }, [showStats, canViewStats]);

  // Fetch partidas para el filtro
  const fetchPartidas = async () => {
    try {
      const { data, error } = await supabase
        .from('partidas_catalogo')
        .select('key, label')
        .eq('activo', true)
        .order('label');
      
      if (error) throw error;
      setPartidas(data || []);
    } catch (error) {
      console.error('Error fetching partidas:', error);
    }
  };

  // NUEVO: Fetch personal de campo para el filtro de asignados.
  // Usa la vista v_empleados_selector. Solo roles de campo (tecnico/encargado) y activos.
  // El valor del filtro es auth_user_id porque leads_asignaciones.usuario_id -> empleados.auth_user_id.
  const fetchEmpleados = async () => {
    try {
      const { data, error } = await supabase
        .from('v_empleados_selector')
        .select('auth_user_id, display_name, rol, activo')
        .in('rol', ['tecnico', 'encargado'])
        .eq('activo', true)
        .order('display_name');

      if (error) throw error;
      // Descartar registros sin auth_user_id (no se podrían cruzar con leads_asignaciones)
      setEmpleadosList((data || []).filter(e => e.auth_user_id));
    } catch (error) {
      console.error('Error fetching empleados:', error);
    }
  };

  const fetchLeads = async () => {
    if (!sessionRole) return;

    try {
      setLoading(true);

      let query = supabase
        .from('leads')
        .select('*, categoria:categoria_id(nombre, codigo)')
        .order('created_at', { ascending: false });

      if (sessionRole.rol === 'tecnico') {
        const ACTIVE_STATUSES = [
          'nuevo', 'visita_agendada',
          'visitado', 'presupuestado', 'aceptado'
        ];
        query = query.in('estado', ACTIVE_STATUSES);
      }

      const { data: leadsData, error: leadsError } = await query;
      if (leadsError) throw leadsError;

      const leadIds = leadsData.map(l => l.id);
      let assignmentsMap = {};
      let readsMap = {};

      if (leadIds.length > 0) {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('leads_asignaciones')
          .select('lead_id, usuario_id')
          .in('lead_id', leadIds);

        if (!assignmentsError && assignmentsData) {
          assignmentsData.forEach(a => {
            if (!assignmentsMap[a.lead_id]) assignmentsMap[a.lead_id] = new Set();
            assignmentsMap[a.lead_id].add(a.usuario_id);
          });
        }

        if (user?.id) {
          const { data: readsData, error: readsError } = await supabase
            .from('lead_lecturas')
            .select('lead_id, visto_at')
            .eq('usuario_id', user.id)
            .in('lead_id', leadIds);

          if (!readsError && readsData) {
            readsData.forEach(read => { readsMap[read.lead_id] = read.visto_at; });
          }
        }
      }

      // NUEVO: Cargar empleados para resolver los nombres de los asignados.
      // leads_asignaciones.usuario_id -> empleados.auth_user_id
      // leads.empleado_asignado_id    -> empleados.id
      let empByAuthId = {};
      let empById = {};
      let empIdToAuthId = {}; // NUEVO: empleados.id -> auth_user_id (para el fallback del filtro)
      const { data: empleadosData, error: empleadosError } = await supabase
        .from('empleados')
        .select('id, auth_user_id, nombre, apellidos');

      if (!empleadosError && empleadosData) {
        empleadosData.forEach(emp => {
          const displayName = `${emp.nombre || ''} ${emp.apellidos || ''}`.trim() || 'Sin nombre';
          if (emp.auth_user_id) {
            empByAuthId[emp.auth_user_id] = displayName;
            empIdToAuthId[emp.id] = emp.auth_user_id; // NUEVO
          }
          empById[emp.id] = displayName;
        });
      }

      const enrichedLeads = leadsData.map(lead => {
        const assignedSet = assignmentsMap[lead.id] || new Set();
        let count = assignedSet.size;

        // NUEVO: IDs (auth_user_id) de los asignados — se usan para el filtro de personal.
        let assignedUserIds = [...assignedSet];

        // NUEVO: Resolver nombres de asignados
        let assignedNames = [...assignedSet]
          .map(uid => empByAuthId[uid])
          .filter(Boolean);

        // Fallback: si no hay asignaciones en leads_asignaciones, usar empleado_asignado_id
        if (assignedNames.length === 0 && lead.empleado_asignado_id && empById[lead.empleado_asignado_id]) {
          assignedNames = [empById[lead.empleado_asignado_id]];
        }

        // NUEVO: Mismo fallback para los IDs del filtro (empleado_asignado_id -> auth_user_id)
        if (assignedUserIds.length === 0 && lead.empleado_asignado_id && empIdToAuthId[lead.empleado_asignado_id]) {
          assignedUserIds = [empIdToAuthId[lead.empleado_asignado_id]];
        }

        return {
          ...lead,
          lead_read_at: readsMap[lead.id] || null,
          nombre_cliente: lead.nombre_empresa || lead.nombre_contacto,
          fecha: lead.created_at,
          assignments_count: count > 0 ? count : (lead.empleado_asignado_id ? 1 : 0),
          assigned_names: assignedNames,
          assigned_user_ids: assignedUserIds, // NUEVO: para el filtro por personal asignado
          category_code: lead.categoria?.codigo || lead.categoria || 'DESCONOCIDO',
          category_label: lead.categoria?.nombre || 'Desconocido'
        };
      });

      setLeads(enrichedLeads || []);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los leads.',
      });
    } finally {
      setLoading(false);
    }
  };

  // NUEVO: leads archivados para la columna HISTORIAL del Kanban.
  // Independiente del filtro por rol de fetchLeads (igual que la pestaña Archivo),
  // para que el historial se vea completo sin importar el rol.
  const fetchArchivedLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*, categoria:categoria_id(nombre, codigo)')
        .eq('archivado', true)
        .order('archivado_at', { ascending: false });

      if (error) throw error;

      const enriched = (data || []).map(lead => ({
        ...lead,
        nombre_cliente: lead.nombre_empresa || lead.nombre_contacto,
        category_label: lead.categoria?.nombre || 'Desconocido',
      }));

      setArchivedLeads(enriched);
    } catch (error) {
      console.error('Error fetching archived leads:', error);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchArchivedLeads(); // NUEVO
    fetchPartidas(); // Cargar partidas al inicio
    fetchEmpleados(); // NUEVO: Cargar personal para el filtro de asignados
  }, [sessionRole, canViewStats, user?.id]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('leads_realtime_v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_asignaciones' }, () => fetchLeads())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => { fetchLeads(); fetchArchivedLeads(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [canViewStats]);

  // Client-side filtering based on derived URL params
  const baseLeads = useMemo(() => {
    if (!urlSearchTerm) return leads;
    const lowerTerm = urlSearchTerm.toLowerCase();
    const match = (str) => str && str.toLowerCase().includes(lowerTerm);

    return leads.filter(lead =>
      match(lead.nombre_cliente) ||
      match(lead.nombre_contacto) ||
      match(lead.nombre_empresa) ||
      match(lead.email) ||
      match(lead.category_label) ||
      (lead.telefono && lead.telefono.includes(urlSearchTerm))
    );
  }, [leads, urlSearchTerm]);

  const getConversionGroup = (status) => {
    if (['aceptado'].includes(status)) return 'Ganado';
    if (['rechazado', 'cancelado'].includes(status)) return 'Perdido';
    return 'En Progreso';
  };

  const statsLeads = useMemo(() => {
    return baseLeads.filter(l => {
      // Filtro de estado MULTI-SELECCIÓN: si hay estados marcados, el lead tiene
      // que estar en alguno de ellos. Array vacío = sin filtro (se muestran todos).
      if (statusFilter.length > 0 && !statusFilter.includes(l.estado)) return false;

      if (selectedCategoryKey) {
        if (l.category_code !== selectedCategoryKey) return false;
      }

      if (conversionFilter) {
        const group = getConversionGroup(l.estado);
        if (group !== conversionFilter) return false;
      }

      // Filtro por partida
      if (partidaFilter !== 'all' && l.partida !== partidaFilter) return false;

      // NUEVO: Filtro por personal asignado.
      // Muestra el lead si el empleado seleccionado está dentro de los asignados,
      // esté solo o acompañado por otros empleados en el mismo lead.
      if (empleadoFilter !== 'all') {
        if (!(l.assigned_user_ids || []).includes(empleadoFilter)) return false;
      }

      if (filterParam === 'assigned') {
        if (l.empleado_asignado_id !== sessionRole?.empleadoId) return false;
      }

      return true;
    });
  }, [baseLeads, statusFilter, selectedCategoryKey, conversionFilter, partidaFilter, empleadoFilter, filterParam, sessionRole]);

  const tableLeads = useMemo(() => {
    // Los leads antiguos pueden tener archivado = NULL. Solo se consideran
    // archivados cuando el valor es true de forma explícita.
    return statsLeads.filter(l => l.archivado !== true);
  }, [statsLeads]);

  // NUEVO: Leads para el Kanban.
  // Aplica los mismos filtros (búsqueda, categoría, partida, personal asignado) EXCEPTO el
  // filtro de estado, porque en Kanban las columnas YA son los estados.
  const kanbanLeads = useMemo(() => {
    return baseLeads.filter(l => {
      if (l.archivado === true) return false;
      if (!KANBAN_COLUMNS.includes(l.estado)) return false;

      if (selectedCategoryKey) {
        if (l.category_code !== selectedCategoryKey) return false;
      }

      if (partidaFilter !== 'all' && l.partida !== partidaFilter) return false;

      // NUEVO: Filtro por personal asignado (mismo criterio que en la lista)
      if (empleadoFilter !== 'all') {
        if (!(l.assigned_user_ids || []).includes(empleadoFilter)) return false;
      }

      if (filterParam === 'assigned') {
        if (l.empleado_asignado_id !== sessionRole?.empleadoId) return false;
      }

      return true;
    });
  }, [baseLeads, selectedCategoryKey, partidaFilter, empleadoFilter, filterParam, sessionRole]);

  // NUEVO: Agrupar leads por estado para las columnas del Kanban
  const kanbanGroups = useMemo(() => {
    const groups = {};
    KANBAN_COLUMNS.forEach(col => { groups[col] = []; });
    kanbanLeads.forEach(lead => {
      if (groups[lead.estado]) groups[lead.estado].push(lead);
    });
    return groups;
  }, [kanbanLeads]);

  // NUEVO: Historial de leads archivados agrupado por mes (columna HISTORIAL del Kanban)
  const leadsHistorial = useMemo(() => {
    return archivedLeads.reduce((acc, lead) => {
      const dateStr = lead.archivado_at || lead.updated_at || lead.created_at;
      let date;
      try { date = parseISO(dateStr); } catch { date = new Date(); }
      const key = formatDateFns(date, 'MMMM yyyy', { locale: es });
      const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
      if (!acc[capitalizedKey]) acc[capitalizedKey] = [];
      acc[capitalizedKey].push(lead);
      return acc;
    }, {});
  }, [archivedLeads]);

  // UI Handlers updating URL params
  // NUEVO: handleStatusClick ahora ALTERNA (añade/quita) un estado dentro del
  // filtro multi-selección, en vez de sustituirlo. Lo usan tanto los checkboxes
  // como los clics en la gráfica de estadísticas.
  const handleStatusClick = (status) => {
    const next = statusFilter.includes(status)
      ? statusFilter.filter(s => s !== status)
      : [...statusFilter, status];

    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (next.length > 0) newParams.set('status', next.join(','));
      else newParams.delete('status');
      newParams.delete('conversion'); // Reset conversion when tocando el filtro de estado
      return newParams;
    });
  };

  const handleCategoryClick = (categoryKey) => {
    updateFilter('category', selectedCategoryKey === categoryKey ? null : categoryKey);
  };

  const handleConversionClick = (group) => {
    if (conversionFilter === group) {
      updateFilter('conversion', null);
    } else {
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.set('conversion', group);
        newParams.delete('status'); // Reset specific status when selecting funnel group
        return newParams;
      });
    }
  };

  // Handler para el filtro de partida
  const handlePartidaChange = (value) => {
    updateFilter('partida', value);
  };

  // NUEVO: Handler para el filtro de personal asignado
  const handleEmpleadoChange = (value) => {
    updateFilter('empleado', value);
  };

  const clearAllFilters = () => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams();
      // Mantener la vista actual (lista/kanban) al limpiar filtros
      const currentView = prev.get('view');
      if (currentView) newParams.set('view', currentView);
      return newParams;
    });
    setLocalSearchTerm('');
    toast({
      description: "Filtros limpiados. Mostrando todos los leads activos.",
      duration: 2000,
    });
  };

  // Incluir partidaFilter y empleadoFilter en la verificación
  const hasActiveFilters = statusFilter.length > 0 || selectedCategoryKey !== null || conversionFilter !== null || partidaFilter !== 'all' || empleadoFilter !== 'all' || urlSearchTerm !== '';

  const handleEdit = (id) => {
    setSelectedLeadId(id);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este lead?')) return;
    try {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Lead eliminado correctamente' });
      fetchLeads();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al eliminar' });
    }
  };

  // Un lead vuelve a estar pendiente cuando cambia después de la última lectura
  // individual del usuario. Sin fila de lectura, se considera pendiente.
  const isUnread = (lead) => {
    if (!lead.lead_read_at) return true;
    if (!lead.updated_at) return false;
    return new Date(lead.updated_at).getTime() > new Date(lead.lead_read_at).getTime();
  };

  // Marcar el lead como leído para el usuario actual
  const marcarComoVisto = async (id) => {
    if (!user?.id) return;
    const ahora = new Date().toISOString();
    // Optimista: quitar el resaltado al instante
    setLeads(prev => prev.map(l =>
      l.id === id ? { ...l, lead_read_at: ahora } : l
    ));
    try {
      const { error } = await supabase
        .from('lead_lecturas')
        .upsert({ lead_id: id, usuario_id: user.id, visto_at: ahora }, { onConflict: 'lead_id,usuario_id' });
      if (error) throw error;
    } catch (e) {
      console.error('Error marcando lead como visto:', e);
    }
  };

  // Navigates preserving query string so back button works perfectly
  const handleLeadClick = (id) => {
    const lead = leads.find(l => l.id === id);
    if (lead && isUnread(lead)) {
      marcarComoVisto(id);
    }
    navigate(`/crm/leads/${id}${location.search}`);
  };

  // ============================================================
  // NUEVO: LÓGICA DRAG & DROP DEL KANBAN
  // ============================================================

  const handleDragStart = (e, leadId) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverColumn(null);
    // Pequeño delay para que el click posterior al drag no abra el detalle
    justDraggedRef.current = true;
    setTimeout(() => { justDraggedRef.current = false; }, 150);
  };

  const handleColumnDragOver = (e, columnStatus) => {
    e.preventDefault(); // Necesario para permitir el drop
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnStatus) {
      setDragOverColumn(columnStatus);
    }
  };

  const handleColumnDragLeave = (e, columnStatus) => {
    // Solo limpiar si realmente salimos de la columna (no de un hijo)
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverColumn === columnStatus) {
      setDragOverColumn(null);
    }
  };

  const handleColumnDrop = async (e, newStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    setDragOverColumn(null);
    setDraggedLeadId(null);

    if (!leadId) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.estado === newStatus) return;

    const oldStatus = lead.estado;

    // 1. Actualización optimista local (la tarjeta cambia de columna al instante)
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, estado: newStatus } : l
    ));

    // 2. Actualización en Supabase (los triggers de notificación/auditoría se disparan solos)
    try {
      const { error } = await supabase
        .from('leads')
        .update({ estado: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: 'Estado actualizado',
        description: `"${lead.nombre_cliente || 'Lead'}" movido a ${getStatusLabel(newStatus)}.`,
        duration: 2500,
      });

      // NUEVO: si el cambio de estado disparó el auto-archivado (ej. aceptado/rechazado/cancelado),
      // refrescamos el historial para que aparezca en la columna HISTORIAL.
      fetchArchivedLeads();
    } catch (error) {
      // Revertir si falla
      setLeads(prev => prev.map(l =>
        l.id === leadId ? { ...l, estado: oldStatus } : l
      ));
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el estado del lead.',
      });
    }
  };

  const handleKanbanCardClick = (id) => {
    if (justDraggedRef.current) return; // No abrir detalle si venimos de un drag
    handleLeadClick(id);
  };

  const getStatusBadge = (status) => {
    const style = estadoMap[status] || estadoMap.nuevo;
    const label = getStatusLabel(status);

    return (
      <Badge variant="outline" className="border uppercase text-[10px] md:text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.text, borderColor: style.br }}>
        {label}
      </Badge>
    );
  };

  const renderAssignments = (count) => {
    if (count > 0) {
      return (
        <Badge variant="secondary" className="font-medium gap-1.5 px-2.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 transition-colors">
          <Users className="w-3.5 h-3.5" />
          {count}
        </Badge>
      );
    }
    return <span className="text-slate-400 text-xs italic">Sin asignar</span>;
  };

  // NUEVO: Mostrar nombres de los asignados (para tarjetas Kanban)
  const renderAssignedNames = (lead) => {
    const names = lead.assigned_names || [];

    if (names.length === 0) {
      return <span className="text-slate-400 text-xs italic">Sin asignar</span>;
    }

    return (
      <div className="flex flex-wrap gap-1 min-w-0">
        {names.map((name, idx) => (
          <Badge
            key={idx}
            variant="secondary"
            className="font-medium gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border-slate-200 text-[11px] max-w-full"
          >
            <Users className="w-3 h-3 shrink-0" />
            <span className="truncate">{name}</span>
          </Badge>
        ))}
      </div>
    );
  };

  const renderLeadName = (lead) => {
    if (lead.nombre_empresa && lead.nombre_empresa.trim() !== '') {
      return <span className="font-bold text-slate-900 leading-tight">{lead.nombre_empresa}</span>;
    }
    return <span className="font-bold text-slate-900 leading-tight">{lead.nombre_contacto || 'Sin nombre'}</span>;
  };

  const renderMobileLeadCard = (lead) => {
    const unread = isUnread(lead);

    return (
      <div
        key={lead.id}
        className={cn(
          'rounded-xl border bg-white p-3 shadow-sm transition-colors cursor-pointer',
          unread
            ? 'border-l-4 border-l-emerald-400 bg-emerald-50/70'
            : 'border-slate-200 hover:bg-slate-50'
        )}
        onClick={() => handleLeadClick(lead.id)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              {unread && (
                <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0" title="Lead sin leer">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate">{renderLeadName(lead)}</div>
                <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lead.municipio || lead.direccion || 'Sin ubicación'}</span>
                </p>
              </div>
            </div>
          </div>
          <div className="shrink-0">{getStatusBadge(lead.estado)}</div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-xs">
          <div className="min-w-0">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Categoría</span>
            <span className="flex items-center gap-1 truncate text-slate-700">
              <Tag className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{lead.category_label || 'Sin categoría'}</span>
            </span>
          </div>
          <div className="min-w-0">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Partida</span>
            <span className="block truncate capitalize text-slate-700">{getPartidaLabel(lead.partida) || 'Sin partida'}</span>
          </div>
          <div className="min-w-0">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Asignados</span>
            <span className="block truncate text-slate-700">{renderAssignments(lead.assignments_count)}</span>
          </div>
          <div className="min-w-0">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Fecha</span>
            <span className="block truncate text-slate-500">{formatDate(lead.fecha)}</span>
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-blue-600" onClick={() => handleEdit(lead.id)} aria-label="Editar lead">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:bg-red-50 hover:text-red-600" onClick={() => handleDelete(lead.id)} aria-label="Eliminar lead">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Obtener label de partida para mostrar
  const getPartidaLabel = (key) => {
    const found = partidas.find(p => p.key === key);
    return found ? found.label : key || '-';
  };

  // ============================================================
  // NUEVO: COMPONENTES DE RENDERIZADO DEL KANBAN
  // ============================================================

  const renderKanbanCard = (lead) => {
    const isDragging = draggedLeadId === lead.id;
    const unread = isUnread(lead);

    return (
      <div
        key={lead.id}
        draggable
        onDragStart={(e) => handleDragStart(e, lead.id)}
        onDragEnd={handleDragEnd}
        onClick={() => handleKanbanCardClick(lead.id)}
        className={cn(
          `group rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing
          hover:shadow-md transition-all select-none`,
          unread
            ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-300/60 hover:border-emerald-400'
            : 'bg-white border-slate-200 hover:border-slate-300',
          isDragging && 'opacity-40 ring-2 ring-primary/40'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-start gap-2">
            {unread && (
              <span className="relative flex h-2.5 w-2.5 shrink-0 mt-1" title="Lead sin leer">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
            <div className="min-w-0 flex-1">
              {renderLeadName(lead)}
            </div>
          </div>
          <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0 mt-0.5" />
        </div>

        {lead.partida && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
            <Wrench className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="capitalize truncate">{getPartidaLabel(lead.partida)}</span>
          </div>
        )}

        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <Tag className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate">{lead.category_label || 'Sin Categoría'}</span>
        </div>

        {(lead.municipio || lead.direccion) && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{lead.municipio || lead.direccion}</span>
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-slate-100 flex items-start justify-between gap-2">
          {renderAssignedNames(lead)}
          <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0 mt-0.5">
            <Calendar className="w-3 h-3" />
            {formatDate(lead.fecha)}
          </span>
        </div>

        {/*
          FIX (móvil): antes "opacity-0 group-hover:opacity-100" -> invisible/inutilizable
          en pantallas táctiles (no existe hover). Ahora: siempre visible por debajo de
          'md' (móvil/tablet pequeño) y oculto-hasta-hover a partir de 'md' (escritorio),
          para no añadir ruido visual en las tarjetas cuando sí hay ratón disponible.
        */}
        <div
          className="mt-2 flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-blue-600" onClick={() => handleEdit(lead.id)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(lead.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  const renderMobileKanbanLeadRow = (lead) => {
    const unread = isUnread(lead);

    return (
      <button
        key={lead.id}
        type="button"
        onClick={() => handleKanbanCardClick(lead.id)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
          unread
            ? 'border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100'
            : 'border-slate-200 bg-white hover:bg-slate-50'
        )}
      >
        {unread ? (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" title="Lead sin leer" />
        ) : (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-200" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">
            {lead.nombre_empresa || lead.nombre_contacto || 'Sin nombre'}
          </span>
          <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.municipio || lead.direccion || lead.category_label || 'Sin datos adicionales'}</span>
          </span>
        </span>
        <span className="shrink-0">{getStatusBadge(lead.estado)}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
    );
  };

  // NUEVO: tarjeta de lead dentro de la columna HISTORIAL (sin drag, solo lectura)
  const renderHistorialLeadCard = (lead) => {
    const fecha = lead.archivado_at || lead.updated_at || lead.created_at;
    return (
      <div
        key={lead.id}
        onClick={() => {
          try { localStorage.setItem('leads_kanban_historial_mes_abierto', kanbanHistorialMonth || ''); } catch {}
          handleLeadClick(lead.id);
        }}
        className="group rounded-lg border border-slate-200 bg-white shadow-sm p-3 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all select-none"
      >
        <div className="min-w-0">{renderLeadName(lead)}</div>

        {lead.partida && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
            <Wrench className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="capitalize truncate">{getPartidaLabel(lead.partida)}</span>
          </div>
        )}

        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <Tag className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate">{lead.category_label || 'Sin Categoría'}</span>
        </div>

        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          {getStatusBadge(lead.estado)}
          <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
            <Calendar className="w-3 h-3" />
            {formatDate(fecha)}
          </span>
        </div>
      </div>
    );
  };

  // NUEVO: contenido de la columna HISTORIAL — lista de meses, o (si hay un mes
  // seleccionado) las tarjetas de ese mes con botón para volver.
  const renderLeadsHistorialContent = () => {
    const monthEntries = Object.entries(leadsHistorial).sort((a, b) => {
      try {
        const da = parseISO(a[1][0]?.archivado_at || a[1][0]?.updated_at || a[1][0]?.created_at);
        const db = parseISO(b[1][0]?.archivado_at || b[1][0]?.updated_at || b[1][0]?.created_at);
        return db - da;
      } catch { return 0; }
    });

    if (kanbanHistorialMonth && leadsHistorial[kanbanHistorialMonth]) {
      const monthLeads = leadsHistorial[kanbanHistorialMonth];
      return (
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 -ml-1 text-xs text-slate-500 hover:text-slate-800"
            onClick={() => {
              setKanbanHistorialMonth(null);
              try { localStorage.removeItem('leads_kanban_historial_mes_abierto'); } catch {}
            }}
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Volver al historial
          </Button>
          <div className="text-xs font-semibold capitalize text-slate-500 px-0.5">
            {kanbanHistorialMonth} · {monthLeads.length}
          </div>
          {monthLeads.map(l => renderHistorialLeadCard(l))}
        </div>
      );
    }

    if (monthEntries.length === 0) {
      return (
        <div className="h-32 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-xs text-center px-3 text-slate-400">
          <Archive className="w-5 h-5 opacity-60" />
          Aún no hay leads archivados
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {monthEntries.map(([month, monthLeads]) => (
          <button
            key={month}
            onClick={() => {
              setKanbanHistorialMonth(month);
              try { localStorage.setItem('leads_kanban_historial_mes_abierto', month); } catch {}
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-left"
          >
            <span className="text-sm font-medium capitalize truncate">{month}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{monthLeads.length}</Badge>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderKanbanColumn = (status) => {
    const columnLeads = kanbanGroups[status] || [];
    const style = estadoMap[status] || estadoMap.nuevo;
    const isOver = dragOverColumn === status;
    const isOpenOnMobile = openMobileKanbanColumn === status;
    const pendingCount = columnLeads.filter(isUnread).length;

    return (
      <div
        key={status}
        onDragOver={(e) => handleColumnDragOver(e, status)}
        onDragLeave={(e) => handleColumnDragLeave(e, status)}
        onDrop={(e) => handleColumnDrop(e, status)}
        className={`flex w-full min-w-0 flex-col rounded-xl border transition-colors md:min-w-[270px] md:w-[270px] md:flex-1
          ${isOver ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-slate-200 bg-slate-100/60'}`}
      >
        {/* Cabecera de columna */}
        <button
          type="button"
          onClick={() => setOpenKanbanColumn(isOpenOnMobile ? null : status)}
          className="w-full px-3 py-2.5 rounded-t-xl border-b flex items-center justify-between gap-2 text-left md:cursor-default"
          style={{ backgroundColor: style.bg, borderColor: style.br }}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="uppercase text-xs font-bold tracking-wide" style={{ color: style.text }}>
              {getStatusLabel(status)}
            </span>
            <ChevronRight className={`h-4 w-4 transition-transform md:hidden ${isOpenOnMobile ? 'rotate-90' : ''}`} style={{ color: style.text }} />
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {pendingCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white shadow-sm" title={`${pendingCount} lead${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'} de atención`}>
                {pendingCount}
              </span>
            )}
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/70"
              style={{ color: style.text }}
            >
              {columnLeads.length}
            </span>
          </span>
        </button>

        {/* Tarjetas */}
        <div className={`flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-340px)] min-h-[120px] ${isOpenOnMobile ? 'block' : 'hidden'} md:block`}>
          {columnLeads.length === 0 ? (
            <div className={`h-24 flex items-center justify-center rounded-lg border-2 border-dashed text-xs
              ${isOver ? 'border-primary/40 text-primary' : 'border-slate-200 text-slate-400'}`}>
              {isOver ? 'Suelta aquí' : 'Sin leads'}
            </div>
          ) : (
            columnLeads.map(lead => isMobile ? renderMobileKanbanLeadRow(lead) : renderKanbanCard(lead))
          )}
        </div>
      </div>
    );
  };

  // NUEVO: columna HISTORIAL (última columna del tablero, no es un estado)
  const renderLeadsHistorialColumn = () => (
    <div
      key="__historial__"
      className="flex w-full min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-100/60 transition-colors md:min-w-[270px] md:w-[270px] md:flex-1"
    >
      <button
        type="button"
        onClick={() => setOpenKanbanColumn(openMobileKanbanColumn === '__historial__' ? null : '__historial__')}
        className="w-full px-3 py-2.5 rounded-t-xl border-b flex items-center justify-between gap-2 text-left md:cursor-default"
        style={{ backgroundColor: '#d1fae5', borderColor: '#6ee7b7' }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="uppercase text-xs font-bold tracking-wide flex items-center gap-1.5" style={{ color: '#047857' }}>
            <Archive className="w-3.5 h-3.5" /> HISTORIAL
          </span>
          <ChevronRight className={`h-4 w-4 transition-transform md:hidden ${openMobileKanbanColumn === '__historial__' ? 'rotate-90' : ''}`} style={{ color: '#047857' }} />
        </span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/70" style={{ color: '#047857' }}>
          {archivedLeads.length}
        </span>
      </button>
      <div className={`flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-340px)] min-h-[120px] ${openMobileKanbanColumn === '__historial__' ? 'block' : 'hidden'} md:block`}>
        {renderLeadsHistorialContent()}
      </div>
    </div>
  );

  const renderKanbanBoard = () => (
    <div className="flex flex-col items-stretch gap-3 pb-4 md:flex-row md:overflow-x-auto">
      {KANBAN_COLUMNS.map(status => renderKanbanColumn(status))}
      {renderLeadsHistorialColumn()}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50/50 min-h-screen">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Leads</h1>
          <p className="text-muted-foreground mt-1">Gestiona tus clientes potenciales y oportunidades de negocio.</p>
        </div>
        <div className={`flex gap-2 w-full md:w-auto ${mobileKanbanOnly ? 'hidden md:flex' : ''}`}>
          {canViewStats && (
            <Button
              variant={showStats ? "secondary" : "outline"}
              onClick={() => setShowStats(!showStats)}
              className="hidden md:flex gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              {showStats ? "Ocultar Estadísticas" : "Mostrar Estadísticas"}
            </Button>
          )}

          <Button onClick={() => fetchLeads()} variant="outline" size="icon" title="Recargar">
            <ArrowUpDown className="h-4 w-4" />
          </Button>

          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="shadow-md bg-primary hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" /> Nuevo Lead
          </Button>
        </div>
      </div>

      <Tabs value={effectiveActiveTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={`w-full sm:w-auto bg-muted/50 p-1 mb-6 ${mobileKanbanOnly ? 'hidden md:flex' : ''}`}>
          <TabsTrigger value="activos" className="flex-1 sm:flex-none">Activos</TabsTrigger>
          <TabsTrigger value="archivo" className="flex-1 sm:flex-none gap-2">
            <Archive className="w-4 h-4" /> Archivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activos" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

          {canViewStats && (
            <Button
              variant="ghost"
              onClick={() => setShowStats(!showStats)}
              className="md:hidden w-full flex justify-between items-center bg-white border mb-4"
            >
              <span className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Estadísticas</span>
              {showStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}

          <AnimatePresence>
            {showStats && canViewStats && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <LeadsStatistics
                  leads={baseLeads}
                  filteredLeads={statsLeads}
                  filters={{
                    status: statusFilter,
                    category: selectedCategoryKey,
                    conversion: conversionFilter,
                    search: urlSearchTerm
                  }}
                  onStatusClick={handleStatusClick}
                  onCategoryClick={handleCategoryClick}
                  onConversionClick={handleConversionClick}
                  onClearFilters={clearAllFilters}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`flex flex-col md:flex-row gap-4 items-center ${mobileKanbanOnly ? 'hidden md:flex' : ''}`}>
            {hasActiveFilters && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full md:w-auto order-last md:order-first"
              >
                <Button
                  variant="ghost"
                  onClick={clearAllFilters}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2 w-full md:w-auto h-10 border border-red-200 bg-red-50/50"
                >
                  <X className="w-4 h-4" /> Limpiar filtros
                </Button>
              </motion.div>
            )}

            <Card className="flex-1 shadow-sm border-slate-200 w-full">
              <CardContent className="p-2 flex flex-col md:flex-row gap-2 items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, empresa, email..."
                    value={localSearchTerm}
                    onChange={(e) => setLocalSearchTerm(e.target.value)}
                    className="pl-9 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <div className="h-8 w-px bg-slate-200 hidden md:block" />

                {/* El filtro de estado solo aplica en vista lista (en Kanban las columnas son los estados) */}
                {effectiveViewMode === 'lista' && (
                  <>
                    {/* NUEVO: Filtro de estado MULTI-SELECCIÓN con checkboxes + marcar/desmarcar todos */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full md:w-[180px] justify-start font-normal border-0 bg-transparent hover:bg-muted"
                        >
                          <span className="flex items-center gap-2 text-muted-foreground overflow-hidden">
                            <Filter className="w-4 h-4 shrink-0" />
                            <span className="text-foreground truncate">
                              {statusFilter.length === 0
                                ? 'Estado'
                                : statusFilter.length === 1
                                  ? getStatusLabel(statusFilter[0])
                                  : `${statusFilter.length} estados`}
                            </span>
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-60 p-2" align="start">
                        <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b">
                          <span className="text-xs font-semibold text-muted-foreground">Filtrar por estado</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-xs text-primary hover:underline"
                              onClick={() => setStatusFilterMulti(
                                statusFilter.length === FORM_STATUS_OPTIONS.length
                                  ? []
                                  : FORM_STATUS_OPTIONS.map(o => o.value)
                              )}
                            >
                              {statusFilter.length === FORM_STATUS_OPTIONS.length ? 'Desmarcar todos' : 'Marcar todos'}
                            </button>
                            {statusFilter.length > 0 && (
                              <button
                                type="button"
                                className="text-xs text-muted-foreground hover:underline"
                                onClick={() => setStatusFilterMulti([])}
                              >
                                Limpiar
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-0.5 max-h-72 overflow-y-auto">
                          {FORM_STATUS_OPTIONS.map((status) => {
                            const checked = statusFilter.includes(status.value);
                            const style = estadoMap[status.value] || estadoMap.nuevo;
                            return (
                              <label
                                key={status.value}
                                className="flex items-center gap-2 px-1.5 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(isChecked) => {
                                    setStatusFilterMulti(isChecked
                                      ? [...statusFilter, status.value]
                                      : statusFilter.filter(s => s !== status.value));
                                  }}
                                />
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: style.text }} />
                                  {status.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <div className="h-8 w-px bg-slate-200 hidden md:block" />
                  </>
                )}

                {/* Filtro por Partida */}
                <Select
                  value={partidaFilter}
                  onValueChange={handlePartidaChange}
                >
                  <SelectTrigger className="w-full md:w-[180px] border-0 bg-transparent focus:ring-0">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-muted-foreground" />
                      <SelectValue placeholder="Partida" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las partidas</SelectItem>
                    {partidas.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* NUEVO: Filtro por Personal Asignado (aplica en Lista y Kanban) */}
                <div className="h-8 w-px bg-slate-200 hidden md:block" />
                <Select
                  value={empleadoFilter}
                  onValueChange={handleEmpleadoChange}
                >
                  <SelectTrigger className="w-full md:w-[200px] border-0 bg-transparent focus:ring-0">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <SelectValue placeholder="Personal" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo el personal</SelectItem>
                    {empleadosList.map((emp) => (
                      <SelectItem key={emp.auth_user_id} value={emp.auth_user_id}>
                        {(emp.display_name || '').trim() || 'Sin nombre'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* NUEVO: Toggle Lista / Kanban */}
                <div className="h-8 w-px bg-slate-200 hidden md:block" />
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => handleViewChange('lista')}
                    title="Vista Lista"
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors
                      ${effectiveViewMode === 'lista' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <List className="w-4 h-4" /> Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewChange('kanban')}
                    title="Vista Kanban"
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors
                      ${effectiveViewMode === 'kanban' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <LayoutGrid className="w-4 h-4" /> Kanban
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ============================================================ */}
          {/* VISTA KANBAN (por defecto) */}
          {/* ============================================================ */}
          {effectiveViewMode === 'kanban' ? (
            loading ? (
              <Card className="shadow-md border-slate-200">
                <CardContent className="h-32 flex items-center justify-center text-muted-foreground">
                  Cargando...
                </CardContent>
              </Card>
            ) : (
              renderKanbanBoard()
            )
          ) : (
            /* VISTA LISTA (original) */
            <Card className="shadow-md border-slate-200 overflow-hidden">
              <div className="hidden rounded-md md:block">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-700 w-[25%]">Nombre</TableHead>
                      <TableHead className="font-semibold text-slate-700 hidden md:table-cell">Partida</TableHead>
                      <TableHead className="font-semibold text-slate-700 hidden md:table-cell">Categoría</TableHead>
                      <TableHead className="font-semibold text-slate-700">Estado</TableHead>
                      <TableHead className="font-semibold text-slate-700 hidden sm:table-cell">Asignados</TableHead>
                      <TableHead className="font-semibold text-slate-700 hidden lg:table-cell">Fecha</TableHead>
                      <TableHead className="text-right font-semibold text-slate-700">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-white">
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">Cargando...</TableCell>
                      </TableRow>
                    ) : leads.length === 0 && sessionRole?.rol === 'tecnico' ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          No tienes leads asignados activos.
                        </TableCell>
                      </TableRow>
                    ) : tableLeads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          No se encontraron leads activos que coincidan con los filtros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tableLeads.map((lead) => {
                        const unread = isUnread(lead);
                        return (
                        <TableRow
                          key={lead.id}
                          className={cn(
                            'transition-colors cursor-pointer group',
                            unread
                              ? 'bg-emerald-100/80 hover:bg-emerald-100 border-l-4 border-l-emerald-400'
                              : 'hover:bg-slate-50'
                          )}
                          onClick={() => handleLeadClick(lead.id)}
                        >
                          <TableCell className="align-top py-4">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                {unread && (
                                  <span className="relative flex h-2.5 w-2.5 shrink-0" title="Lead sin leer">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                  </span>
                                )}
                                {renderLeadName(lead)}
                              </div>
                              <div className="sm:hidden mt-2 space-y-1">
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> {lead.municipio || lead.direccion || '-'}
                                </span>
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Tag className="w-3 h-3" /> {lead.category_label || 'Sin Categoría'}
                                </span>
                                <div className="pt-1">
                                  {renderAssignments(lead.assignments_count)}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="hidden md:table-cell align-top py-4">
                            <span className="capitalize text-sm text-slate-700">
                              {getPartidaLabel(lead.partida)}
                            </span>
                          </TableCell>

                          <TableCell className="hidden md:table-cell align-top py-4">
                            <span className="text-sm text-slate-700">
                              {lead.category_label || '-'}
                            </span>
                          </TableCell>

                          <TableCell className="align-top py-4">
                            {getStatusBadge(lead.estado)}
                          </TableCell>

                          <TableCell className="hidden sm:table-cell align-top py-4">
                            {renderAssignments(lead.assignments_count)}
                          </TableCell>

                          <TableCell className="hidden lg:table-cell align-top py-4 text-sm text-slate-500">
                            {formatDate(lead.fecha)}
                          </TableCell>

                          <TableCell className="text-right align-top py-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => handleEdit(lead.id)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(lead.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-2 bg-slate-50/60 p-2 md:hidden">
                {loading ? (
                  <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">Cargando...</div>
                ) : leads.length === 0 && sessionRole?.rol === 'tecnico' ? (
                  <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    No tienes leads asignados activos.
                  </div>
                ) : tableLeads.length === 0 ? (
                  <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    No se encontraron leads activos que coincidan con los filtros.
                  </div>
                ) : (
                  tableLeads.map(renderMobileLeadCard)
                )}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="archivo" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <LeadsArchiveView onEditLead={handleEdit} renderName={renderLeadName} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AddLeadModalV2
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onLeadAdded={fetchLeads}
      />

      {selectedLeadId && (
        <EditLeadModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedLeadId(null);
          }}
          leadId={selectedLeadId}
          onLeadUpdated={fetchLeads}
        />
      )}
    </div>
  );
};

export default Leads;
