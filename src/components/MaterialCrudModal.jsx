import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Loader2, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { ProviderSelect } from '@/components/ProviderSelect';

const COMMON_CATEGORIES = [
  'Albañilería', 'Fontanería', 'Electricidad', 'Iluminación', 'Pintura', 'Carpintería', 'Herraje', 'Consumible', 'EPIS', 'Pladur', 'Otros'
];

// Organized units by group
const UNIT_GROUPS = [
  {
    label: "Unidades Básicas",
    items: ['ud', 'kg', 'm', 'm2', 'm3', 'l']
  },
  {
    label: "Envases / Paquetes",
    items: ['caja', 'paquete', 'saco', 'palet']
  },
  {
    label: "Rollos",
    items: ['Rollo 50m', 'Rollo 100m', 'Rollo 200m', 'Rollo 500m']
  }
];

const MaterialCrudModal = ({ isOpen, onClose, onSuccess, material }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    categoria: '',
    descripcion: '', // Generic description
    observaciones: '', // Detailed notes
    stock_actual: '0',
    unidad_medida: 'ud',
    precio_coste: '0',
    foto_url: '',
    proveedor_id: ''
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (material) {
      setFormData({
        nombre: material.nombre || material.descripcion || '',
        codigo: material.codigo || '',
        categoria: material.categoria || '',
        descripcion: material.descripcion || '',
        observaciones: material.observaciones || '',
        stock_actual: material.stock_actual || '0',
        unidad_medida: material.unidad_medida || 'ud',
        precio_coste: material.precio_coste || '0',
        foto_url: material.foto_url || '',
        proveedor_id: material.proveedor_id || ''
      });
      setImagePreview(material.foto_url || null);
    } else {
      // Reset for new material
      setFormData({
        nombre: '',
        codigo: '',
        categoria: '',
        descripcion: '',
        observaciones: '',
        stock_actual: '0',
        unidad_medida: 'ud',
        precio_coste: '0',
        foto_url: '',
        proveedor_id: ''
      });
      setImagePreview(null);
    }
    setImageFile(null);
  }, [material, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData(prev => ({ ...prev, foto_url: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre) {
      toast({ variant: 'destructive', title: 'Error', description: 'El nombre es obligatorio.' });
      return;
    }

    setLoading(true);
    try {
      let finalFotoUrl = formData.foto_url;

      // 1. Upload image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('materiales_fotos')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('materiales_fotos')
          .getPublicUrl(filePath);

        finalFotoUrl = publicUrl;
      }

      // 2. Prepare payload
      const payload = {
        nombre: formData.nombre,
        codigo: formData.codigo || `MAT-${Date.now().toString().slice(-6)}`,
        categoria: formData.categoria || 'Otros',
        descripcion: formData.descripcion || formData.nombre,
        observaciones: formData.observaciones,
        stock_actual: parseFloat(formData.stock_actual) || 0,
        unidad_medida: formData.unidad_medida || 'ud',
        precio_coste: parseFloat(formData.precio_coste) || 0,
        fecha_creacion: material ? undefined : new Date().toISOString(),
        foto_url: finalFotoUrl,
        proveedor_id: formData.proveedor_id || null
      };

      // 3. Insert or Update
      let error;
      if (material) {
        const { error: updateError } = await supabase
          .from('materiales')
          .update(payload)
          .eq('id', material.id);
        error = updateError;
      } else {
        payload.id = crypto.randomUUID();
        const { error: insertError } = await supabase
          .from('materiales')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;

      toast({ 
        title: material ? 'Material actualizado' : 'Material creado', 
        description: `El material ${formData.nombre} se ha guardado correctamente.` 
      });
      onSuccess();
    } catch (error) {
      console.error('Error saving material:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Error al guardar', 
        description: error.message || 'Ocurrió un error al guardar el material.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{material ? 'Editar Material' : 'Nuevo Material'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          {/* Image Upload Section */}
          <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg bg-muted/30">
            {imagePreview ? (
              <div className="relative group">
                <img 
                  src={imagePreview} 
                  alt="Previsualización" 
                  className="h-32 w-32 object-cover rounded-md border shadow-sm"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 shadow-md hover:bg-destructive/90 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                </div>
                <Label htmlFor="foto-upload" className="cursor-pointer text-sm font-medium text-primary hover:underline">
                  Sube una imagen
                </Label>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP (Max 2MB)</p>
                <Input 
                  id="foto-upload" 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Material *</Label>
              <Input 
                id="nombre" 
                name="nombre" 
                value={formData.nombre} 
                onChange={handleChange} 
                placeholder="Ej: Cemento Cola" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigo">Código (Opcional)</Label>
              <Input 
                id="codigo" 
                name="codigo" 
                value={formData.codigo} 
                onChange={handleChange} 
                placeholder="Ej: CEM-001" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Select 
                value={COMMON_CATEGORIES.includes(formData.categoria) ? formData.categoria : 'custom'} 
                onValueChange={(val) => val !== 'custom' && handleSelectChange('categoria', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                  <SelectItem value="custom">Otra (Escribir abajo)</SelectItem>
                </SelectContent>
              </Select>
              {(!COMMON_CATEGORIES.includes(formData.categoria) || formData.categoria === '') && (
                <Input 
                  name="categoria" 
                  value={formData.categoria} 
                  onChange={handleChange} 
                  placeholder="Escribe una categoría personalizada" 
                  className="mt-2"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unidad_medida">Unidad de Medida</Label>
              <Select 
                value={formData.unidad_medida} 
                onValueChange={(val) => handleSelectChange('unidad_medida', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar unidad" />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_GROUPS.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.items.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Proveedor Habitual</Label>
            <ProviderSelect 
              value={formData.proveedor_id}
              onValueChange={(val) => handleSelectChange('proveedor_id', val)}
              placeholder="Buscar proveedor..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock_actual">Cantidad (Stock) *</Label>
              <Input 
                id="stock_actual" 
                name="stock_actual" 
                type="number" 
                step="0.01" 
                value={formData.stock_actual} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="precio_coste">Coste Unitario (€)</Label>
              <Input 
                id="precio_coste" 
                name="precio_coste" 
                type="number" 
                step="0.01" 
                value={formData.precio_coste} 
                onChange={handleChange} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observaciones">Descripción / Observaciones</Label>
            <Textarea 
              id="observaciones" 
              name="observaciones" 
              value={formData.observaciones} 
              onChange={handleChange} 
              placeholder="Detalles adicionales del material..." 
              rows={3} 
            />
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                material ? 'Guardar Cambios' : 'Crear Material'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialCrudModal;