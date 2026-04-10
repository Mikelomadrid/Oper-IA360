import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, RefreshCw, Warehouse, Briefcase, Trash2, Pencil, AlertCircle, Filter, FileText, List as ListIcon, PauseCircle, PlayCircle, Euro, PieChart, Building2, Download, MessageCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, formatSecondsToHoursMinutes, fmtMadrid, formatCurrency, formatDecimalHoursToHoursMinutes } from '@/lib/utils';
import { DateRangePicker } from '@/components/DateRangePicker';
import FichajeDetailModal from './FichajeDetailModal';
import * as XLSX from 'xlsx';

/**
 * AdminFichajes
 * - Listado de fichajes utilizando 'v_fichajes_admin_ui' para obtener nombres de proyecto y detalles.
 * - Reporte de costes utilizando 'v_fichajes_admin_neto_v5' y enriquecimiento cliente-side.
 */

const AdminFichajes = () => {
  const {
    sessionRole
  } = useAuth();

  // --- List State ---
  const [fichajes, setFichajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    empleado: 'all',
    proyecto: 'all',
    estado: 'all' // abierto, cerrado
  });
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    // Default to start of current month
    to: new Date()
  });

  // --- Summary/Cost State ---
  const [costData, setCostData] = useState([]);
  const [costLoading, setCostLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  // --- CRUD Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [actionLoading, setActionLoading] = useState(false);

  // --- Delete Alert State ---
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  // --- Detail Modal State ---
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedFichajeId, setSelectedFichajeId] = useState(null);

  // --- Form Data ---
  const initialFormData = {
    id: null,
    empleado_id: '',
    tipo_destino: 'obra',
    // 'obra' | 'nave'
    proyecto_id: '',
    hora_entrada: '',
    hora_salida: ''
  };
  const [formData, setFormData] = useState(initialFormData);

  // --- Selectors Data ---
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);

  // --- Initial Load ---
  useEffect(() => {
    fetchSelectors();
    fetchFichajes();
  }, []);
  useEffect(() => {
    if (activeTab === 'list') {
      fetchFichajes();
    } else if (activeTab === 'costs') {
      fetchCostReport();
    }
  }, [filters, dateRange, activeTab]);
  const fetchSelectors = async () => {
    try {
      const {
        data: emps
      } = await supabase.from('vw_selector_empleados_fichaje').select('*').order('label');
      const {
        data: projs
      } = await supabase.from('vw_selector_proyectos_fichaje').select('*').order('label');
      setEmployees(emps || []);
      setProjects(projs || []);
    } catch (error) {
      console.error("Error loading selectors:", error);
    }
  };
  const fetchFichajes = async () => {
    setLoading(true);
    try {
      // 1. Fetch Fichajes from UI View (includes project names)
      let query = supabase.from('v_fichajes_admin_ui').select('*').order('hora_entrada', {
        ascending: false
      });
      if (filters.empleado && filters.empleado !== 'all') {
        query = query.eq('empleado_id', filters.empleado);
      }
      if (filters.proyecto && filters.proyecto !== 'all') {
        if (filters.proyecto === 'nave') {
          // In UI view, null project implies Nave/General
          query = query.is('proyecto_id', null);
        } else {
          query = query.eq('proyecto_id', filters.proyecto);
        }
      }
      if (dateRange?.from) {
        query = query.gte('hora_entrada', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('hora_entrada', toDate.toISOString());
      }
      if (filters.estado === 'abierto') {
        query = query.is('hora_salida', null);
      } else if (filters.estado === 'cerrado') {
        query = query.not('hora_salida', 'is', null);
      }
      const {
        data: fichajesData,
        error
      } = await query.limit(200);
      if (error) throw error;

      // 2. Fetch Active Pauses
      const fichajeIds = fichajesData?.map(f => f.id) || [];
      let pausesMap = new Map();
      if (fichajeIds.length > 0) {
        const {
          data: pauses,
          error: pausesError
        } = await supabase.from('pausas').select('fichaje_id, hora_fin_pausa').in('fichaje_id', fichajeIds).is('hora_fin_pausa', null);
        if (!pausesError && pauses) {
          pauses.forEach(p => {
            pausesMap.set(p.fichaje_id, true);
          });
        }
      }

      // 3. Fetch Notes/Comments existence
      let notesSet = new Set();
      if (fichajeIds.length > 0) {
        const { data: notesData, error: notesError } = await supabase
          .from('horas_extras_notas')
          .select('fichaje_id')
          .in('fichaje_id', fichajeIds)
          .neq('nota', ''); // ensure note is not empty

        if (!notesError && notesData) {
          notesData.forEach(n => notesSet.add(n.fichaje_id));
        }
      }

      const mergedData = fichajesData?.map(f => {
        // Resolve project name (prioritize fetched name, fallback to 'Sin asignar' or 'NAVE/TALLER')
        let locationName = 'Sin asignar';
        let locationType = 'Desconocido';
        if (f.proyecto_id) {
          locationName = f.nombre_proyecto || f.proyecto_nombre || 'Sin nombre';
          locationType = 'Obra';
        } else {
          locationName = 'NAVE / TALLER';
          locationType = 'Nave/Taller';
        }
        return {
          ...f,
          is_active_pause: pausesMap.has(f.id),
          is_shift_open: !f.hora_salida,
          location_type: locationType,
          location_name: locationName,
          has_notes: notesSet.has(f.id)
        };
      }) || [];
      setFichajes(mergedData);
    } catch (error) {
      console.error("Error fetching fichajes:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los fichajes."
      });
    } finally {
      setLoading(false);
    }
  };
  const fetchCostReport = async () => {
    setCostLoading(true);
    try {
      // Fetch base data for calculation
      let query = supabase.from('v_fichajes_admin_neto_v5').select(`
                id, 
                empleado_id, 
                empleado_nombre, 
                empleado_apellidos,
                proyecto_id, 
                centro_coste_interno_id,
                duracion_neta_segundos,
                hora_entrada
            `);

      // Apply Date Filters
      if (dateRange?.from) {
        query = query.gte('hora_entrada', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('hora_entrada', toDate.toISOString());
      }
      const {
        data,
        error
      } = await query;
      if (error) throw error;

      // Fetch employee costs to calculate totals
      const {
        data: empCosts
      } = await supabase.from('empleados').select('id, costo_por_hora');
      const costMap = new Map(empCosts?.map(e => [e.id, Number(e.costo_por_hora) || 0]));

      // Aggregate
      const grouped = {};
      data.forEach(row => {
        const isNave = !row.proyecto_id;
        const locId = row.proyecto_id || 'nave-taller';

        // Resolve name using projects state if possible, as view v5 might miss it
        let locName = 'Proyecto Desconocido';
        if (isNave) {
          locName = 'NAVE / TALLER (Gastos Generales)';
        } else {
          const proj = projects.find(p => p.value === row.proyecto_id);
          locName = proj ? proj.label : row.nombre_ubicacion || 'Sin nombre';
        }
        const type = isNave ? 'gastos_generales' : 'obra';
        if (!grouped[locId]) {
          grouped[locId] = {
            id: locId,
            name: locName,
            type: type,
            totalHours: 0,
            totalCost: 0,
            employees: {}
          };
        }
        const hours = (row.duracion_neta_segundos || 0) / 3600;
        const rate = costMap.get(row.empleado_id) || 0;
        const cost = hours * rate;
        grouped[locId].totalHours += hours;
        grouped[locId].totalCost += cost;

        // Employee detail inside location
        if (!grouped[locId].employees[row.empleado_id]) {
          grouped[locId].employees[row.empleado_id] = {
            name: `${row.empleado_nombre || ''} ${row.empleado_apellidos || ''}`.trim(),
            hours: 0,
            cost: 0
          };
        }
        grouped[locId].employees[row.empleado_id].hours += hours;
        grouped[locId].employees[row.empleado_id].cost += cost;
      });
      setCostData(Object.values(grouped).sort((a, b) => b.totalCost - a.totalCost));
    } catch (error) {
      console.error("Error fetching cost report:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo generar el reporte de costes."
      });
    } finally {
      setCostLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!fichajes || fichajes.length === 0) {
      toast({
        variant: "destructive",
        title: "Sin datos",
        description: "No hay fichajes para exportar con los filtros actuales."
      });
      return;
    }

    try {
      const dataToExport = fichajes.map(f => ({
        'Empleado': f.empleado_nombre || employees.find(e => e.value === f.empleado_id)?.label || 'Desconocido',
        'Email': f.empleado_email || '',
        'Fecha': f.hora_entrada ? format(new Date(f.hora_entrada), 'dd/MM/yyyy') : '',
        'Hora Entrada': f.hora_entrada ? format(new Date(f.hora_entrada), 'HH:mm') : '',
        'Hora Salida': f.hora_salida ? format(new Date(f.hora_salida), 'HH:mm') : '-',
        'Ubicación': f.location_name || '',
        'Tipo Ubicación': f.location_type || '',
        'Duración (h:m)': f.duracion_neta_segundos ? formatSecondsToHoursMinutes(f.duracion_neta_segundos) : '0h 0m',
        'Estado': f.is_active_pause ? 'En Pausa' : (f.is_shift_open ? 'Activo' : 'Cerrado'),
        'Notas': f.has_notes ? 'Sí' : 'No'
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // Auto-width columns
      const colWidths = [
        { wch: 30 }, // Empleado
        { wch: 30 }, // Email
        { wch: 12 }, // Fecha
        { wch: 12 }, // Hora Entrada
        { wch: 12 }, // Hora Salida
        { wch: 40 }, // Ubicación
        { wch: 15 }, // Tipo
        { wch: 15 }, // Duración
        { wch: 15 }, // Estado
        { wch: 10 }  // Notas
      ];
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Fichajes");

      const filename = `fichajes_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast({
        title: "Exportación exitosa",
        description: `Se ha generado el archivo ${filename}`
      });
    } catch (error) {
      console.error("Error exporting excel:", error);
      toast({
        variant: "destructive",
        title: "Error al exportar",
        description: "Ocurrió un error al generar el archivo Excel."
      });
    }
  };

  // --- Handlers ---

  const openCreateModal = () => {
    setModalMode('create');
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setFormData({
      ...initialFormData,
      hora_entrada: localIso
    });
    setIsModalOpen(true);
  };
  const openEditModal = record => {
    setModalMode('edit');
    const formatForInput = dateStr => {
      if (!dateStr) return '';
      if (dateStr.endsWith('Z')) {
        const d = new Date(dateStr);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      }
      return dateStr.slice(0, 16);
    };
    setFormData({
      id: record.id,
      empleado_id: record.empleado_id,
      tipo_destino: record.proyecto_id ? 'obra' : 'nave',
      // Logic updated: if project_id exists -> obra
      proyecto_id: record.proyecto_id || '',
      hora_entrada: formatForInput(record.hora_entrada),
      hora_salida: formatForInput(record.hora_salida)
    });
    setIsModalOpen(true);
  };
  const handleRowClick = fichaje => {
    setSelectedFichajeId(fichaje.id);
    setDetailModalOpen(true);
  };
  const handleSave = async () => {
    if (!formData.empleado_id) {
      toast({
        variant: "destructive",
        title: "Falta empleado",
        description: "Selecciona un empleado."
      });
      return;
    }
    if (formData.tipo_destino === 'obra' && !formData.proyecto_id) {
      toast({
        variant: "destructive",
        title: "Falta proyecto",
        description: "Selecciona un proyecto."
      });
      return;
    }
    if (!formData.hora_entrada) {
      toast({
        variant: "destructive",
        title: "Falta hora entrada",
        description: "La hora de entrada es obligatoria."
      });
      return;
    }
    setActionLoading(true);
    try {
      const entryDateISO = new Date(formData.hora_entrada).toISOString();
      const exitDateISO = formData.hora_salida ? new Date(formData.hora_salida).toISOString() : null;
      const commonParams = {
        p_empleado_id: formData.empleado_id,
        p_proyecto_id: formData.tipo_destino === 'obra' ? formData.proyecto_id : null,
        p_centro_coste_interno_id: formData.tipo_destino === 'nave' ? 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' : null,
        p_hora_entrada: entryDateISO,
        p_hora_salida: exitDateISO
      };
      if (modalMode === 'create') {
        const {
          error
        } = await supabase.rpc('admin_create_fichaje_full', {
          ...commonParams,
          p_tipo: formData.tipo_destino === 'nave' ? 'nave_taller' : 'entrada_obra',
          p_pausas: null
        });
        if (error) throw error;
        toast({
          className: "bg-green-600 text-white",
          title: "Creado",
          description: "Fichaje registrado correctamente."
        });
      } else {
        const {
          error
        } = await supabase.rpc('admin_update_fichaje_full', {
          ...commonParams,
          p_fichaje_id: formData.id
        });
        if (error) throw error;
        toast({
          className: "bg-blue-600 text-white",
          title: "Actualizado",
          description: "Fichaje actualizado correctamente."
        });
      }
      setIsModalOpen(false);
      if (activeTab === 'list') fetchFichajes();
      if (activeTab === 'costs') fetchCostReport();
    } catch (error) {
      console.error("Save error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error al guardar."
      });
    } finally {
      setActionLoading(false);
    }
  };
  const handleDeleteClick = record => {
    if (!record || !record.id) return;
    setRecordToDelete(record);
    setDeleteAlertOpen(true);
  };
  const confirmDelete = async () => {
    if (!recordToDelete || !recordToDelete.id) {
      setDeleteAlertOpen(false);
      return;
    }
    try {
      const {
        error
      } = await supabase.rpc('fichaje_delete', {
        p_fichaje_id: recordToDelete.id
      });
      if (error) throw error;
      toast({
        className: "bg-green-600 text-white",
        title: "Eliminado",
        description: "Fichaje eliminado correctamente."
      });
      if (activeTab === 'list') await fetchFichajes();
      if (activeTab === 'costs') await fetchCostReport();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description: error.message
      });
    } finally {
      setDeleteAlertOpen(false);
      setRecordToDelete(null);
    }
  };
  return <div className="p-6 w-full">

    {/* Header */}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mx-auto w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Fichajes</h1>
        <p className="text-muted-foreground">Gestión de tiempos, ubicaciones y costes por obra.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => {
          if (activeTab === 'list') fetchFichajes(); else fetchCostReport();
        }} variant="outline" size="icon" className="rounded-xl" title="Recargar">
          <RefreshCw className={cn("w-4 h-4", (loading || costLoading) && "animate-spin")} />
        </Button>
        <Button onClick={handleExportExcel} variant="outline" className="gap-2 rounded-xl shadow-sm bg-white hover:bg-slate-50 border-slate-200">
          <Download className="w-4 h-4 text-green-600" />
          <span className="hidden sm:inline">Exportar Excel</span>
        </Button>
        <Button onClick={openCreateModal} className="gap-2 rounded-xl shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="w-4 h-4" /> Nuevo Fichaje
        </Button>
      </div>
    </div>

    {/* Filters */}
    <Card className="rounded-xl shadow-sm border-border/50 mx-auto mt-6 w-full">
      <CardHeader className="pb-3 pt-4 px-6">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Filter className="w-3 h-3" /> Filtros Globales
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 px-6 pb-4">
        <Select value={filters.empleado} onValueChange={v => setFilters(prev => ({
          ...prev,
          empleado: v
        }))}>
          <SelectTrigger className="rounded-lg border-muted">
            <SelectValue placeholder="Empleado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los empleados</SelectItem>
            {employees.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.proyecto} onValueChange={v => setFilters(prev => ({
          ...prev,
          proyecto: v
        }))}>
          <SelectTrigger className="rounded-lg border-muted">
            <SelectValue placeholder="Ubicación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ubicaciones</SelectItem>
            <SelectItem value="nave" className="font-semibold text-orange-600">
              <Warehouse className="w-3 h-3 inline mr-2" /> NAVE / TALLER
            </SelectItem>
            {projects.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <DateRangePicker date={dateRange} setDate={setDateRange} className="w-full rounded-lg border-muted" />

        <Select value={filters.estado} onValueChange={v => setFilters(prev => ({
          ...prev,
          estado: v
        }))}>
          <SelectTrigger className="rounded-lg border-muted">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquier Estado</SelectItem>
            <SelectItem value="abierto">En Curso / Pausa</SelectItem>
            <SelectItem value="cerrado">Cerrado</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>

    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mx-auto mt-6">
      <TabsList className="mb-4 bg-muted/20 p-1 rounded-xl">
        <TabsTrigger value="list" className="rounded-lg gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
          <ListIcon className="w-4 h-4" /> Listado Detallado
        </TabsTrigger>
        <TabsTrigger value="costs" className="rounded-lg gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
          <Euro className="w-4 h-4" /> Reporte de Costes
        </TabsTrigger>
      </TabsList>

      <TabsContent value="list">
        {/* List Table */}
        <Card className="rounded-xl shadow-sm border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-[220px] font-semibold">Empleado</TableHead>
                    <TableHead className="w-[140px] font-semibold">Fecha</TableHead>
                    <TableHead className="w-[100px] font-semibold">Horario</TableHead>
                    <TableHead className="w-[280px] font-semibold">Obra / Ubicación</TableHead>
                    <TableHead className="text-right w-[100px] font-semibold">Duración</TableHead>
                    <TableHead className="text-center w-[120px] font-semibold">Estado</TableHead>
                    <TableHead className="text-center w-[60px] font-semibold">Notas</TableHead>
                    <TableHead className="text-right w-[100px] font-semibold"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" /> Cargando fichajes...
                      </div>
                    </TableCell>
                  </TableRow> : fichajes.length === 0 ? <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      No se encontraron registros.
                    </TableCell>
                  </TableRow> : fichajes.map(f => <TableRow key={f.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors cursor-pointer group border-b border-border/50" onClick={() => handleRowClick(f)}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {f.empleado_nombre || employees.find(e => e.value === f.empleado_id)?.label || 'Desconocido'}
                        </span>
                        <span className="text-xs text-muted-foreground">{f.empleado_email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {fmtMadrid(f.hora_entrada, 'date')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs font-mono">
                        <span className="text-green-700 dark:text-green-400">IN: {fmtMadrid(f.hora_entrada, 'time')}</span>
                        <span className="text-red-700 dark:text-red-400">
                          OUT: {f.hora_salida ? fmtMadrid(f.hora_salida, 'time') : '--:--'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {f.location_type === 'Nave/Taller' ? <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-medium flex items-center gap-1.5 py-1 px-2.5 rounded-md shadow-sm">
                          <Warehouse className="w-3.5 h-3.5" />
                          NAVE / TALLER
                        </Badge> : f.proyecto_id ? <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium flex items-center gap-1.5 py-1 px-2.5 rounded-md shadow-sm">
                          <Briefcase className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[200px]" title={f.location_name}>{f.location_name}</span>
                        </Badge> : <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                          Sin asignar
                        </Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {f.duracion_neta_segundos ? formatSecondsToHoursMinutes(f.duracion_neta_segundos) : '0h 0m'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {f.is_active_pause ? <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                        <PauseCircle className="w-3 h-3 mr-1" /> Pausa
                      </span> : f.is_shift_open ? <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                        Activo
                      </span> : <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                        Cerrado
                      </span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {f.has_notes && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-amber-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(f);
                          }}
                          title="Ver nota"
                        >
                          <MessageCircle className="w-5 h-5 text-amber-500 fill-amber-500" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50" onClick={e => {
                          e.stopPropagation();
                          openEditModal(f);
                        }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50" onClick={e => {
                          e.stopPropagation();
                          handleDeleteClick(f);
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>)}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="costs">
        <div className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-orange-50/50 border-orange-100 dark:bg-orange-950/10 dark:border-orange-900/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium text-orange-700 flex items-center gap-2">
                  <Warehouse className="w-5 h-5" /> Gastos Generales (Nave/Taller)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">
                  {formatCurrency(costData.filter(c => c.type === 'gastos_generales').reduce((a, b) => a + b.totalCost, 0))}
                </div>
                <p className="text-sm text-orange-600/80">
                  {formatDecimalHoursToHoursMinutes(costData.filter(c => c.type === 'gastos_generales').reduce((a, b) => a + b.totalHours, 0))} horas totales
                </p>
              </CardContent>
            </Card>
            <Card className="bg-blue-50/50 border-blue-100 dark:bg-blue-950/10 dark:border-blue-900/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium text-blue-700 flex items-center gap-2">
                  <Briefcase className="w-5 h-5" /> Costes por Obra
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                  {formatCurrency(costData.filter(c => c.type === 'obra').reduce((a, b) => a + b.totalCost, 0))}
                </div>
                <p className="text-sm text-blue-600/80">
                  {formatDecimalHoursToHoursMinutes(costData.filter(c => c.type === 'obra').reduce((a, b) => a + b.totalHours, 0))} horas totales
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-gray-500" /> Desglose Detallado
              </CardTitle>
              <CardDescription>
                Costes de mano de obra agrupados por ubicación (Proyecto vs Nave)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[400px]">Ubicación</TableHead>
                    <TableHead className="w-[150px]">Tipo</TableHead>
                    <TableHead className="text-right">Horas Totales</TableHead>
                    <TableHead className="text-right">Coste Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costLoading ? <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow> : costData.length === 0 ? <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No hay datos de costes para el periodo seleccionado.
                    </TableCell>
                  </TableRow> : costData.map(item => <React.Fragment key={item.id}>
                    <TableRow className="bg-gray-50/50 hover:bg-gray-100/50 dark:bg-gray-900/20 font-medium">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.type === 'gastos_generales' ? <Warehouse className="w-4 h-4 text-orange-500" /> : <Briefcase className="w-4 h-4 text-blue-500" />}
                          {item.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-1 rounded-full border", item.type === 'gastos_generales' ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                          {item.type === 'gastos_generales' ? 'Gastos Generales' : 'Obra'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatDecimalHoursToHoursMinutes(item.totalHours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.totalCost)}</TableCell>
                    </TableRow>
                    {/* Employee Breakdown rows */}
                    {Object.entries(item.employees).map(([empId, empData]) => <TableRow key={`${item.id}-${empId}`} className="text-sm border-0 hover:bg-transparent">
                      <TableCell className="pl-10 text-muted-foreground">
                        ↳ {empData.name}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right text-muted-foreground font-mono text-xs">
                        {formatDecimalHoursToHoursMinutes(empData.hours)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground font-mono text-xs">
                        {formatCurrency(empData.cost)}
                      </TableCell>
                    </TableRow>)}
                  </React.Fragment>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>

    {/* --- CREATE / EDIT MODAL --- */}
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogContent className="sm:max-w-[500px] rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {modalMode === 'create' ? <><Plus className="w-5 h-5 text-primary" /> Registrar Fichaje Manual</> : <><Pencil className="w-5 h-5 text-primary" /> Editar Fichaje</>}
          </DialogTitle>
          <DialogDescription>
            {modalMode === 'create' ? 'Introduce los detalles para registrar un nuevo turno. Selecciona Obra o Nave.' : 'Modifica los tiempos, empleado o ubicación del registro.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {/* Empleado */}
          <div className="space-y-2">
            <Label htmlFor="empleado">Empleado</Label>
            <Select value={formData.empleado_id} onValueChange={v => setFormData({
              ...formData,
              empleado_id: v
            })}>
              <SelectTrigger id="empleado" className="rounded-lg">
                <SelectValue placeholder="Seleccionar empleado..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo Destino */}
          <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-4">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Asignación de Costes</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Ubicación</Label>
                <Select value={formData.tipo_destino} onValueChange={v => setFormData({
                  ...formData,
                  tipo_destino: v,
                  proyecto_id: ''
                })}>
                  <SelectTrigger className="rounded-lg bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="obra"><Briefcase className="w-3 h-3 inline mr-2 text-blue-500" /> Obra / Proyecto</SelectItem>
                    <SelectItem value="nave"><Warehouse className="w-3 h-3 inline mr-2 text-orange-500" /> Nave / Taller</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proyecto">
                  {formData.tipo_destino === 'obra' ? 'Seleccionar Proyecto' : 'Centro de Coste'}
                </Label>
                {formData.tipo_destino === 'obra' ? <Select value={formData.proyecto_id} onValueChange={v => setFormData({
                  ...formData,
                  proyecto_id: v
                })}>
                  <SelectTrigger id="proyecto" className="rounded-lg bg-background">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select> : <div className="flex items-center px-3 h-10 rounded-lg border bg-orange-50 text-orange-700 text-sm font-medium">
                  <Warehouse className="w-4 h-4 mr-2" /> Gastos Generales
                </div>}
              </div>
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entrada" className="text-green-700 font-medium">Hora Entrada</Label>
              <Input id="entrada" type="datetime-local" className="rounded-lg" value={formData.hora_entrada} onChange={e => setFormData({
                ...formData,
                hora_entrada: e.target.value
              })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salida" className="text-red-700 font-medium">Hora Salida (Opcional)</Label>
              <Input id="salida" type="datetime-local" className="rounded-lg" value={formData.hora_salida} onChange={e => setFormData({
                ...formData,
                hora_salida: e.target.value
              })} />
            </div>
          </div>

        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-lg">Cancelar</Button>
          <Button onClick={handleSave} disabled={actionLoading} className="rounded-lg min-w-[100px]">
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* --- DELETE ALERT --- */}
    <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
      <AlertDialogContent className="rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Confirmar Eliminación
          </AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que deseas eliminar este registro de fichaje?
            <br />
            <span className="font-semibold text-gray-700 block mt-2">
              {recordToDelete && <>
                {recordToDelete.empleado_nombre || 'Empleado'} - {fmtMadrid(recordToDelete.hora_entrada, 'short')}
              </>}
            </span>
            <span className="block mt-2 text-xs text-muted-foreground">
              Esta acción eliminará también las pausas asociadas y no se puede deshacer.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-lg">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* --- FICHAJE DETAIL MODAL --- */}
    {detailModalOpen && <FichajeDetailModal fichajeId={selectedFichajeId} isOpen={detailModalOpen} onClose={() => {
      setDetailModalOpen(false);
      setSelectedFichajeId(null);
    }} />}

  </div>;
};
export default AdminFichajes;