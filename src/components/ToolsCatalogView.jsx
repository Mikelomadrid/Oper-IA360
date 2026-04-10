import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, Search, Wrench, ArrowLeft, Download, Eye, Pencil, Trash2, RefreshCw, Image as ImageIcon, Plus, Layers, History, LogOut } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import ToolCrudModal from '@/components/ToolCrudModal';
import CategoryManagerModal from '@/components/CategoryManagerModal';
import * as XLSX from 'xlsx';
import { getAllOriginalImages, triggerResizeFunction, getThumbnailUrl } from '@/lib/imageUtils';
import { cn } from '@/lib/utils';

const ToolsCatalogView = ({ navigate }) => {
  const { sessionRole } = useAuth();
  const canManage = useMemo(() => ['admin', 'encargado'].includes(sessionRole.rol), [sessionRole.rol]);

  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  
  // Crud Modal
  const [isCrudModalOpen, setIsCrudModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState(null);

  // Regeneration state
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState(0);
  const [regenTotal, setRegenTotal] = useState(0);
  const [regenCurrent, setRegenCurrent] = useState(0);
  const [regenStatus, setRegenStatus] = useState('');

  const fetchTools = async () => {
    // Only set loading on first load to avoid flickering on realtime updates
    if (tools.length === 0) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_herramientas_catalogo_ui_v2')
        .select('*');

      if (error) throw error;
      setTools(data || []);
    } catch (error) {
      console.error('Error fetching tools:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el catálogo de herramientas' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();

    // Subscribe to realtime changes on 'herramientas' table to update stock instantly
    const subscription = supabase
      .channel('herramientas_catalog_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'herramientas' }, (payload) => {
        // Optimistically update if simple update, or refetch
        fetchTools();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const exportToExcel = () => {
    if (filteredTools.length === 0) {
        toast({ title: "Sin datos", description: "No hay herramientas para exportar.", variant: "warning" });
        return;
    }

    const dataToExport = filteredTools.map(t => ({
        'Nombre': t.nombre,
        'Marca': t.marca || '-',
        'Modelo': t.modelo || '-',
        'Ref. Almacén': t.ref_almacen || '-',
        'Categoría': t.categoria || '-',
        'Estado': t.estado || '-',
        'Stock Total': t.unidades_totales,
        'Stock Disponible': t.unidades_disponibles,
        'Proveedor': t.proveedor || '-',
        'Fecha Compra': t.fecha_compra ? new Date(t.fecha_compra).toLocaleDateString() : '-',
        'Precio Compra': t.precio_compra || 0,
        'Observaciones': t.observaciones || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Herramientas");

    const colWidths = Object.keys(dataToExport[0]).map(key => ({
        wch: Math.max(key.length, ...dataToExport.map(row => (row[key] ? row[key].toString().length : 0))) + 2
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `Catalogo_Herramientas_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast({ title: "Exportación exitosa", description: "El archivo Excel se ha descargado." });
  };

  const handleRegenerateAll = async () => {
    setIsRegenerating(true);
    setRegenProgress(0);
    setRegenCurrent(0);
    setRegenStatus('Escaneando imágenes...');
    
    try {
        const images = await getAllOriginalImages();
        setRegenTotal(images.length);
        
        if (images.length === 0) {
            toast({ title: "Sin imágenes", description: "No se encontraron imágenes para procesar." });
            setIsRegenerating(false);
            setRegenDialogOpen(false);
            return;
        }

        let processed = 0;
        for (const img of images) {
            setRegenStatus(`Procesando: ${img.name}`);
            try {
                await triggerResizeFunction(img.name);
            } catch (err) {
                console.error(`Failed to regenerate ${img.name}`, err);
            }
            
            processed++;
            setRegenCurrent(processed);
            setRegenProgress(Math.round((processed / images.length) * 100));
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        setRegenStatus('¡Completado!');
        toast({ title: "Proceso finalizado", description: `Se han procesado ${images.length} imágenes.` });
        
    } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Falló el proceso de regeneración." });
        setRegenStatus('Error en el proceso.');
    } finally {
        setIsRegenerating(false);
    }
  };

  const categories = useMemo(() => {
    const uniqueCats = new Set(tools.map(t => t.categoria).filter(Boolean));
    return Array.from(uniqueCats).sort();
  }, [tools]);

  const filteredTools = useMemo(() => {
    return tools.filter(t => {
      const matchesSearch = 
        (t.nombre && t.nombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.marca && t.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.modelo && t.modelo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.ref_almacen && t.ref_almacen.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = categoryFilter === 'all' || t.categoria === categoryFilter;
      
      const estado = t.estado?.toLowerCase() || '';
      const stock = t.unidades_disponibles;
      
      let matchesAvailability = true;
      const inactiveStates = ['baja', 'robada', 'perdida', 'desechada'];
      
      if (availabilityFilter === 'disponible') {
          // Green: stock > 0 AND operational (not in repair/retired)
          matchesAvailability = stock > 0 && !['en_reparacion', ...inactiveStates].includes(estado);
      } else if (availabilityFilter === 'en_uso') {
          // Red: stock 0 AND active (not in repair/retired)
          matchesAvailability = stock === 0 && !['en_reparacion', ...inactiveStates].includes(estado);
      } else if (availabilityFilter === 'en_taller') {
          // Orange: En taller
          matchesAvailability = estado === 'en_reparacion';
      } else if (availabilityFilter === 'fuera_almacen') {
          // Blue: Fuera de almacén (independiente de stock)
          matchesAvailability = t.fuera_de_almacen === true;
      }
      
      return matchesSearch && matchesCategory && matchesAvailability;
    });
  }, [tools, searchTerm, categoryFilter, availabilityFilter]);

  const handleCreate = () => {
    setEditingTool(null);
    setIsCrudModalOpen(true);
  };

  const handleEdit = (tool) => {
    setEditingTool(tool);
    setIsCrudModalOpen(true);
  };

  const handleDelete = async (tool) => {
      if(!window.confirm(`¿Estás seguro de eliminar la herramienta ${tool.nombre}?`)) return;
      
      try {
          const { data, error } = await supabase.rpc('admin_delete_herramienta', { p_id: tool.id });
          if(error) throw error;
          
          if(data && data.ok) {
              toast({ title: 'Eliminado', description: 'La herramienta se ha eliminado correctamente.'});
              fetchTools();
          } else {
              toast({ variant: 'destructive', title: 'No se pudo eliminar', description: data?.motivo || 'Error desconocido' });
          }
      } catch (err) {
          console.error(err);
          toast({ variant: 'destructive', title: 'Error', description: err.message });
      }
  };

  const getStatusBadge = (tool) => {
    const estado = tool.estado?.toLowerCase() || '';
    const stock = tool.unidades_disponibles;

    // Prioridad 1: Herramienta en taller (Estado específico)
    if (estado === 'en_reparacion') {
        return <Badge className="bg-[#F97316] text-white hover:bg-[#E06000]">En Taller</Badge>; // Orange
    }
    
    // Prioridad 2: Estados inactivos (Baja, Robada, etc.)
    if (['baja', 'robada', 'perdida', 'desechada'].includes(estado)) {
        return <Badge variant="secondary" className="bg-slate-200 text-slate-700 border-slate-300">{estado.toUpperCase()}</Badge>;
    }

    // Prioridad 3: Disponibilidad de Stock
    if (stock > 0) {
        return <Badge className="bg-[#22C55E] text-white hover:bg-[#1DA853]">Disponible</Badge>; // Green
    } else {
        return <Badge className="bg-[#EF4444] text-white hover:bg-[#D53B3B]">En uso</Badge>; // Red
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventario/herramientas')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Wrench className="h-8 w-8" />
              Catálogo Completo
            </h1>
            <p className="text-muted-foreground">Listado general de todas las herramientas.</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
            {canManage && (
                <>
                    <Button onClick={handleCreate} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva Herramienta
                    </Button>
                    <Button variant="outline" onClick={() => setIsCategoryModalOpen(true)}>
                        <Layers className="mr-2 h-4 w-4" />
                        Categorías
                    </Button>
                    <Button variant="outline" onClick={() => setRegenDialogOpen(true)} title="Regenerar miniaturas de imágenes">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerar IMG
                    </Button>
                </>
            )}
            <Button variant="outline" onClick={exportToExcel}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
            </Button>
        </div>
      </div>

      <Card className="rounded-xl shadow-lg border-t-4 border-t-primary">
        <CardHeader className="pb-3">
          <CardTitle>Filtros</CardTitle>
          <div className="flex flex-col md:flex-row gap-4 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre, marca, modelo o referencia..." 
                className="pl-9 rounded-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-[200px]">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-[200px]">
              <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Disponibilidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="disponible">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#22C55E]" />
                      Disponible
                    </div>
                  </SelectItem>
                  <SelectItem value="en_uso">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#EF4444]" />
                      En uso
                    </div>
                  </SelectItem>
                  <SelectItem value="en_taller">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#F97316]" />
                      En taller
                    </div>
                  </SelectItem>
                  <SelectItem value="fuera_almacen">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      Fuera de almacén
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/20">
              <Wrench className="mx-auto h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-xl font-semibold text-muted-foreground">No se encontraron herramientas</h3>
              <p className="text-sm text-muted-foreground mt-2">Prueba con otros filtros o crea una nueva herramienta.</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[60px] text-center"><ImageIcon className="h-4 w-4 mx-auto" /></TableHead>
                    <TableHead className="w-[80px]">Ref.</TableHead>
                    <TableHead>Nombre / Marca</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Stock (Disp/Tot)</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTools.map((tool) => {
                    // Determine initial image source: prefer path (thumbnail), fallback to url (legacy/original)
                    const imageSrc = tool.foto_path ? getThumbnailUrl(tool.foto_path) : tool.foto_url;
                    
                    const isEnUso = tool.unidades_disponibles === 0 && tool.estado?.toLowerCase() !== 'en_reparacion';

                    return (
                    <TableRow 
                        key={tool.id} 
                        onClick={() => navigate(`/inventario/herramientas/${tool.id}`)} 
                        className={cn(
                            "cursor-pointer hover:bg-muted/50 transition-colors group",
                            { "bg-red-50/20 dark:bg-red-900/10": isEnUso }
                        )}
                    >
                      <TableCell>
                        <div className="flex justify-center">
                            {imageSrc ? (
                                <img 
                                    src={imageSrc} 
                                    alt={tool.nombre} 
                                    className="h-10 w-10 object-cover rounded-md border bg-background shadow-sm group-hover:scale-110 transition-transform"
                                    onError={(e) => {
                                        if (e.target.dataset.error === 'true') return;
                                        e.target.dataset.error = 'true';
                                        if (tool.foto_url && e.target.src !== tool.foto_url) {
                                            e.target.src = tool.foto_url;
                                        } else {
                                            e.target.style.display = 'none';
                                            e.target.parentElement.innerHTML = `<div class="h-10 w-10 flex items-center justify-center bg-muted rounded-md border text-muted-foreground/50"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wrench"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>`;
                                        }
                                    }}
                                />
                            ) : (
                                <div className="h-10 w-10 flex items-center justify-center bg-muted rounded-md border text-muted-foreground/40">
                                    <Wrench className="h-5 w-5" />
                                </div>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{tool.ref_almacen || '-'}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{tool.nombre}</div>
                        <div className="text-xs text-muted-foreground">{tool.marca} {tool.modelo}</div>
                      </TableCell>
                      <TableCell>
                        {tool.categoria ? (
                          <Badge variant="outline" className="font-normal">{tool.categoria}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 font-medium">
                            <span className={cn(
                                tool.unidades_disponibles > 0 ? "text-green-600" : "text-destructive",
                                "transition-colors duration-300"
                            )}>
                                {tool.unidades_disponibles}
                            </span>
                            <span className="text-muted-foreground">/</span>
                            <span>{tool.unidades_totales}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(tool)}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary hover:bg-primary/10" onClick={() => navigate(`/inventario/herramientas/${tool.id}`)} title="Ver detalles / Historial">
                                <History className="h-4 w-4" />
                            </Button>
                            {canManage && (
                                <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleEdit(tool)} title="Editar">
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(tool)} title="Eliminar">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {isCrudModalOpen && (
        <ToolCrudModal 
            isOpen={isCrudModalOpen}
            onClose={() => setIsCrudModalOpen(false)}
            onSuccess={() => {
                setIsCrudModalOpen(false);
                fetchTools();
            }}
            toolId={editingTool?.id}
        />
      )}

      {isCategoryModalOpen && (
        <CategoryManagerModal
            isOpen={isCategoryModalOpen}
            onClose={() => setIsCategoryModalOpen(false)}
        />
      )}

      {/* Regeneration Modal */}
      <Dialog open={regenDialogOpen} onOpenChange={(open) => !isRegenerating && setRegenDialogOpen(open)}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Regenerar Imágenes</DialogTitle>
                <DialogDescription>
                    Este proceso regenerará las miniaturas de todas las imágenes de herramientas. Puede tardar unos minutos dependiendo de la cantidad de imágenes.
                </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
                {isRegenerating ? (
                    <>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Progreso</span>
                                <span>{regenCurrent} / {regenTotal}</span>
                            </div>
                            <Progress value={regenProgress} className="h-2" />
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate animate-pulse">
                            {regenStatus}
                        </p>
                    </>
                ) : (
                    <div className="p-4 bg-muted/50 rounded-lg text-sm text-center">
                        <p>Pulsa "Comenzar" para iniciar el proceso de escaneo y regeneración.</p>
                    </div>
                )}
            </div>

            <DialogFooter className="sm:justify-end">
                <Button variant="secondary" onClick={() => setRegenDialogOpen(false)} disabled={isRegenerating}>
                    {isRegenerating ? 'Procesando...' : 'Cancelar'}
                </Button>
                {!isRegenerating && (
                    <Button onClick={handleRegenerateAll}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Comenzar
                    </Button>
                )}
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ToolsCatalogView;