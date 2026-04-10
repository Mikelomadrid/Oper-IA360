import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Pencil, Trash2, Plus, Save, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const CategoryManagerModal = ({ isOpen, onClose }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  
  // Form state for creating/editing
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: ''
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categorias_herramienta')
        .select('*')
        .order('nombre');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las categorías.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cat) => {
    setEditingId(cat.id);
    setFormData({
      nombre: cat.nombre,
      descripcion: cat.descripcion || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ nombre: '', descripcion: '' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que quieres eliminar esta categoría? Si tiene herramientas asociadas, fallará.')) return;

    try {
      const { error } = await supabase
        .from('categorias_herramienta')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: 'Categoría eliminada' });
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar. Verifica que no tenga herramientas asociadas.' });
    }
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast({ variant: 'destructive', title: 'Nombre requerido' });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('categorias_herramienta')
          .update({
            nombre: formData.nombre,
            descripcion: formData.descripcion
          })
          .eq('id', editingId);
        
        if (error) throw error;
        toast({ title: 'Categoría actualizada' });
      } else {
        // Create
        const { error } = await supabase
          .from('categorias_herramienta')
          .insert([{
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            activa: true
          }]);
        
        if (error) throw error;
        toast({ title: 'Categoría creada' });
      }

      handleCancelEdit();
      fetchCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la categoría.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gestionar Categorías</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {/* Create/Edit Form */}
          <div className="bg-muted/30 p-4 rounded-lg border mb-6 space-y-4">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-nombre">Nombre</Label>
                <Input 
                  id="cat-nombre" 
                  value={formData.nombre} 
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Eléctricas" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-desc">Descripción (Opcional)</Label>
                <Input 
                  id="cat-desc" 
                  value={formData.descripcion} 
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Breve descripción" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {editingId && (
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  <X className="w-4 h-4 mr-2" /> Cancelar
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                <Save className="w-4 h-4 mr-2" />
                {editingId ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                        No hay categorías registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((cat) => (
                      <TableRow key={cat.id}>
                        <TableCell className="font-medium">{cat.nombre}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{cat.descripcion || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8" 
                              onClick={() => handleEdit(cat)}
                            >
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleDelete(cat.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryManagerModal;