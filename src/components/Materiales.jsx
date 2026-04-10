import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Search, Package, Pencil, Trash2, Layers, ShoppingCart, Image as ImageIcon, Eye, Download, X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import MaterialCrudModal from '@/components/MaterialCrudModal';
import RequestMaterialModal from '@/components/RequestMaterialModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import * as XLSX from 'xlsx';

const Materiales = ({ navigate }) => {
  const { sessionRole } = useAuth();
  const canManage = useMemo(() => ['admin', 'encargado'].includes(sessionRole.rol), [sessionRole.rol]);
  const canRequest = useMemo(() => ['admin', 'encargado', 'tecnico'].includes(sessionRole.rol), [sessionRole.rol]);

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter state
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Modals
  const [isCrudModalOpen, setIsCrudModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [deleteMaterial, setDeleteMaterial] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('materiales')
        .select('*, proveedores(nombre)')
        .order('fecha_creacion', { ascending: false });

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
      toast({ variant: 'destructive', title: 'Error', description: `No se pudieron cargar los materiales. ${error.message || ''}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const handleEdit = (material) => {
    setEditingMaterial(material);
    setIsCrudModalOpen(true);
  };

  const handleDeleteClick = (material) => {
    setDeleteMaterial(material);
    setDeleteDialogOpen(true);
  };

  const handleViewDetail = (material) => {
    navigate(`/inventario/materiales/${material.id}`);
  };

  const confirmDelete = async () => {
    if (!deleteMaterial) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('materiales').delete().eq('id', deleteMaterial.id);
      if (error) throw error;
      
      toast({ title: 'Material eliminado', description: `${deleteMaterial.nombre || deleteMaterial.descripcion} ha sido eliminado.` });
      fetchMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el material.' });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteMaterial(null);
    }
  };

  const exportToExcel = () => {
    if (filteredMaterials.length === 0) {
      toast({ title: "Sin datos", description: "No hay materiales para exportar.", variant: "warning" });
      return;
    }

    const dataToExport = filteredMaterials.map(m => ({
      'Nombre': m.nombre || m.descripcion,
      'Código': m.codigo || '-',
      'Categoría': m.categoria || '-',
      'Stock Actual': m.stock_actual,
      'Unidad': m.unidad_medida,
      'Precio Coste': m.precio_coste || 0,
      'Proveedor': m.proveedores?.nombre || '-',
      'Observaciones': m.observaciones || '-',
      'Descripción': m.descripcion || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Materiales");
    
    // Auto-adjust column width (basic approximation)
    const colWidths = Object.keys(dataToExport[0]).map(key => ({
      wch: Math.max(key.length, ...dataToExport.map(row => (row[key] ? row[key].toString().length : 0))) + 2
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `Inventario_Materiales_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast({ title: "Exportación exitosa", description: "El archivo Excel se ha descargado." });
  };

  // Derive available categories dynamically from current data
  const categories = useMemo(() => {
    const uniqueCats = new Set(materials.map(m => m.categoria).filter(Boolean));
    return Array.from(uniqueCats).sort();
  }, [materials]);

  // Combined filtering logic: Search AND Category
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      // 1. Search Filter (Case-insensitive, check name, description, code)
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = 
        !term || 
        (m.nombre && m.nombre.toLowerCase().includes(term)) ||
        (m.descripcion && m.descripcion.toLowerCase().includes(term)) ||
        (m.codigo && m.codigo.toLowerCase().includes(term));
      
      // 2. Category Filter (Exact match or 'all')
      const matchesCategory = categoryFilter === 'all' || m.categoria === categoryFilter;

      // 3. Combine (Intersection)
      return matchesSearch && matchesCategory;
    });
  }, [materials, searchTerm, categoryFilter]);

  // Handler for clearing category filter explicitly
  const clearCategoryFilter = (e) => {
    e.stopPropagation(); // Prevent dropdown from opening if using custom clear button logic inside trigger
    setCategoryFilter('all');
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Layers className="h-8 w-8" />
            Inventario de Materiales
          </h1>
          <p className="text-muted-foreground">Gestión de stock y catálogo de materiales de obra.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={exportToExcel} className="flex-1 md:flex-none">
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Exportar Excel</span>
            <span className="sm:hidden">Excel</span>
          </Button>
          {canRequest && (
            <Button variant="secondary" onClick={() => setIsRequestModalOpen(true)} className="flex-1 md:flex-none">
              <ShoppingCart className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Solicitar Material</span>
              <span className="sm:hidden">Solicitar</span>
            </Button>
          )}
          {canManage && (
            <Button onClick={() => { setEditingMaterial(null); setIsCrudModalOpen(true); }} className="flex-1 md:flex-none">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Nuevo Material</span>
              <span className="sm:hidden">Nuevo</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/10">
          <CardTitle className="text-lg">Catálogo</CardTitle>
          
          {/* Search and Filter Controls - Mobile Optimized */}
          <div className="flex flex-col md:flex-row gap-3 mt-4">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input 
                type="text" 
                placeholder="Buscar por nombre, código o descripción..." 
                className="pl-9 h-11 md:h-10 text-base md:text-sm" // Increased height and font-size for mobile touch targets
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                // Mobile optimization: ensure keyboard shows up and input is not covered
                inputMode="search"
                autoComplete="off"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Filter Dropdown */}
            <div className="w-full md:w-[240px]">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-11 md:h-10 w-full relative">
                  <SelectValue placeholder="Filtrar por Categoría" />
                  {categoryFilter !== 'all' && (
                    <span className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center">
                       <Badge variant="secondary" className="h-5 px-1 text-[10px] pointer-events-none mr-1">Filtro</Badge>
                    </span>
                  )}
                </SelectTrigger>
                <SelectContent className="max-h-[40vh]"> {/* Limit height on mobile for better UX */}
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={`cat-${cat}`} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="bg-muted/30 rounded-full p-4 w-20 h-20 mx-auto flex items-center justify-center mb-4">
                <Package className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium">No se encontraron materiales</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                Prueba ajustando los términos de búsqueda o cambiando el filtro de categoría.
              </p>
              {(searchTerm || categoryFilter !== 'all') && (
                <Button 
                  variant="link" 
                  onClick={() => { setSearchTerm(''); setCategoryFilter('all'); }}
                  className="mt-4"
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[80px] pl-4">Imagen</TableHead>
                    <TableHead className="min-w-[150px]">Nombre / Código</TableHead>
                    <TableHead className="min-w-[120px]">Categoría</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[200px]">Descripción</TableHead>
                    <TableHead className="min-w-[100px]">Stock</TableHead>
                    <TableHead className="min-w-[100px]">Coste</TableHead>
                    <TableHead className="text-right pr-4 min-w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials.map((material) => (
                    <TableRow key={material.id} onClick={() => handleViewDetail(material)} className="cursor-pointer hover:bg-muted/50 transition-colors group">
                      <TableCell className="pl-4 py-3">
                        <div 
                          className="h-12 w-12 rounded-lg bg-white border shadow-sm flex items-center justify-center overflow-hidden shrink-0"
                        >
                          {material.foto_url ? (
                            <img 
                              src={material.foto_url} 
                              alt={material.nombre} 
                              className="h-full w-full object-cover"
                              loading="lazy" 
                            />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {material.nombre || 'Sin nombre'}
                        </div>
                        {material.codigo && (
                          <div className="text-xs text-muted-foreground font-mono mt-0.5 bg-muted/50 inline-block px-1 rounded">
                            {material.codigo}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {material.categoria ? (
                          <Badge variant="outline" className="capitalize font-normal text-muted-foreground bg-background">
                            {material.categoria}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-xs truncate text-sm text-muted-foreground" title={material.observaciones || material.descripcion}>
                        {material.observaciones || material.descripcion || '-'}
                      </TableCell>
                      <TableCell>
                        <div className={`font-bold ${material.stock_actual <= 5 ? 'text-orange-600' : 'text-foreground'}`}>
                          {material.stock_actual} 
                          <span className="text-xs font-normal text-muted-foreground ml-1">{material.unidad_medida}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {material.precio_coste ? `${Number(material.precio_coste).toFixed(2)} €` : '-'}
                      </TableCell>
                      <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewDetail(material)} title="Ver detalles">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canManage && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEdit(material)} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(material)} title="Eliminar">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {isCrudModalOpen && (
        <MaterialCrudModal
          isOpen={isCrudModalOpen}
          onClose={() => setIsCrudModalOpen(false)}
          onSuccess={() => {
            fetchMaterials();
            setIsCrudModalOpen(false);
          }}
          material={editingMaterial}
        />
      )}

      {isRequestModalOpen && (
        <RequestMaterialModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          availableMaterials={materials}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el material <strong>{deleteMaterial?.nombre}</strong> del inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Materiales;