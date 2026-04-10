import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Loader2, Plus, Building, FileCheck, Scale, Paperclip, Euro, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Helper functions
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '0,00 €';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
};

const fmtMadrid = (dateStr) => {
  if (!dateStr) return '';
  try {
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    return new Date(clean).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const EmbargoDetail = ({ embargoId, navigate }) => {
  const { user, sessionRole } = useAuth();
  const [embargo, setEmbargo] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [retenciones, setRetenciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isRetentionOpen, setIsRetentionOpen] = useState(false);

  const [isEditEmbargoOpen, setIsEditEmbargoOpen] = useState(false);
  const [isEditRetentionOpen, setIsEditRetentionOpen] = useState(false);
  const [isEditPagoOpen, setIsEditPagoOpen] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);

  const [processing, setProcessing] = useState(false);
  const isSubmittingRef = useRef(false);

  const [newPago, setNewPago] = useState({ concepto: '', file: null }); // Removed importe
  const [newRetention, setNewRetention] = useState({
    fecha: new Date().toISOString().split('T')[0],
    importe: '',
    descripcion: ''
  });

  const [editEmbargoData, setEditEmbargoData] = useState({});
  const [editRetentionData, setEditRetentionData] = useState({});
  const [editPagoData, setEditPagoData] = useState({});

  const isAdmin = ['admin', 'encargado'].includes(sessionRole?.rol);

  const fetchData = async (showLoading = true, includeDetails = true) => {
    if (!embargoId) return;

    if (showLoading) setLoading(true);
    setError(null);

    try {
      const { data: embData, error: embErr } = await supabase
        .from('embargos')
        .select(`
          *,
          empleados (
            id,
            auth_user_id,
            nombre,
            apellidos
          )
        `)
        .eq('id', embargoId)
        .maybeSingle();

      if (embErr) throw embErr;
      if (!embData) throw new Error("Expediente de embargo no encontrado.");

      if (!isAdmin && embData.empleado_id !== user.id) {
        throw new Error("No tienes permiso para ver este expediente.");
      }

      setEmbargo(embData);

      if (includeDetails) {
        const [pagosResult, retencionesResult] = await Promise.all([
          supabase
            .from('embargos_pagos')
            .select('*')
            .eq('embargo_id', embargoId)
            .order('fecha_pago', { ascending: false }),

          supabase
            .from('embargos_retenciones')
            .select('*')
            .eq('embargo_id', embargoId)
            .order('fecha', { ascending: false })
        ]);

        if (pagosResult.error) throw pagosResult.error;
        if (retencionesResult.error) throw retencionesResult.error;

        const uniquePagosMap = new Map();
        (pagosResult.data || []).forEach(item => uniquePagosMap.set(item.id, item));
        const uniquePagos = Array.from(uniquePagosMap.values());

        const uniqueRetencionesMap = new Map();
        (retencionesResult.data || []).forEach(item => uniqueRetencionesMap.set(item.id, item));
        const uniqueRetenciones = Array.from(uniqueRetencionesMap.values());

        setPagos(uniquePagos);
        setRetenciones(
          uniqueRetenciones.map(r => ({
            ...r,
            importe: Number(r.importe),
            fecha: r.fecha ? r.fecha.split('T')[0] : null
          }))
        );
      }

    } catch (err) {
      console.error("Error fetching embargo details:", err);
      setError(err.message || "Error desconocido al cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!embargoId || !user) return;
    fetchData(true, true);
  }, [embargoId, user]);

  const uploadFileToStorage = async (file, embargoId, empleadoAuthId) => {
    const ext = file.name.split('.').pop();
    const safeAuthId = empleadoAuthId || 'unknown';
    // Path structure: embargos/auth_id/embargo_id/timestamp.ext
    const fileName = `embargos/${safeAuthId}/${embargoId}/${Date.now()}.${ext}`;
    const bucket = 'embargos-documentos'; // Updated bucket name

    const { error: uploadErr } = await supabase
      .storage
      .from(bucket)
      .upload(fileName, file);

    if (uploadErr) throw uploadErr;

    const { data: { publicUrl } } = supabase
      .storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleAddRetention = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    if (!newRetention.importe || !newRetention.fecha) return;

    setProcessing(true);
    isSubmittingRef.current = true;

    try {
      const { error } = await supabase.rpc('api_embargo_add_retencion', {
        p_embargo_id: embargoId,
        p_fecha: newRetention.fecha,
        p_importe: parseFloat(newRetention.importe),
        p_descripcion: newRetention.descripcion || "Retención nómina"
      });

      if (error) throw error;

      toast({ title: "Retención añadida", description: "Se registró correctamente." });
      setIsRetentionOpen(false);

      setNewRetention({
        fecha: new Date().toISOString().split('T')[0],
        importe: '',
        descripcion: ''
      });

      await fetchData(false, true);

    } catch (err) {
      toast({ variant: 'destructive', title: "Error", description: err.message });
    } finally {
      setProcessing(false);
      isSubmittingRef.current = false;
    }
  };

  const handleRegistrarPago = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    
    if (!newPago.concepto) { // Removed importe validation
        toast({ variant: 'destructive', title: "Error", description: "Concepto es requerido." });
        return;
    }

    setProcessing(true);
    isSubmittingRef.current = true;

    try {
      let fileUrl = null;
      const authId = embargo?.empleados?.auth_user_id || embargo?.empleado_id || user.id;

      if (newPago.file) {
        fileUrl = await uploadFileToStorage(newPago.file, embargoId, authId);
      }

      const { error: rpcErr } = await supabase.rpc('api_embargo_registrar_pago_v1', {
        embargo: embargoId,
        importe: 0, // Set importe to 0 as it's no longer entered via UI
        archivo_url: fileUrl,
        concepto: newPago.concepto
      });

      if (rpcErr) throw rpcErr;

      toast({ 
        title: "Pago registrado", 
        description: `Concepto: "${newPago.concepto}".`
      });
      setIsPayOpen(false);
      setNewPago({ concepto: '', file: null }); // Removed importe from newPago reset
      await fetchData(false, true);

    } catch (err) {
      toast({ variant: 'destructive', title: "Error", description: err.message });
    } finally {
      setProcessing(false);
      isSubmittingRef.current = false;
    }
  };

  const openEditEmbargo = () => {
    setEditEmbargoData({
      organismo: embargo.organismo,
      motivo: embargo.motivo,
      importe_total: embargo.importe_total,
      fecha_inicio: embargo.fecha_inicio,
      fecha_fin: embargo.fecha_fin || ''
    });
    setIsEditEmbargoOpen(true);
  };

  const handleUpdateEmbargo = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    setProcessing(true);
    isSubmittingRef.current = true;

    try {
      const { error } = await supabase
        .from('embargos')
        .update({
          organismo: editEmbargoData.organismo,
          motivo: editEmbargoData.motivo,
          importe_total: parseFloat(editEmbargoData.importe_total),
          fecha_inicio: editEmbargoData.fecha_inicio,
          fecha_fin: editEmbargoData.fecha_fin || null
        })
        .eq('id', embargoId);

      if (error) throw error;

      await supabase.rpc('api_embargo_recalc_balance', { p_embargo_id: embargoId });

      toast({ title: "Embargo actualizado" });
      setIsEditEmbargoOpen(false);

      await fetchData(false, true);

    } catch (err) {
      toast({ variant: 'destructive', title: "Error", description: err.message });
    } finally {
      setProcessing(false);
      isSubmittingRef.current = false;
    }
  };

  const openEditRetention = (ret) => {
    setEditRetentionData(ret);
    setIsEditRetentionOpen(true);
  };

  const handleUpdateRetention = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    setProcessing(true);
    isSubmittingRef.current = true;

    try {
      const { error } = await supabase
        .from('embargos_retenciones')
        .update({
          fecha: editRetentionData.fecha,
          importe: parseFloat(editRetentionData.importe),
          descripcion: editRetentionData.descripcion
        })
        .eq('id', editRetentionData.id);

      if (error) throw error;

      await supabase.rpc('api_embargo_recalc_balance', { p_embargo_id: embargoId });

      toast({ title: "Retención actualizada" });
      setIsEditRetentionOpen(false);

      await fetchData(false, true);

    } catch (err) {
      toast({ variant: 'destructive', title: "Error", description: err.message });
    } finally {
      setProcessing(false);
      isSubmittingRef.current = false;
    }
  };

  const openEditPago = (pago) => {
    setEditPagoData(pago);
    setIsEditPagoOpen(true);
  };

  const handleUpdatePago = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    setProcessing(true);
    isSubmittingRef.current = true;

    try {
      const { error } = await supabase
        .from('embargos_pagos')
        .update({
          fecha_pago: editPagoData.fecha_pago,
          importe: parseFloat(editPagoData.importe),
          concepto: editPagoData.concepto
        })
        .eq('id', editPagoData.id);

      if (error) throw error;

      await supabase.rpc('api_embargo_recalc_balance', { p_embargo_id: embargoId });

      toast({ title: "Pago actualizado" });
      setIsEditPagoOpen(false);

      await fetchData(false, true);

    } catch (err) {
      toast({ variant: 'destructive', title: "Error", description: err.message });
    } finally {
      setProcessing(false);
      isSubmittingRef.current = false;
    }
  };

  const confirmDelete = (item, type) => {
    if (!item || !item.id) {
      toast({ variant: "destructive", title: "Error", description: "El elemento no tiene ID válido." });
      return;
    }
    setDeleteItem({ id: item.id, type });
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteItem || isSubmittingRef.current) return;
    setProcessing(true);
    isSubmittingRef.current = true;

    try {
      let table = '';
      if (deleteItem.type === 'embargo') table = 'embargos';
      else if (deleteItem.type === 'retention') table = 'embargos_retenciones';
      else if (deleteItem.type === 'pago') table = 'embargos_pagos';

      if (!table) throw new Error("Tipo de elemento desconocido");

      const targetEmbargoId = embargoId; 

      const { data, error } = await supabase
        .from(table)
        .delete()
        .eq('id', deleteItem.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("No se pudo eliminar el registro.");
      }

      if (deleteItem.type === 'embargo') {
        toast({ title: "Embargo eliminado" });
        if (navigate) navigate("/personal/embargos");
        return;
      }

      const { error: rpcError } = await supabase.rpc('api_embargo_recalc_balance', { 
        p_embargo_id: targetEmbargoId 
      });
      if (rpcError) console.error("Error recalculando balance manual:", rpcError);

      if (deleteItem.type === 'retention') {
        setRetenciones(prev => prev.filter(r => r.id !== deleteItem.id));
      } else if (deleteItem.type === 'pago') {
        setPagos(prev => prev.filter(p => p.id !== deleteItem.id));
      }

      toast({ title: "Registro eliminado", description: "El saldo se está actualizando..." });
      setDeleteItem(null);
      setDeleteConfirmOpen(false);

      setTimeout(async () => {
        await fetchData(false, false); 
      }, 500);

    } catch (error) {
      console.error("Error al eliminar:", error);
      toast({ variant: "destructive", title: "Error al eliminar", description: error.message });
      await fetchData(false, true);
    } finally {
      setProcessing(false);
      isSubmittingRef.current = false;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Cargando expediente...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 p-4">
        <div className="bg-red-100 p-6 rounded-full shadow-sm">
          <AlertCircle className="h-10 w-10 text-red-600" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">No se pudo cargar el expediente</h2>
          <p className="text-muted-foreground max-w-md">{error}</p>
        </div>
        <Button variant="default" onClick={() => navigate && navigate(-1)} className="min-w-[120px]">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>
    );
  }

  if (!embargo) return null;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">

      {/* ENCABEZADO */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate && navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              Expediente de Embargo
            </h1>
            <p className="text-muted-foreground text-sm">
              {embargo.organismo} • {embargo.motivo || 'Sin motivo especificado'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            className={
              embargo.estado === 'liquidado'
                ? 'bg-green-100 text-green-800 border-green-200'
                : 'bg-yellow-100 text-yellow-800 border-yellow-200'
            }
            variant="outline"
          >
            {embargo.estado === 'liquidado' ? 'LIQUIDADO' : 'ACTIVO'}
          </Badge>

          {isAdmin && (
            <div className="flex gap-1 ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={openEditEmbargo}
              >
                <Pencil className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                onClick={() => confirmDelete(embargo, 'embargo')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* BLOQUE A: INFORMACIÓN GENERAL */}
      <Card className="border-l-4 border-l-primary shadow-sm relative">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" /> Información del Embargo
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Organismo</Label>
              <div className="font-medium text-base">{embargo.organismo}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Total Deuda</Label>
              <div className="font-medium text-base">{formatCurrency(embargo.importe_total)}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Pendiente</Label>
              <div
                className={`font-bold text-xl flex items-center gap-1 ${
                  embargo.importe_pendiente > 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                <Euro className="h-5 w-5" />
                {formatCurrency(embargo.importe_pendiente)}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Periodo</Label>
              <div className="text-sm">
                <span className="block">Desde: {fmtMadrid(embargo.fecha_inicio)}</span>
                <span className="block text-muted-foreground">
                  Hasta: {embargo.fecha_fin ? fmtMadrid(embargo.fecha_fin) : 'Indefinido'}
                </span>
              </div>
            </div>
            {isAdmin && (
              <div className="md:col-span-2 lg:col-span-4 pt-2 border-t mt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building className="h-4 w-4" />
                  Empleado:
                  <span className="font-semibold text-foreground">
                    {embargo.empleados?.nombre || 'Desconocido'}&nbsp;
                    {embargo.empleados?.apellidos || ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* BLOQUES B y C */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* BLOQUE B — RETENCIONES */}
        <Card className="h-full flex flex-col shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-blue-600" /> Retenciones en Nómina
            </CardTitle>

            {isAdmin && embargo.estado === 'activo' && (
              <Button size="sm" variant="outline" onClick={() => setIsRetentionOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Añadir
              </Button>
            )}
          </CardHeader>

          <CardContent className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  {isAdmin && <TableHead className="w-[70px]"></TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                {retenciones.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 4 : 3}
                      className="text-center h-24 text-muted-foreground"
                    >
                      No hay retenciones registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  retenciones.map((ret) => (
                    <TableRow key={ret.id} className="group">
                      <TableCell>{fmtMadrid(ret.fecha)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ret.descripcion || 'Retención nómina'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        -{formatCurrency(ret.importe)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right p-0 pr-2">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => openEditRetention(ret)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => confirmDelete(ret, 'retention')}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* BLOQUE C — PAGOS */}
        <Card className="h-full flex flex-col shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Euro className="h-5 w-5 text-green-600" /> Pagos al Organismo
            </CardTitle>

            {isAdmin && embargo.estado === 'activo' && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setIsPayOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" /> Registrar Pago
              </Button>
            )}
          </CardHeader>

          <CardContent className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha Pago</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Documento</TableHead>
                  {isAdmin && <TableHead className="w-[70px]"></TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                {pagos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 4 : 3}
                      className="text-center h-24 text-muted-foreground"
                    >
                      No hay pagos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagos.map((p) => (
                    <TableRow key={p.id} className="group">
                      <TableCell>{fmtMadrid(p.fecha_pago)}</TableCell>
                      <TableCell className="font-medium">
                        {p.concepto || <span className="text-muted-foreground italic">Sin concepto</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {p.archivo_url ? (
                            <a
                              href={p.archivo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground px-2 py-1 rounded transition-colors"
                            >
                              <FileCheck className="h-3 w-3 mr-1" /> Ver
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Pendiente</span>
                          )}
                        </div>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right p-0 pr-2">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => openEditPago(p)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => confirmDelete(p, 'pago')}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* MODALES — CREAR RETENCIÓN */}
      <Dialog open={isRetentionOpen} onOpenChange={setIsRetentionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir Retención en Nómina</DialogTitle>
            <DialogDescription>Registra una retención aplicada al empleado.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddRetention} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha</Label>
                <Input
                  type="date"
                  required
                  value={newRetention.fecha}
                  onChange={(e) =>
                    setNewRetention({ ...newRetention, fecha: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Importe (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={newRetention.importe}
                  onChange={(e) =>
                    setNewRetention({ ...newRetention, importe: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                placeholder="Ej: Nómina enero"
                value={newRetention.descripcion}
                onChange={(e) =>
                  setNewRetention({ ...newRetention, descripcion: e.target.value })
                }
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsRetentionOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={processing}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODALES — CREAR PAGO */}
      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago al Organismo</DialogTitle>
            <DialogDescription>Registra una transferencia realizada.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegistrarPago} className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4"> {/* Changed to 1 column */}
                <div>
                  <Label htmlFor="concepto">Concepto</Label>
                  <Input
                    id="concepto"
                    type="text"
                    required
                    value={newPago.concepto}
                    onChange={(e) =>
                      setNewPago({ ...newPago, concepto: e.target.value })
                    }
                    placeholder="Ej: Pago mensual"
                  />
                </div>
            </div>

            <div>
              <Label htmlFor="justificante-file">Justificante (PDF/Imagen)</Label>
              <Input
                id="justificante-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) =>
                  setNewPago({ ...newPago, file: e.target.files[0] })
                }
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsPayOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={processing} className="bg-green-600 hover:bg-green-700">
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registrar Pago
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL — EDITAR RETENCIÓN */}
      <Dialog open={isEditRetentionOpen} onOpenChange={setIsEditRetentionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Retención</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateRetention} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha</Label>
                <Input
                  type="date"
                  required
                  value={editRetentionData.fecha}
                  onChange={(e) =>
                    setEditRetentionData({ ...editRetentionData, fecha: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Importe (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={editRetentionData.importe}
                  onChange={(e) =>
                    setEditRetentionData({ ...editRetentionData, importe: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Input
                value={editRetentionData.descripcion}
                onChange={(e) =>
                  setEditRetentionData({
                    ...editRetentionData,
                    descripcion: e.target.value
                  })
                }
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsEditRetentionOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={processing}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Actualizar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL — EDITAR PAGO */}
      <Dialog open={isEditPagoOpen} onOpenChange={setIsEditPagoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pago</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdatePago} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha Pago</Label>
                <Input
                  type="date"
                  required
                  value={editPagoData.fecha_pago}
                  onChange={(e) =>
                    setEditPagoData({ ...editPagoData, fecha_pago: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Importe (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={editPagoData.importe}
                  onChange={(e) =>
                    setEditPagoData({ ...editPagoData, importe: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Concepto</Label>
              <Input
                value={editPagoData.concepto || ''}
                onChange={(e) =>
                  setEditPagoData({ ...editPagoData, concepto: e.target.value })
                }
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsEditPagoOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={processing}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Actualizar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL — EDITAR EMBARGO */}
      <Dialog open={isEditEmbargoOpen} onOpenChange={setIsEditEmbargoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Embargo</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateEmbargo} className="space-y-4 py-2">
            <div>
              <Label>Organismo</Label>
              <Input
                required
                value={editEmbargoData.organismo}
                onChange={(e) =>
                  setEditEmbargoData({ ...editEmbargoData, organismo: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input
                value={editEmbargoData.motivo}
                onChange={(e) =>
                  setEditEmbargoData({ ...editEmbargoData, motivo: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Importe Total (€)</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={editEmbargoData.importe_total}
                onChange={(e) =>
                  setEditEmbargoData({ ...editEmbargoData, importe_total: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha Inicio</Label>
                <Input
                  type="date"
                  required
                  value={editEmbargoData.fecha_inicio}
                  onChange={(e) =>
                    setEditEmbargoData({ ...editEmbargoData, fecha_inicio: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Fecha Fin (Opcional)</Label>
                <Input
                  type="date"
                  value={editEmbargoData.fecha_fin}
                  onChange={(e) =>
                    setEditEmbargoData({ ...editEmbargoData, fecha_fin: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsEditEmbargoOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={processing}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Actualizar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL — CONFIRMAR ELIMINACIÓN */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
              {deleteItem?.type === 'embargo'
                ? ' Se borrará todo el expediente y registros asociados.'
                : ' Se eliminará este registro y se actualizará el saldo pendiente.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default function WrappedEmbargoDetail(props) {
  return <EmbargoDetail key={props.embargoId} {...props} />;
}