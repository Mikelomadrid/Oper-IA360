import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Banknote, Wallet, AlertCircle, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { formatCurrency, fmtMadrid } from '@/lib/utils';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const PAYMENT_METHODS = [
  { value: 'transferencia', label: 'Transferencia Bancaria' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'pagare', label: 'Pagaré' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'bizum', label: 'Bizum' },
  { value: 'otros', label: 'Otro' },
];

const PAYMENT_STATUS = [
  { value: 'completado', label: 'Completado (Cobrado)', color: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' },
  { value: 'pendiente', label: 'Pendiente (Planificado)', color: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
  { value: 'parcial', label: 'Parcial', color: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
];

const ProjectPayments = ({ projectId, budget = 0 }) => {
  const { sessionRole, empleadoId } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    method: 'transferencia',
    reference: '',
    status: 'completado'
  });

  const canManage = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado';

  useEffect(() => {
    if (projectId) {
      fetchPayments();
    }
  }, [projectId]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pagos_clientes')
        .select('*, empleado:created_by(nombre, apellidos)')
        .eq('proyecto_id', projectId)
        .order('fecha_pago', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los pagos.'
      });
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    // Only count completed payments for "Total Cobrado"
    const totalCollected = payments
        .filter(p => p.estado === 'completado' || p.estado === null) // Backwards compatibility for null
        .reduce((acc, curr) => acc + Number(curr.importe), 0);
    
    // Count pending payments
    const totalPendingScheduled = payments
        .filter(p => p.estado === 'pendiente')
        .reduce((acc, curr) => acc + Number(curr.importe), 0);

    const pendingToBill = Math.max(0, budget - totalCollected);
    const progress = budget > 0 ? (totalCollected / budget) * 100 : 0;
    
    return {
      totalCollected,
      totalPendingScheduled,
      pendingToBill,
      progress
    };
  }, [payments, budget]);

  const handleOpenModal = (payment = null) => {
    if (payment) {
      setEditingPayment(payment);
      setFormData({
        amount: payment.importe,
        date: format(new Date(payment.fecha_pago), 'yyyy-MM-dd'),
        method: payment.metodo,
        reference: payment.referencia || '',
        status: payment.estado || 'completado'
      });
    } else {
      setEditingPayment(null);
      setFormData({
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        method: 'transferencia',
        reference: '',
        status: 'completado'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.date || !formData.method) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Por favor rellena los campos obligatorios.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        proyecto_id: projectId,
        importe: parseFloat(formData.amount),
        fecha_pago: formData.date,
        metodo: formData.method,
        referencia: formData.reference,
        estado: formData.status
      };

      if (!editingPayment) {
        payload.created_by = empleadoId;
      }

      let error;
      if (editingPayment) {
        const { error: updateError } = await supabase
          .from('pagos_clientes')
          .update(payload)
          .eq('id', editingPayment.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('pagos_clientes')
          .insert(payload);
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: editingPayment ? 'Pago actualizado' : 'Pago registrado',
        description: `El pago ha sido ${editingPayment ? 'actualizado' : 'registrado'} correctamente.`
      });
      
      setIsModalOpen(false);
      fetchPayments();
    } catch (error) {
      console.error('Error saving payment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar el pago.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!paymentToDelete) return;
    try {
      const { error } = await supabase
        .from('pagos_clientes')
        .delete()
        .eq('id', paymentToDelete.id);

      if (error) throw error;

      toast({ title: 'Pago eliminado', description: 'El registro ha sido borrado.' });
      fetchPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el pago.' });
    } finally {
      setIsDeleteAlertOpen(false);
      setPaymentToDelete(null);
    }
  };

  const getStatusBadge = (status) => {
    const s = status || 'completado';
    const config = PAYMENT_STATUS.find(st => st.value === s) || PAYMENT_STATUS[0];
    
    return (
        <Badge className={`${config.color} border-0 shadow-sm`}>
            {s === 'completado' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
            <span className="capitalize">{s}</span>
        </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Summary Cards with Gradient */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-blue-700">Presupuesto Total</CardTitle>
            <div className="p-2 bg-blue-100 rounded-full">
                <Banknote className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{formatCurrency(budget)}</div>
            <p className="text-xs text-blue-600 mt-1">Importe total aceptado</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-emerald-700">Cobrado Real</CardTitle>
            <div className="p-2 bg-emerald-100 rounded-full">
                <Wallet className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">{formatCurrency(summary.totalCollected)}</div>
            <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-emerald-600">
                {summary.progress.toFixed(1)}% completado
                </p>
                {summary.totalPendingScheduled > 0 && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                        + {formatCurrency(summary.totalPendingScheduled)} previstos
                    </span>
                )}
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${summary.pendingToBill > 0 ? 'from-orange-50 to-amber-50 border-orange-200' : 'from-gray-50 to-gray-100 border-gray-200'} shadow-sm`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-semibold ${summary.pendingToBill > 0 ? 'text-orange-700' : 'text-gray-700'}`}>Pendiente de Cobro</CardTitle>
            <div className={`p-2 rounded-full ${summary.pendingToBill > 0 ? 'bg-orange-100' : 'bg-gray-200'}`}>
                <AlertCircle className={`h-4 w-4 ${summary.pendingToBill > 0 ? 'text-orange-600' : 'text-gray-500'}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.pendingToBill > 0 ? 'text-orange-900' : 'text-gray-600'}`}>
              {formatCurrency(summary.pendingToBill)}
            </div>
            <p className={`text-xs mt-1 ${summary.pendingToBill > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                Restante por facturar/cobrar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h3 className="text-lg font-bold text-gray-800">Historial de Pagos</h3>
            <p className="text-sm text-muted-foreground">Registro de ingresos y previsiones de cobro.</p>
        </div>
        {canManage && (
          <Button onClick={() => handleOpenModal()} className="shadow-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all hover:scale-[1.02]">
            <Plus className="h-4 w-4 mr-2" /> Registrar Pago
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[120px]">Fecha</TableHead>
              <TableHead className="w-[120px]">Estado</TableHead>
              <TableHead>Importe</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="hidden md:table-cell">Referencia / Notas</TableHead>
              <TableHead className="hidden lg:table-cell">Registrado por</TableHead>
              {canManage && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span>Cargando datos financieros...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="p-3 bg-muted rounded-full">
                        <Banknote className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p>No hay pagos registrados para este proyecto.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">{fmtMadrid(payment.fecha_pago, 'date')}</TableCell>
                  <TableCell>{getStatusBadge(payment.estado)}</TableCell>
                  <TableCell className="font-bold text-gray-700">
                    {formatCurrency(payment.importe)}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{payment.metodo}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[250px] truncate text-muted-foreground text-sm">
                    {payment.referencia || <span className="opacity-30">-</span>}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {payment.empleado 
                      ? `${payment.empleado.nombre} ${payment.empleado.apellidos || ''}` 
                      : <span className="italic opacity-50">Sistema</span>}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => handleOpenModal(payment)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setPaymentToDelete(payment);
                            setIsDeleteAlertOpen(true);
                          }}
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

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                {editingPayment ? <Pencil className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                {editingPayment ? 'Editar Pago' : 'Registrar Nuevo Pago'}
            </DialogTitle>
            <DialogDescription>
              Introduce los detalles del pago recibido o planificado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 py-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Estado del Pago</Label>
                <Select 
                    value={formData.status} 
                    onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                    <SelectTrigger className={formData.status === 'completado' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PAYMENT_STATUS.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="amount">Importe (€)</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">€</span>
                        <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        className="pl-7 font-bold text-lg"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        />
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="method">Método</Label>
                    <Select 
                        value={formData.method} 
                        onValueChange={(val) => setFormData({ ...formData, method: val })}
                    >
                        <SelectTrigger>
                        <SelectValue placeholder="Selecciona método" />
                        </SelectTrigger>
                        <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Referencia / Notas</Label>
              <Textarea
                id="reference"
                placeholder="Ej: Factura F-2024-001, Anticipo 50%..."
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="h-20 resize-none"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary text-white shadow-md">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingPayment ? 'Guardar Cambios' : 'Registrar Pago'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Eliminar Registro
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar este pago de <span className="font-bold">{paymentToDelete && formatCurrency(paymentToDelete.importe)}</span>? 
              <br/>
              Esta acción no se puede deshacer y afectará al cálculo de cobros del proyecto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPaymentToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Eliminar Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectPayments;