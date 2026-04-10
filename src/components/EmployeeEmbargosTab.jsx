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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Eye, Gavel, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

const EmployeeEmbargosTab = ({ employee, sessionRole, navigate }) => {
  const [embargos, setEmbargos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEmbargo, setNewEmbargo] = useState({
    organismo: '',
    motivo: '',
    importe_total: '',
  });

  const isAdmin = sessionRole?.rol === 'admin';

  const fetchEmbargos = async () => {
    if (!employee?.auth_user_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('embargos')
        .select(`
    *,
    embargos_retenciones (*),
    embargos_pagos (*)
  `)
        .eq('empleado_id', employee.auth_user_id)
        .order('created_at', { ascending: false });


      if (error) throw error;
      setEmbargos(data || []);
    } catch (error) {
      console.error('Error fetching embargos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmbargos();
  }, [employee]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newEmbargo.organismo || !newEmbargo.importe_total) {
      toast({ variant: 'destructive', title: 'Error', description: 'Campos obligatorios faltantes' });
      return;
    }

    if (!employee.auth_user_id) {
        toast({ variant: 'destructive', title: 'Error', description: 'Este empleado no tiene usuario vinculado.' });
        return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.rpc('api_crear_embargo_v1', {
        empleado: employee.auth_user_id,
        organismo: newEmbargo.organismo,
        motivo: newEmbargo.motivo || '',
        importe_total: parseFloat(newEmbargo.importe_total)
      });

      if (error) throw error;

      toast({ title: 'Éxito', description: 'Embargo registrado correctamente.' });
      setIsCreateOpen(false);
      setNewEmbargo({ organismo: '', motivo: '', importe_total: '' });
      fetchEmbargos();
    } catch (error) {
      console.error('Error creating embargo:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (estado) => {
    if (estado === 'liquidado') return <Badge className="bg-green-100 text-green-800 border-green-200">Liquidado</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Activo</Badge>;
  };

  if (!isAdmin) return <div className="p-4">No autorizado</div>;

  return (
    <div className="pt-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Gavel className="h-5 w-5" />
          Embargos y Retenciones
        </h3>
        <Button onClick={() => setIsCreateOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Embargo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : embargos.length === 0 ? (
        <div className="text-center p-8 border rounded-lg border-dashed text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No hay embargos registrados para este empleado.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organismo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Pendiente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {embargos.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.organismo}</TableCell>
                  <TableCell>{item.motivo || '-'}</TableCell>
                  <TableCell>{formatCurrency(item.importe_total)}</TableCell>
                  <TableCell className="font-bold text-red-600">{formatCurrency(item.importe_pendiente)}</TableCell>
                  <TableCell>{getStatusBadge(item.estado)}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => navigate && navigate(`/personal/embargos/${item.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Embargo para {employee.nombre}</DialogTitle>
            <DialogDescription>Registra una nueva retención judicial o administrativa.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="organismo">Organismo</Label>
              <Input 
                id="organismo" 
                value={newEmbargo.organismo} 
                onChange={e => setNewEmbargo({...newEmbargo, organismo: e.target.value})}
                placeholder="Ej: Hacienda, Juzgado..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="importe">Importe Total (€)</Label>
              <Input 
                id="importe" 
                type="number" 
                step="0.01" 
                value={newEmbargo.importe_total} 
                onChange={e => setNewEmbargo({...newEmbargo, importe_total: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo / Referencia</Label>
              <Input 
                id="motivo" 
                value={newEmbargo.motivo} 
                onChange={e => setNewEmbargo({...newEmbargo, motivo: e.target.value})}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeEmbargosTab;