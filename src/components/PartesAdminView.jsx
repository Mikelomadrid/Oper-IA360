import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Plus, Search, MapPin, Calendar, User, Filter,
  LayoutGrid, List as ListIcon, Trash2, Edit, FileDown,
  EyeOff, Eye, Archive, ArrowLeft, UserCog, RefreshCw,
  BarChart3, CheckSquare, XSquare, CheckCircle,
  X, UserCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from '@/components/ui/use-toast';
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils';

import PartesStatistics from '@/components/PartesStatistics';
import { getStatusColor, getStatusTextColor, getStatusLabel } from '@/utils/statusColors';
import { mapInternalToUI } from '@/utils/parteEstadoUIMap';
import { useSearchParams } from 'react-router-dom';

const PartesAdminView = ({ navigate }) => {
  const { user, sessionRole } = useAuth();
  const [searchParams] = useSearchParams();
  const [partes, setPartes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- STATE WITH PERSISTENCE ---
  const DEFAULT_FILTERS = {
    status: 'all',
    technician: 'all',
    creator: 'all',
    origin: 'all',
    search: '',
    showDeleted: false,
    showArchive: false
  };

  const [filters, setFilters] = useState(() => {
    try {
      const saved = sessionStorage.getItem('partes_filters_state');
      return saved ? { ...DEFAULT_FILTERS, ...JSON.parse(saved) } : DEFAULT_FILTERS;
    } catch (e) {
      return DEFAULT_FILTERS;
    }
  });

  const statusFilter = filters.status;
  const technicianFilter = filters.technician;
  const creatorFilter = filters.creator;
  const originFilter = filters.origin;
  const searchTerm = filters.search;
  const showDeleted = filters.showDeleted;
  const showArchive = filters.showArchive;

  const setStatusFilter = (v) => setFilters(prev => ({ ...prev, status: v }));
  const setTechnicianFilter = (v) => setFilters(prev => ({ ...prev, technician: v }));
  const setCreatorFilter = (v) => setFilters(prev => ({ ...prev, creator: v }));
  const setSearchTerm = (v) => setFilters(prev => ({ ...prev, search: v }));
  const setOriginFilter = (v) => setFilters(prev => ({ ...prev, origin: v }));
  const setShowDeleted = (v) => setFilters(prev => ({ ...prev, showDeleted: v }));
  const setShowArchive = (v) => setFilters(prev => ({ ...prev, showArchive: v }));

  useEffect(() => {
    sessionStorage.setItem('partes_filters_state', JSON.stringify(filters));
  }, [filters]);

  const [showStats, setShowStats] = useState(() => {
    return localStorage.getItem('partes_stats_pref') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('partes_stats_pref', showStats);
  }, [showStats]);

  // View state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [parteToDelete, setParteToDelete] = useState(null);

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [parteToAssign, setParteToAssign] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('partesViewMode') || 'list';
  });

  const [selectedPartes, setSelectedPartes] = useState(new Set());
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false);
  const [transitionType, setTransitionType] = useState(null);
  const [transitionNote, setTransitionNote] = useState('');
  const [processingTransition, setProcessingTransition] = useState(false);

  // Role Checks
  const userRole = sessionRole?.rol;
  const isAdmin = userRole === 'admin';
  const isEncargado = userRole === 'encargado';
  const isFincaAdmin = userRole === 'finca_admin';
  const isTechnician = userRole === 'tecnico';
  const isAdminOrEncargado = isAdmin || isEncargado;

  const specificEmails = ['administracion@atcfincas.es', 'vanesa@delbrioyblanco.es'];
  const isSpecificEmail = user?.email && specificEmails.includes(user.email.toLowerCase());

  const isFincaAdminUser = isFincaAdmin || isSpecificEmail;

  const canViewArchive = isAdmin || isEncargado || isFincaAdminUser;
  const canCreate = isAdminOrEncargado || isFincaAdminUser;
  const canTransition = isAdmin || isEncargado;

  const hasActiveFilters = useMemo(() => {
    return statusFilter !== 'all' ||
      technicianFilter !== 'all' ||
      creatorFilter !== 'all' ||
      originFilter !== 'all' ||
      searchTerm !== '' ||
      showDeleted === true;
  }, [statusFilter, technicianFilter, creatorFilter, originFilter, searchTerm, showDeleted]);

  const clearFilters = () => {
    setFilters(prev => ({
      ...DEFAULT_FILTERS,
      showArchive: prev.showArchive
    }));
    toast({ description: "Filtros limpiados" });
  };

  useEffect(() => {
    localStorage.setItem('partesViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (showArchive) {
      if (statusFilter !== 'all') setStatusFilter('all');
      if (originFilter !== 'all') setOriginFilter('all');
    }
    setSelectedPartes(new Set());
  }, [showArchive]);

  useEffect(() => {
    if (sessionRole?.loaded) {
      fetchPartes();
    }
  }, [
    technicianFilter,
    creatorFilter,
    showDeleted,
    showArchive,
    sessionRole,
    user
  ]);

  // Load all employees for mapping and assignment
  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        const { data: allEmps, error } = await supabase
          .from('empleados')
          .select('id, nombre, apellidos');

        if (error) throw error;

        const mappedEmps = (allEmps || []).map(e => ({
          id: e.id,
          fullName: `${e.nombre} ${e.apellidos || ''}`.trim(),
        }));
        setEmployees(mappedEmps);

      } catch (error) {
        console.error("Error fetching dependencies:", error);
      }
    };

    if (isAdminOrEncargado || isFincaAdminUser) {
      fetchDependencies();
    }
  }, [isAdminOrEncargado, isFincaAdminUser]);

  // Load unique creators
  useEffect(() => {
    const loadCreators = async () => {
      try {
        const { data: partesData, error: partesError } = await supabase
          .from('v_partes_estado_ui')
          .select('created_by');

        if (partesError) throw partesError;

        const uniqueIds = [...new Set(partesData.map(p => p.created_by).filter(Boolean))];

        if (uniqueIds.length > 0) {
          const { data: emps, error: empsError } = await supabase
            .from('empleados')
            .select('id, nombre, apellidos')
            .in('id', uniqueIds)
            .order('nombre');

          if (empsError) throw empsError;

          const formatted = emps.map(e => ({
            id: e.id,
            name: `${e.nombre} ${e.apellidos || ''}`.trim()
          }));
          setCreators(formatted);
        }
      } catch (err) {
        console.error("Error loading creators:", err);
      }
    };

    if (isAdminOrEncargado || isFincaAdminUser) {
      loadCreators();
    }
  }, [isAdminOrEncargado, isFincaAdminUser]);

  const fetchPartes = async () => {
    setLoading(true);
    const currentEmployeeId = sessionRole?.empleadoId;

    try {
      let query = supabase
        .from('v_partes_estado_ui')
        .select('*');

      // ARCHIVE logic (ACEPTADO, RECHAZADO, CANCELADO)
      if (showArchive) {
        const archiveStates = ['aceptado', 'finalizado', 'facturado', 'completado', 'garantia', 'rechazado', 'cancelado', 'anulado', 'archivado'];
        query = query.in('estado', archiveStates);

        if (!isAdmin) {
          if (isEncargado) {
            if (currentEmployeeId) query = query.eq('created_by', currentEmployeeId);
            else query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          } else if (isFincaAdminUser) {
            if (currentEmployeeId) query = query.or(`administrador_finca_id.eq.${currentEmployeeId},created_by.eq.${currentEmployeeId}`);
            else query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        }

        query = query.order('fecha_actualizacion', { ascending: false });

      } else {
        // ACTIVE states: Not archive states.
        const archiveStates = ['aceptado', 'finalizado', 'facturado', 'completado', 'garantia', 'rechazado', 'cancelado', 'anulado', 'archivado'];
        query = query.not('estado', 'in', `(${archiveStates.join(',')})`)
          .order('created_at', { ascending: false });

        if (technicianFilter !== 'all') {
          query = query.eq('tecnico_asignado_id', technicianFilter);
        }

        if (creatorFilter !== 'all') {
          query = query.eq('created_by', creatorFilter);
        }

        if (!showDeleted) {
          query = query.is('deleted_at', null);
        }

        if (!isAdminOrEncargado && currentEmployeeId) {
          if (isFincaAdminUser) {
            query = query.or(`created_by.eq.${currentEmployeeId},administrador_finca_id.eq.${currentEmployeeId}`);
          } else {
            query = query.or(`tecnico_asignado_id.eq.${currentEmployeeId},created_by.eq.${currentEmployeeId}`);
          }
        } else if (!isAdminOrEncargado && !currentEmployeeId) {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      const processedData = (data || []).map(p => {
        let origin = 'Interno';
        if (p.administrador_finca_id) origin = 'Finca / Admin';

        // Map DB internal state to UI state immediately
        const uiState = mapInternalToUI(p.estado);

        return {
          ...p,
          origin,
          estado_ui: uiState
        };
      });

      setPartes(processedData);
    } catch (error) {
      console.error('Error fetching partes:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los partes.' });
    } finally {
      setLoading(false);
    }
  };

  const statusOrder = [
    'NUEVO', 'CONTACTADO', 'VISITA AGENDADA', 'VISITADO',
    'PRESUPUESTADO', 'ACEPTADO', 'RECHAZADO', 'CANCELADO'
  ];

  const filteredPartes = useMemo(() => {
    return partes.filter(parte => {
      const search = searchTerm.toLowerCase();
      const searchClean = search.replace(/[-\/]/g, '');
      const parteIdDisplay = parte.custom_id || parte.id;
      const parteIdClean = String(parteIdDisplay).toLowerCase().replace(/[-\/]/g, '');

      const matchesSearch = (
        (parte.cliente_nombre && parte.cliente_nombre.toLowerCase().includes(search)) ||
        (parte.direccion_servicio && parte.direccion_servicio.toLowerCase().includes(search)) ||
        String(parteIdDisplay).toLowerCase().includes(search) ||
        parteIdClean.includes(searchClean)
      );

      if (!matchesSearch) return false;

      if (statusFilter !== 'all') {
        if (parte.estado_ui !== statusFilter) {
          return false;
        }
      }

      if (originFilter !== 'all' && parte.origin !== originFilter) {
        return false;
      }

      if (creatorFilter !== 'all' && parte.created_by !== creatorFilter) {
        return false;
      }

      const filterParam = searchParams.get('filter');
      if (filterParam === 'assigned') {
        if (parte.tecnico_asignado_id !== sessionRole?.empleadoId) {
          return false;
        }
      }

      return true;
    });
  }, [partes, searchTerm, statusFilter, originFilter, creatorFilter, searchParams, sessionRole]);

  const archivedGroups = useMemo(() => {
    if (!showArchive) return [];

    const groups = {};
    filteredPartes.forEach(p => {
      let date = p.archive_date || p.finalized_at || p.archived_at || p.fecha_cierre || p.fecha_actualizacion || p.created_at;
      date = new Date(date);

      const key = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy', { locale: es });

      if (!groups[key]) {
        groups[key] = {
          label: label.charAt(0).toUpperCase() + label.slice(1),
          items: []
        };
      }
      groups[key].items.push(p);
    });

    const sortedGroups = Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));

    sortedGroups.forEach(([_, group]) => {
      group.items.sort((a, b) => {
        const da = a.archive_date || a.finalized_at || a.archived_at || a.created_at;
        const db = b.archive_date || b.finalized_at || b.archived_at || b.created_at;
        return new Date(db) - new Date(da);
      });
    });

    return sortedGroups;
  }, [filteredPartes, showArchive]);

  const handleChartStatusClick = (statusName) => {
    if (statusFilter === statusName) {
      setStatusFilter('all');
    } else {
      setStatusFilter(statusName);
    }
  };

  const handleChartOriginClick = (originName) => {
    if (originFilter === originName) {
      setOriginFilter('all');
    } else {
      setOriginFilter(originName);
    }
  };

  const getStatusBadge = (parte) => {
    if (parte.deleted_at) {
      return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200 hover:bg-red-200 rounded-xl px-2.5 py-0.5 shadow-sm">Eliminado</Badge>;
    }

    // CRITICAL FIX: Ensure badge text is visible and populated
    const statusLabel = parte.estado_ui || mapInternalToUI(parte.estado) || '––';
    const bg = getStatusColor(statusLabel);
    const text = getStatusTextColor(statusLabel);

    if (parte.es_garantia && statusLabel === 'ACEPTADO') {
      const gColor = getStatusColor('garantia');
      return <Badge
        variant="outline"
        className="rounded-xl px-2.5 py-0.5 shadow-sm border font-medium capitalize"
        style={{ backgroundColor: '#10b981', color: '#ffffff', borderColor: '#10b981' }}
      >
        Garantía
      </Badge>;
    }

    return (
      <Badge
        variant="outline"
        className="rounded-xl px-2.5 py-0.5 shadow-sm border font-medium capitalize"
        style={{
          backgroundColor: bg,
          color: text, // White text forced by statusColors
          borderColor: bg
        }}
      >
        {statusLabel}
      </Badge>
    );
  };

  const getTechnicianInfo = (parte) => {
    if (parte.tecnico_asignado_id) {
      const found = employees.find(e => e.id === parte.tecnico_asignado_id);
      if (found) return { fullName: found.fullName };
      return { fullName: 'Asignado (Desconocido)' };
    }
    return null;
  };

  const toggleSelectAll = () => {
    if (selectedPartes.size === filteredPartes.length) {
      setSelectedPartes(new Set());
    } else {
      setSelectedPartes(new Set(filteredPartes.map(p => p.id)));
    }
  };

  const toggleSelectOne = (id) => {
    const newSet = new Set(selectedPartes);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedPartes(newSet);
  };

  const openTransitionDialog = (type) => {
    setTransitionType(type);
    setTransitionNote('');
    setTransitionDialogOpen(true);
  };

  const handleBulkTransition = async () => {
    if (selectedPartes.size === 0) return;
    setProcessingTransition(true);
    try {
      const now = new Date().toISOString();
      const updates = {
        estado: transitionType.toLowerCase(),
        [transitionType === 'aceptado' ? 'finalized_at' : 'archived_at']: now,
        [transitionType === 'aceptado' ? 'finalized_by' : 'archived_by']: sessionRole.empleadoId,
      };
      const ids = Array.from(selectedPartes);
      const { error } = await supabase.from('partes').update(updates).in('id', ids);
      if (error) throw error;
      toast({ title: `Partes ${transitionType}`, description: `Se han actualizado ${ids.length} partes correctamente.` });
      setSelectedPartes(new Set());
      setTransitionDialogOpen(false);
      fetchPartes();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron actualizar los partes.' });
    } finally {
      setProcessingTransition(false);
    }
  };

  const handleDeleteClick = (e, parte) => {
    e.stopPropagation();
    if (parte.deleted_at) return;
    setParteToDelete(parte);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!parteToDelete) return;
    try {
      const { error } = await supabase
        .from('partes')
        .update({ deleted_at: new Date().toISOString(), deleted_by: sessionRole.empleadoId })
        .eq('id', parteToDelete.id);
      if (error) throw error;
      toast({ title: "Parte eliminado", description: "El parte ha sido marcado como eliminado." });
      fetchPartes();
    } catch (err) {
      console.error("Error deleting parte:", err);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el parte." });
    } finally {
      setDeleteDialogOpen(false);
      setParteToDelete(null);
    }
  };

  const handleAssignClick = (e, parte) => {
    e.stopPropagation();
    setParteToAssign(parte);
    setSelectedEmployeeId(parte.tecnico_asignado_id || '');
    setAssignDialogOpen(true);
  };

  const confirmAssignment = async () => {
    if (!parteToAssign) return;
    setAssignLoading(true);
    try {
      const newTechnicianId = (selectedEmployeeId === 'unassigned' || selectedEmployeeId === '') ? null : selectedEmployeeId;
      const { error } = await supabase.from('partes').update({ tecnico_asignado_id: newTechnicianId }).eq('id', parteToAssign.id);
      if (error) throw error;

      toast({ title: "Asignación actualizada", description: "El parte ha sido reasignado correctamente." });
      fetchPartes();
      setAssignDialogOpen(false);
    } catch (error) {
      console.error("Error assigning parte:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo asignar el parte." });
    } finally {
      setAssignLoading(false);
    }
  };

  const canManageParte = (parte) => {
    if (isAdminOrEncargado) return true;
    if (isFincaAdminUser && parte.created_by === sessionRole?.empleadoId) return true;
    return false;
  };

  return (
    <div className="p-6 w-full space-y-6 overflow-x-hidden">

      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {showArchive ? "Archivo Histórico" : "Partes de Trabajo"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {showArchive
              ? "Partes aceptados y completados."
              : "Gestión y seguimiento de partes activos."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!loading && !showArchive && !isFincaAdminUser && (
            <Button
              variant={showStats ? "secondary" : "outline"}
              onClick={() => setShowStats(!showStats)}
              className={cn("gap-2 border-dashed", isTechnician && "hidden md:flex")}
            >
              <BarChart3 className="w-4 h-4" />
              {showStats ? "Ocultar Estadísticas" : "Mostrar Estadísticas"}
            </Button>
          )}

          {canViewArchive && (
            <Button
              variant={showArchive ? "default" : "outline"}
              onClick={() => setShowArchive(!showArchive)}
              className="gap-2 border-dashed"
            >
              {showArchive ? <ArrowLeft className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              {showArchive ? "Volver a Activos" : "Archivo Histórico"}
            </Button>
          )}

          {!showArchive && canCreate && (
            <Button
              onClick={() => navigate('/gestion/partes/nuevo')}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Plus className="mr-2 h-4 w-4" /> Nuevo Parte
            </Button>
          )}
        </div>
      </div>

      {/* --- DASHBOARD STATS --- */}
      {!loading && !showArchive && !isFincaAdminUser && showStats && (
        <div className={cn("animate-in fade-in slide-in-from-top-4 duration-500", isTechnician && "hidden md:block")}>
          <PartesStatistics
            partes={filteredPartes}
            filters={filters}
            onStatusClick={handleChartStatusClick}
            onOriginClick={handleChartOriginClick}
            onClearFilters={hasActiveFilters ? clearFilters : null}
          />
        </div>
      )}

      {/* --- FILTERS & TOOLBAR --- */}
      {!showArchive && (
        <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-xl border shadow-sm items-center">

          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, dirección o ID..."
              className="pl-9 h-10 bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
            <div className="bg-muted p-1 rounded-lg flex items-center gap-1 border">
              <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-md" onClick={() => setViewMode('grid')} title="Cuadrícula">
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-md" onClick={() => setViewMode('list')} title="Lista">
                <ListIcon className="h-4 w-4" />
              </Button>
            </div>

            {creators.length > 0 && (
              <div className="w-[180px]">
                <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                  <SelectTrigger className="h-10">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <UserCheck className="w-4 h-4" />
                      <span className="text-foreground truncate">
                        {creatorFilter === 'all' ? 'Filtrar por Creador' :
                          (creators.find(c => c.id === creatorFilter)?.name || 'Creador')}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los creadores</SelectItem>
                    {creators.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="w-[180px]">
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
                <SelectTrigger className="h-10">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Filter className="w-4 h-4" />
                    <span className="text-foreground truncate">
                      {statusFilter === 'all' ? 'Estado' : getStatusLabel(statusFilter)}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {statusOrder.map((s) => (
                    <SelectItem key={s} value={s}>
                      {getStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-destructive gap-2 h-10 px-3"
                title="Limpiar filtros"
              >
                <X className="w-4 h-4" />
                <span className="hidden xl:inline">Limpiar</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* --- BULK ACTIONS --- */}
      {selectedPartes.size > 0 && canTransition && !showArchive && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-300">
            <CheckSquare className="w-4 h-4" />
            <span className="font-semibold">{selectedPartes.size}</span> seleccionados
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white border-0" onClick={() => openTransitionDialog('aceptado')}>
              <CheckCircle className="w-4 h-4 mr-2" /> Aceptar/Cerrar
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:bg-blue-100 dark:hover:bg-blue-900/40" onClick={() => setSelectedPartes(new Set())}>
              <XSquare className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* --- LIST / GRID CONTENT --- */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
      ) : showArchive ? (
        <div className="bg-card rounded-lg border shadow-sm p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {archivedGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl bg-muted/5 mx-1">
              <div className="bg-muted p-4 rounded-full mb-3"><Archive className="h-8 w-8 text-muted-foreground/50" /></div>
              <h3 className="text-lg font-medium">El archivo está vacío</h3>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-3">
              {archivedGroups.map(([key, { label, items }]) => (
                <AccordionItem value={key} key={key} className="border rounded-lg bg-card shadow-sm overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-3 px-4 bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="flex justify-between w-full pr-4 items-center">
                      <div className="flex items-center gap-3">
                        <div className="bg-white dark:bg-slate-800 p-1.5 rounded border shadow-sm"><Calendar className="w-4 h-4 text-primary" /></div>
                        <span className="font-semibold text-sm capitalize text-foreground">{label}</span>
                      </div>
                      <Badge variant="secondary" className="ml-auto font-normal text-xs px-2.5 py-0.5 h-6">{items.length} {items.length === 1 ? 'parte' : 'partes'}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 border-t">
                    <div className="divide-y">
                      {items.map(parte => {
                        const dateDisplay = parte.finalized_at || parte.archived_at || parte.fecha_cierre || parte.created_at;
                        return (
                          <div key={parte.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center">
                            <div className="flex-1 space-y-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-xs text-muted-foreground font-medium px-1.5 py-0.5 bg-muted rounded border">{parte.custom_id || '#' + parte.id.slice(0, 8)}</span>
                                {getStatusBadge(parte)}
                                <span className="text-xs text-muted-foreground ml-auto md:ml-0 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(dateDisplay), 'dd/MM/yyyy')}
                                </span>
                              </div>
                              <h4 className="font-semibold text-sm truncate pr-4 text-foreground">{parte.proyecto?.nombre_proyecto || 'Sin Proyecto Asignado'}</h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground"><User className="w-3 h-3" /><span className="font-medium text-foreground/80">{parte.cliente_nombre}</span></div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-0">
                              <Button variant="outline" size="sm" className="flex-1 md:flex-none text-xs h-8" onClick={() => navigate(`/gestion/partes/detail/${parte.id}`)}><Eye className="w-3.5 h-3.5 mr-1.5" /> Ver</Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      ) : filteredPartes.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed rounded-lg bg-muted/10">
          <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No hay partes activos encontrados</h3>
          <p className="text-muted-foreground">Prueba a cambiar los filtros.</p>
        </div>
      ) : viewMode === 'list' ? (
        /* --- LIST VIEW --- */
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {canTransition && <TableHead className="w-[40px] pl-4"><Checkbox checked={selectedPartes.size === filteredPartes.length && filteredPartes.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>}
                <TableHead className="w-[30%] pl-4">Parte</TableHead>
                <TableHead className="hidden md:table-cell w-[25%]">Dirección</TableHead>
                <TableHead className="hidden lg:table-cell w-[15%]">Técnico</TableHead>
                <TableHead className="hidden xl:table-cell w-[10%]">Fecha</TableHead>
                <TableHead className="w-[15%]">Estado</TableHead>
                <TableHead className="w-[15%] text-right pr-4">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPartes.map((parte) => {
                const tech = getTechnicianInfo(parte);
                return (
                  <TableRow
                    key={parte.id}
                    className={`hover:bg-muted/50 cursor-pointer ${parte.deleted_at ? 'opacity-60 bg-red-50/30' : ''} ${selectedPartes.has(parte.id) ? 'bg-blue-50/50' : ''}`}
                    onClick={() => navigate(`/gestion/partes/detail/${parte.id}`)}
                  >
                    {canTransition && (
                      <TableCell className="pl-4 align-middle" onClick={(e) => e.stopPropagation()}>
                        {!parte.deleted_at && (
                          <Checkbox checked={selectedPartes.has(parte.id)} onCheckedChange={() => toggleSelectOne(parte.id)} />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-medium pl-4 py-3 align-middle">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-sm text-foreground line-clamp-1">{parte.cliente_nombre}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-[10px] h-5 px-1.5 shadow-none bg-muted border border-border text-muted-foreground">
                            {parte.custom_id || `#${parte.id.slice(0, 8)}`}
                          </Badge>
                          <span className="md:hidden text-[10px] text-muted-foreground truncate max-w-[140px]">{parte.direccion_servicio}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell max-w-[200px] truncate text-muted-foreground text-sm" title={parte.direccion_servicio}>
                      {parte.direccion_servicio}
                    </TableCell>

                    <TableCell className="hidden lg:table-cell text-sm">
                      {tech ? <div className="flex items-center gap-1"><User className="w-3 h-3 text-muted-foreground" /> {tech.fullName}</div> : <span className="text-muted-foreground italic text-xs">Sin asignar</span>}
                    </TableCell>

                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                      {format(new Date(parte.created_at), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>

                    <TableCell className="align-middle">
                      {getStatusBadge(parte)}
                    </TableCell>

                    <TableCell className="text-right pr-4 align-middle">
                      <div className="flex justify-end gap-2">
                        {canManageParte(parte) && !parte.deleted_at && (
                          <>
                            {(isAdminOrEncargado || isFincaAdminUser) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600 hidden sm:inline-flex" onClick={(e) => handleAssignClick(e, parte)} title="Asignar"><UserCog className="w-4 h-4" /></Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/gestion/partes/editar/${parte.id}`); }} title="Editar"><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hidden sm:inline-flex" onClick={(e) => handleDeleteClick(e, parte)} title="Eliminar"><Trash2 className="w-4 h-4" /></Button>
                          </>
                        )}
                        {parte.deleted_at ? (
                          <Button variant="ghost" size="sm" disabled className="h-8 text-red-500"><EyeOff className="w-4 h-4 mr-1" /> Eliminado</Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-8 sm:hidden">Ver</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* --- GRID VIEW --- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPartes.map((parte) => {
            const tech = getTechnicianInfo(parte);
            const isClosed = parte.estado_ui === 'ACEPTADO';

            return (
              <Card
                key={parte.id}
                className={`hover:shadow-md transition-all cursor-pointer border-l-4 group relative rounded-xl ${parte.deleted_at ? 'border-l-red-400 bg-red-50/30 opacity-75' : isClosed ? 'border-l-teal-500' : 'border-l-primary'
                  }`}
                onClick={() => navigate(`/gestion/partes/detail/${parte.id}`)}
              >
                {canTransition && !parte.deleted_at && (
                  <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedPartes.has(parte.id)} onCheckedChange={() => toggleSelectOne(parte.id)} />
                  </div>
                )}

                {canManageParte(parte) && !parte.deleted_at && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-card/80 backdrop-blur-sm rounded-md p-1 shadow-sm border z-10">
                    {(isAdminOrEncargado || isFincaAdminUser) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-600" onClick={(e) => handleAssignClick(e, parte)} title="Asignar"><UserCog className="w-3.5 h-3.5" /></Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/gestion/partes/editar/${parte.id}`); }}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => handleDeleteClick(e, parte)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                )}

                <CardHeader className="pb-3 space-y-2 pl-10 pt-4">
                  <div className="flex justify-between items-start pr-8">
                    <Badge variant="secondary" className="font-mono text-xs opacity-70">
                      {parte.custom_id || `#${parte.id.slice(0, 8)}`}
                    </Badge>
                    {getStatusBadge(parte)}
                  </div>
                  <div>
                    <CardTitle className="text-lg leading-tight truncate group-hover:text-primary transition-colors" title={parte.cliente_nombre}>{parte.cliente_nombre}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1 truncate"><MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{parte.direccion_servicio}</span></CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pb-4 text-sm border-t pt-3 bg-muted/5">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span>{format(new Date(parte.created_at), 'dd MMM yyyy', { locale: es })}</span></div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4" /><span className="truncate font-medium text-foreground/80">{tech ? tech.fullName : 'Sin técnico asignado'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs: Assign, Transition, Delete... */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Parte</DialogTitle>
            <DialogDescription>
              Selecciona un técnico o encargado para asignar al parte.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="employee-select" className="mb-2 block">Empleado Asignado</Label>
            <Select value={selectedEmployeeId || 'unassigned'} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger id="employee-select"><SelectValue placeholder="Seleccionar empleado..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">-- Sin asignar --</SelectItem>
                {employees.map(emp => (<SelectItem key={emp.id} value={emp.id}>{emp.fullName}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmAssignment} disabled={assignLoading}>{assignLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Guardar Asignación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transitionDialogOpen} onOpenChange={setTransitionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aceptar Partes</DialogTitle>
            <DialogDescription>
              Vas a marcar como {transitionType} {selectedPartes.size} partes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="transition-note" className="mb-2 block">Nota (Opcional)</Label>
            <Textarea id="transition-note" placeholder="Detalles..." value={transitionNote} onChange={(e) => setTransitionNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleBulkTransition} disabled={processingTransition} className="bg-green-600 hover:bg-green-700 text-white">
              {processingTransition && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>El parte de trabajo será marcado como eliminado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PartesAdminView;