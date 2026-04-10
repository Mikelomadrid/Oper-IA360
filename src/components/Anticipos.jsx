import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Check, Loader2, FileText, Upload, Ban, Pencil, Trash2, Eye } from 'lucide-react';
import { formatCurrency, fmtMadrid } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';

const Anticipos = () => {
  const { user, sessionRole } = useAuth();
  const [anticipos, setAnticipos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create/Edit modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Confirm/Reject state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  // Generic Upload State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  
  const [selectedAnticipo, setSelectedAnticipo] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);

  const [employees, setEmployees] = useState([]);
  
  // Form data for creation/editing
  const [formData, setFormData] = useState({
    cantidad: '',
    motivo: '',
    empleado_auth_id: '', 
  });

  const isAdminOrEncargado = ['admin', 'encargado'].includes(sessionRole?.rol);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch anticipos
      let query = supabase
        .from('anticipos_nomina')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: anticiposData, error: anticiposError } = await query;

      if (anticiposError) throw anticiposError;

      // 2. If admin, fetch employees to map names
      if (isAdminOrEncargado) {
        const { data: empData, error: empError } = await supabase
          .from('empleados')
          .select('id, auth_user_id, nombre, apellidos')
          .eq('activo', true)
          .order('nombre');
        
        if (empError) throw empError;
        setEmployees(empData || []);
      }

      setAnticipos(anticiposData || []);
    } catch (error) {
      console.error('Error fetching anticipos:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los anticipos.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, sessionRole]);

  // Map helper for employee names
  const getEmployeeName = (authUserId) => {
    if (!authUserId) return 'Desconocido';
    const emp = employees.find((e) => e.auth_user_id === authUserId);
    return emp ? `${emp.nombre} ${emp.apellidos || ''}` : 'Usuario no encontrado';
  };

  // --- Handlers for Create/Edit ---

  const openCreate = () => {
    setEditingId(null);
    setFormData({ cantidad: '', motivo: '', empleado_auth_id: '' });
    setIsFormOpen(true);
  };

  const openEdit = (anticipo) => {
    setEditingId(anticipo.id);
    setFormData({
      cantidad: anticipo.cantidad,
      motivo: anticipo.motivo,
      empleado_auth_id: anticipo.empleado_id // This column holds the auth_user_id
    });
    setIsFormOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.cantidad || !formData.motivo) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Por favor rellena cantidad y motivo.' });
      return;
    }

    const targetAuthId = isAdminOrEncargado && formData.empleado_auth_id 
      ? formData.empleado_auth_id 
      : user.id;

    if (!targetAuthId) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al empleado.' });
        return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('anticipos_nomina')
          .update({
            cantidad: parseFloat(formData.cantidad),
            motivo: formData.motivo,
            empleado_id: targetAuthId
          })
          .eq('id', editingId);

        if (error) throw error;
        toast({ title: 'Anticipo actualizado', description: 'Los datos han sido modificados.' });
      } else {
        const { error } = await supabase.rpc('api_crear_anticipo_v1', {
          empleado: targetAuthId,
          cantidad: parseFloat(formData.cantidad),
          motivo: formData.motivo,
        });

        if (error) throw error;
        toast({ title: 'Anticipo solicitado', description: 'La solicitud se ha creado correctamente.' });
      }

      setIsFormOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving anticipo:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  // --- Handlers for Delete ---

  const openDeleteDialog = (anticipo) => {
    setSelectedAnticipo(anticipo);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedAnticipo) return;
    setProcessing(true);
    try {
      const { error } = await supabase.from('anticipos_nomina').delete().eq('id', selectedAnticipo.id);
      if (error) throw error;
      toast({ title: 'Anticipo eliminado', description: 'El registro ha sido eliminado.' });
      setAnticipos(prev => prev.filter(a => a.id !== selectedAnticipo.id));
      setIsDeleteOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el anticipo.' });
    } finally {
      setProcessing(false);
    }
  };

  // --- Handlers for Uploads (Generic & Confirm) ---

  const uploadFileToStorage = async (file, anticipoId, empleadoId) => {
    const fileExt = file.name.split('.').pop();
    // Path format: anticipos/{empleado_id}/{anticipo_id}/filename
    const fileName = `anticipos/${empleadoId}/${anticipoId}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
        .from('anticipos_docs')
        .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('anticipos_docs')
        .getPublicUrl(fileName);
    
    return publicUrl;
  };

  // Opens the confirmation dialog (Status: Pendiente -> Confirmado + Upload)
  const openConfirmDialog = (anticipo) => {
    setSelectedAnticipo(anticipo);
    setReceiptFile(null);
    setIsConfirmOpen(true);
  };

  // Opens the generic upload dialog (Just upload/replace file, no status change logic enforced here)
  const openUploadDialog = (anticipo) => {
    setSelectedAnticipo(anticipo);
    setReceiptFile(null);
    setIsUploadOpen(true);
  };

  const handleConfirm = async () => {
    if (!receiptFile) {
      toast({ variant: 'destructive', title: 'Falta el justificante', description: 'Debes adjuntar un archivo.' });
      return;
    }

    setProcessing(true);
    try {
      const publicUrl = await uploadFileToStorage(receiptFile, selectedAnticipo.id, selectedAnticipo.empleado_id);

      const { error: updateError } = await supabase
        .from('anticipos_nomina')
        .update({ estado: 'confirmado', justificante_url: publicUrl })
        .eq('id', selectedAnticipo.id);

      if (updateError) throw updateError;

      toast({ title: 'Anticipo confirmado', description: 'Se ha marcado como confirmado y guardado el justificante.' });
      setIsConfirmOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error confirming:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo confirmar el anticipo.' });
    } finally {
      setProcessing(false);
    }
  };

  const handleGenericUpload = async () => {
    if (!receiptFile) {
      toast({ variant: 'destructive', title: 'Falta archivo', description: 'Selecciona un archivo para subir.' });
      return;
    }

    setProcessing(true);
    try {
      const publicUrl = await uploadFileToStorage(receiptFile, selectedAnticipo.id, selectedAnticipo.empleado_id);

      const { error: updateError } = await supabase
        .from('anticipos_nomina')
        .update({ justificante_url: publicUrl })
        .eq('id', selectedAnticipo.id);

      if (updateError) throw updateError;

      toast({ title: 'Justificante actualizado', description: 'El archivo se ha subido correctamente.' });
      setIsUploadOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error uploading:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo subir el archivo.' });
    } finally {
      setProcessing(false);
    }
  };

  // --- Other Handlers ---

  const openRejectDialog = (anticipo) => {
    setSelectedAnticipo(anticipo);
    setIsRejectOpen(true);
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.from('anticipos_nomina').update({ estado: 'rechazado' }).eq('id', selectedAnticipo.id);
      if (error) throw error;
      toast({ title: 'Anticipo rechazado', description: 'La solicitud ha sido rechazada.' });
      setIsRejectOpen(false);
      fetchData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo rechazar la solicitud.' });
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkDescontado = async (id) => {
    try {
      const { error } = await supabase.rpc('api_marcar_anticipo_descontado_v1', { anticipo: id });
      if (error) throw error;
      toast({ title: 'Actualizado', description: 'El anticipo se ha marcado como descontado.' });
      setAnticipos((prev) => prev.map((a) => (a.id === id ? { ...a, estado: 'descontado' } : a)));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estado.' });
    }
  };

  const getStatusBadge = (estado) => {
    const styles = {
      pendiente: "bg-yellow-100 text-yellow-800 border-yellow-200",
      confirmado: "bg-blue-100 text-blue-800 border-blue-200",
      descontado: "bg-green-100 text-green-800 border-green-200",
      rechazado: "bg-red-100 text-red-800 border-red-200"
    };
    return <Badge className={`capitalize ${styles[estado] || ''}`} variant="secondary">{estado}</Badge>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Anticipos de Nómina</h1>
          <p className="text-muted-foreground text-sm">Gestiona las solicitudes de adelanto salarial.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {isAdminOrEncargado ? "Registrar Anticipo" : "Solicitar Anticipo"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                {isAdminOrEncargado && <TableHead>Empleado</TableHead>}
                <TableHead>Cantidad</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Justificante</TableHead>
                <TableHead>Estado</TableHead>
                {isAdminOrEncargado && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {anticipos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdminOrEncargado ? 7 : 6} className="text-center h-32 text-muted-foreground">
                    No hay anticipos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                anticipos.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{fmtMadrid(item.fecha_solicitud, 'date')}</div>
                    </TableCell>
                    {isAdminOrEncargado && (
                      <TableCell><span className="font-medium text-sm">{getEmployeeName(item.empleado_id)}</span></TableCell>
                    )}
                    <TableCell className="font-bold text-foreground">{formatCurrency(item.cantidad)}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={item.motivo}>{item.motivo}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.justificante_url ? (
                          <a 
                            href={item.justificante_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-600 hover:underline text-xs font-medium"
                          >
                            <Eye className="h-3 w-3 mr-1" /> Ver
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No hay justificante</span>
                        )}
                        {isAdminOrEncargado && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-primary" 
                            onClick={() => openUploadDialog(item)}
                            title={item.justificante_url ? "Reemplazar justificante" : "Subir justificante"}
                          >
                            <Upload className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.estado)}</TableCell>
                    {isAdminOrEncargado && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)} title="Editar">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => openDeleteDialog(item)} title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <div className="w-px h-4 bg-border mx-1" />
                          {item.estado === 'pendiente' && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600" onClick={() => openConfirmDialog(item)}>
                                <Check className="h-3.5 w-3.5 mr-1" /> Confirmar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600" onClick={() => openRejectDialog(item)}>
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {item.estado === 'confirmado' && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600" onClick={() => handleMarkDescontado(item.id)}>
                              <Check className="h-3.5 w-3.5 mr-1" /> Descontar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal Create/Edit */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Anticipo' : 'Solicitar Anticipo'}</DialogTitle>
            <DialogDescription>{editingId ? 'Modifica los datos.' : 'Registra una nueva solicitud.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            {isAdminOrEncargado && (
              <div className="space-y-2">
                <Label>Empleado</Label>
                <Select value={formData.empleado_auth_id} onValueChange={(val) => setFormData({ ...formData, empleado_auth_id: val })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un empleado" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      // Guardrail: Ensure value is not empty
                      <SelectItem key={emp.id} value={emp.auth_user_id || "unknown"}>{emp.nombre} {emp.apellidos}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Cantidad (€)</Label>
              <Input type="number" step="0.01" min="0" value={formData.cantidad} onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea value={formData.motivo} onChange={(e) => setFormData({ ...formData, motivo: e.target.value })} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirm (with upload) */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Anticipo</DialogTitle>
            <DialogDescription>Confirma el pago subiendo el justificante.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 p-3 rounded text-sm">
              <p><strong>Cantidad:</strong> {selectedAnticipo && formatCurrency(selectedAnticipo.cantidad)}</p>
              <p><strong>Motivo:</strong> {selectedAnticipo?.motivo}</p>
            </div>
            <div className="space-y-2">
              <Label>Justificante (PDF/Imagen)</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setReceiptFile(e.target.files[0])} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Just Upload (Admin) */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir Justificante</DialogTitle>
            <DialogDescription>Sube o reemplaza el documento del anticipo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Archivo (PDF/Imagen)</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setReceiptFile(e.target.files[0])} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsUploadOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenericUpload} disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Subir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alerta Rechazar */}
      <AlertDialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción marcará la solicitud como rechazada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700" disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alerta Eliminar */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar anticipo?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción es irreversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Anticipos;