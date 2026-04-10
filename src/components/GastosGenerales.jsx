import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Search, RefreshCw, Pencil, Trash2, Building2, Receipt, Banknote, Filter, X, Calendar as CalendarIcon, Scan } from 'lucide-react';
import { format } from 'date-fns';
import { ProviderSelect } from '@/components/ProviderSelect';
import { AsyncSearchableSelector } from '@/components/AsyncSearchableSelector';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import FotoEvidencia from '@/components/FotoEvidencia';
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
import { cn } from "@/lib/utils";

/**
 * GastosGenerales Component
 * 
 * Manages two types of records:
 * 1. 'Facturas' (Table: public.gastos) - External invoices with providers, projects, VAT.
 * 2. 'Gastos' (Table: public.gastos_generales) - Internal expenses (payroll, etc.) without provider/VAT logic.
 */

const GastosGenerales = ({ navigate }) => {
  const { sessionRole, user } = useAuth();
  const isAdmin = sessionRole?.rol === 'admin';

  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('factura');
  const [saving, setSaving] = useState(false);

  // --- FILTERS STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'factura', 'gasto'
  const [filterProviderId, setFilterProviderId] = useState(null);
  const [filterProviderLabel, setFilterProviderLabel] = useState('');
  const [filterEstadoPago, setFilterEstadoPago] = useState('all'); // 'all', 'pagada', 'pendiente_pago', 'parcialmente_pagada', 'vencida'

  // Edit & Delete states
  const [editingId, setEditingId] = useState(null);
  const [editingType, setEditingType] = useState(null); // 'factura' or 'gasto'
  const [gastoToDelete, setGastoToDelete] = useState(null);

  // Initial labels for modal selectors
  const [initialProviderLabel, setInitialProviderLabel] = useState('');
  const [initialProjectLabel, setInitialProjectLabel] = useState('');

  // --- FORMS STATE ---
  const [facturaForm, setFacturaForm] = useState({
    fecha_emision: format(new Date(), 'yyyy-MM-dd'),
    fecha_vencimiento: '',
    proveedor_id: '',
    proyecto_id: '',
    numero_factura: '',
    concepto: '',
    monto_bruto: '',
    iva_percentage: '21',
    estado_pago: 'pendiente_pago',
    numero_referencia: '',
    archivo: null
  });

  const [gastoForm, setGastoForm] = useState({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    tipo: 'Otros',
    descripcion: '',
    importe: '',
    archivo: null
  });

  const fetchGastos = useCallback(async () => {
    setLoading(true);
    try {
      let facturasData = [];
      let gastosData = [];

      // 1. Fetch Facturas (from 'gastos' table)
      if (filterType === 'all' || filterType === 'factura') {
        let queryRaw = supabase
          .from('gastos')
          .select(`
                *,
                proveedor:proveedores(nombre),
                proyecto:proyectos(nombre_proyecto)
            `)
          .order('fecha_emision', { ascending: false });

        if (dateFrom) queryRaw = queryRaw.gte('fecha_emision', dateFrom);
        if (dateTo) queryRaw = queryRaw.lte('fecha_emision', dateTo);
        if (filterProviderId) queryRaw = queryRaw.eq('proveedor_id', filterProviderId);
        if (filterEstadoPago !== 'all') queryRaw = queryRaw.eq('estado_pago', filterEstadoPago);

        if (searchTerm) {
          queryRaw = queryRaw.or(`concepto.ilike.%${searchTerm}%,numero_factura.ilike.%${searchTerm}%`);
        }

        const { data: rawData, error: rawError } = await queryRaw;

        if (rawError) {
          console.error("Error fetching facturas:", rawError);
          toast({ variant: 'destructive', title: 'Error', description: 'Error cargando facturas: ' + rawError.message });
        } else if (rawData) {
          facturasData = rawData.filter(item => {
            return true;
          });
        }
      }

      // 2. Fetch Gastos (from 'gastos_generales' table)
      if ((filterType === 'all' || filterType === 'gasto') && !filterProviderId) {
        let queryGastos = supabase
          .from('gastos_generales')
          .select('*')
          .order('fecha', { ascending: false });

        if (dateFrom) queryGastos = queryGastos.gte('fecha', dateFrom);
        if (dateTo) queryGastos = queryGastos.lte('fecha', dateTo);
        if (searchTerm) {
          queryGastos = queryGastos.or(`descripcion.ilike.%${searchTerm}%,tipo.ilike.%${searchTerm}%`);
        }

        const { data: rawGastos, error: gastosError } = await queryGastos;

        if (gastosError) {
          console.error("Error fetching gastos generales:", gastosError);
        } else {
          gastosData = rawGastos || [];
        }
      }

      // Normalize Facturas
      const facturas = facturasData.map(f => ({
        ...f,
        _type: 'factura',
        display_date: f.fecha_emision,
        display_provider: f.proveedor?.nombre || 'Proveedor Desconocido',
        proveedor_nombre: f.proveedor?.nombre,
        display_ref: f.numero_factura,
        display_concept: f.concepto,
        display_amount: f.total_con_iva,
        display_status: f.estado_pago,
        project_name: f.proyecto?.nombre_proyecto
      }));

      // Normalize Gastos
      const gastosSimples = gastosData.map(g => ({
        ...g,
        _type: 'gasto',
        display_date: g.fecha,
        display_provider: 'Interno',
        display_ref: g.tipo,
        display_concept: g.descripcion,
        display_amount: g.importe,
        display_status: 'pagada'
      }));

      // Combine and Sort
      const combined = [...facturas, ...gastosSimples].sort((a, b) => new Date(b.display_date) - new Date(a.display_date));

      // Client-side search refinement
      let finalFiltered = combined;
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        finalFiltered = combined.filter(item =>
          (item.display_provider && item.display_provider.toLowerCase().includes(lowerTerm)) ||
          (item.display_ref && item.display_ref.toLowerCase().includes(lowerTerm)) ||
          (item.display_concept && item.display_concept.toLowerCase().includes(lowerTerm)) ||
          (item.project_name && item.project_name.toLowerCase().includes(lowerTerm))
        );
      }

      setGastos(finalFiltered);

    } catch (error) {
      console.error('Error general fetching gastos:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los registros.' });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, dateFrom, dateTo, filterType, filterProviderId, filterEstadoPago]);

  useEffect(() => {
    fetchGastos();
  }, [fetchGastos]);

  const totals = useMemo(() => {
    return gastos.reduce((acc, curr) => {
      return acc + (Number(curr.display_amount) || 0);
    }, 0);
  }, [gastos]);

  // --- HANDLERS FOR FACTURA FORM ---
  const handleFacturaChange = (e) => {
    const { name, value } = e.target;
    setFacturaForm(prev => ({ ...prev, [name]: value }));
  };
  const handleFacturaSelectChange = (name, value) => {
    setFacturaForm(prev => ({ ...prev, [name]: value }));
  };
  const handleFacturaFile = (file) => {
    setFacturaForm(prev => ({ ...prev, archivo: file }));
  };

  // --- HANDLERS FOR GASTO FORM ---
  const handleGastoChange = (e) => {
    const { name, value } = e.target;
    setGastoForm(prev => ({ ...prev, [name]: value }));
  };
  const handleGastoSelectChange = (name, value) => {
    setGastoForm(prev => ({ ...prev, [name]: value }));
  };
  const handleGastoFile = (file) => {
    setGastoForm(prev => ({ ...prev, archivo: file }));
  };

  const calculateIvaAmount = () => {
    const bruto = parseFloat(facturaForm.monto_bruto) || 0;
    const percentage = parseFloat(facturaForm.iva_percentage) || 0;
    return (bruto * percentage / 100);
  };

  const resetForms = () => {
    setFacturaForm({
      fecha_emision: format(new Date(), 'yyyy-MM-dd'),
      fecha_vencimiento: '',
      proveedor_id: '',
      proyecto_id: '',
      numero_factura: '',
      concepto: '',
      monto_bruto: '',
      iva_percentage: '21',
      estado_pago: 'pendiente_pago',
      numero_referencia: '',
      archivo: null
    });
    setGastoForm({
      fecha: format(new Date(), 'yyyy-MM-dd'),
      tipo: 'Otros',
      descripcion: '',
      importe: '',
      archivo: null
    });
    setInitialProviderLabel('');
    setInitialProjectLabel('');
    setEditingId(null);
    setEditingType(null);
    setActiveTab('factura');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setFilterType('all');
    setFilterProviderId(null);
    setFilterProviderLabel('');
    setFilterEstadoPago('all');
  };

  const handleOpenCreate = () => {
    // We do NOT clear filters automatically to preserve context, but reset form
    resetForms();
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (item) => {
    setEditingId(item.id);
    setEditingType(item._type);
    setActiveTab(item._type);

    if (item._type === 'factura') {
      const { data, error } = await supabase.from('gastos').select('*, proveedor:proveedores(nombre), proyecto:proyectos(nombre_proyecto)').eq('id', item.id).single();
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Error cargando factura.' });
        return;
      }

      let fileUrl = null;
      try {
        const { data: adjData } = await supabase.from('adjuntos')
          .select('url_almacenamiento')
          .eq('entidad_id', item.id)
          .eq('tipo_entidad', 'gasto')
          .limit(1)
          .single();

        if (adjData && adjData.url_almacenamiento) {
          if (adjData.url_almacenamiento.startsWith('http')) {
            fileUrl = adjData.url_almacenamiento;
          } else {
            const { data: signed } = await supabase.storage.from('admin_docs').createSignedUrl(adjData.url_almacenamiento, 3600);
            fileUrl = signed?.signedUrl;
          }
        }
      } catch (e) {
        console.log("No attachment found or error fetching it", e);
      }

      setInitialProviderLabel(data.proveedor?.nombre || '');
      setInitialProjectLabel(data.proyecto?.nombre_proyecto || '');
      setFacturaForm({
        fecha_emision: data.fecha_emision,
        fecha_vencimiento: data.fecha_vencimiento || '',
        proveedor_id: data.proveedor_id,
        proyecto_id: data.proyecto_id || '',
        numero_factura: data.numero_factura,
        concepto: data.concepto || '',
        monto_bruto: data.monto_bruto,
        iva_percentage: (data.iva * 100).toString(),
        estado_pago: data.estado_pago,
        numero_referencia: data.numero_referencia || '',
        archivo: fileUrl
      });
    } else {
      let fileUrl = null;
      try {
        const { data: adjData } = await supabase.from('adjuntos')
          .select('url_almacenamiento')
          .eq('entidad_id', item.id)
          .eq('tipo_entidad', 'gasto_general')
          .limit(1)
          .single();

        if (adjData && adjData.url_almacenamiento) {
          if (adjData.url_almacenamiento.startsWith('http')) {
            fileUrl = adjData.url_almacenamiento;
          } else {
            const { data: signed } = await supabase.storage.from('admin_docs').createSignedUrl(adjData.url_almacenamiento, 3600);
            fileUrl = signed?.signedUrl;
          }
        }
      } catch (e) {
        console.log("No attachment found or error fetching it for gasto", e);
      }

      setGastoForm({
        fecha: item.fecha,
        tipo: item.tipo,
        descripcion: item.descripcion,
        importe: item.importe,
        archivo: fileUrl
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveFactura = async () => {
    if (!facturaForm.proveedor_id) {
      toast({ variant: 'destructive', title: 'Proveedor requerido', description: 'Selecciona un proveedor.' });
      return;
    }
    if (!facturaForm.monto_bruto || isNaN(parseFloat(facturaForm.monto_bruto))) {
      toast({ variant: 'destructive', title: 'Monto inválido', description: 'El monto bruto es requerido.' });
      return;
    }

    setSaving(true);
    try {
      const bruto = parseFloat(facturaForm.monto_bruto);
      const percentage = parseFloat(facturaForm.iva_percentage) || 0;
      const ivaRate = percentage / 100;

      const payload = {
        fecha_emision: facturaForm.fecha_emision,
        fecha_vencimiento: facturaForm.fecha_vencimiento || null,
        proveedor_id: facturaForm.proveedor_id,
        numero_factura: facturaForm.numero_factura,
        concepto: facturaForm.concepto,
        monto_bruto: bruto,
        iva: ivaRate,
        estado_pago: facturaForm.estado_pago,
        numero_referencia: facturaForm.numero_referencia,
        gasto_nave_taller: !facturaForm.proyecto_id,
        proyecto_id: facturaForm.proyecto_id || null
      };

      let targetId = editingId;

      if (editingId) {
        const { error } = await supabase.from('gastos').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('gastos').insert([payload]).select().single();
        if (error) throw error;
        targetId = data.id;
      }

      if (facturaForm.archivo instanceof File && targetId) {
        const file = facturaForm.archivo;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `facturas/${targetId}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('admin_docs').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: empData } = await supabase.from('empleados').select('id').eq('auth_user_id', user?.id).single();

        await supabase.from('adjuntos').insert([{
          nombre_archivo: file.name,
          url_almacenamiento: filePath,
          tipo_entidad: 'gasto',
          entidad_id: targetId,
          subido_por_empleado_id: empData?.id
        }]);
      }

      toast({ title: 'Éxito', description: 'Factura guardada correctamente.' });
      setIsModalOpen(false);
      fetchGastos(); // Force refresh
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGasto = async () => {
    if (!gastoForm.descripcion) {
      toast({ variant: 'destructive', title: 'Concepto requerido' });
      return;
    }
    if (!gastoForm.importe || isNaN(parseFloat(gastoForm.importe))) {
      toast({ variant: 'destructive', title: 'Importe inválido' });
      return;
    }

    setSaving(true);
    try {
      let empleadoId = null;
      if (user?.id) {
        const { data: empData } = await supabase
          .from('empleados')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (empData) {
          empleadoId = empData.id;
        }
      }

      const payload = {
        fecha: gastoForm.fecha,
        tipo: gastoForm.tipo,
        descripcion: gastoForm.descripcion,
        importe: parseFloat(gastoForm.importe),
        creado_por: empleadoId,
        creado_en: new Date().toISOString()
      };

      let targetId = editingId;

      if (editingId) {
        const { error } = await supabase.from('gastos_generales').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('gastos_generales').insert([payload]).select().single();
        if (error) throw error;
        targetId = data.id;
      }

      if (gastoForm.archivo && targetId) {
        if (gastoForm.archivo instanceof File) {
          const file = gastoForm.archivo;
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          const filePath = `gastos_generales/${fileName}`;

          const { error: uploadError } = await supabase.storage.from('admin_docs').upload(filePath, file);
          if (uploadError) throw uploadError;

          const { error: adjError } = await supabase.from('adjuntos').insert([{
            nombre_archivo: file.name,
            url_almacenamiento: filePath,
            tipo_entidad: 'gasto_general',
            entidad_id: targetId,
            subido_por_empleado_id: empleadoId
          }]);
          if (adjError) {
            console.error("Error linking file:", adjError);
            toast({ variant: "warning", title: "Gasto guardado pero error al adjuntar archivo" });
          }
        }
      }

      toast({ title: 'Éxito', description: 'Gasto registrado correctamente.' });
      setIsModalOpen(false);

      await fetchGastos();

    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!gastoToDelete) return;
    try {
      if (gastoToDelete._type === 'factura') {
        const { error: unlinkError } = await supabase
          .from('detalles_solicitud')
          .update({ gasto_id: null })
          .eq('gasto_id', gastoToDelete.id);

        if (unlinkError) throw unlinkError;

        const { error: deleteError } = await supabase
          .from('gastos')
          .delete()
          .eq('id', gastoToDelete.id);

        if (deleteError) throw deleteError;
      } else {
        const { error } = await supabase.from('gastos_generales').delete().eq('id', gastoToDelete.id);
        if (error) throw error;
      }
      toast({ title: 'Eliminado', description: 'Registro eliminado correctamente.' });
      fetchGastos();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar. ' + error.message });
    } finally {
      setGastoToDelete(null);
    }
  };

  const ivaAmount = calculateIvaAmount();
  const isFiltersActive = dateFrom || dateTo || filterType !== 'all' || filterProviderId || searchTerm || filterEstadoPago !== 'all';

  return (
    <div className="p-6 w-full">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full mx-auto"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturación y Gastos</h1>
          <p className="text-muted-foreground">Control de facturas de proveedores y gastos internos</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white dark:bg-slate-900 border rounded-lg px-4 py-2 flex items-center gap-2 shadow-sm">
            <span className="text-sm font-medium text-muted-foreground">Total Filtrado:</span>
            <span className="text-lg font-bold text-foreground">
              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totals)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/administracion/gastos/scanner')} className="md:w-auto w-full">
              <Scan className="w-4 h-4 mr-2" /> Escanear Factura
            </Button>
            <Button onClick={handleOpenCreate} className="md:w-auto w-full">
              <Plus className="w-4 h-4 mr-2" /> Nuevo Registro
            </Button>
          </div>
        </div>
      </motion.div>

      <Card className="w-full mx-auto mt-6">
        <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-5 h-5 text-muted-foreground" />
                Filtros
              </CardTitle>
              {isFiltersActive && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground h-8">
                  <X className="w-4 h-4 mr-2" /> Limpiar filtros
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date Range */}
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="date"
                    className="pl-9"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    placeholder="Desde"
                  />
                </div>
                <span className="text-muted-foreground">-</span>
                <div className="relative flex-1">
                  <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="date"
                    className="pl-9"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    placeholder="Hasta"
                  />
                </div>
              </div>

              {/* Type Selector */}
              <div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Tipo de registro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los registros</SelectItem>
                    <SelectItem value="factura">Solo Facturas</SelectItem>
                    <SelectItem value="gasto">Solo Gastos Internos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Estado de pago */}
              <div>
                <Select value={filterEstadoPago} onValueChange={setFilterEstadoPago}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Estado de pago" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pagada">Pagado</SelectItem>
                    <SelectItem value="pendiente_pago">Pendiente de pago</SelectItem>
                    <SelectItem value="parcialmente_pagada">Parcialmente pagada</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Provider Filter */}
              <div className="relative">
                <ProviderSelect
                  value={filterProviderId}
                  onValueChange={(val, prov) => { setFilterProviderId(val); setFilterProviderLabel(prov?.nombre || ''); }}
                  placeholder="Filtrar por proveedor..."
                  initialLabel={filterProviderLabel}
                  className="w-full bg-background"
                  disabled={filterType === 'gasto'}
                />
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  className="pl-9 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="rounded-md border-x border-b">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                  <TableHead className="w-[100px]">Tipo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor / Ref</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="h-32 text-center">
                      <div className="flex justify-center items-center h-full gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-muted-foreground">Cargando datos...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : gastos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Filter className="h-8 w-8 opacity-20" />
                        <p>No se encontraron registros con los filtros actuales.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  gastos.map((g) => (
                    <TableRow key={`${g._type}-${g.id}`} className={g._type === 'gasto' ? 'bg-orange-50/10 hover:bg-orange-50/20' : 'hover:bg-slate-50/50'}>
                      <TableCell>
                        {g._type === 'factura' ? (
                          <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                            <Receipt className="w-3 h-3 mr-1" /> Factura
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800">
                            <Banknote className="w-3 h-3 mr-1" /> Gasto
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {format(new Date(g.display_date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className={cn("font-medium text-sm", !g.proveedor_nombre && g._type === 'gasto' && "text-muted-foreground italic")}>
                            {g.display_provider}
                          </span>
                          {g.display_ref && <span className="text-xs text-muted-foreground">{g.display_ref}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={g.display_concept}>
                        <div className="flex flex-col">
                          <span>{g.display_concept || '-'}</span>
                          {g.project_name && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> {g.project_name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm tabular-nums">
                        {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(g.display_amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`
                          ${g.display_status === 'pagada' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                            g.display_status === 'pendiente_pago' ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' :
                              g.display_status === 'vencida' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' :
                                'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'}
                        `}>
                          {g.display_status ? g.display_status.replace('_', ' ').toUpperCase() : '-'}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(g)}
                              className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setGastoToDelete(g)}
                              className="h-8 w-8 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Main Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Registro' : 'Nuevo Registro'}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {!editingId && (
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="factura">Factura (Con IVA)</TabsTrigger>
                <TabsTrigger value="gasto">Gasto (Sin IVA)</TabsTrigger>
              </TabsList>
            )}

            {/* TAB FACTURA */}
            <TabsContent value="factura">
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha Emisión</Label>
                    <Input name="fecha_emision" type="date" value={facturaForm.fecha_emision} onChange={handleFacturaChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha Vencimiento</Label>
                    <Input name="fecha_vencimiento" type="date" value={facturaForm.fecha_vencimiento} onChange={handleFacturaChange} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <ProviderSelect
                    value={facturaForm.proveedor_id}
                    onValueChange={(val) => handleFacturaSelectChange('proveedor_id', val)}
                    placeholder="Buscar proveedor..."
                    initialLabel={initialProviderLabel}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" /> Asignar a Obra (Opcional)
                  </Label>
                  <AsyncSearchableSelector
                    fetcher={async (search) => {
                      let query = supabase.from('proyectos').select('id, nombre_proyecto').order('nombre_proyecto', { ascending: true }).limit(100);
                      if (search) query = query.ilike('nombre_proyecto', `%${search}%`);
                      const { data } = await query;
                      return (data || []).map(p => ({ value: p.id, label: p.nombre_proyecto }));
                    }}
                    selected={facturaForm.proyecto_id}
                    onSelect={(val) => handleFacturaSelectChange('proyecto_id', val)}
                    placeholder="Seleccionar obra..."
                    initialLabel={initialProjectLabel}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nº Factura</Label>
                    <Input name="numero_factura" value={facturaForm.numero_factura} onChange={handleFacturaChange} placeholder="F-2024-001" />
                  </div>
                  <div className="space-y-2">
                    <Label>Ref. Interna</Label>
                    <Input name="numero_referencia" value={facturaForm.numero_referencia} onChange={handleFacturaChange} placeholder="INT-001" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Concepto</Label>
                  <Textarea name="concepto" value={facturaForm.concepto} onChange={handleFacturaChange} placeholder="Descripción..." rows={2} />
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border">
                  <div className="space-y-2">
                    <Label>Base Imponible</Label>
                    <div className="relative">
                      <Input name="monto_bruto" type="number" step="0.01" value={facturaForm.monto_bruto} onChange={handleFacturaChange} className="pl-6 font-bold" />
                      <span className="absolute left-2 top-2.5 text-xs text-muted-foreground">€</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>IVA</Label>
                    <Select value={facturaForm.iva_percentage} onValueChange={(val) => handleFacturaSelectChange('iva_percentage', val)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="10">10%</SelectItem>
                        <SelectItem value="21">21%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 text-right text-sm text-muted-foreground pt-1 border-t border-slate-200 dark:border-slate-800">
                    Total Estimado: <span className="font-bold text-foreground">
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                        (parseFloat(facturaForm.monto_bruto) || 0) + (parseFloat(facturaForm.monto_bruto) * parseFloat(facturaForm.iva_percentage) / 100 || 0)
                      )}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Estado de Pago</Label>
                  <Select value={facturaForm.estado_pago} onValueChange={(val) => handleFacturaSelectChange('estado_pago', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente_pago">Pendiente</SelectItem>
                      <SelectItem value="pagada">Pagada</SelectItem>
                      <SelectItem value="parcialmente_pagada">Parcial</SelectItem>
                      <SelectItem value="vencida">Vencida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 pt-2 border-t mt-2">
                  <FotoEvidencia
                    label="Imagen de la Factura (Cámara/Archivo)"
                    currentFile={facturaForm.archivo}
                    onFotoCapturada={handleFacturaFile}
                  />
                </div>

              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancelar</Button>
                <Button onClick={handleSaveFactura} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Factura
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* TAB GASTO */}
            <TabsContent value="gasto">
              <div className="grid gap-4 py-2">
                <div className="bg-orange-50 border border-orange-100 dark:bg-orange-900/10 dark:border-orange-900/20 p-3 rounded-md text-sm text-orange-800 dark:text-orange-400 mb-2 flex gap-2">
                  <Banknote className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    Los gastos registrados aquí <strong>no tienen IVA</strong> y se asignan automáticamente a <strong>Gastos Generales</strong>.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input name="fecha" type="date" value={gastoForm.fecha} onChange={handleGastoChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Gasto</Label>
                    <Select value={gastoForm.tipo} onValueChange={(val) => handleGastoSelectChange('tipo', val)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nóminas">Nóminas</SelectItem>
                        <SelectItem value="Seguros sociales">Seguros Sociales</SelectItem>
                        <SelectItem value="Tickets">Tickets / Dietas</SelectItem>
                        <SelectItem value="Otros">Otros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Concepto / Descripción</Label>
                  <Textarea name="descripcion" value={gastoForm.descripcion} onChange={handleGastoChange} placeholder="Ej: Pago nómina Enero..." rows={3} />
                </div>

                <div className="space-y-2">
                  <Label>Importe Total (€)</Label>
                  <div className="relative">
                    <Input name="importe" type="number" step="0.01" value={gastoForm.importe} onChange={handleGastoChange} className="pl-6 text-lg font-bold" placeholder="0.00" />
                    <span className="absolute left-2 top-3 text-xs text-muted-foreground">€</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t mt-2">
                  <FotoEvidencia
                    label="Adjuntar Comprobante (Opcional)"
                    currentFile={gastoForm.archivo}
                    onFotoCapturada={handleGastoFile}
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancelar</Button>
                <Button onClick={handleSaveGasto} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Gasto
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!gastoToDelete} onOpenChange={() => setGastoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará este registro permanentemente.
              {gastoToDelete?._type === 'factura' ? ' Es una FACTURA.' : ' Es un GASTO.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GastosGenerales;