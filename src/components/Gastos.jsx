import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MoreHorizontal, Edit, Trash2, Loader2, X, ScanLine, UploadCloud, Sparkles, PlusCircle, User, MapPin, Phone, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { useDropzone } from 'react-dropzone';
import { ProviderSelect } from '@/components/ProviderSelect';

const PAGO_STATUS_DB_VALUES = ['pendiente_pago', 'parcialmente_pagada', 'pagada', 'vencida'];
const PAGO_STATUS_LABELS = {
  'pendiente_pago': 'Pendiente',
  'parcialmente_pagada': 'Parcial',
  'pagada': 'Pagado',
  'vencida': 'Vencido',
};

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const formatCurrency = (value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0);
const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString.replace(/-/g, '/').replace(/T.+/, ''));
    return format(date, 'dd/MM/yyyy');
};

// --- QUICK ADD PROVIDER MODAL ---
const QuickProviderModal = ({ isOpen, onOpenChange, onProviderCreated }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nombre: '',
        cif: '',
        email: '',
        telefono: '',
        direccion: ''
    });

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.nombre.trim()) {
            toast({ title: "Nombre obligatorio", description: "El nombre comercial es requerido.", variant: "destructive" });
            return;
        }
        
        setLoading(true);
        try {
            const { data, error } = await supabase.from('proveedores').insert([{
                nombre: formData.nombre,
                cif: formData.cif || null,
                email: formData.email || null,
                telefono: formData.telefono || null,
                direccion: formData.direccion || null,
                activo: true,
                created_by: user?.id,
                fecha_creacion: new Date()
            }]).select().single();

            if (error) throw error;

            toast({ title: 'Proveedor creado', description: `Se ha añadido a ${data.nombre} correctamente.` });
            if (onProviderCreated) onProviderCreated(data);
            onOpenChange(false);
            setFormData({ nombre: '', cif: '', email: '', telefono: '', direccion: '' }); // reset
        } catch (err) {
            console.error(err);
            toast({ title: 'Error al crear proveedor', description: err.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Alta de nuevo Proveedor</DialogTitle>
                    <DialogDescription>Añade rápidamente un proveedor para asignarlo a esta factura.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="qp-nombre">Nombre Comercial *</Label>
                            <div className="relative">
                                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input id="qp-nombre" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Ej: Materiales Gómez S.L." className="pl-9" autoFocus required />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="qp-cif">CIF/NIF</Label>
                                <Input id="qp-cif" name="cif" value={formData.cif} onChange={handleChange} placeholder="B12345678" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="qp-telefono">Teléfono</Label>
                                <div className="relative">
                                    <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input id="qp-telefono" name="telefono" value={formData.telefono} onChange={handleChange} placeholder="600..." className="pl-9" />
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="qp-email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input id="qp-email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="facturacion@proveedor.com" className="pl-9" />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="qp-direccion">Dirección</Label>
                            <div className="relative">
                                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input id="qp-direccion" name="direccion" value={formData.direccion} onChange={handleChange} placeholder="C/ Ejemplo, 123" className="pl-9" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Crear y Seleccionar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

// --- GASTO FORM ---
const GastoForm = ({ onSave, onCancel, isSaving, context, projectId, gastoToEdit, ocrData }) => {
  const [formData, setFormData] = useState({
    numero_factura: '', numero_referencia: '', concepto: '', proyecto_id: '', proveedor_id: '',
    fecha_emision: format(new Date(), 'yyyy-MM-dd'), estado_pago: 'pendiente_pago', iva: 0.21, monto_bruto: 0,
  });
  const [initialProviderLabel, setInitialProviderLabel] = useState('');
  const [showNewProvider, setShowNewProvider] = useState(false);
  const [selectorKey, setSelectorKey] = useState(0); 
  const isEditing = !!gastoToEdit;
  
  useEffect(() => {
    const fetchInitialProvider = async (id) => {
        const { data } = await supabase.from('proveedores').select('nombre').eq('id', id).single();
        if (data) setInitialProviderLabel(data.nombre);
    }
    
    if (ocrData) {
        setFormData(prev => ({
            ...prev,
            numero_factura: ocrData.numero_factura || '',
            fecha_emision: ocrData.fecha_emision ? format(new Date(ocrData.fecha_emision), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            monto_bruto: ocrData.monto_bruto || 0,
            iva: ocrData.iva || 0.21,
            concepto: ocrData.concepto || '',
            proveedor_id: ocrData.proveedor_id || '',
        }));
        if (ocrData.proveedor_nombre) {
             setInitialProviderLabel(ocrData.proveedor_nombre);
        }
        if (ocrData.proveedor_id) {
            fetchInitialProvider(ocrData.proveedor_id);
        }
    } else if (isEditing) {
        setFormData({
            numero_factura: gastoToEdit.numero_factura || '',
            numero_referencia: gastoToEdit.numero_referencia || '',
            concepto: gastoToEdit.concepto || '',
            proyecto_id: gastoToEdit.proyecto_id || '',
            proveedor_id: gastoToEdit.proveedor_id || '',
            fecha_emision: gastoToEdit.fecha_emision ? format(new Date(gastoToEdit.fecha_emision), 'yyyy-MM-dd') : '',
            estado_pago: gastoToEdit.estado_pago || 'pendiente_pago',
            iva: gastoToEdit.iva !== undefined ? gastoToEdit.iva : 0.21,
            monto_bruto: gastoToEdit.monto_bruto || 0,
        });
        if (gastoToEdit.proveedor_id) {
           fetchInitialProvider(gastoToEdit.proveedor_id);
        }
    } else if (context === 'project' && projectId) {
        setFormData(prev => ({...prev, proyecto_id: projectId}));
    }
  }, [context, projectId, isEditing, gastoToEdit, ocrData]);
  
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let parsedValue = value;
    if (name === 'iva' || name === 'monto_bruto') {
        parsedValue = value === '' ? '' : parseFloat(value);
    }
    setFormData(prev => ({ ...prev, [name]: parsedValue }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProviderCreated = (newProvider) => {
      setFormData(prev => ({ ...prev, proveedor_id: newProvider.id }));
      setInitialProviderLabel(newProvider.nombre);
      setSelectorKey(prev => prev + 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.proveedor_id || !formData.numero_factura || !formData.fecha_emision) {
        toast({ title: "Campos requeridos", description: "Proveedor, Nº Factura y Fecha son obligatorios.", variant: "destructive" });
        return;
    }
    if (formData.monto_bruto === '' || parseFloat(formData.monto_bruto) < 0) {
        toast({ title: "Base imponible inválida", description: "La base imponible es obligatoria y no puede ser negativa.", variant: "destructive" });
        return;
    }
    
    const dataToSave = {
        proyecto_id: projectId,
        proveedor_id: formData.proveedor_id,
        numero_factura: formData.numero_factura,
        numero_referencia: formData.numero_referencia || null,
        fecha_emision: formData.fecha_emision,
        estado_pago: formData.estado_pago,
        concepto: formData.concepto || null,
        monto_bruto: parseFloat(formData.monto_bruto),
        iva: formData.iva === '' || isNaN(parseFloat(formData.iva)) ? 0.21 : parseFloat(formData.iva)
    };

    onSave(dataToSave);
  };

  return (
      <form onSubmit={handleSubmit} className="space-y-6 p-1">
        <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proveedor_id">Proveedor *</Label>
              <div className="flex gap-2">
                  <div className="flex-1">
                       <ProviderSelect
                        key={selectorKey}
                        value={formData.proveedor_id}
                        onChange={(id, provider) => handleSelectChange('proveedor_id', id)}
                        placeholder="Buscar y seleccionar proveedor..."
                        initialLabel={initialProviderLabel}
                      />
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowNewProvider(true)}
                    className="shrink-0"
                    title="Añadir nuevo proveedor"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Nuevo
                  </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="numero_factura">Nº Factura *</Label><Input id="numero_factura" name="numero_factura" value={formData.numero_factura} onChange={handleFormChange} required /></div>
                <div className="space-y-2"><Label htmlFor="numero_referencia">Nº Referencia</Label><Input id="numero_referencia" name="numero_referencia" value={formData.numero_referencia} onChange={handleFormChange} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="concepto">Concepto</Label><Input id="concepto" name="concepto" value={formData.concepto} onChange={handleFormChange} /></div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="fecha_emision">Fecha Emisión *</Label><Input type="date" id="fecha_emision" name="fecha_emision" value={formData.fecha_emision} onChange={handleFormChange} required /></div>
              <div className="space-y-2"><Label htmlFor="estado_pago">Estado de Pago *</Label><Select name="estado_pago" onValueChange={(v) => handleSelectChange('estado_pago', v)} value={formData.estado_pago}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAGO_STATUS_DB_VALUES.map(s => <SelectItem key={s} value={s}>{PAGO_STATUS_LABELS[s]}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="monto_bruto">Base imponible (€) *</Label>
                    <Input type="number" step="0.01" id="monto_bruto" name="monto_bruto" value={formData.monto_bruto} onChange={handleFormChange} required min="0" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="iva">IVA</Label>
                    <Input type="number" step="0.01" id="iva" name="iva" value={formData.iva} onChange={handleFormChange} placeholder="0.21" />
                    {formData.iva === '' && <p className="text-xs text-muted-foreground mt-1">(se aplicará 21% por defecto)</p>}
                </div>
            </div>
        </div>

        <DialogFooter className="mt-6">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {gastoToEdit ? 'Actualizar Factura' : 'Crear Factura'}
          </Button>
        </DialogFooter>

        <QuickProviderModal 
            isOpen={showNewProvider} 
            onOpenChange={setShowNewProvider} 
            onProviderCreated={handleProviderCreated} 
        />
      </form>
  );
};

const OcrUploadModal = ({ isOpen, onOpenChange, onOcrComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [files, setFiles] = useState([]);

    const onDrop = useCallback(acceptedFiles => {
        setFiles(prev => [...prev, ...acceptedFiles].filter((v,i,a)=>a.findIndex(t=>(t.path === v.path))===i));
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 
            'image/jpeg': ['.jpg', '.jpeg'], 
            'image/png': ['.png'] 
        },
        multiple: true,
    });

    const removeFile = (fileToRemove) => {
        setFiles(prev => prev.filter(file => file !== fileToRemove));
    }

    const handleProcessFile = async () => {
        if (files.length === 0) {
            toast({ title: "No hay archivos", description: "Por favor, selecciona uno o más archivos para procesar.", variant: "destructive" });
            return;
        }
        setIsProcessing(true);
        
        try {
            const uploadPromises = files.map(file => {
                const fileExtension = file.name.split('.').pop();
                const fileName = `${new Date().toISOString()}-${Math.random().toString(36).substring(2, 8)}.${fileExtension}`;
                const filePath = `facturas_ocr/${fileName}`;
                return supabase.storage.from('facturas_ocr').upload(filePath, file).then(({ data, error }) => {
                    if (error) throw new Error(`Error al subir el archivo ${file.name}: ${error.message}`);
                    return data.path;
                });
            });

            const filePaths = await Promise.all(uploadPromises);

            const { data, error: functionError } = await supabase.functions.invoke('process-invoice-ocr', {
                body: { filePaths: filePaths },
            });

            if (functionError) {
                const errorPayload = functionError.context?.error;
                if (errorPayload) {
                    throw new Error(`Error en la función OCR: ${errorPayload.message}`);
                }
                throw new Error(`Error en la función OCR: ${functionError.message}`);
            }

            toast({ title: "¡Factura procesada!", description: "Los datos han sido extraídos con IA." });
            onOcrComplete(data);
            onOpenChange(false);
        } catch (error) {
            console.error("Error en el proceso de OCR:", error);
            toast({ title: "Error de OCR", description: `Hubo un problema al procesar la factura: ${error.message}`, variant: "destructive" });
        } finally {
            setIsProcessing(false);
            setFiles([]);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="text-primary" />
                        Extraer datos de Factura (OCR con IA)
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div {...getRootProps()} className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                        <input {...getInputProps()} />
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <UploadCloud className="w-10 h-10" />
                            {isDragActive ?
                                <p>¡Suelta las imágenes aquí!</p> :
                                <p>Arrastra imágenes JPG/PNG, o haz clic para seleccionarlas.</p>
                            }
                        </div>
                    </div>
                    {files.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            <p className="text-sm font-medium">Archivos seleccionados:</p>
                             {files.map((file, index) => (
                                <div key={index} className="p-2 border rounded-md bg-muted/50 text-sm text-muted-foreground flex items-center justify-between">
                                    <span className="truncate pr-2">{file.name}</span>
                                    <Button variant="ghost" size="icon" onClick={() => removeFile(file)}><X className="w-4 h-4" /></Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => { onOpenChange(false); setFiles([]); }}>Cancelar</Button>
                    <Button onClick={handleProcessFile} disabled={files.length === 0 || isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {isProcessing ? 'Procesando...' : 'Extraer Datos'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const Gastos = ({ projectId, navigate }) => {
    const [totals, setTotals] = useState({ num_facturas: 0, coste_base_imponible: 0, total_con_iva: 0 });
    const [gastos, setGastos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
    const [gastoToEdit, setGastoToEdit] = useState(null);
    const [ocrData, setOcrData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const { sessionRole } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const debouncedSearch = useDebounce(searchTerm, 300);

    const canManageGastos = useMemo(() => ['admin', 'encargado'].includes(sessionRole?.rol), [sessionRole]);

    const fetchData = useCallback(async (search, filter) => {
        if (!projectId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        
        const fetchTotals = supabase
            .from('v_gastos_proyecto_base')
            .select('num_facturas, coste_base_imponible, total_con_iva')
            .eq('proyecto_id', projectId)
            .single();

        const selectString = search
            ? 'id, proyecto_id, proveedor:proveedores!inner(id, nombre), numero_factura, numero_referencia, concepto, fecha_emision, estado_pago, monto_bruto, iva, total_con_iva, gasto_etiquetas_rel(etiqueta:gasto_etiquetas(nombre, color)), facturas_gastos!left(gasto_etiquetas_rel(etiqueta:gasto_etiquetas(nombre, color)))'
            : 'id, proyecto_id, proveedor:proveedores(id, nombre), numero_factura, numero_referencia, concepto, fecha_emision, estado_pago, monto_bruto, iva, total_con_iva, gasto_etiquetas_rel(etiqueta:gasto_etiquetas(nombre, color)), facturas_gastos!left(gasto_etiquetas_rel(etiqueta:gasto_etiquetas(nombre, color)))';

        let gastosQuery = supabase
            .from('gastos')
            .select(selectString)
            .eq('proyecto_id', projectId)
            .order('fecha_emision', { ascending: false });

        if (search) {
            gastosQuery = gastosQuery.ilike('proveedor.nombre', `%${search}%`);
        }
        if (filter && filter !== 'all') {
            gastosQuery = gastosQuery.eq('estado_pago', filter);
        }

        const [totalsResult, gastosResult] = await Promise.all([fetchTotals, gastosQuery]);

        if (totalsResult.error && totalsResult.error.code !== 'PGRST116') {
             toast({ title: 'Error al cargar totales', description: totalsResult.error.message, variant: 'destructive'});
        } else {
            setTotals(totalsResult.data || { num_facturas: 0, coste_base_imponible: 0, total_con_iva: 0 });
        }

        if (gastosResult.error) {
            toast({ title: 'Error al cargar facturas', description: gastosResult.error.message, variant: 'destructive' });
            setGastos([]);
        } else {
            const processedGastos = (gastosResult.data || []).map(g => {
                const directLabels = g.gasto_etiquetas_rel?.map(rel => rel.etiqueta).filter(Boolean) || [];
                let inheritedLabels = [];
                if (Array.isArray(g.facturas_gastos)) {
                     inheritedLabels = g.facturas_gastos.flatMap(fg => 
                        fg.gasto_etiquetas_rel?.map(rel => rel.etiqueta).filter(Boolean) || []
                     );
                } else if (g.facturas_gastos) {
                     inheritedLabels = g.facturas_gastos.gasto_etiquetas_rel?.map(rel => rel.etiqueta).filter(Boolean) || [];
                }

                const allLabels = [...directLabels, ...inheritedLabels];
                const uniqueLabels = [];
                const seen = new Set();
                
                allLabels.forEach(tag => {
                    if (tag && tag.nombre && !seen.has(tag.nombre)) {
                        seen.add(tag.nombre);
                        uniqueLabels.push(tag);
                    }
                });

                return {
                    ...g,
                    etiquetas: uniqueLabels
                };
            });
            setGastos(processedGastos);
        }
        
        setLoading(false);
    }, [projectId]);

    useEffect(() => {
        fetchData(debouncedSearch, statusFilter);
    }, [debouncedSearch, statusFilter, fetchData]);

    const handleSaveGasto = async (gastoData) => {
        setIsSaving(true);
        const isEditing = !!gastoToEdit || !!ocrData;
        
        try {
            const query = (isEditing && gastoToEdit)
                ? supabase.from('gastos').update(gastoData).eq('id', gastoToEdit.id).select()
                : supabase.from('gastos').insert(gastoData).select();
            
            const { data, error } = await query;

            if (error) throw error;

            console.log('Saved Gasto:', data);
            
            toast({ title: `Factura ${isEditing ? 'actualizada' : 'creada'} con éxito`, description: `ID: ${data[0].id}` });
            
            // Immediate refresh
            await fetchData(debouncedSearch, statusFilter);
            
            setIsModalOpen(false);
            setGastoToEdit(null);
            setOcrData(null);
        } catch (error) {
            console.error('Error saving gasto:', error);
            toast({ 
                title: `Error al ${isEditing ? 'actualizar' : 'crear'} la factura`, 
                description: error.message, 
                variant: 'destructive' 
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteGasto = async (gastoId) => {
        try {
            const { error } = await supabase.from('gastos').delete().eq('id', gastoId);
            if (error) throw error;
            
            toast({ title: 'Factura eliminada con éxito' });
            await fetchData(debouncedSearch, statusFilter);
        } catch (error) {
            toast({ title: 'Error al eliminar la factura', description: error.message, variant: 'destructive' });
        }
    };

    const handleOcrComplete = (data) => {
        setOcrData(data);
        setGastoToEdit(null);
        setIsModalOpen(true);
    };
    
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader><CardTitle>Nº Facturas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totals.num_facturas}</p></CardContent></Card>
                <Card><CardHeader><CardTitle>Base Imponible</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(totals.coste_base_imponible)}</p></CardContent></Card>
                <Card><CardHeader><CardTitle>Total con IVA</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(totals.total_con_iva)}</p></CardContent></Card>
            </div>
            
            <Card>
                <CardHeader className="flex flex-wrap items-center justify-between gap-4">
                    <CardTitle>Facturas del Proyecto</CardTitle>
                    {canManageGastos && (
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => navigate ? navigate('/finanzas/escaner') : window.location.href = '/finanzas/escaner'}>
                                <ScanLine className="mr-2 h-4 w-4" /> Escáner Facturas
                            </Button>
                            <Button onClick={() => { setGastoToEdit(null); setOcrData(null); setIsModalOpen(true); }}>
                                <Plus className="mr-2 h-4 w-4" /> Nueva Factura
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4 mb-4">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar por nombre de proveedor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por estado..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los estados</SelectItem>
                                {PAGO_STATUS_DB_VALUES.map(s => <SelectItem key={s} value={s}>{PAGO_STATUS_LABELS[s]}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="relative">
                        <AnimatePresence>
                            {loading && <motion.div initial={{ opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="absolute inset-0 bg-background/50 flex items-center justify-center z-10"><Loader2 className="h-8 w-8 animate-spin" /></motion.div>}
                        </AnimatePresence>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                                    <TableHead>Factura / Proveedor</TableHead>
                                    <TableHead className="hidden md:table-cell">Proveedor</TableHead>
                                    <TableHead>Etiquetas</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    {canManageGastos && <TableHead className="w-[100px] text-right">Acciones</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {gastos.length > 0 ? gastos.map(g => (
                                    <TableRow key={g.id}>
                                        <TableCell className="hidden sm:table-cell">{formatDate(g.fecha_emision)}</TableCell>
                                        <TableCell className="font-medium">
                                            <div>{g.numero_factura}</div>
                                            <div className="md:hidden text-xs text-muted-foreground">{g.proveedor?.nombre || 'N/A'}</div>
                                            <div className="sm:hidden text-[10px] text-muted-foreground">{formatDate(g.fecha_emision)}</div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">{g.proveedor?.nombre || 'N/A'}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {g.etiquetas && g.etiquetas.length > 0 ? (
                                                    g.etiquetas.map((etiqueta, idx) => (
                                                        <Badge 
                                                            key={idx} 
                                                            variant="secondary"
                                                            className={etiqueta.nombre === 'Personal' ? 'bg-blue-500 text-white hover:bg-blue-600 border-none' : ''}
                                                        >
                                                            {etiqueta.nombre}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell><span className={`px-2 py-1 rounded-full text-xs font-medium bg-opacity-20 ${g.estado_pago === 'pagada' ? 'bg-green-500 text-green-800 dark:text-green-300' : (g.estado_pago === 'parcialmente_pagada' ? 'bg-blue-500 text-blue-800 dark:text-blue-300' : 'bg-yellow-500 text-yellow-800 dark:text-yellow-300')}`}>{PAGO_STATUS_LABELS[g.estado_pago] || g.estado_pago}</span></TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(g.total_con_iva)}</TableCell>
                                        {canManageGastos && (
                                            <TableCell className="text-right">
                                                 <AlertDialog>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => { setGastoToEdit(g); setOcrData(null); setIsModalOpen(true); }}>
                                                                <Edit className="mr-2 h-4 w-4"/>Editar
                                                            </DropdownMenuItem>
                                                            <AlertDialogTrigger asChild>
                                                              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4"/>Eliminar</DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <AlertDialogContent>
                                                      <AlertDialogHeader><AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará permanentemente la factura. Escribe ELIMINAR para confirmar.</AlertDialogDescription></AlertDialogHeader>
                                                      <Input id="delete-confirm-input" placeholder="ELIMINAR" className="my-2" />
                                                      <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => {
                                                            if (document.getElementById('delete-confirm-input').value === 'ELIMINAR') {
                                                                handleDeleteGasto(g.id);
                                                            } else {
                                                                toast({ title: 'Confirmación incorrecta', variant: 'destructive'});
                                                            }
                                                        }} className="bg-destructive hover:bg-destructive/90">Confirmar</AlertDialogAction>
                                                      </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={canManageGastos ? 7 : 6} className="text-center h-24">No hay facturas registradas en esta obra.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={(isOpen) => { if(!isOpen) { setGastoToEdit(null); setOcrData(null); } setIsModalOpen(isOpen); }}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{gastoToEdit ? 'Editar Factura' : (ocrData ? 'Revisar Factura de OCR' : 'Nueva Factura')}</DialogTitle>
                    </DialogHeader>
                    <GastoForm 
                        onSave={handleSaveGasto} 
                        onCancel={() => { setIsModalOpen(false); setGastoToEdit(null); setOcrData(null); }} 
                        isSaving={isSaving}
                        context="project"
                        projectId={projectId}
                        gastoToEdit={gastoToEdit}
                        ocrData={ocrData}
                    />
                </DialogContent>
            </Dialog>

            <OcrUploadModal
                isOpen={isOcrModalOpen}
                onOpenChange={setIsOcrModalOpen}
                onOcrComplete={handleOcrComplete}
            />
        </div>
    );
};

export default Gastos;