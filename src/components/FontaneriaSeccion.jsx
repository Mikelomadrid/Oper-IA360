import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Droplets, Euro, Plus, Pencil, Trash2, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { format, parseISO, getMonth, getYear, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from '@/components/ui/use-toast';
import FontaneriaModal from '@/components/FontaneriaModal';

const TARIFA_FONTANERIA = 15;

const FRAN_EMAIL = 'fran@orkaled.com';

const months = [
  { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' }, { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

const formatCurrency = (val) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val || 0);

/**
 * FontaneriaSeccion
 * Bloque de horas de fontanería para añadir al final de HorasExtras2View.
 * Visible solo para fran@orkaled.com y admins.
 */
export default function FontaneriaSeccion() {
  const { user, sessionRole } = useAuth();
  const isAdmin = sessionRole?.rol === 'admin';
  const isFran = user?.email?.toLowerCase() === FRAN_EMAIL;

  // Solo visible para Fran o admins
  if (!isFran && !isAdmin) return null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  const [selectedMonth, setSelectedMonth] = useState(String(getMonth(new Date()) + 1));
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [proyectosMap, setProyectosMap] = useState({});

  // Modal añadir/editar registro
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFecha, setModalFecha] = useState(null);

  // Eliminar
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  // Cargar proyectos para mapear nombres
  useEffect(() => {
    const loadProyectos = async () => {
      const { data } = await supabase
        .from('proyectos')
        .select('id, nombre_proyecto');
      if (data) {
        const map = {};
        data.forEach(p => { map[p.id] = p.nombre_proyecto; });
        setProyectosMap(map);
      }
    };
    loadProyectos();
  }, []);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    try {
      const newDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
      const from = format(startOfMonth(newDate), 'yyyy-MM-dd');
      const to = format(endOfMonth(newDate), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('fontaneria_horas')
        .select('*')
        .gte('fecha', from)
        .lte('fecha', to)
        .order('fecha', { ascending: false });

      if (error) throw error;
      setRegistros(data || []);
    } catch (err) {
      console.error('Error cargando fontanería:', err);
      toast({ title: 'Error', description: 'No se pudieron cargar los registros.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchRegistros();
  }, [fetchRegistros]);

  // Totales del mes
  const totalHoras = registros.reduce((acc, r) => acc + Number(r.horas || 0), 0);
  const totalEuros = totalHoras * TARIFA_FONTANERIA;

  const handleNuevoRegistro = () => {
    setModalFecha(format(new Date(), 'yyyy-MM-dd'));
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      const { error } = await supabase
        .from('fontaneria_horas')
        .delete()
        .eq('id', recordToDelete.id);
      if (error) throw error;
      toast({ title: 'Eliminado', description: 'Registro de fontanería eliminado.' });
      fetchRegistros();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  return (
    <div className="mt-8 space-y-4">
      {/* Separador visual */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm uppercase tracking-wider">
          <Droplets className="w-4 h-4" />
          Horas de Fontanería
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Cabecera con filtros y acciones */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-blue-50/50 border border-blue-100 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchRegistros} disabled={loading} className="h-9">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>

        <Button
          size="sm"
          onClick={handleNuevoRegistro}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Añadir registro
        </Button>
      </div>

      {/* Cards resumen del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-blue-100 bg-blue-50/30">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Horas Fontanería</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">{totalHoras}h</p>
              <p className="text-xs text-muted-foreground mt-1">{registros.length} registros este mes</p>
            </div>
            <Droplets className="w-10 h-10 text-blue-200" />
          </CardContent>
        </Card>
        <Card className="border-emerald-100 bg-emerald-50/30">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Extra a Cobrar</p>
              <p className="text-3xl font-bold text-emerald-700 mt-1">{formatCurrency(totalEuros)}</p>
              <p className="text-xs text-muted-foreground mt-1">{TARIFA_FONTANERIA}€/h × {totalHoras}h</p>
            </div>
            <Euro className="w-10 h-10 text-emerald-200" />
          </CardContent>
        </Card>
      </div>

      {/* Tabla de registros */}
      <Card className="shadow-sm border-0 ring-1 ring-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  {isAdmin && <TableHead className="text-center w-20">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" /> Cargando...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : registros.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="h-32 text-center">
                      <div className="flex flex-col items-center text-muted-foreground">
                        <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                        <p>No hay registros de fontanería este mes.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {registros.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          {r.fecha ? format(parseISO(r.fecha), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">
                            {proyectosMap[r.obra_id] || 'Obra desconocida'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-blue-700">
                          {Number(r.horas)}h
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-700 font-semibold">
                          {formatCurrency(Number(r.horas) * TARIFA_FONTANERIA)}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => { setRecordToDelete(r); setDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}

                    {/* Fila totales */}
                    <TableRow className="bg-muted/40 font-bold border-t-2">
                      <TableCell colSpan={2} className="text-right text-muted-foreground uppercase text-xs tracking-wider">
                        Total mes:
                      </TableCell>
                      <TableCell className="text-right font-mono text-blue-700 text-base">
                        {totalHoras}h
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-700 text-base">
                        {formatCurrency(totalEuros)}
                      </TableCell>
                      {isAdmin && <TableCell />}
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal para añadir registro manual */}
      <FontaneriaModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); fetchRegistros(); }}
        fecha={modalFecha}
      />

      {/* Confirmar eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el registro de {recordToDelete?.horas}h del día{' '}
              {recordToDelete?.fecha ? format(parseISO(recordToDelete.fecha), 'dd/MM/yyyy') : ''}.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
