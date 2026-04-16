/**
 * Leads.jsx
 * 
 * FILTER PERSISTENCE PATTERN:
 * This component uses URL Query Parameters (via useSearchParams) as the single source of truth 
 * for all list filters (status, category, search, tab, partida, etc.).
 * 
 * - State is derived directly from searchParams on render.
 * - User interactions (filtering) update the URL using setSearchParams.
 * - This ensures that refreshing the page or sharing the URL preserves the exact view state.
 * - Navigation to Detail View propagates these query parameters so the "Back" button
 *   can restore the exact same list state.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, ArrowUpDown, Edit, Trash2, MapPin,
  BarChart3, ChevronDown, ChevronUp, X, Users, Archive, Tag, Wrench
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { formatDate } from '@/lib/utils';
import { FORM_STATUS_OPTIONS, getStatusLabel, estadoMap } from '@/utils/leadStatus';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams, useLocation } from 'react-router-dom';

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

const Leads = ({ navigate }) => {
  const { sessionRole } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // URL Param State Management
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Derived state from URL params
  const statusFilter = searchParams.get('status') || 'all';
  const selectedCategoryKey = searchParams.get('category') || null;
  const conversionFilter = searchParams.get('conversion') || null;
  const partidaFilter = searchParams.get('partida') || 'all'; // NUEVO: Filtro por partida
  const activeTab = searchParams.get('tab') || 'activos';
  const urlSearchTerm = searchParams.get('q') || '';
  const filterParam = searchParams.get('filter') || null;

  // Local state for search input to prevent lag/excessive URL updates
  const [localSearchTerm, setLocalSearchTerm] = useState(urlSearchTerm);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partidas, setPartidas] = useState([]); // NUEVO: Lista de partidas para el filtro

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(null);

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

  const handleTabChange = (value) => {
    updateFilter('tab', value);
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

  // NUEVO: Fetch partidas para el filtro
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
          'nuevo', 'contactado', 'visita_agendada',
          'visitado', 'presupuestado', 'aceptado'
        ];
        query = query.in('estado', ACTIVE_STATUSES);
      }

      const { data: leadsData, error: leadsError } = await query;
      if (leadsError) throw leadsError;

      const leadIds = leadsData.map(l => l.id);
      let assignmentsMap = {};

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
      }

      const enrichedLeads = leadsData.map(lead => {
        const assignedSet = assignmentsMap[lead.id] || new Set();
        let count = assignedSet.size;

        return {
          ...lead,
          nombre_cliente: lead.nombre_empresa || lead.nombre_contacto,
          fecha: lead.created_at,
          assignments_count: count > 0 ? count : (lead.empleado_asignado_id ? 1 : 0),
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

  useEffect(() => {
    fetchLeads();
    fetchPartidas(); // NUEVO: Cargar partidas al inicio
  }, [sessionRole, canViewStats]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('leads_realtime_v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_asignaciones' }, () => fetchLeads())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads())
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
    if (['rechazado', 'cancelado', 'anulado'].includes(status)) return 'Perdido';
    return 'En Progreso';
  };

  const statsLeads = useMemo(() => {
    return baseLeads.filter(l => {
      if (statusFilter !== 'all' && l.estado !== statusFilter) return false;

      if (selectedCategoryKey) {
        if (l.category_code !== selectedCategoryKey) return false;
      }

      if (conversionFilter) {
        const group = getConversionGroup(l.estado);
        if (group !== conversionFilter) return false;
      }

      // NUEVO: Filtro por partida
      if (partidaFilter !== 'all' && l.partida !== partidaFilter) return false;

      if (filterParam === 'assigned') {
        if (l.empleado_asignado_id !== sessionRole?.empleadoId) return false;
      }

      return true;
    });
  }, [baseLeads, statusFilter, selectedCategoryKey, conversionFilter, partidaFilter, filterParam, sessionRole]);

  const tableLeads = useMemo(() => {
    return statsLeads.filter(l => l.archivado === false);
  }, [statsLeads]);

  // UI Handlers updating URL params
  const handleStatusClick = (status) => {
    if (statusFilter === status) {
      updateFilter('status', 'all');
    } else {
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.set('status', status);
        newParams.delete('conversion'); // Reset conversion when selecting specific status
        return newParams;
      });
    }
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

  // NUEVO: Handler para el filtro de partida
  const handlePartidaChange = (value) => {
    updateFilter('partida', value);
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams()); // Clears everything
    setLocalSearchTerm('');
    toast({
      description: "Filtros limpiados. Mostrando todos los leads activos.",
      duration: 2000,
    });
  };

  // ACTUALIZADO: Incluir partidaFilter en la verificación
  const hasActiveFilters = statusFilter !== 'all' || selectedCategoryKey !== null || conversionFilter !== null || partidaFilter !== 'all' || urlSearchTerm !== '';

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

  // Navigates preserving query string so back button works perfectly
  const handleLeadClick = (id) => {
    navigate(`/crm/leads/${id}${location.search}`);
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

  const renderLeadName = (lead) => {
    if (lead.nombre_empresa && lead.nombre_empresa.trim() !== '') {
      return <span className="font-bold text-slate-900 leading-tight">{lead.nombre_empresa}</span>;
    }
    return <span className="font-bold text-slate-900 leading-tight">{lead.nombre_contacto || 'Sin nombre'}</span>;
  };

  // NUEVO: Obtener label de partida para mostrar
  const getPartidaLabel = (key) => {
    const found = partidas.find(p => p.key === key);
    return found ? found.label : key || '-';
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50/50 min-h-screen">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Leads</h1>
          <p className="text-muted-foreground mt-1">Gestiona tus clientes potenciales y oportunidades de negocio.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full sm:w-auto bg-muted/50 p-1 mb-6">
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

          <div className="flex flex-col md:flex-row gap-4 items-center">
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
                <Select
                  value={statusFilter}
                  onValueChange={(val) => {
                    handleStatusClick(val);
                  }}
                >
                  <SelectTrigger className="w-full md:w-[180px] border-0 bg-transparent focus:ring-0">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {FORM_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value || "unknown"}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* NUEVO: Filtro por Partida */}
                <div className="h-8 w-px bg-slate-200 hidden md:block" />
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
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-md border-slate-200 overflow-hidden">
            <div className="rounded-md">
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
                    tableLeads.map((lead) => (
                      <TableRow key={lead.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => handleLeadClick(lead.id)}>
                        <TableCell className="align-top py-4">
                          <div className="flex flex-col gap-0.5">
                            {renderLeadName(lead)}
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
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
