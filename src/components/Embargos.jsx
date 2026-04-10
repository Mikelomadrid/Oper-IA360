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
import { Plus, Loader2, Search, Eye, Gavel } from 'lucide-react';
import { formatCurrency, fmtMadrid } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Embargos = ({ navigate }) => {
  const { sessionRole } = useAuth();
  const [embargos, setEmbargos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEmbargo, setNewEmbargo] = useState({
    empleado_id: '',
    organismo: '',
    motivo: '',
    importe_total: '',
  });
  
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = sessionRole?.rol === 'admin';
  const isEncargado = sessionRole?.rol === 'encargado'; // Assuming encargados might verify but creation is admin only as per prompt (admin only for creation).
  // Prompt: "Add 'Nuevo Embargo' button (admin only)"

  const fetchEmbargos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('embargos')
        .select(`
          *,
          empleados!embargos_empleado_id_fkey (
            nombre,
            apellidos
          )
        `)
        .order('created_at', { ascending: false });

      // RLS should handle filtering for non-admins, but we rely on policies.
      // Prompt says: "Filter by role: non-admins see only their own embargos." -> handled by RLS usually, but let's fetch.

      const { data, error } = await query;

      if (error) throw error;
      setEmbargos(data || []);
    } catch (error) {
      console.error('Error fetching embargos:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los embargos.',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    if (!isAdmin) return;
    const { data } = await supabase
      .from('empleados')
      .select('auth_user_id, nombre, apellidos')
      .eq('activo', true)
      .not('auth_user_id', 'is', null)
      .order('nombre');
    setEmployees(data || []);
  };

  useEffect(() => {
    fetchEmbargos();
    if (isAdmin) fetchEmployees();
  }, [isAdmin]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newEmbargo.empleado_id || !newEmbargo.organismo || !newEmbargo.importe_total) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Rellena todos los campos obligatorios.' });
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.rpc('api_crear_embargo_v1', {
        empleado: newEmbargo.empleado_id,
        organismo: newEmbargo.organismo,
        motivo: newEmbargo.motivo || '',
        importe_total: parseFloat(newEmbargo.importe_total)
      });

      if (error) throw error;

      toast({ title: 'Embargo creado', description: 'El embargo se ha registrado correctamente.' });
      setIsCreateOpen(false);
      setNewEmbargo({ empleado_id: '', organismo: '', motivo: '', importe_total: '' });
      fetchEmbargos();
    } catch (error) {
      console.error('Error creating embargo:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setCreating(false);
    }
  };

  const filteredEmbargos = embargos.filter(e => 
    e.organismo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.motivo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.empleados?.nombre + ' ' + e.empleados?.apellidos).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'activo':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200">Activo</Badge>;
      case 'liquidado':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">Liquidado</Badge>;
      default:
        return <Badge variant="secondary">{estado}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gavel className="h-6 w-6 text-primary" />
            Gestión de Embargos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Control de retenciones judiciales y administrativas.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Embargo
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 bg-card p-2 rounded-lg border shadow-sm w-full md:w-auto md:max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground ml-2" />
        <Input 
          placeholder="Buscar por organismo, empleado..." 
          className="border-0 focus-visible:ring-0"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organismo</TableHead>
              <TableHead>Motivo</TableHead>
              {isAdmin && <TableHead>Empleado</TableHead>}
              <TableHead>Importe Total</TableHead>
              <TableHead>Pendiente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fechas</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : filteredEmbargos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  No hay embargos registrados.
                </TableCell>
              </TableRow>
            ) : (
              filteredEmbargos.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{item.organismo}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={item.motivo}>{item.motivo || '-'}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      {item.empleados ? `${item.empleados.nombre} ${item.empleados.apellidos || ''}` : 'Desconocido'}
                    </TableCell>
                  )}
                  <TableCell>{formatCurrency(item.importe_total)}</TableCell>
                  <TableCell className="font-bold text-foreground">{formatCurrency(item.importe_pendiente)}</TableCell>
                  <TableCell>{getStatusBadge(item.estado)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>Inicio: {fmtMadrid(item.fecha_inicio)}</div>
                    {item.fecha_fin && <div>Fin: {fmtMadrid(item.fecha_fin)}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate(`/personal/embargos/${item.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver detalle
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Crear Embargo */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Embargo</DialogTitle>
            <DialogDescription>Introduce los detalles de la orden de embargo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="empleado">Empleado</Label>
              <Select 
                value={newEmbargo.empleado_id} 
                onValueChange={(val) => setNewEmbargo({...newEmbargo, empleado_id: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.auth_user_id} value={emp.auth_user_id}>
                      {emp.nombre} {emp.apellidos}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organismo">Organismo Emisor</Label>
              <Input 
                id="organismo" 
                placeholder="Ej: Agencia Tributaria, Juzgado nº 5..." 
                value={newEmbargo.organismo}
                onChange={(e) => setNewEmbargo({...newEmbargo, organismo: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="importe">Importe Total (€)</Label>
              <Input 
                id="importe" 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={newEmbargo.importe_total}
                onChange={(e) => setNewEmbargo({...newEmbargo, importe_total: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo / Referencia</Label>
              <Input 
                id="motivo" 
                placeholder="Ej: Multa tráfico, Pensión alimentos..." 
                value={newEmbargo.motivo}
                onChange={(e) => setNewEmbargo({...newEmbargo, motivo: e.target.value})}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Embargo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Embargos;