import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Save, X, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { ProviderSelect } from '@/components/ProviderSelect';
import { useAuth } from '@/contexts/SupabaseAuthContext';

/**
 * ToolCrudModal Component
 * 
 * Modal for creating or editing tools in the inventory.
 */
const ToolCrudModal = ({ isOpen, onClose, onSuccess, toolId }) => {
    const isEditMode = Boolean(toolId);
    const { sessionRole } = useAuth();
    const canEditStock = ['admin', 'encargado'].includes(sessionRole?.rol);

    // UI States
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Data Sources
    const [categories, setCategories] = useState([]);

    // Image State
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        nombre: '',
        marca: '',
        modelo: '',
        ref_almacen: '',
        categoria_id: '',
        proveedor_id: '',
        precio_compra: '',
        unidades_totales: '1',
        unidades_disponibles: '1',
        observaciones: '',
        estado: 'operativa'
    });

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                nombre: '',
                marca: '',
                modelo: '',
                ref_almacen: '',
                categoria_id: '',
                proveedor_id: '',
                precio_compra: '',
                unidades_totales: '1',
                unidades_disponibles: '1',
                observaciones: '',
                estado: 'operativa'
            });
            setImageFile(null);
            setImagePreview(null);
            fetchDependencies();
            if (isEditMode) fetchToolData(toolId);
        }
    }, [isOpen, toolId]);

    const fetchDependencies = async () => {
        try {
            // 1. Fetch Categories
            const { data: catData } = await supabase
                .from('categorias_herramienta')
                .select('id, nombre')
                .eq('activa', true)
                .order('nombre');

            setCategories(catData || []);

        } catch (err) {
            console.error("Dependency fetch error:", err);
            toast({ variant: "destructive", title: "Error", description: "Error al cargar datos auxiliares." });
        }
    };

    const fetchToolData = async (id) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('herramientas')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            if (data) {
                setFormData({
                    nombre: data.nombre || '',
                    marca: data.marca || '',
                    modelo: data.modelo || '',
                    ref_almacen: data.ref_almacen || '',
                    categoria_id: data.categoria_id || '',
                    proveedor_id: data.proveedor_id || '',
                    precio_compra: data.precio_compra || data.coste || '',
                    unidades_totales: data.unidades_totales?.toString() || '1',
                    unidades_disponibles: data.unidades_disponibles?.toString() || '1',
                    observaciones: data.observaciones || '',
                    estado: data.estado || 'operativa'
                });
                // Initialize image preview from existing data
                if (data.foto_url) {
                    setImagePreview(data.foto_url);
                }
            }
        } catch (err) {
            console.error("Error fetching tool:", err);
            toast({ variant: "destructive", title: "Error", description: "No se pudo cargar la herramienta." });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Image handlers
    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast({ variant: "destructive", title: "Archivo muy grande", description: "La imagen debe ser menor a 5MB" });
                return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic validation
        if (!formData.nombre || !formData.unidades_totales) {
            toast({ variant: "destructive", title: "Campos requeridos", description: "Nombre y Unidades son obligatorios." });
            return;
        }

        setSaving(true);
        try {
            // Image Upload Logic
            let finalFotoUrl = imagePreview;
            let finalFotoPath = null;

            // If a new file is selected, upload it
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `tools/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('herramientas_fotos')
                    .upload(fileName, imageFile);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('herramientas_fotos')
                    .getPublicUrl(fileName);

                finalFotoUrl = urlData.publicUrl;
                finalFotoPath = fileName;
            } else if (imagePreview === null) {
                // If preview was explicitly cleared, clear the URL in DB
                finalFotoUrl = null;
                finalFotoPath = null;
            }

            const payload = {
                nombre: formData.nombre,
                marca: formData.marca,
                modelo: formData.modelo,
                ref_almacen: formData.ref_almacen,
                categoria_id: formData.categoria_id || null,
                proveedor_id: formData.proveedor_id || null,
                precio_compra: parseFloat(formData.precio_compra) || 0,
                coste: parseFloat(formData.precio_compra) || 0,
                unidades_totales: parseInt(formData.unidades_totales) || 1,
                unidades_disponibles: parseInt(formData.unidades_disponibles) || 0,
                observaciones: formData.observaciones,
                estado: formData.estado,
                foto_url: finalFotoUrl,
                updated_at: new Date().toISOString()
            };

            // Only update foto_path if we uploaded a new one or cleared it
            if (imageFile || finalFotoUrl === null) {
                payload.foto_path = finalFotoPath;
            }

            if (!isEditMode) {
                payload.unidades_disponibles = payload.unidades_totales;
                payload.created_at = new Date().toISOString();
                payload.activa = true;
            }

            let error;
            if (isEditMode) {
                const { error: updateError } = await supabase
                    .from('herramientas')
                    .update(payload)
                    .eq('id', toolId);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('herramientas')
                    .insert([payload]);
                error = insertError;
            }

            if (error) throw error;

            toast({ title: "Éxito", description: isEditMode ? "Herramienta actualizada" : "Herramienta creada" });
            onSuccess(); // Close and Refresh parent

        } catch (err) {
            console.error("Save error:", err);
            toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la herramienta." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] overflow-visible max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Editar Herramienta' : 'Nueva Herramienta'}</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        {/* Row 1 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nombre">Nombre *</Label>
                                <Input
                                    id="nombre"
                                    value={formData.nombre}
                                    onChange={(e) => handleChange('nombre', e.target.value)}
                                    placeholder="Ej: Taladro Percutor"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ref_almacen">Ref. Almacén</Label>
                                <Input
                                    id="ref_almacen"
                                    value={formData.ref_almacen}
                                    onChange={(e) => handleChange('ref_almacen', e.target.value)}
                                    placeholder="Ej: TAL-001"
                                />
                            </div>
                        </div>

                        {/* Row 2 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="marca">Marca</Label>
                                <Input
                                    id="marca"
                                    value={formData.marca}
                                    onChange={(e) => handleChange('marca', e.target.value)}
                                    placeholder="Ej: Makita"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="modelo">Modelo</Label>
                                <Input
                                    id="modelo"
                                    value={formData.modelo}
                                    onChange={(e) => handleChange('modelo', e.target.value)}
                                    placeholder="Ej: DHP484"
                                />
                            </div>
                        </div>

                        {/* Row 3 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Categoría</Label>
                                <Select
                                    value={formData.categoria_id}
                                    onValueChange={(val) => handleChange('categoria_id', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.nombre}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Proveedor</Label>
                                <ProviderSelect
                                    value={formData.proveedor_id}
                                    onValueChange={(val) => handleChange('proveedor_id', val)}
                                    placeholder="Buscar proveedor..."
                                />
                            </div>
                        </div>

                        {/* Row 4 */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="unidades_totales">Stock Total *</Label>
                                <Input
                                    id="unidades_totales"
                                    type="number"
                                    min="1"
                                    value={formData.unidades_totales}
                                    onChange={(e) => handleChange('unidades_totales', e.target.value)}
                                    disabled={!canEditStock}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="unidades_disponibles">Stock Disponible</Label>
                                <Input
                                    id="unidades_disponibles"
                                    type="number"
                                    min="0"
                                    value={formData.unidades_disponibles}
                                    onChange={(e) => handleChange('unidades_disponibles', e.target.value)}
                                    disabled={!canEditStock}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="precio_compra">Precio Compra (€)</Label>
                                <Input
                                    id="precio_compra"
                                    type="number"
                                    step="0.01"
                                    value={formData.precio_compra}
                                    onChange={(e) => handleChange('precio_compra', e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Row 5: Observaciones */}
                        <div className="space-y-2">
                            <Label htmlFor="observaciones">Observaciones</Label>
                            <Textarea
                                id="observaciones"
                                value={formData.observaciones}
                                onChange={(e) => handleChange('observaciones', e.target.value)}
                                placeholder="Detalles adicionales..."
                                rows={3}
                            />
                        </div>

                        {/* New Row: Image Upload */}
                        <div className="space-y-2 pt-2 border-t mt-4">
                            <Label className="block mb-2 font-medium">Foto de la Herramienta</Label>
                            <div className="flex items-start gap-4">
                                {imagePreview ? (
                                    <div className="relative group shrink-0">
                                        <div className="w-24 h-24 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRemoveImage}
                                            className="absolute -top-2 -right-2 bg-destructive text-white p-1 rounded-full shadow-sm hover:bg-red-600 transition-colors"
                                            title="Eliminar foto"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/20 text-muted-foreground shrink-0">
                                        <ImageIcon size={24} className="opacity-50" />
                                    </div>
                                )}
                                <div className="flex-1 space-y-2">
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageSelect}
                                        className="cursor-pointer file:text-primary file:font-medium"
                                        disabled={saving}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Sube una foto clara de la herramienta. Formatos: JPG, PNG, WEBP.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditMode ? 'Guardar Cambios' : 'Crear Herramienta'}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default ToolCrudModal;