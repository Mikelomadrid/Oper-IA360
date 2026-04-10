import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Search,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash,
  Plus,
  UploadCloud,
  LayoutGrid,
  List,
  FolderOpen
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

const AdminIncidencias = () => {
  const [incidencias, setIncidencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const { user } = useAuth();
  const { toast } = useToast();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [newIncidentData, setNewIncidentData] = useState({
    descripcion: '',
    proyecto_id: '',
    file: null
  });

  const [selectedIncidencia, setSelectedIncidencia] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [notasAdmin, setNotasAdmin] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    fetchIncidencias();
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('proyectos')
        .select('id, nombre_proyecto')
        .eq('estado', 'activo')
        .order('nombre_proyecto');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchIncidencias = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('incidencias')
        .select(`
          *,
          empleados:empleado_id (nombre, apellidos),
          proyectos:proyecto_id (nombre_proyecto),
          resolutor:resuelto_por (nombre, apellidos)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIncidencias(data || []);
    } catch (error) {
      console.error('Error fetching incidencias:', error);
      toast({
        variant: 'destructive',
        title: 'Error al cargar incidencias',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClick = () => {
    setNewIncidentData({ descripcion: '', proyecto_id: '', file: null });
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async () => {
    if (!newIncidentData.descripcion.trim()) {
      toast({ title: "La descripción es obligatoria", variant: "destructive" });
      return;
    }

    setCreateLoading(true);
    try {
      let photoUrl = null;

      if (newIncidentData.file) {
        const fileExt = newIncidentData.file.name.split('.').pop();
        const fileName = `admin-upload-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('incidencias')
          .upload(filePath, newIncidentData.file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('incidencias')
          .getPublicUrl(filePath);

        photoUrl = urlData.publicUrl;
      }

      const { data: empData } = await supabase
        .from('empleados')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!empData) throw new Error('No se pudo identificar tu usuario empleado.');

      const { error: insertError } = await supabase
        .from('incidencias')
        .insert({
          empleado_id: empData.id,
          proyecto_id: newIncidentData.proyecto_id || null,
          descripcion: newIncidentData.descripcion,
          foto_url: photoUrl,
          estado: 'abierta'
        });

      if (insertError) throw insertError;

      toast({ title: "Incidencia creada correctamente" });
      setCreateModalOpen(false);
      fetchIncidencias();
    } catch (error) {
      console.error(error);
      toast({ title: "Error al crear incidencia", description: error.message, variant: "destructive" });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResolveClick = (incidencia) => {
    setSelectedIncidencia(incidencia);
    setNotasAdmin('');
    setResolveModalOpen(true);
  };

  const handleEditClick = (incidencia) => {
    setSelectedIncidencia(incidencia);
    setEditDescription(incidencia.descripcion || '');
    setEditModalOpen(true);
  };

  const handleDeleteClick = (incidencia) => {
    setSelectedIncidencia(incidencia);
    setDeleteDialogOpen(true);
  };

  const confirmResolve = async () => {
    if (!selectedIncidencia) return;

    setActionLoading(true);
    try {
      const { data: empData } = await supabase
        .from('empleados')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!empData) throw new Error('No se pudo identificar tu usuario empleado.');

      const { error } = await supabase
        .from('incidencias')
        .update({
          estado: 'resuelta',
          resuelto_por: empData.id,
          notas_admin: notasAdmin,
        })
        .eq('id', selectedIncidencia.id);

      if (error) throw error;

      toast({
        title: 'Incidencia resuelta',
        description: 'La incidencia ha sido marcada como resuelta correctamente.',
        className: 'bg-green-600 text-white',
      });

      setResolveModalOpen(false);
      fetchIncidencias();
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error al resolver',
        description: error.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const confirmEdit = async () => {
    if (!selectedIncidencia) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('incidencias')
        .update({ descripcion: editDescription })
        .eq('id', selectedIncidencia.id);

      if (error) throw error;

      toast({ title: "Incidencia actualizada" });
      setEditModalOpen(false);
      fetchIncidencias();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedIncidencia) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('incidencias')
        .delete()
        .eq('id', selectedIncidencia.id);

      if (error) throw error;

      toast({ title: "Incidencia eliminada" });
      setDeleteDialogOpen(false);
      fetchIncidencias();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const openPhoto = (url) => {
    setSelectedPhoto(url);
    setPhotoModalOpen(true);
  };

  // Logic to separate incidents
  const matchesSearch = (inc) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      inc.descripcion?.toLowerCase().includes(searchLower) ||
      inc.empleados?.nombre?.toLowerCase().includes(searchLower) ||
      inc.empleados?.apellidos?.toLowerCase().includes(searchLower) ||
      inc.proyectos?.nombre_proyecto?.toLowerCase().includes(searchLower)
    );
  };

  const pendingIncidencias = incidencias.filter(inc => inc.estado !== 'resuelta' && matchesSearch(inc));
  const resolvedIncidencias = incidencias.filter(inc => inc.estado === 'resuelta' && matchesSearch(inc));

  const renderIncidentsList = (items) => {
    if (items.length === 0) {
      return (
        <div className="h-32 text-center text-muted-foreground flex items-center justify-center border border-dashed rounded-xl bg-card">
          No se encontraron incidencias en esta sección.
        </div>
      );
    }

    if (viewMode === 'list') {
      return (
        <div className="rounded-md border overflow-hidden bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[40%] sm:w-auto pl-4">Incidencia</TableHead>
                <TableHead className="hidden md:table-cell">Reportado Por</TableHead>
                <TableHead className="hidden lg:table-cell">Ubicación</TableHead>
                <TableHead className="hidden md:table-cell w-[30%]">Descripción</TableHead>
                <TableHead className="hidden sm:table-cell">Evidencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right w-[80px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((inc) => (
                <TableRow
                  key={inc.id}
                  className="group hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleEditClick(inc)}
                >
                  <TableCell className="font-medium text-xs align-top py-3 pl-4">
                    <div className="whitespace-nowrap mb-1 text-foreground/90">
                      {format(new Date(inc.created_at), "d MMM", { locale: es })}
                    </div>
                    <div className="md:hidden flex flex-col gap-1 text-muted-foreground mt-1">
                      <span className="font-semibold text-foreground/80">{inc.empleados?.nombre} {inc.empleados?.apellidos}</span>
                      {inc.proyectos && <span className="text-[10px] truncate flex items-center gap-1"><MapPin className="w-3 h-3" /> {inc.proyectos.nombre_proyecto}</span>}
                      <span className="line-clamp-2 text-[11px] italic mt-0.5">{inc.descripcion}</span>
                      {inc.foto_url && (
                        <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 justify-start text-[10px] mt-0.5" onClick={(e) => { e.stopPropagation(); openPhoto(inc.foto_url); }}>
                          <Eye className="w-3 h-3 mr-1" /> Ver foto
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell align-top">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        {inc.empleados?.nombre} {inc.empleados?.apellidos}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell align-top">
                    {inc.proyectos ? (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="w-3 h-3 text-primary/70" />
                        {inc.proyectos.nombre_proyecto}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">Sin proyecto asignado</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell align-top">
                    <p className="text-sm whitespace-pre-wrap line-clamp-2 group-hover:line-clamp-none transition-all">
                      {inc.descripcion}
                    </p>
                    {inc.estado === 'resuelta' && inc.notas_admin && (
                      <div className="mt-2 text-xs bg-green-50 dark:bg-green-950/20 p-2 rounded border border-green-100 dark:border-green-900/50 text-green-800 dark:text-green-300">
                        <strong>Resolución:</strong> {inc.notas_admin}
                        <div className="opacity-70 mt-0.5 text-[10px]">
                          Por: {inc.resolutor?.nombre}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell align-top">
                    {inc.foto_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={(e) => { e.stopPropagation(); openPhoto(inc.foto_url); }}
                      >
                        <Eye className="w-4 h-4 mr-1" /> Ver foto
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {inc.estado === 'resuelta' ? (
                      <Badge variant="default" className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Resuelta
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                        <AlertCircle className="w-3 h-3 mr-1" /> Abierta
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right align-top">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                          <span className="sr-only">Abrir menú</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); if (inc.foto_url) openPhoto(inc.foto_url); }} disabled={!inc.foto_url}>
                          <Eye className="mr-2 h-4 w-4" /> Ver Evidencia
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditClick(inc); }}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        {inc.estado !== 'resuelta' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleResolveClick(inc); }}>
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Resolver
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteClick(inc); }} className="text-destructive focus:text-destructive">
                          <Trash className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    } else {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((inc) => (
            <Card
              key={inc.id}
              className="cursor-pointer hover:shadow-md transition-all border-l-4 overflow-hidden"
              style={{ borderLeftColor: inc.estado === 'resuelta' ? '#22c55e' : '#ef4444' }}
              onClick={() => handleEditClick(inc)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <div className="text-sm font-semibold">
                    {inc.empleados?.nombre} {inc.empleados?.apellidos}
                    <div className="text-xs font-normal text-muted-foreground mt-0.5">
                      {format(new Date(inc.created_at), "d MMM yyyy", { locale: es })}
                    </div>
                  </div>
                  {inc.estado === 'resuelta' ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Resuelta</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Abierta</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 text-sm space-y-2">
                {inc.proyectos && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 p-1.5 rounded">
                    <MapPin className="w-3 h-3 text-primary/70 shrink-0" />
                    <span className="truncate">{inc.proyectos.nombre_proyecto}</span>
                  </div>
                )}
                <p className="line-clamp-3 text-foreground/90 min-h-[3rem]">
                  {inc.descripcion}
                </p>
              </CardContent>
              <CardFooter className="p-3 bg-muted/30 border-t flex justify-between items-center">
                {inc.foto_url ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => { e.stopPropagation(); openPhoto(inc.foto_url); }}
                  >
                    <Eye className="w-3 h-3 mr-1" /> Evidencia
                  </Button>
                ) : <span />}

                <div className="flex gap-1">
                  {inc.estado !== 'resuelta' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                      onClick={(e) => { e.stopPropagation(); handleResolveClick(inc); }}
                    >
                      Resolver
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="p-6 space-y-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestión de Incidencias</h1>
          <p className="text-muted-foreground">Supervisa y resuelve incidencias reportadas por los técnicos.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center bg-muted rounded-lg p-1 border mr-2">
            <Button
              variant={viewMode === 'cluster' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => setViewMode('cluster')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleCreateClick} className="gap-2 w-full md:w-auto">
            <Plus className="w-4 h-4" /> Nueva Incidencia
          </Button>
          <Badge variant="outline" className="bg-background px-3 py-1 h-10 flex items-center hidden md:flex gap-2">
            <span>Pendientes: {pendingIncidencias.length}</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-green-600">Resueltas: {resolvedIncidencias.length}</span>
          </Badge>
        </div>
      </div>

      <div className="rounded-lg border bg-muted p-3 md:p-4 shadow-1 mb-5">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-1/2">
            <div className="relative w-full">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por técnico, obra o descripción..."
                className="pl-8 h-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVE / PENDING INCIDENTS */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`pending-${viewMode}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-red-600">
            <AlertCircle className="w-5 h-5" />
            Incidencias Activas ({pendingIncidencias.length})
          </div>
          {loading ? (
            <div className="h-32 text-center flex items-center justify-center gap-2 text-muted-foreground border rounded-lg bg-card">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando incidencias...
            </div>
          ) : (
            renderIncidentsList(pendingIncidencias)
          )}
        </motion.div>
      </AnimatePresence>

      {/* RESOLVED INCIDENTS (Collapsible) */}
      <Accordion type="single" collapsible className="w-full mt-8 border rounded-lg bg-card shadow-sm">
        <AccordionItem value="resolved" className="border-none">
          <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 hover:no-underline transition-colors">
            <div className="flex items-center gap-3 w-full">
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full text-green-600 dark:text-green-400">
                <FolderOpen className="w-5 h-5" />
              </div>
              <span className="font-semibold text-lg text-foreground">Incidencias Resueltas</span>
              <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                {resolvedIncidencias.length}
              </Badge>
              <div className="ml-auto text-xs text-muted-foreground font-normal mr-4">
                Haga clic para expandir
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-6 pt-2 border-t">
            {renderIncidentsList(resolvedIncidencias)}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Crear Nueva Incidencia</DialogTitle>
            <DialogDescription>
              Registra un nuevo reporte de incidencia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Proyecto (Opcional)</Label>
              <Select
                value={newIncidentData.proyecto_id}
                onValueChange={(v) => setNewIncidentData(prev => ({ ...prev, proyecto_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un proyecto..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre_proyecto}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descripción del Problema</Label>
              <Textarea
                placeholder="Detalla qué ha sucedido..."
                value={newIncidentData.descripcion}
                onChange={(e) => setNewIncidentData(prev => ({ ...prev, descripcion: e.target.value }))}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Foto / Evidencia (Opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  className="cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) setNewIncidentData(prev => ({ ...prev, file: file }));
                  }}
                />
              </div>
              {newIncidentData.file && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <UploadCloud className="w-3 h-3" /> Archivo seleccionado: {newIncidentData.file.name}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSubmit} disabled={createLoading}>
              {createLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Incidencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resolveModalOpen} onOpenChange={setResolveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Incidencia</DialogTitle>
            <DialogDescription>
              Indica las acciones tomadas o notas para cerrar esta incidencia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-md text-sm">
              <p className="font-medium mb-1">Reporte original:</p>
              <p className="text-muted-foreground">{selectedIncidencia?.descripcion}</p>
            </div>
            <div className="space-y-2">
              <Label>Notas de Resolución</Label>
              <Textarea
                placeholder="Ej: Material repuesto, se contactó al cliente, etc."
                value={notasAdmin}
                onChange={(e) => setNotasAdmin(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveModalOpen(false)}>Cancelar</Button>
            <Button onClick={confirmResolve} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar y Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Incidencia</DialogTitle>
            <DialogDescription>
              Modifica la descripción de la incidencia si es necesario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={confirmEdit} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente la incidencia y su registro de la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-none">
          <div className="relative w-full h-full flex items-center justify-center bg-black/95 min-h-[400px]">
            {selectedPhoto && (
              <img
                src={selectedPhoto}
                alt="Evidencia"
                className="max-w-full max-h-[80vh] object-contain"
              />
            )}
            <Button
              className="absolute top-4 right-4 rounded-full bg-black/50 hover:bg-black/70 text-white"
              size="icon"
              variant="ghost"
              onClick={() => setPhotoModalOpen(false)}
            >
              <span className="sr-only">Cerrar</span>
              <span className="text-xl font-bold">×</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminIncidencias;