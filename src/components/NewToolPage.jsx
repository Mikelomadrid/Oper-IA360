import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, ArrowLeft, Image as ImageIcon, FileText } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { ProviderSelect } from '@/components/ProviderSelect'; 

const NewToolPage = ({ navigate }) => {
    const { id } = useParams(); 
    const isEditMode = Boolean(id);

    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [fetching, setFetching] = useState(true); // Start fetching true
    const [categories, setCategories] = useState([]);
    const [providers, setProviders] = useState([]); // Store providers here
    
    // Form State
    const [formData, setFormData] = useState({
        nombre: '',
        marca: '',
        modelo: '',
        categoria_id: '',
        proveedor_id: null, 
        precio_compra: '',
        fecha_compra: '',
        fecha_garantia: '',
        observaciones: '',
        unidades_totales: '1',
        unidades_disponibles: '1',
        ref_almacen: '',
        estado: 'operativa',
        activa: true
    });

    const [files, setFiles] = useState({
        foto: null,
        ficha_tecnica: null
    });

    const [existingFiles, setExistingFiles] = useState({
        foto_url: null,
        ficha_tecnica_path: null
    });

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            setFetching(true);
            try {
                // 1. Fetch Categories
                const { data: cats } = await supabase
                    .from('categorias_herramienta')
                    .select('id, nombre')
                    .eq('activa', true)
                    .order('nombre');
                setCategories(cats || []);

                // 2. Fetch Providers (Now handled here instead of inside the component)
                const { data: provs } = await supabase
                    .from('proveedores')
                    .select('id, nombre')
                    .eq('activo', true)
                    .order('nombre');
                setProviders(provs || []);
                console.log("Providers loaded:", provs?.length);

                // 3. Fetch Tool Data if Edit Mode
                if (isEditMode) {
                    const { data: tool, error } = await supabase
                        .from('herramientas')
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (error) throw error;

                    if (tool) {
                        setFormData({
                            nombre: tool.nombre || '',
                            marca: tool.marca || '',
                            modelo: tool.modelo || '',
                            categoria_id: tool.categoria_id || '',
                            proveedor_id: tool.proveedor_id || null, 
                            precio_compra: tool.precio_compra || tool.coste || '',
                            fecha_compra: tool.fecha_compra || '',
                            fecha_garantia: tool.fecha_garantia || '',
                            observaciones: tool.observaciones || '',
                            unidades_totales: tool.unidades_totales?.toString() || '1',
                            unidades_disponibles: tool.unidades_disponibles?.toString() || '1',
                            ref_almacen: tool.ref_almacen || '',
                            estado: tool.estado || 'operativa',
                            activa: tool.activa
                        });
                        setExistingFiles({
                            foto_url: tool.foto_url,
                            ficha_tecnica_path: tool.ficha_tecnica_path
                        });
                    }
                }

            } catch (error) {
                console.error('Error fetching data:', error);
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos.' });
                navigate('/inventario/catalogo');
            } finally {
                setFetching(false);
            }
        };

        fetchData();
    }, [id, isEditMode, navigate]);

    // Input Handlers
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        
        // Auto-sync totals/available on create
        if (!isEditMode && name === 'unidades_totales') {
            setFormData(prev => ({
                ...prev,
                unidades_totales: value,
                unidades_disponibles: value
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSelectChange = (name, value) => {
        console.log(`Selecting ${name}:`, value);
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            setFiles(prev => ({ ...prev, [type]: file }));
        }
    };

    // File Upload Helper
    const uploadFile = async (file, bucket, pathPrefix = '') => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${pathPrefix}${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(fileName, file);

        if (uploadError) throw uploadError;
        
        if (bucket === 'herramientas_fotos') {
             const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
             return { path: fileName, url: data.publicUrl };
        }
        
        return { path: fileName, url: null };
    };

    // Submit Handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.nombre || !formData.categoria_id || !formData.precio_compra || !formData.unidades_totales) {
            toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Completa los campos marcados con *' });
            return;
        }

        setLoading(true);
        setUploading(true);

        try {
            let fotoUrl = existingFiles.foto_url;
            let fichaPath = existingFiles.ficha_tecnica_path;

            if (files.foto) {
                const result = await uploadFile(files.foto, 'herramientas_fotos');
                fotoUrl = result.url;
            }

            if (files.ficha_tecnica) {
                const result = await uploadFile(files.ficha_tecnica, 'herramientas_docs');
                fichaPath = result.path;
            }

            setUploading(false);

            const payload = {
                nombre: formData.nombre,
                marca: formData.marca,
                modelo: formData.modelo,
                categoria_id: formData.categoria_id,
                proveedor_id: formData.proveedor_id,
                ref_almacen: formData.ref_almacen,
                precio_compra: parseFloat(formData.precio_compra),
                coste: parseFloat(formData.precio_compra),
                fecha_compra: formData.fecha_compra || null,
                fecha_garantia: formData.fecha_garantia || null,
                observaciones: formData.observaciones,
                unidades_totales: parseInt(formData.unidades_totales),
                unidades_disponibles: parseInt(formData.unidades_disponibles), 
                foto_url: fotoUrl,
                ficha_tecnica_path: fichaPath,
                estado: formData.estado,
                activa: formData.activa,
                updated_at: new Date().toISOString()
            };

            if (!isEditMode) {
                payload.created_at = new Date().toISOString();
                payload.estado = 'operativa';
                payload.activa = true;
            }

            let error;
            if (isEditMode) {
                const { error: updateError } = await supabase
                    .from('herramientas')
                    .update(payload)
                    .eq('id', id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('herramientas')
                    .insert([payload]);
                error = insertError;
            }

            if (error) throw error;

            toast({ 
                title: isEditMode ? 'Actualizado' : 'Creado', 
                description: 'La herramienta se ha guardado correctamente.' 
            });
            navigate('/inventario/catalogo');

        } catch (error) {
            console.error('Error saving tool:', error);
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    if (fetching) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 pb-20 overflow-visible">
            <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4"
            >
                <Button variant="ghost" size="icon" onClick={() => navigate('/inventario/catalogo')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{isEditMode ? 'Editar Herramienta' : 'Nueva Herramienta'}</h1>
                    <p className="text-muted-foreground">
                        {isEditMode ? 'Modifica los datos de la herramienta.' : 'Registra una nueva herramienta en el inventario.'}
                    </p>
                </div>
            </motion.div>

            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* 1. Datos Básicos */}
                <Card className="overflow-visible">
                    <CardHeader>
                        <CardTitle className="text-xl">1. Datos Básicos</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-visible">
                        <div className="space-y-2">
                            <Label htmlFor="nombre">Nombre *</Label>
                            <Input id="nombre" name="nombre" value={formData.nombre} onChange={handleInputChange} placeholder="Ej: Taladro Percutor" required />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="ref_almacen">Referencia Almacén *</Label>
                            <Input id="ref_almacen" name="ref_almacen" value={formData.ref_almacen} onChange={handleInputChange} placeholder="Ej: HER-001" required />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="marca">Marca</Label>
                            <Input id="marca" name="marca" value={formData.marca} onChange={handleInputChange} placeholder="Ej: Makita" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="modelo">Modelo</Label>
                            <Input id="modelo" name="modelo" value={formData.modelo} onChange={handleInputChange} placeholder="Ej: HP457D" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="categoria_id">Categoría *</Label>
                            <Select value={formData.categoria_id} onValueChange={(val) => handleSelectChange('categoria_id', val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar categoría" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id || "unknown"}>{cat.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="proveedor_id">Proveedor</Label>
                            {/* UPDATED: Simplified ProviderSelect usage */}
                            <ProviderSelect 
                                value={formData.proveedor_id} 
                                onValueChange={(val) => handleSelectChange('proveedor_id', val)}
                                providers={providers}
                                placeholder="Seleccionar proveedor..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="precio_compra">Precio Compra (€) *</Label>
                            <Input id="precio_compra" name="precio_compra" type="number" step="0.01" value={formData.precio_compra} onChange={handleInputChange} placeholder="0.00" required />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fecha_compra">Fecha Compra</Label>
                            <Input id="fecha_compra" name="fecha_compra" type="date" value={formData.fecha_compra} onChange={handleInputChange} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fecha_garantia">Fecha Garantía</Label>
                            <Input id="fecha_garantia" name="fecha_garantia" type="date" value={formData.fecha_garantia} onChange={handleInputChange} />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="observaciones">Observaciones</Label>
                            <Textarea id="observaciones" name="observaciones" value={formData.observaciones} onChange={handleInputChange} placeholder="Notas adicionales..." rows={3} />
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Stock e Inventario */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">2. Stock e Inventario</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="unidades_totales">Unidades Totales *</Label>
                            <Input 
                                id="unidades_totales" 
                                name="unidades_totales" 
                                type="number" 
                                min="1" 
                                value={formData.unidades_totales} 
                                onChange={handleInputChange} 
                                required 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unidades_disponibles">Unidades Disponibles</Label>
                            <Input 
                                id="unidades_disponibles" 
                                name="unidades_disponibles" 
                                type="number" 
                                value={formData.unidades_disponibles} 
                                onChange={handleInputChange}
                                className={isEditMode ? "" : "bg-muted"}
                                disabled={!isEditMode} 
                            />
                            {isEditMode && <p className="text-xs text-yellow-600">⚠️ Modificar solo si el inventario está desfasado.</p>}
                        </div>

                        {isEditMode && (
                            <div className="space-y-2">
                                <Label htmlFor="estado">Estado</Label>
                                <Select value={formData.estado} onValueChange={(val) => handleSelectChange('estado', val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="operativa">Operativa</SelectItem>
                                        <SelectItem value="en_reparacion">En Reparación</SelectItem>
                                        <SelectItem value="baja">Baja / Desechada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 3. Archivos */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">3. Archivos y Documentación</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4 border rounded-lg p-4 border-dashed relative">
                            <div className="flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-blue-500" />
                                <Label htmlFor="foto" className="text-base">Fotografía</Label>
                            </div>
                            {existingFiles.foto_url && (
                                <div className="mb-2 relative w-24 h-24 border rounded overflow-hidden">
                                    <img src={existingFiles.foto_url} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                            )}
                            <Input 
                                id="foto" 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => handleFileChange(e, 'foto')} 
                                className="cursor-pointer"
                            />
                        </div>

                        <div className="space-y-4 border rounded-lg p-4 border-dashed">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-orange-500" />
                                <Label htmlFor="ficha_tecnica" className="text-base">Ficha Técnica</Label>
                            </div>
                            {existingFiles.ficha_tecnica_path && (
                                <div className="mb-2 text-sm text-blue-600 underline">
                                    <a href="#" onClick={(e) => e.preventDefault()}>Ver ficha actual</a>
                                </div>
                            )}
                            <Input 
                                id="ficha_tecnica" 
                                type="file" 
                                accept=".pdf,.doc,.docx" 
                                onChange={(e) => handleFileChange(e, 'ficha_tecnica')} 
                                className="cursor-pointer"
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4 pt-4">
                    <Button type="button" variant="outline" onClick={() => navigate('/inventario/catalogo')} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="min-w-[150px]">
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {uploading ? 'Subiendo...' : 'Guardando...'}
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                {isEditMode ? 'Guardar Cambios' : 'Crear Herramienta'}
                            </>
                        )}
                    </Button>
                </div>

            </form>
        </div>
    );
};

export default NewToolPage;