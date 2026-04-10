import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { 
  Plus, 
  Loader2, 
  Paperclip, 
  X, 
  Eye, 
  Building2,
  Image as ImageIcon,
  FileText,
  Filter,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  HardHat,
  FileArchive,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar as CalendarIcon
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, fmtMadrid } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

const FarmAdminAvisosView = ({ navigate }) => {
  const { user } = useAuth();
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [filters, setFilters] = useState({
    dateRange: { from: undefined, to: undefined },
    ccpp: '',
    status: 'all',
  });

  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newFiles, setNewFiles] = useState([]);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    descripcion: '',
    comunidad: '',
    contacto: '',
    telefono: ''
  });

  useEffect(() => {
    if (user) fetchAvisos();
  }, [user]);

  const fetchAvisos = async () => {
    setLoading(true);
    try {
      const { data: empData } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single();
      if (!empData) throw new Error('Perfil de administrador de finca no encontrado');

      const { data, error } = await supabase
        .from('avisos')
        .select(`
          *, 
          tecnico:empleados!avisos_tecnico_asignado_id_fkey(id, nombre, apellidos),
          creador_interno:empleados!avisos_creador_id_fkey(nombre, apellidos, rol),
          archivos:avisos_archivos(count)
        `)
        .eq('creador_id', empData.id) 
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvisos(data || []);
    } catch (error) {
      console.error('Error fetching avisos:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los avisos.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.descripcion.trim()) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'La descripción es obligatoria.' });
      return;
    }
    if (!formData.comunidad.trim()) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'El nombre de la Comunidad de Propietarios es obligatorio (CCPP).' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: empData } = await supabase.from('empleados').select('id, nombre').eq('auth_user_id', user.id).single();
      
      const { data: avisoData, error: avisoError } = await supabase
        .from('avisos')
        .insert({
          descripcion_solicitud: formData.descripcion,
          direccion_servicio: formData.comunidad, 
          cliente_nombre: formData.contacto || empData.nombre,
          telefono_contacto: formData.telefono,
          creador_id: empData.id,
          creador_rol: 'Administrador de Finca',
          estado: 'pendiente',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (avisoError) throw avisoError;

      if (newFiles.length > 0) {
        const uploadPromises = newFiles.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `avisos/${avisoData.id}/${uuidv4()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('avisos-files').upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from('avisos-files').getPublicUrl(fileName);
          return supabase.from('avisos_archivos').insert({
            aviso_id: avisoData.id,
            archivo_url: urlData.publicUrl,
            nombre_archivo: file.name,
            tipo_archivo: file.type,
            subido_por: empData.id
          });
        });
        await Promise.all(uploadPromises);
      }

      toast({ title: 'Aviso creado', description: 'Se ha notificado a la central correctamente.' });
      setIsCreateOpen(false);
      setFormData({ descripcion: '', comunidad: '', contacto: '', telefono: '' });
      setNewFiles([]);
      fetchAvisos();

    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear el aviso.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files) setNewFiles(prev => [...prev, ...Array.from(e.target.files)]);
  };

  const handleRemoveFile = (idx) => {
    setNewFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleOpenDetail = (aviso) => {
    if (navigate) navigate(`/finca/avisos/detail/${aviso.id}`);
    else console.error("Navigate function is not available.");
  };

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase() || 'pendiente';
    switch(s) {
      case 'cerrado': return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200"><CheckCircle2 className="w-3 h-3 mr-1"/>Completado</Badge>;
      case 'en_curso': return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200"><Clock className="w-3 h-3 mr-1"/>En Curso</Badge>;
      default: return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200"><AlertCircle className="w-3 h-3 mr-1"/>Pendiente</Badge>;
    }
  };

  const getCreatorShortName = (aviso) => {
    if (aviso.creador_interno) {
      if (aviso.creador_interno.nombre === 'Administracion') return 'ATC';
      return aviso.creador_interno.nombre || 'N/A';
    }
    return aviso.creador_rol || 'Sistema';
  };

  const filteredAndSortedAvisos = React.useMemo(() => {
    return avisos.filter(a => {
      const matchesCCPP = !filters.ccpp || (a.direccion_servicio || '').toLowerCase().includes(filters.ccpp.toLowerCase());
      const matchesStatus = filters.status === 'all' || a.estado === filters.status;
      let matchesDate = true;
      if (filters.dateRange.from) {
        const date = parseISO(a.created_at);
        if (filters.dateRange.to) {
          matchesDate = date >= startOfDay(filters.dateRange.from) && date <= endOfDay(filters.dateRange.to);
        } else {
          matchesDate = date >= startOfDay(filters.dateRange.from) && date <= endOfDay(filters.dateRange.from);
        }
      }
      return matchesCCPP && matchesStatus && matchesDate;
    }).sort((a, b) => {
      if (!sortConfig.key) return 0;
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [avisos, filters, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const clearFilters = () => {
    setFilters({ dateRange: { from: undefined, to: undefined }, ccpp: '', status: 'all' });
  };

  return (
    <>
      <Helmet><title>Mis Avisos | Gestión de Fincas</title></Helmet>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <Building2 className="w-8 h-8 text-primary" />
              Panel de Fincas
            </h1>
            <p className="text-muted-foreground">Gestiona tus solicitudes de mantenimiento y reparación.</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-primary text-primary-foreground shadow-md">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Aviso
          </Button>
        </div>

        <div className="bg-card border rounded-lg p-4 shadow-sm flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nombre de CCPP</Label>
            <Input 
              placeholder="Buscar por comunidad..." 
              value={filters.ccpp}
              onChange={e => setFilters(prev => ({ ...prev, ccpp: e.target.value }))}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Estado</Label>
            <Select value={filters.status} onValueChange={val => setFilters(prev => ({ ...prev, status: val }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_curso">En Curso</SelectItem>
                <SelectItem value="cerrado">Completado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="text-muted-foreground hover:text-destructive self-end"
            disabled={!filters.ccpp && filters.status === 'all'}
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Limpiar
          </Button>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[120px]">Fecha</TableHead>
                <TableHead className="w-[120px]">Creador</TableHead>
                <TableHead>Nombre de C.P.</TableHead>
                <TableHead className="w-[150px]">Estado</TableHead>
                <TableHead className="w-[180px]">Técnico Asignado</TableHead>
                <TableHead className="w-[120px]">Archivos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : filteredAndSortedAvisos.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No se encontraron avisos.</TableCell></TableRow>
              ) : (
                filteredAndSortedAvisos.map((aviso) => (
                  <TableRow key={aviso.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => handleOpenDetail(aviso)}>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span className="font-medium">{fmtMadrid(aviso.created_at, 'date')}</span>
                        <span className="text-muted-foreground">{fmtMadrid(aviso.created_at, 'time')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
                          {getCreatorShortName(aviso).charAt(0)}
                        </div>
                        <span>{getCreatorShortName(aviso)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium max-w-[250px] truncate" title={aviso.direccion_servicio}>
                        {aviso.direccion_servicio}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(aviso.estado)}</TableCell>
                    <TableCell>
                      {aviso.tecnico ? (
                        <div className="flex items-center gap-2 text-sm"><HardHat className="w-4 h-4 text-primary" /><span>{aviso.tecnico.nombre}</span></div>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground font-normal">Sin asignar</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <FileArchive className="w-4 h-4" />
                        <span>{aviso.archivos[0]?.count || 0}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden space-y-4">
          {loading ? (
            <div className="h-32 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filteredAndSortedAvisos.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">No hay avisos para mostrar.</div>
          ) : (
            filteredAndSortedAvisos.map(aviso => (
              <Card key={aviso.id} className="cursor-pointer" onClick={() => handleOpenDetail(aviso)}>
                <CardHeader className="flex-row justify-between items-start pb-2">
                  <CardTitle className="text-sm font-medium">
                    <div className="flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-primary" /><span>{fmtMadrid(aviso.created_at, 'datetime')}</span></div>
                  </CardTitle>
                  {getStatusBadge(aviso.estado)}
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-3">
                  <p className="font-semibold text-foreground pr-2">{aviso.direccion_servicio}</p>
                  <div className="text-sm text-muted-foreground space-y-2 pt-2 border-t">
                    <div className="flex items-center gap-2"><User className="w-4 h-4 text-primary/70"/><span>Creado por: <span className="font-medium text-foreground/80">{getCreatorShortName(aviso)}</span></span></div>
                    {aviso.tecnico ? (
                      <div className="flex items-center gap-2"><HardHat className="w-4 h-4 text-green-600"/><span>Asignado a: <span className="font-medium text-foreground/80">{aviso.tecnico.nombre}</span></span></div>
                    ) : (
                      <div className="flex items-center gap-2"><HardHat className="w-4 h-4 text-muted-foreground"/><span>Sin técnico asignado</span></div>
                    )}
                    <div className="flex items-center gap-2"><FileArchive className="w-4 h-4 text-muted-foreground" /><span>{aviso.archivos[0]?.count || 0} archivos adjuntos</span></div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Aviso</DialogTitle>
            <DialogDescription>Indica los detalles de la incidencia o solicitud de trabajo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="comunidad">CCPP (Comunidad de Propietarios) *</Label>
              <Input 
                id="comunidad"
                placeholder="Ej: Comunidad del Edificio Las Flores, Calle Principal 123"
                value={formData.comunidad}
                onChange={(e) => setFormData(p => ({ ...p, comunidad: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="desc">Descripción del problema *</Label>
              <Textarea 
                id="desc"
                placeholder="Ej: Fuga de agua en zona comunitaria, escalera B..."
                value={formData.descripcion}
                onChange={(e) => setFormData(p => ({ ...p, descripcion: e.target.value }))}
                className="min-h-[100px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact">Persona de Contacto</Label>
                <Input 
                  id="contact"
                  placeholder="Nombre"
                  value={formData.contacto}
                  onChange={(e) => setFormData(p => ({ ...p, contacto: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input 
                  id="phone"
                  placeholder="Número de contacto"
                  value={formData.telefono}
                  onChange={(e) => setFormData(p => ({ ...p, telefono: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Adjuntar Fotos / Documentos</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {newFiles.map((file, idx) => (
                  <div key={idx} className="relative group border rounded-md p-2 bg-muted/20 flex items-center gap-2 pr-8">
                    {file.type.includes('image') ? <ImageIcon className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-orange-500" />}
                    <span className="text-xs truncate max-w-[120px]">{file.name}</span>
                    <button onClick={() => handleRemoveFile(idx)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-red-100 text-red-500 rounded-full transition-colors"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="h-9" onClick={() => fileInputRef.current?.click()}><Paperclip className="w-4 h-4 mr-2" /> Añadir Archivo</Button>
                <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar Aviso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FarmAdminAvisosView;