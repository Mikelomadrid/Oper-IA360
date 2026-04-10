import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
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
import { Plus, Check, Loader2, FileText, Upload, Ban, Pencil, Trash2, Eye } from 'lucide-react';
import { formatCurrency, fmtMadrid } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';

const EmployeeAnticiposTab = ({ employee, sessionRole }) => {
  const [anticipos, setAnticipos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  
  const [selectedAnticipo, setSelectedAnticipo] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);

  const [formData, setFormData] = useState({ cantidad: '', motivo: '' });

  const isAdminOrEncargado = ['admin', 'encargado'].includes(sessionRole?.rol);

  const fetchData = async () => {
    if (!employee?.auth_user_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('anticipos_nomina')
        .select('*')
        .eq('empleado_id', employee.auth_user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnticipos(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Error al cargar anticipos.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [employee]);

  // --- Actions ---

  const openCreate = () => {
    setEditingId(null);
    setFormData({ cantidad: '', motivo: '' });
    setIsFormOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setFormData({ cantidad: item.cantidad, motivo: item.motivo });
    setIsFormOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!employee.auth_user_id) return toast({ variant: 'destructive', title: 'Error', description: 'Sin usuario vinculado.' });
    
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('anticipos_nomina').update({ cantidad: parseFloat(formData.cantidad), motivo: formData.motivo }).eq('id', editingId);
        if (error) throw error;
        toast({ title: 'Actualizado', description: 'Anticipo modificado.' });
      } else {
        const { error } = await supabase.rpc('api_crear_anticipo_v1', { empleado: employee.auth_user_id, cantidad: parseFloat(formData.cantidad), motivo: formData.motivo });
        if (error) throw error;
        toast({ title: 'Creado', description: 'Anticipo registrado.' });
      }
      setIsFormOpen(false);
      fetchData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.from('anticipos_nomina').delete().eq('id', selectedAnticipo.id);
      if (error) throw error;
      toast({ title: 'Eliminado', description: 'Anticipo borrado.' });
      setAnticipos(prev => prev.filter(a => a.id !== selectedAnticipo.id));
      setIsDeleteOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar.' });
    } finally {
      setProcessing(false);
    }
  };

  const uploadFile = async (file, anticipoId) => {
    const ext = file.name.split('.').pop();
    const path = `anticipos/${employee.auth_user_id}/${anticipoId}/${Date.now()}.${ext}`;
    
    const { error } = await supabase.storage.from('anticipos_docs').upload(path, file);
    if (error) throw error;
    
    const { data } = supabase.storage.from('anticipos_docs').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleConfirm = async () => {
    if (!receiptFile) return toast({ variant: 'destructive', title: 'Error', description: 'Falta archivo.' });
    setProcessing(true);
    try {
      const url = await uploadFile(receiptFile, selectedAnticipo.id);
      const { error } = await supabase.from('anticipos_nomina').update({ estado: 'confirmado', justificante_url: url }).eq('id', selectedAnticipo.id);
      if (error) throw error;
      toast({ title: 'Confirmado', description: 'Anticipo confirmado.' });
      setIsConfirmOpen(false);
      fetchData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Fallo al confirmar.' });
    } finally {
      setProcessing(false);
    }
  };

  const handleGenericUpload = async () => {
    if (!receiptFile) return toast({ variant: 'destructive', title: 'Error', description: 'Falta archivo.' });
    setProcessing(true);
    try {
      const url = await uploadFile(receiptFile, selectedAnticipo.id);
      const { error } = await supabase.from('anticipos_nomina').update({ justificante_url: url }).eq('id', selectedAnticipo.id);
      if (error) throw error;
      toast({ title: 'Subido', description: 'Justificante actualizado.' });
      setIsUploadOpen(false);
      fetchData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Fallo al subir.' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.from('anticipos_nomina').update({ estado: 'rechazado' }).eq('id', selectedAnticipo.id);
      if (error) throw error;
      toast({ title: 'Rechazado', description: 'Solicitud rechazada.' });
      setIsRejectOpen(false);
      fetchData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo rechazar.' });
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkDescontado = async (id) => {
    try {
      const { error } = await supabase.rpc('api_marcar_anticipo_descontado_v1', { anticipo: id });
      if (error) throw error;
      toast({ title: 'Descontado', description: 'Marcado como descontado.' });
      setAnticipos(prev => prev.map(a => a.id === id ? { ...a, estado: 'descontado' } : a));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Fallo al actualizar.' });
    }
  };

  const getBadge = (status) => {
    const colors = { pendiente: 'bg-yellow-100 text-yellow-800', confirmado: 'bg-blue-100 text-blue-800', descontado: 'bg-green-100 text-green-800', rechazado: 'bg-red-100 text-red-800' };
    return <Badge className={colors[status]} variant="secondary">{status}</Badge>;
  };

  if (!isAdminOrEncargado) return <div className="p-4 text-muted-foreground">No autorizado.</div>;

  return (
    <div className="space-y-6 pt-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Anticipos de Nómina</h3>
        <Button onClick={openCreate} size="sm"><Plus className="mr-2 h-4 w-4" /> Registrar</Button>
      </div>

      {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Justificante</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {anticipos.map(item => (
                <TableRow key={item.id}>
                  <TableCell>{fmtMadrid(item.fecha_solicitud, 'date')}</TableCell>
                  <TableCell className="font-bold">{formatCurrency(item.cantidad)}</TableCell>
                  <TableCell className="truncate max-w-[150px]" title={item.motivo}>{item.motivo}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.justificante_url ? (
                        <a href={item.justificante_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center text-xs"><Eye className="w-3 h-3 mr-1"/>Ver</a>
                      ) : <span className="text-xs text-muted-foreground">No hay</span>}
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedAnticipo(item); setIsUploadOpen(true); }}><Upload className="w-3 h-3" /></Button>
                    </div>
                  </TableCell>
                  <TableCell>{getBadge(item.estado)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { setSelectedAnticipo(item); setIsDeleteOpen(true); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      <div className="w-px h-4 bg-border mx-1" />
                      {item.estado === 'pendiente' && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600" onClick={() => { setSelectedAnticipo(item); setIsConfirmOpen(true); }}><Check className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600" onClick={() => { setSelectedAnticipo(item); setIsRejectOpen(true); }}><Ban className="w-3.5 h-3.5" /></Button>
                        </>
                      )}
                      {item.estado === 'confirmado' && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600" onClick={() => handleMarkDescontado(item.id)}><Check className="w-3.5 h-3.5" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs reused conceptually */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Nuevo'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2"><Label>Cantidad</Label><Input type="number" step="0.01" value={formData.cantidad} onChange={e => setFormData({...formData, cantidad: e.target.value})} required /></div>
            <div className="space-y-2"><Label>Motivo</Label><Textarea value={formData.motivo} onChange={e => setFormData({...formData, motivo: e.target.value})} required /></div>
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin mr-2" />} Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar</DialogTitle><DialogDescription>Sube justificante.</DialogDescription></DialogHeader>
          <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setReceiptFile(e.target.files[0])} />
          <DialogFooter><Button variant="ghost" onClick={() => setIsConfirmOpen(false)}>Cancelar</Button><Button onClick={handleConfirm} disabled={processing}>{processing && <Loader2 className="animate-spin mr-2" />} Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Subir Archivo</DialogTitle></DialogHeader>
          <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setReceiptFile(e.target.files[0])} />
          <DialogFooter><Button variant="ghost" onClick={() => setIsUploadOpen(false)}>Cancelar</Button><Button onClick={handleGenericUpload} disabled={processing}>{processing && <Loader2 className="animate-spin mr-2" />} Subir</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Rechazar?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>No</AlertDialogCancel><AlertDialogAction onClick={handleReject}>Sí</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>No</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Sí</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmployeeAnticiposTab;